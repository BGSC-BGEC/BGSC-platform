import { Router, raw } from 'express';
import { requireAuth, optionalAuth, requireRole, validate, UserRole } from '@bgsc/shared';
import * as c from './event.controller';
import {
    CreateEventSchema,
    UpdateEventSchema,
    QueryEventsSchema,
    RefParamSchema,
    QueryParticipantsSchema,
    PromoteWaitlistSchema,
    ManageCaptainSchema,
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
    requireRole(UserRole.CORE),
    validate({ body: PromoteWaitlistSchema }),
    c.promoteWaitlist
);

// Event Attendance Tracking
eventRoutes.get('/:ref/attendance', requireAuth, requireRole(UserRole.CORE), validate({ params: RefParamSchema }), c.getAttendance);
eventRoutes.post('/:ref/attendance', requireAuth, requireRole(UserRole.CORE), validate({ params: RefParamSchema }), c.recordAttendance);

// League Captains Management
eventRoutes.get('/:ref/captains', optionalAuth, validate({ params: RefParamSchema }), c.listCaptains);
eventRoutes.post(
    '/:ref/captains',
    requireAuth,
    requireRole(UserRole.CORE),
    validate({ params: RefParamSchema, body: ManageCaptainSchema }),
    c.addCaptain
);
eventRoutes.delete('/:ref/captains/:userId', requireAuth, requireRole(UserRole.CORE), c.removeCaptain);

// Management (Core / Admin)
eventRoutes.post('/', requireAuth, requireRole(UserRole.CORE), validate({ body: CreateEventSchema }), c.create);
eventRoutes.patch('/:ref', requireAuth, validate({ params: RefParamSchema, body: UpdateEventSchema }), c.update);
eventRoutes.delete('/:ref', requireAuth, requireRole(UserRole.COORDINATOR), validate({ params: RefParamSchema }), c.remove);

// Media Upload (Poster / Logo)
eventRoutes.post(
    '/:ref/media',
    requireAuth,
    validate({ params: RefParamSchema }),
    raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: IMAGE_MAX_BYTES }),
    c.uploadMedia
);
