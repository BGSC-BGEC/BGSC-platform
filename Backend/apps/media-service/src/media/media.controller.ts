import { NextFunction, Request, Response } from 'express';
import { ServiceError, wrap } from '@bgsc/shared';
import { mediaService, Viewer } from './media.service';
import {
    CreateAlbumInput,
    ListAlbumsQuery,
    ListMediaQuery,
    ModerateMediaInput,
    PageQuery,
    UpdateMediaInput,
    UploadMediaQuery,
} from './media.schemas';
import { ACCEPTED_CONTENT_TYPES, IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from '../storage/storage';

/**
 * Thin: the routes validate (`validate()` → 422), `requireActiveUser` loads the live actor for
 * every write (`req.actor`), and these call the service.
 */

const idOf = (req: Request): string => (req.params as Record<string, string>).id;
const viewerOf = (req: Request): Viewer | null => (req.user ? { id: req.user.id, role: req.user.role } : null);

/**
 * Refuse an oversized upload from its headers, before a byte is buffered. Images have a tighter
 * ceiling than video, and the declared type is only used to pick it — the service re-checks
 * against the sniffed type. No Content-Length (a chunked body) is refused: the ceiling cannot be
 * applied to a length nobody declared. A type we never accept is a 415 here, not an empty body later.
 */
export function declaredSize(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers['content-length'];
    const length = Number(header);
    if (header === undefined || !Number.isFinite(length)) {
        res.status(411).json({ error: 'length_required' });
        return;
    }
    // `raw()` below skips any other type, which would reach the handler as an empty body (a 422).
    const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!ACCEPTED_CONTENT_TYPES.includes(type)) {
        res.status(415).json({ error: 'unsupported_media_type' });
        return;
    }
    const isImage = type.startsWith('image/');
    if (length > (isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES)) {
        res.status(413).json({ error: isImage ? 'image_payload_too_large' : 'payload_too_large' });
        return;
    }
    next();
}

export const uploadMedia = wrap(async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        return void res
            .status(422)
            .json({ error: 'validation_failed', fields: [{ key: 'body', code: 'empty' }] });
    }

    const media = await mediaService.uploadMedia(req.actor!, body, req.query as unknown as UploadMediaQuery);
    res.status(201).json(media);
});

export const listMedia = wrap(async (req, res) => {
    res.json(await mediaService.listMedia(req.query as unknown as ListMediaQuery, viewerOf(req)));
});

export const getMedia = wrap(async (req, res) => {
    res.json(await mediaService.getMediaById(idOf(req), viewerOf(req)));
});

/** Headers first: `sendFile` keeps a Content-Type or Cache-Control that is already set. */
export const getMediaFile = wrap(async (req, res) => {
    const { path, mime } = await mediaService.getMediaFile(idOf(req), viewerOf(req));
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    // `.pending/` is a dot-directory, which `send` refuses by default; the path comes from the
    // stored row and is already confined to the upload root.
    await new Promise<void>((resolve, reject) =>
        res.sendFile(path, { dotfiles: 'allow' }, (err) =>
            err && !res.headersSent ? reject(new ServiceError(404, 'media_not_found')) : resolve()
        )
    );
});

export const updateMedia = wrap(async (req, res) => {
    res.json(await mediaService.updateMedia(idOf(req), req.actor!, req.body as UpdateMediaInput));
});

export const deleteMedia = wrap(async (req, res) => {
    res.json(await mediaService.deleteMedia(idOf(req), req.actor!));
});

export const createAlbum = wrap(async (req, res) => {
    res.status(201).json(await mediaService.createAlbum(req.actor!, req.body as CreateAlbumInput));
});

export const listAlbums = wrap(async (req, res) => {
    res.json(await mediaService.listAlbums(req.query as unknown as ListAlbumsQuery, viewerOf(req)));
});

export const getAlbum = wrap(async (req, res) => {
    res.json(await mediaService.getAlbumById(idOf(req), viewerOf(req)));
});

export const listPendingModeration = wrap(async (req, res) => {
    res.json(await mediaService.listPendingModeration(req.query as unknown as PageQuery, viewerOf(req)!));
});

export const moderateMedia = wrap(async (req, res) => {
    res.json(await mediaService.moderateMedia(idOf(req), req.actor!, req.body as ModerateMediaInput));
});

export const toggleLike = wrap(async (req, res) => {
    res.json(await mediaService.toggleLike(idOf(req), { id: req.actor!._id, role: req.actor!.role }));
});
