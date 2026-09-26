import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { announcementRoutes } from './announcements/announcement.routes';
import { internalRoutes } from './internal/internal.routes';
import { initializeConsumers } from './events/consumers';
import { startScheduler } from './scheduler/tick';

/**
 * Announcement Service — :3005. Owns `announcements` and the per-user read state on the User
 * document. Editorial broadcast only: no comments, no reactions.
 *
 * Makes no outbound service calls. Everything it needs from another domain is a read, and reads
 * go straight to the model.
 */

const NAME = 'announcement-service';
const PORT = parseInt(process.env.PORT || '3005', 10);

const options = {
    name: NAME,
    port: PORT,
    // Only its own collection's indexes are built at boot. It also writes `users.announcements.*`,
    // but `users` belongs to User Service, which builds that collection's indexes.
    models: ['Announcement'],
    routes(app: express.Express) {
        app.use('/announcements', announcementRoutes);
        // Service-to-service only: the gateway refuses /internal from the edge and the router
        // mounts requireServiceToken. One caller — the Notification Service's delivery writeback.
        app.use('/internal', internalRoutes);
    },
    async onReady() {
        // Author snapshot refresh.
        initializeConsumers();
        // Scheduled -> published, published -> archived, archived -> purged.
        startScheduler();
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
