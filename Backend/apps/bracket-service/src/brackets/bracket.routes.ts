import { UserRole, optionalAuth, requireActiveUser, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as c from './bracket.controller';
import { EventIdParams, GenerateBracketSchema } from './bracket.schemas';

/**
 * Mounted at `/brackets` — the prefix the gateway forwards unchanged.
 *
 * Reads are `optionalAuth`: Spec §5.5's spectator bracket view is a public screen, and a guest
 * watching a tournament is the ordinary case. Writes rank the **live** user document
 * (`requireActiveUser`) and are then narrowed again to the event's own core admins in the service
 * (`actor.ts`).
 */
export const bracketRoutes = Router();

bracketRoutes.post(
    '/',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: GenerateBracketSchema }),
    c.generate
);

bracketRoutes.get('/:event_id/standings', optionalAuth, validate({ params: EventIdParams }), c.standings);
bracketRoutes.get('/:event_id', optionalAuth, validate({ params: EventIdParams }), c.get);

bracketRoutes.delete(
    '/:event_id',
    requireAuth,
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: EventIdParams }),
    c.remove
);
