import { Router } from 'express';
import {
    UserRole,
    optionalAuth,
    requireActiveUser,
    requireAuth,
    validate,
} from '@bgsc/shared';
import * as c from './auction.controller';
import {
    CreateLotsSchema,
    EventRefParamSchema,
    LotIdParamSchema,
    OverrideCaptainBudgetSchema,
    OverridePriceSchema,
    PlaceBidSchema,
    QueryLotsSchema,
    TeamIdParamSchema,
    UpdateAuctionConfigSchema,
} from './auction.schemas';

export const auctionRoutes = Router();

// --- Dedicated /auction root routes (Gateway matches /auction/**) ---

// Spectator & Public Reads
auctionRoutes.get(
    '/events/:ref/live',
    optionalAuth,
    validate({ params: EventRefParamSchema }),
    c.liveState
);

auctionRoutes.get(
    '/events/:ref/lots',
    optionalAuth,
    validate({ params: EventRefParamSchema, query: QueryLotsSchema }),
    c.listLots
);

auctionRoutes.get(
    '/lots/:id',
    optionalAuth,
    validate({ params: LotIdParamSchema }),
    c.getLot
);

// High-Concurrency Bidding (Captains). `requireActiveUser()`: a suspended or deleted captain's
// token stays valid for fifteen minutes, and a bid spends a team's purse.
auctionRoutes.post(
    '/lots/:id/bid',
    requireAuth,
    requireActiveUser(),
    validate({ params: LotIdParamSchema, body: PlaceBidSchema }),
    c.bid
);

// Admin & Core Lifecycle Operations. The CORE floor is only the first gate: the service also
// requires the actor to administer THIS event (core_admins / creator / coordinator+).
auctionRoutes.post(
    '/events/:ref/lots',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema, body: CreateLotsSchema }),
    c.createLots
);

auctionRoutes.post(
    '/events/:ref/start',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema }),
    c.start
);

auctionRoutes.post(
    '/events/:ref/pause',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema }),
    c.pause
);

auctionRoutes.post(
    '/events/:ref/resume',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema }),
    c.resume
);

auctionRoutes.post(
    '/events/:ref/close',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema }),
    c.close
);

auctionRoutes.patch(
    '/events/:ref/config',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema, body: UpdateAuctionConfigSchema }),
    c.updateConfig
);

auctionRoutes.patch(
    '/events/:ref/teams/:teamId/budget',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: TeamIdParamSchema, body: OverrideCaptainBudgetSchema }),
    c.overrideCaptainBudget
);

auctionRoutes.get(
    '/events/:ref/budget-preview',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema }),
    c.budgetPreview
);

auctionRoutes.post(
    '/lots/:id/advance',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: LotIdParamSchema }),
    c.advance
);

auctionRoutes.post(
    '/lots/:id/override-price',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: LotIdParamSchema, body: OverridePriceSchema }),
    c.overridePrice
);

// --- Subrouter for /events/:ref/auction/* ---
export const eventAuctionRoutes = Router({ mergeParams: true });

eventAuctionRoutes.get('/live', optionalAuth, c.liveState);
eventAuctionRoutes.get(
    '/lots',
    optionalAuth,
    validate({ query: QueryLotsSchema }),
    c.listLots
);
eventAuctionRoutes.post(
    '/lots',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: CreateLotsSchema }),
    c.createLots
);
eventAuctionRoutes.post(
    '/start',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    c.start
);
eventAuctionRoutes.post(
    '/pause',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    c.pause
);
eventAuctionRoutes.post(
    '/resume',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    c.resume
);
eventAuctionRoutes.post(
    '/close',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    c.close
);
eventAuctionRoutes.patch(
    '/config',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: UpdateAuctionConfigSchema }),
    c.updateConfig
);
eventAuctionRoutes.patch(
    '/teams/:teamId/budget',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: TeamIdParamSchema, body: OverrideCaptainBudgetSchema }),
    c.overrideCaptainBudget
);
eventAuctionRoutes.get(
    '/budget-preview',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: EventRefParamSchema }),
    c.budgetPreview
);
