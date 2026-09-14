import { Router } from 'express';
import { requireServiceToken, validate, wrap } from '@bgsc/shared';
import * as svc from '../events/event.service';
import { ReserveSeatSchema, ReleaseSeatSchema } from '../events/event.schemas';

export const internalRoutes = Router();

internalRoutes.use(requireServiceToken);

internalRoutes.post(
    '/events/:eventId/reserve-seat',
    validate({ body: ReserveSeatSchema }),
    wrap(async (req, res) => {
        const eventId = (req.params as Record<string, string>).eventId;
        const result = await svc.reserveSeat(
            eventId,
            req.body.registration_id,
            req.body.idempotency_key
        );
        res.json(result);
    })
);

internalRoutes.post(
    '/events/:eventId/release-seat',
    validate({ body: ReleaseSeatSchema }),
    wrap(async (req, res) => {
        const eventId = (req.params as Record<string, string>).eventId;
        const result = await svc.releaseSeat(
            eventId,
            req.body.registration_id
        );
        res.json(result);
    })
);
