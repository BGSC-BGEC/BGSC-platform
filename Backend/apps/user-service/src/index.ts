import express from 'express';
import { createServiceApp, startService } from '@bgsc/shared';
import { userRoutes } from './users/user.routes';
import { replayDeleted } from './users/user.service';

/** UserDeleted replay cadence. */
export const REPLAY_INTERVAL_MS = 5 * 60 * 1000;

/**
 * User Service — :3002. Owns everything about a user after signup (Spec §5.3, §5.15.5).
 * Auth, token issuance and the login flow are the Auth Service's, not this one's.
 */

const NAME = 'user-service';
const PORT = parseInt(process.env.PORT || '3002', 10);

const options = {
    name: NAME,
    port: PORT,
    // AuditLog too: this service reads it for the admin audit view, and no other service lists it.
    models: ['User', 'AuditLog'],
    routes(app: express.Express) {
        // Avatars are written under config.uploadDir/avatars; media-service is the only thing that
        // serves `/uploads` (the gateway routes it there). No static mount here.
        app.use('/users', userRoutes);
    },
    async onReady() {
        // ponytail: in-process timer in every instance; replays are idempotent, so N instances only
        // cost N× the publishes. unref'd so it never holds the process open.
        setInterval(() => {
            replayDeleted().catch((err) => console.error(`[${NAME}] UserDeleted replay failed:`, err));
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
