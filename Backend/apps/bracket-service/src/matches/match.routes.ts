import { UserRole, optionalAuth, requireActiveUser, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import { ListMatchesQuery, MatchIdParams, ReportResultSchema, ScheduleMatchSchema } from '../brackets/bracket.schemas';
import * as c from './match.controller';

/**
 * Mounted at `/matches`.
 *
 * `event_id` is required on the list: a fixture list with no event is every match on the platform,
 * which is neither a screen anybody asked for nor a query any index serves.
 *
 * `/:id/schedule` is declared before `/:id` — they are different shapes to Express, but the order
 * is the habit that keeps the next route from being swallowed.
 */
export const matchRoutes = Router();

matchRoutes.get('/', optionalAuth, validate({ query: ListMatchesQuery }), c.list);

matchRoutes.patch(
    '/:id/schedule',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: MatchIdParams, body: ScheduleMatchSchema }),
    c.schedule
);

matchRoutes.patch(
    '/:id',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: MatchIdParams, body: ReportResultSchema }),
    c.report
);

matchRoutes.get('/:id', optionalAuth, validate({ params: MatchIdParams }), c.get);
