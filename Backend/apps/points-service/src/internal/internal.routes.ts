import { requireServiceToken, validate, wrap } from '@bgsc/shared';
import { Router } from 'express';
import { RefundBody, RefundBodyInput, SpendBody, SpendBodyInput } from '../points/points.schemas';
import * as svc from '../points/points.service';

/**
 * Service-to-service only. Two layers guard it, both required: the gateway 404s every `/internal*`
 * path at the edge (`routing.ts` `isInternalPath`), and this router checks the shared token in
 * constant time. "Not exposed on the gateway" is a deployment assumption, not an access control.
 *
 * Leaderboard Service calls /points/spend on investment, and /points/refund on compensation rollback.
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

// Bound to the spend `request_id` made: same user, exactly its amount, at most once across this
// route and the event-cancel sweep (they share `idempotencyKey.investmentRefund`).
internalRoutes.post(
    '/points/refund',
    validate({ body: RefundBody }),
    wrap(async (req, res) => {
        const { tx, replayed } = await svc.refundForInvestment(req.body as RefundBodyInput);
        res.json({ transaction_id: tx._id, balance_after: tx.balance_after, replayed });
    })
);

