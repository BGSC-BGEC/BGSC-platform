import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { formRoutes } from './forms/form.routes';
import { registrationRoutes } from './registrations/registration.routes';
import { teamRoutes } from './teams/team.routes';
import { internalRoutes } from './internal/internal.routes';
import { initializeConsumers } from './events/consumers';
import { startSweeps } from './events/sweeps';
import { migrateLegacyUploads } from './storage/storage';

/**
 * Registration Service — :3004. Common registration service for events, challenges,
 * and anything form-shaped. Owns form_definitions, form_submissions, form_uploads and teams.
 *
 * Uploaded files are PRIVATE: written under `config.uploadDir/.private/registrations/` (a dot-dir
 * media's static handler never serves) and read back only through the authed
 * `GET /registrations/:id/files/:field_key`.
 */

const NAME = 'registration-service';
const PORT = parseInt(process.env.PORT || '3004', 10);

const options = {
    name: NAME,
    port: PORT,
    // Only the collections this service writes get their indexes built here.
    models: ['FormDefinition', 'FormDefinitionVersion', 'FormSubmission', 'FormUpload', 'Team', 'TeamMembership'],
    routes(app: express.Express) {
        app.use('/forms', formRoutes);
        app.use('/registrations', registrationRoutes);
        app.use('/teams', teamRoutes);
        // Service-to-service only. The gateway also refuses /internal from the edge.
        app.use('/internal', internalRoutes);
    },
    async onReady() {
        // Files earlier builds left under the public /uploads tree move to the private one.
        const moved = await migrateLegacyUploads();
        if (moved) console.log(`[${NAME}] moved ${moved} legacy registration upload(s) to private storage`);
        // Event bus consumers: waitlist promotion, roster locks, user snapshots.
        initializeConsumers();
        // And the same work re-derived from state, for events the bus dropped.
        startSweeps();
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
