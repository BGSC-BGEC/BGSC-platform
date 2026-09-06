import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { config } from './config/env';
import { connectDB, disconnectDB, getDBStatus } from './config/db';
import { userRoutes, internalRoutes } from './users/user.routes';
import { UPLOAD_DIR } from './storage/storage';
import { assertInternalTokenConfigured } from './middleware/requireServiceToken';
import { ServiceError } from './users/user.service';
import './models';   // register every schema before buildIndexes() enumerates them

/**
 * Server entrypoint. The MVP plan assigns this to nobody (see docs/be2-user-service-plan.md §11.5);
 * BE-2 wrote it because both Sunday tasks are blocked without it.
 *
 * BE-1: mount the Auth Service at the marked line below. Auth middleware already exists —
 * `middleware/requireAuth.ts` — and the access-token payload contract is documented there.
 */

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));

/**
 * `nosniff` matters most for /uploads: those are user-supplied bytes served from our own origin, so
 * a browser that content-sniffs its way to text/html would execute them as a same-origin page.
 * Magic-byte validation already blocks non-images; this closes the sniffing path behind it.
 * Applied globally because a JSON API has no reason to be sniffed or framed either.
 */
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Avatar upload reads a raw image body instead of multipart — see be2-user-service-plan.md §6.
// It is mounted per-route, not here, so it cannot swallow ordinary JSON requests.

// Local-disk uploads. Week 4's Media Service replaces this with S3/R2 + CDN (Spec §15.2).
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h', index: false, dotfiles: 'deny' }));

app.get('/health', (_req: Request, res: Response) => {
    const db = getDBStatus();
    // Every route needs Mongo, so "process is up" is not health. Reporting ok without a database
    // keeps a load balancer routing traffic to an instance that can only return 500s.
    const healthy = db === 'connected';
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db,
        env: config.nodeEnv,
        uptime_s: Math.round(process.uptime()),
    });
});

// ---- routers -------------------------------------------------------------
// BE-1 (Auth Service): uncomment when src/auth/auth.routes.ts lands.
// import { authRoutes } from './auth/auth.routes';
// app.use('/auth', authRoutes);

// BE-2 (User Service):
app.use('/users', userRoutes);
app.use('/internal', internalRoutes);
// --------------------------------------------------------------------------

app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
});

// Four args: Express identifies the error handler by arity, so `_next` must stay even though unused.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // A ServiceError is a deliberate, client-facing refusal. Mapping it here rather than in each
    // handler means a route cannot forget and turn a 409 into a 500.
    if (err instanceof ServiceError) {
        res.status(err.status).json({ error: err.code });
        return;
    }
    // Never return `err.message` for anything else — it leaks stack traces, driver errors and query shapes.
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'internal_error' });
});

/**
 * Build every model's indexes before serving, and wait for it.
 *
 * Mongoose's autoIndex builds in the background with no completion signal, so early requests can
 * run against a collection whose unique indexes do not exist yet. That is not a slow-start
 * annoyance: `form_submissions` relies on a unique index to reject duplicate registrations
 * (registration-model.md §3.2 — "The DB, not the app"), and `point_transactions` relies on one to
 * make replayed domain events idempotent. Miss the window and both silently allow doubles.
 *
 * createIndexes is additive and idempotent — unlike syncIndexes, it will not drop an index another
 * service created outside the schema. An index that cannot be built is fatal: serving without it
 * means serving without the guarantee it encodes.
 */
async function buildIndexes(): Promise<void> {
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
    console.log(`Indexes ready for ${names.length} models.`);
}

/**
 * Node's default for an unhandled rejection is to throw, which takes the whole API down for one
 * stray promise somewhere. Route errors already funnel through wrap() into the error handler, so a
 * rejection reaching here is a bug worth shouting about — but not worth dropping every in-flight
 * request for. An uncaught exception is different: process state may be corrupt, so log and exit
 * and let the supervisor restart cleanly.
 */
function installProcessGuards(): void {
    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED REJECTION (request continues, but this is a bug):', reason);
    });
    process.on('uncaughtException', (err) => {
        console.error('UNCAUGHT EXCEPTION, exiting:', err);
        process.exit(1);
    });
}

export async function start(): Promise<void> {
    assertInternalTokenConfigured();
    installProcessGuards();
    await connectDB();

    await buildIndexes();
    const server = app.listen(config.port, () => {
        console.log(`API listening on :${config.port} (${config.nodeEnv})`);
    });

    // Without this, nodemon's restart signal leaves the Mongo connection and the port held.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.on(signal, () => {
            console.log(`${signal} received, shutting down.`);
            server.close(async () => {
                await disconnectDB();
                process.exit(0);
            });
        });
    }
}

if (require.main === module) {
    start().catch((err) => {
        console.error('Fatal: server failed to start:', err);
        process.exit(1);
    });
}
