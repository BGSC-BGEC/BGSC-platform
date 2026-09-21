import { requireServiceToken, validate, wrap } from '@bgsc/shared';
import { Router } from 'express';
import { SpendBody, SpendBodyInput } from '../points/points.schemas';
import * as svc from '../points/points.service';

/**
 * Service-to-service only. Two layers guard it, both required: the gateway 404s every `/internal*`
 * path at the edge (`routing.ts` `isInternalPath`), and this router checks the shared token in
 * constant time. "Not exposed on the gateway" is a deployment assumption, not an access control.
 *
 * One route, because there is exactly one caller — Leaderboard Service
 * (leaderboard-model.md §6 step 2). Challenge awards arrive on the event bus instead, so there is
 * no internal *award* route: a contract with no second party is a guess
 * (adding-a-service.md §6.4).
 */
export const internalRoutes = Router();

internalRoutes.use(requireServiceToken);

internalRoutes.post(
    '/points/spend',
    validate({ body: SpendBody }),
    wrap(async (req, res) => {
        // `reason` is not a parameter: this route always writes 'leaderboard.investment'. A caller
        // that could name any reason could mint podium rows with a service token.
        const { tx, replayed } = await svc.spendForInvestment(req.body as SpendBodyInput);
        res.json({ transaction_id: tx._id, balance_after: tx.balance_after, replayed });
    })
);
