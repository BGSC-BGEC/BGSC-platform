import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/env';
import { connectDB, disconnectDB, getDBStatus } from './config/db';
import { assertInternalTokenConfigured } from './middleware/requireServiceToken';
import { ZodError } from 'zod';
import { ServiceError } from './errors';
import { issuesOf } from './middleware/validate';
import { connectEventBus, disconnectEventBus } from './events/publish';

/**
 * Every service boots identically: cors, json, security headers, /health, 404, error handler,
 * index build, process guards, graceful shutdown. Writing that eleven times is eleven chances to
 * forget the one that matters — the fail-closed health check, or awaiting the index build.
 *
 * A service supplies its name, port and routes; everything else is the same by construction.
 */

export interface ServiceOptions {
    name: string;
    port: number;
    /** Mount routers, static dirs, anything service-specific. Runs before the 404 handler. */
    routes: (app: Express) => void;
    /** Extra work after the DB is up and indexes are built, before listening. */
    onReady?: () => Promise<void>;
    /**
     * Mongoose model names this service OWNS (relationships.md §1). Only these get their indexes
     * built at boot. Omitted = every registered model (the old behaviour).
     */
    models?: string[];
}

/**
 * One success envelope for every service: `{ success: true, data: <payload> }`.
 *
 * Auth Service wrapped its responses and the others returned bare objects, so a client behind the
 * gateway had to know which service it was talking to before it could read a response. Done here
 * rather than at ~60 call sites because a rule enforced in one place cannot be forgotten in a
 * handler written next week.
 *
 * Deliberately left alone:
 *  - failures, which already carry `error` and stay `{ error, details? }` — the error handler owns
 *    that shape, and wrapping it would make every client unwrap twice to find out something broke;
 *  - anything a handler already wrapped, so a hand-written envelope is not nested inside another;
 *  - `/health`, which orchestrators and the compose healthcheck parse as-is.
 */
export function successEnvelope(req: Request, res: Response, next: NextFunction): void {
    if (req.path === '/health') return next();

    const json = res.json.bind(res);
    res.json = (body: unknown) => json(isEnveloped(body) ? body : { success: true, data: body ?? null });
    next();
}

/**
 * Already an envelope: an error (`error` is a string code) or an explicit success envelope
 * (`success: true` AND `data`). The test used to be "has a top-level `success` or `error` key", which
 * let a payload like `{ success: true, count: 3 }` or `{ error: null, value: 1 }` through unwrapped
 * — the first with no `data`, the second reading as a failure (audit Sep 26).
 */
export function isEnveloped(body: unknown): boolean {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
    const b = body as { success?: unknown; error?: unknown };
    return typeof b.error === 'string' || (b.success === true && 'data' in b);
}

/** Largest unread body drained before an early reply: above media's 50MB upload cap. */
const DRAIN_CAP_BYTES = 64 * 1024 * 1024;
const DRAIN_TIMEOUT_MS = 15_000;

/**
 * Read the rest of an unread request body before replying.
 *
 * A route that refuses an upload before reading it (bad or expired token, 413/415 pre-checks)
 * answers while the gateway is still streaming the body; Node then closes the socket, the gateway's
 * next write fails with EPIPE before it has read the reply, and the client got a 502 instead of the
 * 401 that tells it to refresh its token. Draining first lets the real answer through.
 *
 * ponytail: bounded by Content-Length (64MB) and 15s; chunked bodies with no length are answered at
 * once with `Connection: close` (they can still race). Upgrade path: reject early at the gateway.
 */
export function drainUnreadBody(req: Request, res: Response, next: NextFunction): void {
    const end = res.end;
    res.end = function (this: Response, ...args: unknown[]) {
        const reply = () => end.apply(this, args as Parameters<typeof end>);
        if (req.complete || req.readableEnded) return reply();
        const declared = Number(req.headers['content-length']);
        if (!(declared <= DRAIN_CAP_BYTES)) {
            if (!this.headersSent) this.setHeader('Connection', 'close');
            return reply();
        }
        let sent = false;
        const once = () => {
            if (sent) return;
            sent = true;
            clearTimeout(timer);
            reply();
        };
        const timer = setTimeout(once, DRAIN_TIMEOUT_MS);
        timer.unref();
        req.once('end', once);
        req.once('close', once);
        req.once('error', once);
        req.resume();
        return this;
    } as typeof res.end;
    next();
}

export function createServiceApp(opts: ServiceOptions): Express {
    const app = express();
    // One proxy hop (the gateway). `req.ip` then reflects the client's `X-Forwarded-For`
    // instead of the loopback, which is what audit-log `ip` columns want.
    app.set('trust proxy', 1);

    app.use(drainUnreadBody);
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(successEnvelope);

    // nosniff matters most where a service serves user-supplied bytes from its own origin.
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        next();
    });

    // The gateway and any orchestrator poll this. Every route needs Mongo, so reporting ok without
    // a database keeps traffic arriving at an instance that can only return 500s.
    app.get('/health', (_req: Request, res: Response) => {
        const db = getDBStatus();
        const healthy = db === 'connected';
        res.status(healthy ? 200 : 503).json({
            status: healthy ? 'ok' : 'degraded',
            service: opts.name,
            db,
            env: config.nodeEnv,
            uptime_s: Math.round(process.uptime()),
        });
    });

    opts.routes(app);

    app.use((_req: Request, res: Response) => {
        res.status(404).json({ error: 'not_found' });
    });

    app.use(errorHandler(opts.name));

    return app;
}

/**
 * The one error handler every service mounts. Exported so it can be checked directly, the way the
 * rest of the shared middleware is — no server, no sockets.
 *
 * Four args: Express identifies an error handler by arity, so `_next` must stay.
 */
export function errorHandler(serviceName: string) {
    return function (err: Error, _req: Request, res: Response, _next: NextFunction): void {
        // A ServiceError is a deliberate, client-facing refusal. Mapping it centrally means a
        // handler cannot forget and turn a 409 into a 500.
        if (err instanceof ServiceError) {
            res.status(err.status).json(
                err.details === undefined ? { error: err.code } : { error: err.code, details: err.details }
            );
            return;
        }

        // body-parser rejects a malformed or oversized body before any route sees it, tagging the
        // error `expose: true` with a 4xx status. Falling through to 500 told the client that its
        // own bad request was a server fault — so it retries something that can never succeed, and
        // the noise lands in this service's error log instead of the caller's.
        //
        // `expose` is the gate rather than the status alone: it is http-errors' own marker for
        // "this message is safe to show the client", so nothing internal leaks through it.
        const parseErr = err as Error & { status?: number; expose?: boolean; type?: string };
        if (parseErr.expose === true && typeof parseErr.status === 'number' && parseErr.status < 500) {
            res.status(parseErr.status).json({
                error: parseErr.type === 'entity.too.large' ? 'payload_too_large' : 'malformed_body',
            });
            return;
        }

        // A ZodError that escaped `validate()` (a handler calling `schema.parse` itself) is still the
        // client's bad input, not a server fault.
        if (err instanceof ZodError) {
            res.status(422).json({ error: 'validation_failed', fields: issuesOf(err) });
            return;
        }

        // The router's own decode failure (`/users/%E0%A4%A`) is a URIError tagged 400 with no
        // `expose` — it fell through to 500 and logged a stack for a malformed URL.
        if (err instanceof URIError) {
            res.status(400).json({ error: 'bad_request' });
            return;
        }

        console.error(`[${serviceName}] Unhandled error:`, err);
        res.status(500).json({ error: 'internal_error' });
    };
}

/**
 * Build every registered model's indexes before serving, and wait for it.
 *
 * autoIndex builds in the background with no completion signal, so early requests can run against
 * collections whose unique indexes do not exist yet. `form_submissions` relies on one to reject
 * duplicate registrations and `point_transactions` on one to make replayed events idempotent —
 * miss the window and both silently allow doubles. An index that will not build is fatal: serving
 * without it means serving without the guarantee it encodes.
 */
export async function buildIndexes(serviceName: string, owned?: string[]): Promise<void> {
    // Only the models this service owns. Building all of them made one bad collection (a duplicate
    // slug blocking a unique index) a boot failure for every service on the platform.
    const names = owned && owned.length > 0 ? owned : mongoose.modelNames();
    await Promise.all(
        names.map(async (name) => {
            try {
                await mongoose.model(name).createIndexes();
            } catch (err) {
                throw new Error(`Failed to build indexes for ${name}: ${(err as Error).message}`);
            }
        })
    );
    console.log(`[${serviceName}] Indexes ready for ${names.length} models.`);
}

function installProcessGuards(name: string): void {
    // Node's default is to kill the process on an unhandled rejection. Route errors already funnel
    // through the error handler, so one reaching here is a bug worth shouting about — but not worth
    // dropping every in-flight request for. An uncaught exception is different: state may be
    // corrupt, so exit and let the supervisor restart cleanly.
    process.on('unhandledRejection', (reason) => {
        console.error(`[${name}] UNHANDLED REJECTION (request continues, but this is a bug):`, reason);
    });
    process.on('uncaughtException', (err) => {
        console.error(`[${name}] UNCAUGHT EXCEPTION, exiting:`, err);
        process.exit(1);
    });
}

export async function startService(app: Express, opts: ServiceOptions): Promise<void> {
    assertInternalTokenConfigured();
    installProcessGuards(opts.name);

    await connectDB();
    await buildIndexes(opts.name, opts.models);
    // No-op without REDIS_URL, which is the right behaviour for a single service in dev and tests.
    await connectEventBus();
    if (opts.onReady) await opts.onReady();

    const server = app.listen(opts.port, () => {
        console.log(`[${opts.name}] listening on :${opts.port} (${config.nodeEnv})`);
    });

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.on(signal, () => {
            console.log(`[${opts.name}] ${signal} received, shutting down.`);
            server.close(async () => {
                await disconnectEventBus();
                await disconnectDB();
                process.exit(0);
            });
        });
    }
}
