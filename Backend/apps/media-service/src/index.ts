import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { mediaRoutes } from './media/media.routes';
import { initializeConsumers } from './events/consumers';
import { UPLOAD_DIR } from './storage/storage';

/**
 * Media Service — :3009. Owns `media`, `media_albums`, and the unified `/uploads` pipeline
 * (docs/modeldocs/media-model.md & Spec §5.11.1).
 */

const NAME = 'media-service';
const PORT = parseInt(process.env.PORT || '3009', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        // Unified static file delivery under /uploads
        app.use(
            '/uploads',
            express.static(UPLOAD_DIR, {
                maxAge: '7d',
                immutable: true,
                index: false,
                dotfiles: 'deny',
                setHeaders: (res) => {
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                },
            })
        );

        app.use('/media', mediaRoutes);
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
