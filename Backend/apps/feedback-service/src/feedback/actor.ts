import { RoleName } from '@bgsc/shared';
import { Request } from 'express';
import { Actor } from './feedback.service';

/**
 * The audit actor for a staff write, from the LIVE user document `requireActiveUser` (from
 * `@bgsc/shared`) loaded onto `req.actor` — never the token's role claim, which outlives a demotion
 * by up to fifteen minutes. Submission does not go through here: Spec §5.12 makes it public.
 */
export const actorOf = (req: Request): Actor => ({
    id: req.actor!._id,
    role: req.actor!.role as RoleName,
    ip: req.ip ?? null,
});
