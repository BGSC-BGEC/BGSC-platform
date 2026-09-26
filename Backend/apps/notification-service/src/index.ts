import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { reportConfiguration } from './broadcast/whatsapp';
import { initializeConsumers } from './events/consumers';
import { notificationRoutes } from './notifications/notification.routes';
import { startScheduler } from './scheduler/tick';

/**
 * Notification Service — :3010. Owns `notifications`, `notification_dispatches` and
 * `notification_preferences` (docs/modeldocs/notification-model.md).
 *
 * Two jobs: the in-app inbox a client reads, and the broadcast machinery behind it — fan-out on
 * `AnnouncementPublished`, WhatsApp delivery per category (Spec §9.4), and the delivery receipt
 * written back onto the announcement document.
 *
 * One outbound call in the whole service: `PATCH /internal/announcements/:id/delivery`, because
 * `announcements` belongs to another service and a receipt is a write. Everything else it needs
 * from another domain is a read, and reads go straight to the model (adding-a-service.md §6.5).
 *
 * No `/internal` routes of its own: nothing calls this service.
 */

const NAME = 'notification-service';
const PORT = parseInt(process.env.PORT || '3010', 10);

const options = {
    name: NAME,
    port: PORT,
    // The collections this service owns — only their indexes are built at boot.
    models: ['Notification', 'NotificationDispatch', 'NotificationPreference', 'NotificationRateSlot'],
    routes(app: express.Express) {
        app.use('/notifications', notificationRoutes);
    },
    async onReady() {
        // One line saying what this deployment can actually send, including a group map whose keys
        // do not match any announcement category — otherwise that tag silently never broadcasts.
        reportConfiguration();
        // Broadcast, retraction and the per-user triggers.
        initializeConsumers();
        // Retry failed sends, reconcile broadcasts lost to a bus outage, catch up writebacks.
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
