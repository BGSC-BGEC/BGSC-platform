import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { eventRoutes } from './events/event.routes';
import { internalRoutes } from './internal/internal.routes';
import { initializeConsumers } from './events/consumers';
import { UPLOAD_DIR } from './storage/storage';

/**
 * Event Service — :3003. Event lifecycle, categories, registration gates, and live bracket/auction config.
 */
const NAME = 'event-service';
const PORT = parseInt(process.env.PORT || '3003', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        // Local-disk uploads for posters/logos (Week 4 Media Service replaces this with CDN)
        app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h', index: false, dotfiles: 'deny' }));

        app.use('/events', eventRoutes);
        // Inter-service routes protected by requireServiceToken
        app.use('/internal', internalRoutes);
    },
    async onReady() {
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
