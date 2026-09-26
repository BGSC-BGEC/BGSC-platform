import { Router, raw } from 'express';
import { requireAuth, optionalAuth, requireActiveUser, requireRole, validate, UserRole } from '@bgsc/shared';
import * as ctrl from './media.controller';
import {
    AlbumRefParams,
    CreateAlbumSchema,
    ListAlbumsQuerySchema,
    ListMediaQuerySchema,
    MediaIdParams,
    ModerateMediaSchema,
    PageQuerySchema,
    UpdateMediaSchema,
    UploadMediaQuerySchema,
} from './media.schemas';
import { ACCEPTED_CONTENT_TYPES, VIDEO_MAX_BYTES } from '../storage/storage';

/**
 * Every write runs `requireActiveUser`: it ranks the LIVE user document, so a suspended or
 * demoted account stops uploading, moderating and auto-approving the moment it changes — not
 * when its token expires. Reads keep the token (`optionalAuth` / `requireRole`), where a stale
 * answer is not a damage path.
 */
export const mediaRoutes = Router();

// Upload: validate the query and the declared size BEFORE the body is buffered.
mediaRoutes.post(
    '/upload',
    requireAuth,
    requireActiveUser(),
    validate({ query: UploadMediaQuerySchema }),
    ctrl.declaredSize,
    // `inflate: false`: a gzip body is refused (415), never expanded — the limit would otherwise be
    // on the inflated bytes, and a few KB of zip bomb is 50MB of buffer.
    raw({ limit: VIDEO_MAX_BYTES, type: ACCEPTED_CONTENT_TYPES, inflate: false }),
    ctrl.uploadMedia
);

// Albums
mediaRoutes.get('/albums', optionalAuth, validate({ query: ListAlbumsQuerySchema }), ctrl.listAlbums);
mediaRoutes.post(
    '/albums',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: CreateAlbumSchema }),
    ctrl.createAlbum
);
mediaRoutes.get('/albums/:id', optionalAuth, validate({ params: AlbumRefParams }), ctrl.getAlbum);

// Moderation
mediaRoutes.get(
    '/moderation/pending',
    requireAuth,
    requireRole(UserRole.CORE),
    validate({ query: PageQuerySchema }),
    ctrl.listPendingModeration
);
mediaRoutes.patch(
    '/:id/moderate',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: MediaIdParams, body: ModerateMediaSchema }),
    ctrl.moderateMedia
);

// Interactions & Details
mediaRoutes.post('/:id/like', requireAuth, requireActiveUser(), validate({ params: MediaIdParams }), ctrl.toggleLike);
// The file itself, for whoever may see the item — the only way to a pending file (moderator preview,
// uploader's own view); an approved one is also at its public `/uploads` URL.
mediaRoutes.get('/:id/file', requireAuth, validate({ params: MediaIdParams }), ctrl.getMediaFile);
mediaRoutes.get('/:id', optionalAuth, validate({ params: MediaIdParams }), ctrl.getMedia);
mediaRoutes.patch(
    '/:id',
    requireAuth,
    requireActiveUser(),
    validate({ params: MediaIdParams, body: UpdateMediaSchema }),
    ctrl.updateMedia
);
mediaRoutes.delete('/:id', requireAuth, requireActiveUser(), validate({ params: MediaIdParams }), ctrl.deleteMedia);

// Public Gallery
mediaRoutes.get('/', optionalAuth, validate({ query: ListMediaQuerySchema }), ctrl.listMedia);
