import { Request, Response } from 'express';
import { wrap, Event, ServiceError, User, UserStatus } from '@bgsc/shared';
import * as svc from './event.service';
import { TERMINAL_STATUSES, assertEventAdmin } from './access';
import { deleteObject, putObject, sniffImage } from '../storage/storage';
import { invalidateAuctionLiveCache } from '../auction/cache';

/**
 * The actor for a guarded write: the document `requireActiveUser` loaded, not the token's claim —
 * the claim stays valid for up to fifteen minutes after a demotion.
 * Every write route mounts `requireActiveUser`.
 */
const writeActor = (req: Request) => ({ id: req.actor!._id, role: req.actor!.role });
/**
 * The live viewer on an optional-auth read that shows admins more (participants, their stats): the token's
 * role could be fifteen minutes stale. A deleted or suspended account reads as the public.
 */
const liveViewer = async (req: Request) => {
    if (!req.user) return undefined;
    const u = await User.findOne({ _id: req.user.id, deleted_at: null, status: UserStatus.ACTIVE }, { role: 1 }).lean();
    return u ? { id: u._id, role: u.role } : undefined;
};
const refOf = (req: Request) => (req.params as Record<string, string>).ref;

export const create = wrap(async (req: Request, res: Response) => {
    res.status(201).json(await svc.createEvent(writeActor(req), req.body));
});

export const list = wrap(async (req: Request, res: Response) => {
    res.json(await svc.listEvents(req.query as never, req.user));
});

export const get = wrap(async (req: Request, res: Response) => {
    res.json(await svc.findByRef(refOf(req), req.user));
});

export const update = wrap(async (req: Request, res: Response) => {
    res.json(await svc.updateEvent(refOf(req), writeActor(req), req.body));
});

export const remove = wrap(async (req: Request, res: Response) => {
    res.json(await svc.deleteEvent(refOf(req), writeActor(req)));
});

export const uploadMedia = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const event = await svc.findByRef(refOf(req), actor);
    assertEventAdmin(event, actor);
    // Past and cancelled events are records; their media is frozen with them.
    if (TERMINAL_STATUSES.includes(event.status)) throw new ServiceError(409, 'event_is_terminal');

    const kind = req.query.type ?? 'cover';
    if (kind !== 'cover' && kind !== 'logo') {
        return void res.status(422).json({ error: 'validation_failed', fields: [{ key: 'type', code: 'not_cover_or_logo' }] });
    }

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        return void res.status(422).json({ error: 'validation_failed', fields: [{ key: 'body', code: 'empty' }] });
    }

    const mime = sniffImage(body);
    if (!mime) {
        return void res.status(415).json({ error: 'unsupported_media_type', fields: [{ key: 'body', code: 'not_jpg_png_webp' }] });
    }

    const targetType = kind === 'logo' ? 'logo_url' : 'cover_media_url';
    const stored = await putObject(event._id, body, mime);

    // A targeted `$set`, not `save()`: one field changes, and a full save re-validated the whole
    // document just to swap an image URL. The replaced file is removed (only if it is one of ours,
    // and not still shown as the other image: cover and logo may point at the same file).
    const otherType = kind === 'logo' ? 'cover_media_url' : 'logo_url';
    const before = await Event.findOneAndUpdate(
        { _id: event._id },
        { $set: { [targetType]: stored.url } },
        { projection: { logo_url: 1, cover_media_url: 1 } }
    ).lean();
    const replaced = (before?.[targetType] as string | null | undefined) ?? null;
    if (replaced !== before?.[otherType]) await deleteObject(event._id, replaced);
    invalidateAuctionLiveCache(event._id);

    res.status(201).json({ url: stored.url, type: targetType, bytes: stored.bytes, mime: stored.mime });
});

export const eligibility = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getEventEligibility(refOf(req), req.user!.id));
});

export const myRegistration = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getMyEventRegistration(refOf(req), req.user!.id));
});

export const participants = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getEventParticipants(refOf(req), req.query as never, await liveViewer(req)));
});

export const participantStats = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getEventParticipantStats(refOf(req), await liveViewer(req)));
});

export const waitlist = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getEventWaitlist(refOf(req), writeActor(req)));
});

export const promoteWaitlist = wrap(async (req: Request, res: Response) => {
    const registrationId = (req.params as Record<string, string>).registrationId;
    res.json(await svc.promoteWaitlistedParticipant(refOf(req), registrationId, writeActor(req)));
});

export const getAttendance = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getEventAttendance(refOf(req), writeActor(req)));
});

export const recordAttendance = wrap(async (req: Request, res: Response) => {
    // `{ attendances: [...] }`, enforced by the route's schema.
    res.json(await svc.recordEventAttendance(refOf(req), req.body.attendances, writeActor(req)));
});

export const listCaptains = wrap(async (req: Request, res: Response) => {
    res.json(await svc.listEventCaptains(refOf(req), req.user));
});

export const addCaptain = wrap(async (req: Request, res: Response) => {
    res.json(await svc.addEventCaptain(refOf(req), req.body.user_id, writeActor(req)));
});

export const removeCaptain = wrap(async (req: Request, res: Response) => {
    const userId = (req.params as Record<string, string>).userId;
    res.json(await svc.removeEventCaptain(refOf(req), userId, writeActor(req)));
});
