import { Router, raw } from 'express';
import { requireAuth, optionalAuth, requireRole, UserRole } from '@bgsc/shared';
import * as ctrl from './media.controller';

export const mediaRoutes = Router();

// Upload route: raw binary stream up to 50MB
mediaRoutes.post(
    '/upload',
    requireAuth,
    raw({
        limit: '50mb',
        type: ['image/*', 'video/*', 'application/octet-stream', '*/*'],
    }),
    ctrl.uploadMedia
);

// Albums
mediaRoutes.get('/albums', optionalAuth, ctrl.listAlbums);
mediaRoutes.post('/albums', requireAuth, requireRole(UserRole.CORE), ctrl.createAlbum);
mediaRoutes.get('/albums/:id', optionalAuth, ctrl.getAlbum);

// Moderation
mediaRoutes.get(
    '/moderation/pending',
    requireAuth,
    requireRole(UserRole.CORE),
    ctrl.listPendingModeration
);
mediaRoutes.patch(
    '/:id/moderate',
    requireAuth,
    requireRole(UserRole.CORE),
    ctrl.moderateMedia
);

// Interactions & Details
mediaRoutes.post('/:id/like', requireAuth, ctrl.toggleLike);
mediaRoutes.get('/:id', optionalAuth, ctrl.getMedia);
mediaRoutes.patch('/:id', requireAuth, ctrl.updateMedia);
mediaRoutes.delete('/:id', requireAuth, ctrl.deleteMedia);

// Public Gallery
mediaRoutes.get('/', optionalAuth, ctrl.listMedia);
