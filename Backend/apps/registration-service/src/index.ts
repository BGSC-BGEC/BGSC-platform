import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { formRoutes } from './forms/form.routes';
import { registrationRoutes } from './registrations/registration.routes';
import { teamRoutes } from './teams/team.routes';
import { internalRoutes } from './internal/internal.routes';
import { initializeConsumers } from './events/consumers';
import { UPLOAD_DIR } from './storage/storage';

/**
 * Registration Service — :3004. Common registration service for events, challenges,
 * and anything form-shaped. Owns form_definitions, form_submissions, and teams.
 */

const NAME = 'registration-service';
const PORT = parseInt(process.env.PORT || '3004', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        // Local-disk uploads. Week 4's Media Service replaces this with S3/R2 + CDN (Spec §15.2).
        app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h', index: false, dotfiles: 'deny' }));

        app.use('/forms', formRoutes);
        app.use('/registrations', registrationRoutes);
        app.use('/teams', teamRoutes);
        // Service-to-service only. The gateway also refuses /internal from the edge.
        app.use('/internal', internalRoutes);
    },
    async onReady() {
        // Event bus consumers: waitlist promotion on a released seat.
        initializeConsumers();
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
