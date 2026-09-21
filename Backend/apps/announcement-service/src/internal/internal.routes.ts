import { requireServiceToken, validate, wrap } from '@bgsc/shared';
import { Router } from 'express';
import { IdParams, RecordDeliveryInput, RecordDeliverySchema } from '../announcements/announcement.schemas';
import * as svc from '../announcements/announcement.service';

/**
 * Service-to-service only. Two layers guard it, both required: the gateway 404s every `/internal*`
 * path at the edge (`routing.ts` `isInternalPath`), and this router checks the shared token in
 * constant time. "Not exposed on the gateway" is a deployment assumption, not an access control.
 *
 * One route, because there is exactly one caller — the Notification Service, writing back what its
 * broadcast did (be2-broadcast-service-plan.md §6). Built now rather than in Week 2 because a
 * contract with no second party is a guess (announcement plan D7).
 *
 * Note what this route cannot do: every field it accepts is an OUTCOME. There is no way to ask this
 * service to send anything, so a leaked internal token cannot be turned into a broadcast.
 */
export const internalRoutes = Router();

internalRoutes.use(requireServiceToken);

internalRoutes.patch(
    '/announcements/:id/delivery',
    validate({ params: IdParams, body: RecordDeliverySchema }),
    wrap(async (req, res) => {
        const id = (req.params as Record<string, string>).id;
        const a = await svc.recordDelivery(id, req.body as RecordDeliveryInput);
        // An acknowledgement, not the announcement: the caller already has every field it sent,
        // and the document itself is reader-facing content it has no business receiving back.
        res.json({ announcement_id: a._id, delivery: a.delivery });
    })
);
