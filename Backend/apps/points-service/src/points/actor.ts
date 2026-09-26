import { Response } from 'express';
import { Actor } from './points.service';

/**
 * The write-path gate, in place of `requireRole`. Mount after `requireAuth`.
 *
 * A token is cryptographically valid for up to JWT_ACCESS_EXPIRES_IN (15m) after the user behind it
 * was suspended, deleted or demoted. `requireRole` ranks the token's claim; `requireActiveUser` ranks
 * the live document, so a demotion lands on the next request. This is the service where a stale
 * token mints points, so that window is not one to leave open.
 *
 * The guard lives in `@bgsc/shared`; re-exported here beside `actorOf`, which reads what it stored.
 */
export { requireActiveUser } from '@bgsc/shared';

export const actorOf = (res: Response): Actor => res.locals.actor;
