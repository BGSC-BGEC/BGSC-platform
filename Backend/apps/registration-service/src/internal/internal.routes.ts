import { ServiceError, requireServiceToken, validate, wrap } from '@bgsc/shared';
import { Router } from 'express';
import { z } from 'zod';
import * as registrationService from '../registrations/registration.service';
import * as teamService from '../teams/team.service';

/**
 * Service-to-service routes. Registration Service is the only writer of
 * `form_submissions` and `teams`; the Event Service asks through these instead of writing them.
 *
 * Removed: `/internal/registrations/confirm` (no caller, and it confirmed rejected or unapproved
 * rows without a seat) and `/internal/teams/snapshot` (no caller).
 */

export const internalRoutes = Router();

internalRoutes.use(requireServiceToken);

const Id = z.string().uuid();
const IdParams = z.object({ id: Id });
const EventParams = z.object({ eventId: Id });

// POST /internal/registrations/attendance - mark attendance on confirmed registrations of an event
internalRoutes.post(
    '/registrations/attendance',
    validate({
        body: z.object({
            event_id: Id,
            marked_by: z.string().min(1).max(64),
            attendances: z.array(z.object({ registration_id: Id, attended: z.boolean() })).min(1).max(1000),
        }),
    }),
    wrap(async (req, res) => {
        const { event_id, marked_by, attendances } = req.body;
        res.json(await registrationService.recordAttendance(event_id, marked_by, attendances));
    })
);

// POST /internal/registrations/:id/promote - waitlisted -> (seat) -> confirmed
internalRoutes.post(
    '/registrations/:id/promote',
    validate({ params: IdParams, body: z.object({ by: z.string().min(1).max(64) }) }),
    wrap(async (req, res) => {
        const registration = await registrationService.getRegistration(req.params.id as string);
        if (registration.status !== 'waitlisted') throw new ServiceError(409, 'not_waitlisted');

        const result = await registrationService
            .promoteRegistration(registration, req.body.by, 'admin_promoted_from_waitlist')
            .catch((err) => {
                throw registrationService.seatCallError(err);
            });
        if (result.outcome === 'refused' || result.outcome === 'skipped') throw new ServiceError(409, result.reason);
        if (result.outcome === 'raced') throw new ServiceError(409, 'not_waitlisted');
        res.json(result.registration);
    })
);

const Amount = z.object({ amount: z.number().positive().finite(), request_id: z.string().min(1).max(200) });

// POST /internal/teams/:id/debit-purse - idempotent on request_id (`<lot>:<team_id>:debit`)
internalRoutes.post(
    '/teams/:id/debit-purse',
    validate({ params: IdParams, body: Amount }),
    wrap(async (req, res) => {
        res.json(await teamService.debitPurse(req.params.id as string, req.body.amount, req.body.request_id));
    })
);

// POST /internal/teams/:id/refund-purse - idempotent on request_id (`<lot>:<team_id>:refund`); never clamps
internalRoutes.post(
    '/teams/:id/refund-purse',
    validate({ params: IdParams, body: Amount }),
    wrap(async (req, res) => {
        res.json(await teamService.refundPurse(req.params.id as string, req.body.amount, req.body.request_id));
    })
);

// POST /internal/teams/:id/add-member - auction seat, idempotent on request_id (`<lot>:<team_id>:add`)
internalRoutes.post(
    '/teams/:id/add-member',
    validate({ params: IdParams, body: z.object({ user_id: Id, registration_id: Id, request_id: z.string().min(1).max(200) }) }),
    wrap(async (req, res) => {
        res.json(
            await teamService.addMemberToTeam(
                req.params.id as string,
                req.body.user_id,
                req.body.registration_id,
                'auction',
                req.body.request_id
            )
        );
    })
);

// POST /internal/events/:eventId/auction-purses - default purse on every live team lacking one
internalRoutes.post(
    '/events/:eventId/auction-purses',
    validate({ params: EventParams, body: z.object({ purse_total: z.number().min(0).finite() }) }),
    wrap(async (req, res) => {
        res.json(await teamService.setAuctionPurses(req.params.eventId as string, req.body.purse_total));
    })
);

// PATCH /internal/teams/:id/auction-budget - a captain's budget override
internalRoutes.patch(
    '/teams/:id/auction-budget',
    validate({
        params: IdParams,
        body: z.object({
            purse_total: z.number().min(0).finite(),
            reason: z.string().max(500).nullable().optional(),
            overridden_by: z.string().min(1).max(64),
        }),
    }),
    wrap(async (req, res) => {
        res.json(
            await teamService.setAuctionBudget(req.params.id as string, {
                purse_total: req.body.purse_total,
                reason: req.body.reason ?? null,
                overridden_by: req.body.overridden_by,
            })
        );
    })
);

/**
 * POST /internal/teams/:id/lock - freeze a roster (called by Challenge Service on team acceptance).
 * The Points Service pays exactly the roster snapshotted at acceptance, so it must stop moving.
 */
internalRoutes.post(
    '/teams/:id/lock',
    validate({ params: IdParams }),
    wrap(async (req, res) => {
        const teamId = req.params.id as string;
        const lockedBy = typeof req.body?.locked_by === 'string' ? req.body.locked_by.slice(0, 64) : 'system';

        const team = await teamService.getTeam(teamId);
        // Already done. Idempotent for a retrying caller rather than a 400 it has to special-case.
        if (team.status === 'locked') {
            res.json(team);
            return;
        }
        res.json(await teamService.lockTeam(teamId, lockedBy));
    })
);
