import { Router } from 'express';
import { requireServiceToken, validate, wrap } from '@bgsc/shared';
import * as svc from '../events/event.service';
import { ReserveSeatSchema, ReleaseSeatSchema } from '../events/event.schemas';

export const internalRoutes = Router();

internalRoutes.use(requireServiceToken);

// Seat contract: idempotent per registration_id. Answers `{ reserved: true }` or
// `{ reserved: false, reason }`; the success envelope is unwrapped by the caller's `callInternal`.
internalRoutes.post(
    '/events/:eventId/reserve-seat',
    validate({ body: ReserveSeatSchema }),
    wrap(async (req, res) => {
        const eventId = (req.params as Record<string, string>).eventId;
        res.json(await svc.reserveSeat(eventId, req.body.registration_id));
    })
);

internalRoutes.post(
    '/events/:eventId/release-seat',
    validate({ body: ReleaseSeatSchema }),
    wrap(async (req, res) => {
        const eventId = (req.params as Record<string, string>).eventId;
        res.json(await svc.releaseSeat(eventId, req.body.registration_id));
    })
);
