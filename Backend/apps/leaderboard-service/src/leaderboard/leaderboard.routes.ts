import { Router } from 'express';
import { requireActiveUser, requireAuth, UserRole, validate } from '@bgsc/shared';
import * as ctrl from './leaderboard.controller';
import {
    EventRefParamSchema,
    InvestPointsSchema,
    ProjectInvestmentSchema,
    QueryEventLeaderboardSchema,
    QueryGlobalLeaderboardSchema,
    SubmitScoresSchema,
} from './leaderboard.schemas';

export const leaderboardRoutes = Router();

// Public reads
leaderboardRoutes.get(
    '/global',
    validate({ query: QueryGlobalLeaderboardSchema }),
    ctrl.getGlobalLeaderboard
);

leaderboardRoutes.get(
    '/events/:ref',
    validate({ params: EventRefParamSchema, query: QueryEventLeaderboardSchema }),
    ctrl.getEventLeaderboard
);

leaderboardRoutes.get(
    '/events/:ref/podium',
    validate({ params: EventRefParamSchema }),
    ctrl.getPodium
);

leaderboardRoutes.get(
    '/events/:ref/snapshots',
    validate({ params: EventRefParamSchema }),
    ctrl.getSnapshots
);

// Authenticated participant routes
leaderboardRoutes.get(
    '/events/:ref/me',
    requireAuth,
    validate({ params: EventRefParamSchema }),
    ctrl.getMyEntry
);

leaderboardRoutes.get(
    '/events/:ref/project',
    requireAuth,
    validate({ params: EventRefParamSchema, query: ProjectInvestmentSchema }),
    ctrl.projectInvestment
);

leaderboardRoutes.post(
    '/events/:ref/invest',
    requireAuth,
    validate({ params: EventRefParamSchema, body: InvestPointsSchema }),
    ctrl.investPoints
);

// Admin / Core score entry (supports both PUT and POST)
leaderboardRoutes.put(
    '/events/:ref/scores',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema, body: SubmitScoresSchema }),
    ctrl.submitScores
);

leaderboardRoutes.post(
    '/events/:ref/scores',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema, body: SubmitScoresSchema }),
    ctrl.submitScores
);
