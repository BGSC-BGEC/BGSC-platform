import express from 'express';
import { createServiceApp, startService } from '@bgsc/shared';

/**
 * Auth Service — :3001. BE-1's (MVP plan Week 1 Sunday: JWT, register, login, password reset,
 * token refresh, email verification).
 *
 * This is a skeleton so the gateway has something to route to and the topology is complete. The
 * bootstrap, health check, index build, error envelope and shutdown all come from @bgsc/shared —
 * BE-1 only writes routes.
 *
 * To add the real thing:
 *   1. create src/auth/auth.routes.ts exporting `authRoutes`
 *   2. uncomment the two lines below
 *   3. sign access tokens as { sub: <user _id>, role } with HS256 — see docs/handoff-to-be1.md §2
 */

const NAME = 'auth-service';
const PORT = parseInt(process.env.PORT || '3001', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(_app: express.Express) {
        // import { authRoutes } from './auth/auth.routes';
        // _app.use('/auth', authRoutes);
    },
};

export const app = createServiceApp(options);
export const start = () => startService(app, options);

if (require.main === module) {
    start().catch((err) => {
        console.error(`[${NAME}] Fatal: failed to start:`, err);
        process.exit(1);
    });
}
