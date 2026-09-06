import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/env';
import { connectDB, disconnectDB, getDBStatus } from './config/db';
import { assertInternalTokenConfigured } from './middleware/requireServiceToken';
import { ServiceError } from './errors';
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
}

export function createServiceApp(opts: ServiceOptions): Express {
    const app = express();

    app.use(cors({ origin: config.corsOrigin, credentials: true }));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));

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

    // Four args: Express identifies the error handler by arity, so `_next` must stay.
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        // A ServiceError is a deliberate, client-facing refusal. Mapping it centrally means a
        // handler cannot forget and turn a 409 into a 500.
        if (err instanceof ServiceError) {
            res.status(err.status).json({ error: err.code });
            return;
        }
        console.error(`[${opts.name}] Unhandled error:`, err);
        res.status(500).json({ error: 'internal_error' });
    });

    return app;
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
export async function buildIndexes(serviceName: string): Promise<void> {
    const names = mongoose.modelNames();
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
    await buildIndexes(opts.name);
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
