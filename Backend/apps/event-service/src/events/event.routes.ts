import { Router, raw } from 'express';
import { requireActiveUser, requireAuth, optionalAuth, requireRole, validate, UserRole } from '@bgsc/shared';
import * as c from './event.controller';
import {
    CreateEventSchema,
    ManageCaptainSchema,
    PromoteWaitlistSchema,
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
eventRoutes.get('/:ref/waitlist', requireAuth, requireRole(UserRole.CORE), validate({ params: RefParamSchema }), c.waitlist);
eventRoutes.post(
    '/:ref/waitlist/:registrationId/promote',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: PromoteWaitlistSchema }),
    c.promoteWaitlist
);

// Event Attendance Tracking
eventRoutes.get('/:ref/attendance', requireAuth, requireRole(UserRole.CORE), validate({ params: RefParamSchema }), c.getAttendance);
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

// Management (Core / Admin)
// Writes rank the LIVE user document, not the token's role claim: a token outlives a demotion or a
// suspension by up to fifteen minutes (adding-a-service.md §6.2). Reads below keep `requireRole` —
// a stale read is not a damage path. (Whole-backend audit, Sep 27.)
eventRoutes.post('/', requireAuth, requireActiveUser(UserRole.CORE), validate({ body: CreateEventSchema }), c.create);
eventRoutes.patch('/:ref', requireAuth, validate({ params: RefParamSchema, body: UpdateEventSchema }), c.update);
eventRoutes.delete('/:ref', requireAuth, requireActiveUser(UserRole.COORDINATOR), validate({ params: RefParamSchema }), c.remove);

// Media Upload (Poster / Logo)
eventRoutes.post(
    '/:ref/media',
    requireAuth,
    validate({ params: RefParamSchema }),
    raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: IMAGE_MAX_BYTES }),
    c.uploadMedia
);
