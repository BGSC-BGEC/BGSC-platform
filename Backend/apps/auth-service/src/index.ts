import express from 'express';
import { createServiceApp, startService } from '@bgsc/shared';
import { authRoutes, accountRoutes } from './auth/auth.routes';
import { AuthService } from './auth/auth.service';

/** UserRestored replay cadence. */
export const REPLAY_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Auth Service — :3001. Credentials, sessions, email/phone verification, password reset, Google
 * OAuth, and account reactivation (Spec §11.1).
 *
 * Converted Sep 8, 2026 from `Backend/src/auth`, where it had been written against the old
 * single-app layout and imported '../models/User' and '../config/env' — paths that stopped
 * existing at the microservice split, so it never compiled. Everything it needs now comes from
 * @bgsc/shared, and the bootstrap, health check, index build, error envelope and shutdown are the
 * same ones every other service gets from createServiceApp/startService.
 *
 * Account lifecycle split (Sep 8): User Service owns deletion — DELETE /users/me, with the
 * retention-consent gate. This service owns getting back in, because a deleted user holds no
 * token. `GET /auth/me` and `POST /account/delete` were removed upstream for the same reason.
 */

const NAME = 'auth-service';
const PORT = parseInt(process.env.PORT || '3001', 10);

const options = {
    name: NAME,
    port: PORT,
    // Shares `users` with User Service (auth fields here, profile fields there).
    models: ['User'],
    routes(app: express.Express) {
        app.use('/auth', authRoutes);
        // Its own prefix, matching the gateway's routing table rather than nesting under /auth.
        app.use('/account', accountRoutes);
    },
    async onReady() {
        // ponytail: in-process timer in every instance; replays are idempotent, so N instances only
        // cost N× the publishes. unref'd so it never holds the process open.
        setInterval(() => {
            AuthService.replayRestored().catch((err) => console.error(`[${NAME}] UserRestored replay failed:`, err));
        }, REPLAY_INTERVAL_MS).unref();
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
