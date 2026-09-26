import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import path from 'path';
import { mediaRoutes } from './media/media.routes';
import { initializeConsumers } from './events/consumers';
import { UPLOAD_DIR } from './storage/storage';

/**
 * Media Service — :3009. Owns `media`, `media_albums`, `media_likes`, and is the ONE server of
 * `/uploads` for the whole platform (docs/modeldocs/media-model.md, Spec §5.11.1).
 *
 * `UPLOAD_DIR` is `config.uploadDir`: user avatars, event images and registration files are
 * written there by their own services under their own prefixes, and served from here — the
 * gateway routes every `/uploads` request to this service.
 */

const MEDIA_ROOT = path.join(path.resolve(UPLOAD_DIR), 'media') + path.sep;

const NAME = 'media-service';
const PORT = parseInt(process.env.PORT || '3009', 10);

const options = {
    name: NAME,
    port: PORT,
    models: ['Media', 'MediaAlbum', 'MediaLike'],
    routes(app: express.Express) {
        app.use(
            '/uploads',
            express.static(UPLOAD_DIR, {
                maxAge: '7d',
                immutable: true,
                index: false,
                // `ignore`, not `deny`: the pending tree is `.pending/`, and it must answer 404 like
                // any other missing file — a 403 would confirm an unapproved upload exists.
                dotfiles: 'ignore',
                setHeaders: (res, filePath) => {
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    // Gallery files can be withdrawn (a re-moderated edit, a rejection), so a
                    // week-long immutable cache would keep serving them from every browser and CDN
                    // after moderation said no. Other prefixes keep the long cache: their names
                    // are uuids that never change meaning.
                    if (filePath.startsWith(MEDIA_ROOT)) res.setHeader('Cache-Control', 'public, max-age=300');
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
