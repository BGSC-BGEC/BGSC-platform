import { UserRole, optionalAuth, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as c from './announcement.controller';
import { requireActiveUser } from './actor';
import {
    CreateAnnouncementSchema,
    IdParams,
    ListAnnouncementsQuery,
    PublishAnnouncementSchema,
    UpdateAnnouncementSchema,
} from './announcement.schemas';

/**
 * ORDER MATTERS. `/heads` and `/unread-count` are the same shape as `/:id` to Express, which
 * matches in declaration order — declared after it, they resolve as lookups for announcements
 * with those ids.
 *
 * `optionalAuth`, not `requireAuth`, on every read: Spec §1 and §5.2 make announcements readable
 * by guests, and the gateway already verifies a token when one is present without ever rejecting.
 *
 * Writes use `requireActiveUser(floor)` rather than `requireRole(floor)`: it ranks the live user
 * document, not the token's role claim, which can be up to 15 minutes stale (actor.ts).
 */

export const announcementRoutes = Router();

// ---- literal paths, before /:id -------------------------------------------
announcementRoutes.get('/heads', optionalAuth, c.getHeads);
announcementRoutes.get('/unread-count', requireAuth, c.getUnreadCount);
announcementRoutes.post('/read-all', requireAuth, requireActiveUser(), c.markAllRead);

// ---- feed ------------------------------------------------------------------
announcementRoutes.get('/', optionalAuth, validate({ query: ListAnnouncementsQuery }), c.listAnnouncements);

// ---- composer (Spec §6.4; "Core with permission" collapses to core+, plan §D5) ----
announcementRoutes.post(
    '/',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: CreateAnnouncementSchema }),
    c.createAnnouncement
);

announcementRoutes.post(
    '/:id/publish',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: IdParams, body: PublishAnnouncementSchema }),
    c.publishAnnouncement
);

announcementRoutes.post(
    '/:id/unschedule',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: IdParams }),
    c.unscheduleAnnouncement
);

announcementRoutes.post('/:id/read', requireAuth, requireActiveUser(), validate({ params: IdParams }), c.markRead);

announcementRoutes.patch(
    '/:id',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: IdParams, body: UpdateAnnouncementSchema }),
    c.updateAnnouncement
);

announcementRoutes.delete(
    '/:id',
    requireAuth,
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: IdParams }),
    c.deleteAnnouncement
);

announcementRoutes.get(
    '/:id/audit',
    requireAuth,
    // Founder-only: audit rows carry actor IPs and naming, which is sensitive even within the
    // coordinator rank. A coordinator needing a coarse "who did what" view asks a founder.
    requireActiveUser(UserRole.FOUNDER),
    validate({ params: IdParams }),
    c.auditForAnnouncement
);

// Parameterised read last, so none of the literal paths above is swallowed by it.
announcementRoutes.get('/:id', optionalAuth, validate({ params: IdParams }), c.getAnnouncement);
