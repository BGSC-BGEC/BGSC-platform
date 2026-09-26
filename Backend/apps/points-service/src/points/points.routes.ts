import { UserRole, requireAuth, requireRole, validate } from '@bgsc/shared';
import { Router } from 'express';
import { requireActiveUser } from './actor';
import * as c from './points.controller';
import {
    AdjustBody,
    AwardBody,
    EventIdParams,
    EventLedgerQuery,
    HistoryQuery,
    RuleIdParams,
    RulePatchBody,
    TransactionIdParams,
    UserIdParams,
} from './points.schemas';

/**
 * Mounted at `/points` — the prefix the gateway forwards unchanged.
 *
 * Spec §5.7 marks the whole Point System page "Visibility: Authenticated only", so there is one
 * floor for the entire prefix and no `optionalAuth` anywhere in this service.
 *
 * Writes take `requireActiveUser` (the live user document's role) rather than `requireRole` (the
 * token's claim): a token outlives a demotion by up to 15 minutes, and every write here moves
 * points.
 */
export const pointsRoutes = Router();

pointsRoutes.use(requireAuth);

/* ---- literal segments first; `/users/:id` and `/events/:id` never collide with them ---- */

pointsRoutes.get('/me', c.me);
pointsRoutes.get('/me/transactions', validate({ query: HistoryQuery }), c.myTransactions);
pointsRoutes.get('/me/breakdown', c.myBreakdown);
pointsRoutes.get('/opportunities', c.opportunities);

pointsRoutes.get('/rules', requireRole(UserRole.CORE), c.listRules);
pointsRoutes.patch(
    '/rules/:id',
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: RuleIdParams, body: RulePatchBody }),
    c.updateRule
);

/* ---- admin writes ---- */

pointsRoutes.post(
    '/adjust',
    requireActiveUser(UserRole.COORDINATOR),
    validate({ body: AdjustBody }),
    c.adjust
);
pointsRoutes.post('/award', requireActiveUser(UserRole.CORE), validate({ body: AwardBody }), c.award);

/* ---- admin reads ---- */

pointsRoutes.get('/users/:id', requireRole(UserRole.CORE), validate({ params: UserIdParams }), c.userSummary);
pointsRoutes.get(
    '/users/:id/transactions',
    requireRole(UserRole.CORE),
    validate({ params: UserIdParams, query: HistoryQuery }),
    c.userTransactions
);
pointsRoutes.post(
    '/users/:id/recalculate',
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: UserIdParams }),
    c.recalculate
);
pointsRoutes.get(
    '/events/:eventId',
    requireRole(UserRole.CORE),
    validate({ params: EventIdParams, query: EventLedgerQuery }),
    c.eventLedger
);
pointsRoutes.get(
    '/transactions/:id/audit',
    requireRole(UserRole.FOUNDER),
    validate({ params: TransactionIdParams }),
    c.transactionAudit
);
