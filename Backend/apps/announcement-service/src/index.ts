import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { announcementRoutes } from './announcements/announcement.routes';
import { initializeConsumers } from './events/consumers';
import { startScheduler } from './scheduler/tick';

/**
 * Announcement Service — :3005. Owns `announcements` and the per-user read state on the User
 * document. Editorial broadcast only: no comments, no reactions.
 *
 * Makes no outbound service calls. Everything it needs from another domain is a read, and reads
 * go straight to the model (be2-announcement-service-plan.md §0.3).
 */

const NAME = 'announcement-service';
const PORT = parseInt(process.env.PORT || '3005', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        app.use('/announcements', announcementRoutes);
        // No /internal: nothing calls this service. Week 4's Broadcast Service adds
        // PATCH /internal/announcements/:id/delivery when there is a caller for it (plan §D7).
    },
    async onReady() {
        // Author snapshot refresh.
        initializeConsumers();
        // Scheduled -> published, published -> archived, archived -> purged (plan §6).
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
