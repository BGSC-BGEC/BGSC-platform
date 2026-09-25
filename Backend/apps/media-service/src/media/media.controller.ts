import { wrap, ServiceError } from '@bgsc/shared';
import { mediaService } from './media.service';
import {
    UploadMediaQuerySchema,
    ListMediaQuerySchema,
    CreateAlbumSchema,
    UpdateMediaSchema,
    ModerateMediaSchema,
} from './media.schemas';

export const uploadMedia = wrap(async (req, res) => {
    if (!req.user) {
        throw new ServiceError(401, 'unauthorized');
    }

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        return void res
            .status(422)
            .json({ error: 'validation_failed', fields: [{ key: 'body', code: 'empty' }] });
    }

    const query = UploadMediaQuerySchema.parse(req.query);
    const media = await mediaService.uploadMedia(req.user, body, query);

    res.status(201).json(media);
});

export const listMedia = wrap(async (req, res) => {
    const query = ListMediaQuerySchema.parse(req.query);
    const result = await mediaService.listMedia(query, req.user || null);
    res.json(result);
});

export const getMedia = wrap(async (req, res) => {
    const id = req.params.id as string;
    const media = await mediaService.getMediaById(id);
    res.json(media);
});

export const updateMedia = wrap(async (req, res) => {
    if (!req.user) throw new ServiceError(401, 'unauthorized');
    const id = req.params.id as string;
    const input = UpdateMediaSchema.parse(req.body);
    const media = await mediaService.updateMedia(id, req.user, input);
    res.json(media);
});

export const deleteMedia = wrap(async (req, res) => {
    if (!req.user) throw new ServiceError(401, 'unauthorized');
    const id = req.params.id as string;
    const result = await mediaService.deleteMedia(id, req.user);
    res.json(result);
});

export const createAlbum = wrap(async (req, res) => {
    if (!req.user) throw new ServiceError(401, 'unauthorized');
    const input = CreateAlbumSchema.parse(req.body);
    const album = await mediaService.createAlbum(req.user.id, input);
    res.status(201).json(album);
});

export const listAlbums = wrap(async (req, res) => {
    const result = await mediaService.listAlbums(req.query, req.user || null);
    res.json(result);
});

export const getAlbum = wrap(async (req, res) => {
    const id = req.params.id as string;
    const album = await mediaService.getAlbumById(id);
    res.json(album);
});

export const listPendingModeration = wrap(async (req, res) => {
    const result = await mediaService.listPendingModeration(req.query);
    res.json(result);
});

export const moderateMedia = wrap(async (req, res) => {
    if (!req.user) throw new ServiceError(401, 'unauthorized');
    const id = req.params.id as string;
    const input = ModerateMediaSchema.parse(req.body);
    const media = await mediaService.moderateMedia(id, req.user, input);
    res.json(media);
});

export const toggleLike = wrap(async (req, res) => {
    const id = req.params.id as string;
    const result = await mediaService.toggleLike(id);
    res.json(result);
});
