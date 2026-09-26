import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { eventRoutes } from './events/event.routes';
import { auctionRoutes } from './auction/auction.routes';
import { internalRoutes } from './internal/internal.routes';
import { initializeConsumers } from './events/consumers';
import { startScheduler } from './events/scheduler';

/**
 * Event Service — :3003. Event lifecycle, categories, registration gates, and live bracket/auction config.
 *
 * No `/uploads` static mount: posters and logos are written under the shared upload root and Media
 * Service is the one thing that serves `/uploads` (the gateway already routes it there).
 */
const NAME = 'event-service';
const PORT = parseInt(process.env.PORT || '3003', 10);

const options = {
    name: NAME,
    port: PORT,
    // The collections this service owns; only their indexes are built here.
    models: ['Event', 'AuctionLot'],
    routes(app: express.Express) {
        app.use('/events', eventRoutes);
        app.use('/auction', auctionRoutes);
        // Inter-service routes protected by requireServiceToken
        app.use('/internal', internalRoutes);
    },
    async onReady() {
        initializeConsumers();
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
