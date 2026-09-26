import { IAnnouncement, UserRole, rankOf, wrap } from '@bgsc/shared';
import { Request } from 'express';
import * as svc from './announcement.service';
import { markAllRead as markAllReadInStore, markRead as markReadInStore, unreadCount, withUnread } from './reads';
import { actorOf, userOf } from './actor';
import { Viewer, viewerFor } from './audience';
import {
    CreateAnnouncementInput,
    ListAnnouncementsInput,
    PublishAnnouncementInput,
    UpdateAnnouncementInput,
} from './announcement.schemas';

/** HTTP only. Data access, guards and domain events live in announcement.service.ts. */

/** Sees drafts and scheduled items. Ranked against the shared ladder, not a name list. */
const isAdmin = (req: Request) => !!req.user && rankOf(req.user.role) >= rankOf(UserRole.CORE);

/**
 * The response shape, in one place. `delivery` is the composer's view of the WhatsApp/push fan-out —
 * masked group ids and provider error strings — so only core+ gets it. `__v` is
 * Mongoose's bookkeeping, not API. Takes a lean object or a hydrated document.
 */
type Presented = Record<string, unknown> & Pick<IAnnouncement, '_id' | 'published_at'>;
function present(a: IAnnouncement, composer: boolean): Presented {
    const plain = (typeof a.toObject === 'function' ? a.toObject() : a) as unknown as Presented;
    const { __v, delivery, ...rest } = plain;
    return (composer ? { ...rest, delivery } : rest) as Presented;
}

/**
 * The per-card unread dot. Omitted entirely for a guest rather than sent as `unread: true` on
 * everything — a guest has no read state to be behind on.
 */
const decorate = (v: Viewer, cards: Presented[]): Promise<unknown[]> =>
    v.id ? withUnread(v.id, cards) : Promise.resolve(cards);

/* ---- feed ---------------------------------------------------------------- */

export const listAnnouncements = wrap(async (req, res) => {
    const v = await viewerFor(req.user);
    const { announcements, next_cursor } = await svc.list(
        v,
        req.query as unknown as ListAnnouncementsInput,
        isAdmin(req)
    );
    const cards = announcements.map((a) => present(a, isAdmin(req)));
    res.json({ announcements: await decorate(v, cards), next_cursor });
});

export const getHeads = wrap(async (req, res) => {
    const heads = await svc.heads(await viewerFor(req.user));
    res.json(heads.map((h) => ({ ...h, announcement: h.announcement && present(h.announcement, false) })));
});

export const getUnreadCount = wrap(async (req, res) => {
    res.json({ count: await unreadCount(await viewerFor(req.user)) });
});

export const getAnnouncement = wrap(async (req, res) => {
    const v = await viewerFor(req.user);
    const a = await svc.get(req.params.id as string, v, isAdmin(req));
    const [decorated] = await decorate(v, [present(a, isAdmin(req))]);
    res.json(decorated);
});

/* ---- composer ------------------------------------------------------------ */

export const createAnnouncement = wrap(async (req, res) => {
    const a = await svc.create(req.body as CreateAnnouncementInput, userOf(res), actorOf(res));
    res.status(201).json(present(a, true));
});

export const updateAnnouncement = wrap(async (req, res) => {
    res.json(present(await svc.update(req.params.id as string, req.body as UpdateAnnouncementInput, actorOf(res)), true));
});

export const publishAnnouncement = wrap(async (req, res) => {
    const { scheduled_for } = req.body as PublishAnnouncementInput;
    res.json(present(await svc.publishOrSchedule(req.params.id as string, scheduled_for, actorOf(res)), true));
});

export const unscheduleAnnouncement = wrap(async (req, res) => {
    res.json(present(await svc.unschedule(req.params.id as string, actorOf(res)), true));
});

export const deleteAnnouncement = wrap(async (req, res) => {
    await svc.remove(req.params.id as string, actorOf(res));
    res.status(204).end();
});

/** Append-only history of every write against one announcement. Founder only — the rows carry
 *  actor IPs and identities, which is sensitive beyond the coordinator rank. */
export const auditForAnnouncement = wrap(async (req, res) => {
    res.json({ entries: await svc.auditTrail(req.params.id as string) });
});

/* ---- read tracking ------------------------------------------------------- */

export const markRead = wrap(async (req, res) => {
    await markReadInStore(req.user!.id, req.params.id as string);
    res.status(204).end();
});

export const markAllRead = wrap(async (req, res) => {
    res.json({ last_seen_at: await markAllReadInStore(req.user!.id) });
});
