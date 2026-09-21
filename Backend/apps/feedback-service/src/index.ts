import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { initializeConsumers } from './events/consumers';
import { contactRoutes, feedbackRoutes } from './feedback/feedback.routes';

/**
 * Feedback Service — :3011. Owns `feedback_tickets` and `feedback_throttle`
 * (docs/modeldocs/feedback-model.md).
 *
 * Spec §5.12's ticket system: bug reports, feature requests, event complaints and contact-us, with
 * an anonymous option that is actually anonymous — no reporter, no actor and no address in the
 * audit trail (be2-feedback-bracket-plan.md D10).
 *
 * Makes no outbound service calls. The one thing it wants from another domain — telling staff a
 * ticket arrived — goes out as `FeedbackSubmitted` on the bus, because the Notification Service
 * already knows who staff are and how to reach them.
 */

const NAME = 'feedback-service';
const PORT = parseInt(process.env.PORT || '3011', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        app.use('/feedback', feedbackRoutes);
        app.use('/contact', contactRoutes);
    },
    async onReady() {
        // A reporter's name follows them: renamed on a profile edit, erased when the account goes.
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
