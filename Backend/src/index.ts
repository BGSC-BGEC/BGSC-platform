import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { connectDB, disconnectDB, getDBStatus } from './config/db';

/**
 * Server entrypoint. The MVP plan assigns this to nobody (see docs/be2-user-service-plan.md §11.5);
 * BE-2 wrote it because both Sunday tasks are blocked without it.
 *
 * BE-1: mount the Auth Service at the marked line below. Auth middleware already exists —
 * `middleware/requireAuth.ts` — and the access-token payload contract is documented there.
 */

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Avatar upload reads a raw image body instead of multipart — see be2-user-service-plan.md §6.
// It is mounted per-route, not here, so it cannot swallow ordinary JSON requests.

app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        db: getDBStatus(),
        env: config.nodeEnv,
        uptime_s: Math.round(process.uptime()),
    });
});

// ---- routers -------------------------------------------------------------
// BE-1 (Auth Service): uncomment when src/auth/auth.routes.ts lands.
// import { authRoutes } from './auth/auth.routes';
// app.use('/auth', authRoutes);

// BE-2 (User Service): uncomment when src/users/user.routes.ts lands (Phase B).
// import { userRoutes } from './users/user.routes';
// app.use('/users', userRoutes);
// --------------------------------------------------------------------------

app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
});

// Four args: Express identifies the error handler by arity, so `_next` must stay even though unused.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // Never return `err.message` to the client — it leaks stack traces, driver errors and query shapes.
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'internal_error' });
});

export async function start(): Promise<void> {
    await connectDB();
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
