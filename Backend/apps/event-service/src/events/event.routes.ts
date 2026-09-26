import { Router, raw } from 'express';
import { requireActiveUser, requireAuth, optionalAuth, validate, UserRole } from '@bgsc/shared';
import * as c from './event.controller';
import { eventAuctionRoutes } from '../auction/auction.routes';
import {
    CreateEventSchema,
    ManageCaptainSchema,
    QueryEventsSchema,
    QueryParticipantsSchema,
    RecordAttendanceSchema,
    RefParamSchema,
    UpdateEventSchema,
} from './event.schemas';
import { IMAGE_MAX_BYTES } from '../storage/storage';

export const eventRoutes = Router();

// Public / Authenticated Browse
eventRoutes.get('/', optionalAuth, validate({ query: QueryEventsSchema }), c.list);
eventRoutes.get('/:ref', optionalAuth, validate({ params: RefParamSchema }), c.get);

// Registration Workflow & Eligibility
eventRoutes.get('/:ref/eligibility', requireAuth, validate({ params: RefParamSchema }), c.eligibility);
eventRoutes.get('/:ref/my-registration', requireAuth, validate({ params: RefParamSchema }), c.myRegistration);

// Event Participants Management
eventRoutes.get('/:ref/participants/stats', optionalAuth, validate({ params: RefParamSchema }), c.participantStats);
eventRoutes.get('/:ref/participants', optionalAuth, validate({ params: RefParamSchema, query: QueryParticipantsSchema }), c.participants);

// Event Waitlist Management
eventRoutes.get('/:ref/waitlist', requireAuth, requireActiveUser(UserRole.CORE), validate({ params: RefParamSchema }), c.waitlist);
eventRoutes.post(
    '/:ref/waitlist/:registrationId/promote',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    c.promoteWaitlist
);

// Event Attendance Tracking
eventRoutes.get('/:ref/attendance', requireAuth, requireActiveUser(UserRole.CORE), validate({ params: RefParamSchema }), c.getAttendance);
// The body is validated too: `RecordAttendanceSchema` existed in event.schemas.ts and was never
// wired, so a malformed body reached the service and surfaced as a 500 instead of a 422, and the
// array was uncapped — one request could drive an unbounded number of queries.
eventRoutes.post(
    '/:ref/attendance',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: RefParamSchema, body: RecordAttendanceSchema }),
    c.recordAttendance
);

// League Captains Management
eventRoutes.get('/:ref/captains', optionalAuth, validate({ params: RefParamSchema }), c.listCaptains);
eventRoutes.post(
    '/:ref/captains',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: RefParamSchema, body: ManageCaptainSchema }),
    c.addCaptain
);
eventRoutes.delete('/:ref/captains/:userId', requireAuth, requireActiveUser(UserRole.CORE), c.removeCaptain);

// Auction Sub-routes (:ref/auction/*)
eventRoutes.use('/:ref/auction', eventAuctionRoutes);

// Management (Core / Admin)
// Writes rank the LIVE user document, not the token's role claim: a token outlives a demotion or a
// suspension by up to fifteen minutes (adding-a-service.md §6.2). Admin reads of an event's
// registrations (waitlist, attendance) do too, and are scoped to the event's admins.
eventRoutes.post('/', requireAuth, requireActiveUser(UserRole.CORE), validate({ body: CreateEventSchema }), c.create);
eventRoutes.patch(
    '/:ref',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: RefParamSchema, body: UpdateEventSchema }),
    c.update
);
// Delete a draft: Core+ who administers it (model doc §5); the service checks the event-level right.
eventRoutes.delete('/:ref', requireAuth, requireActiveUser(UserRole.CORE), validate({ params: RefParamSchema }), c.remove);

// Media Upload (Poster / Logo). Event admins only — any signed-in user could replace any published
// event's cover; the service checks the event-level right.
eventRoutes.post(
    '/:ref/media',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: RefParamSchema }),
    raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: IMAGE_MAX_BYTES }),
    c.uploadMedia
);
