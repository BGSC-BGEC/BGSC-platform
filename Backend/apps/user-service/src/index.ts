import express from 'express';
import { createServiceApp, startService, config } from '@bgsc/shared';
import { userRoutes, internalRoutes } from './users/user.routes';
import { UPLOAD_DIR } from './storage/storage';

/**
 * User Service — :3002. Owns everything about a user after signup (Spec §5.3, §5.15.5).
 * Auth, token issuance and the login flow are the Auth Service's, not this one's.
 */

const NAME = 'user-service';
const PORT = parseInt(process.env.PORT || '3002', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        // Local-disk uploads. Week 4's Media Service replaces this with S3/R2 + CDN (Spec §15.2).
        app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h', index: false, dotfiles: 'deny' }));
        app.use('/users', userRoutes);
        // Service-to-service only. The gateway also refuses /internal from the edge.
        app.use('/internal', internalRoutes);
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
