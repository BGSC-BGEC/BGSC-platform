import { UserRole, optionalAuth, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import { requireActiveUser } from './actor';
import * as c from './feedback.controller';
import {
    ListTicketsQuery,
    SubmitContactSchema,
    SubmitFeedbackSchema,
    TicketNoParams,
    UpdateSeveritySchema,
    UpdateStatusSchema,
} from './feedback.schemas';

/**
 * Mounted at `/feedback`. Spec §5.12 marks the page **Public**, so submission takes `optionalAuth`:
 * a signed-in reporter is attributed, a signed-out one is anonymous, and neither is turned away.
 * What keeps that from being a spam hose is the per-submitter cap in the service, not a login.
 *
 * ORDER MATTERS. `/me` is the same shape as `/:ticket_no` to Express, which matches in declaration
 * order — declared after it, it would resolve as a lookup for a ticket numbered "me".
 */
export const feedbackRoutes = Router();

feedbackRoutes.post('/', optionalAuth, validate({ body: SubmitFeedbackSchema }), c.submitFeedback);

// ---- literal path, before /:ticket_no ------------------------------------
feedbackRoutes.get('/me', requireAuth, validate({ query: ListTicketsQuery }), c.listMine);

// ---- the staff inbox ------------------------------------------------------
feedbackRoutes.get(
    '/',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ query: ListTicketsQuery }),
    c.listInbox
);

feedbackRoutes.patch(
    '/:ticket_no/status',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: TicketNoParams, body: UpdateStatusSchema }),
    c.updateStatus
);

feedbackRoutes.patch(
    '/:ticket_no/severity',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: TicketNoParams, body: UpdateSeveritySchema }),
    c.updateSeverity
);

// Parameterised read last. `optionalAuth`: for an anonymous ticket the number IS the credential,
// which is how the receipt email works.
feedbackRoutes.get('/:ticket_no', optionalAuth, validate({ params: TicketNoParams }), c.getTicket);

/** Contact-us is its own front door onto the same collection. */
export const contactRoutes = Router();
contactRoutes.post('/', optionalAuth, validate({ body: SubmitContactSchema }), c.submitContact);
