import { Request, Response } from 'express';
import { wrap, ServiceError } from '@bgsc/shared';
import * as svc from './event.service';
import { putObject, sniffImage, IMAGE_MAX_BYTES } from '../storage/storage';

export const create = wrap(async (req: Request, res: Response) => {
    const actor = req.user!;
    const event = await svc.createEvent(actor, req.body);
    res.status(201).json(event);
});

export const list = wrap(async (req: Request, res: Response) => {
    const viewer = req.user;
    const result = await svc.listEvents(req.query as never, viewer);
    res.json(result);
});

export const get = wrap(async (req: Request, res: Response) => {
    const viewer = req.user;
    const ref = (req.params as Record<string, string>).ref;
    const event = await svc.findByRef(ref, viewer);
    res.json(event);
});

export const update = wrap(async (req: Request, res: Response) => {
    const actor = req.user!;
    const ref = (req.params as Record<string, string>).ref;
    const updated = await svc.updateEvent(ref, actor, req.body);
    res.json(updated);
});

export const remove = wrap(async (req: Request, res: Response) => {
    const actor = req.user!;
    const ref = (req.params as Record<string, string>).ref;
    const result = await svc.deleteEvent(ref, actor);
    res.json(result);
});

export const uploadMedia = wrap(async (req: Request, res: Response) => {
    const actor = req.user!;
    const ref = (req.params as Record<string, string>).ref;
    const event = await svc.findByRef(ref, actor);

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        return void res.status(422).json({ error: 'validation_failed', fields: [{ key: 'body', code: 'empty' }] });
    }
    if (body.length > IMAGE_MAX_BYTES) {
        return void res.status(413).json({ error: 'payload_too_large' });
    }

    const mime = sniffImage(body);
    if (!mime) {
        return void res.status(415).json({ error: 'unsupported_media_type', fields: [{ key: 'body', code: 'not_jpg_png_webp' }] });
    }

    const targetType = (req.query.type as string) === 'logo' ? 'logo_url' : 'cover_media_url';
    const stored = await putObject(`events/${event._id}`, body, mime);

    event[targetType] = stored.url;
    await event.save();

    res.status(201).json({ url: stored.url, type: targetType, bytes: stored.bytes, mime: stored.mime });
});

export const eligibility = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const userId = req.user!.id;
    const result = await svc.getEventEligibility(ref, userId);
    res.json(result);
});

export const myRegistration = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const userId = req.user!.id;
    const result = await svc.getMyEventRegistration(ref, userId);
    res.json(result);
});

export const participants = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const viewer = req.user;
    const result = await svc.getEventParticipants(ref, req.query as never, viewer);
    res.json(result);
});

export const participantStats = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const viewer = req.user;
    const result = await svc.getEventParticipantStats(ref, viewer);
    res.json(result);
});

export const waitlist = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const viewer = req.user;
    const result = await svc.getEventWaitlist(ref, viewer);
    res.json(result);
});

export const promoteWaitlist = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const registrationId = (req.params as Record<string, string>).registrationId;
    const actor = req.user!;
    const adminOverride = req.body?.admin_override ?? false;
    const result = await svc.promoteWaitlistedParticipant(ref, registrationId, actor, adminOverride);
    res.json(result);
});

export const getAttendance = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const viewer = req.user;
    const result = await svc.getEventAttendance(ref, viewer);
    res.json(result);
});

export const recordAttendance = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const actor = req.user!;
    const attendances = Array.isArray(req.body.attendances)
        ? req.body.attendances
        : [req.body];
    const result = await svc.recordEventAttendance(ref, attendances, actor);
    res.json(result);
});

export const listCaptains = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const result = await svc.listEventCaptains(ref);
    res.json(result);
});

export const addCaptain = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const actor = req.user!;
    const result = await svc.addEventCaptain(ref, req.body.user_id, actor);
    res.json(result);
});

export const removeCaptain = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const userId = (req.params as Record<string, string>).userId;
    const actor = req.user!;
    const result = await svc.removeEventCaptain(ref, userId, actor);
    res.json(result);
});
