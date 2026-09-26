import { NextFunction, Request, Response } from 'express';
import { IUser, User, UserRole, UserStatus, rankOf } from '@bgsc/shared';
import { Actor } from './challenge.service';

/**
 * The write-path gate, in place of `requireRole`. Mount after `requireAuth`.
 *
 * A token is cryptographically valid for up to JWT_ACCESS_EXPIRES_IN (15m) after the user behind it
 * was suspended, deleted or demoted. `requireRole` ranks the token's claim, so a coordinator demoted
 * to member would keep composer rights for the rest of that window. This ranks the live document
 * instead, so the floor is stated once, here, and a demotion lands on the next request.
 *
 * One `User.findById` per write. Read paths don't take it: a stale token reading what it could read
 * a minute ago is not a damage path, and the auth middleware already verified the signature.
 *
 * Downstream handlers read the result with `actorOf(res)` / `userOf(res)`.
 *
 * Copied from points-service: approving a participation
 * publishes ChallengeCompleted, which mints points on the other side of the bus, so the 15-minute
 * window between a demotion and a token's expiry is not one to leave open here either.
 */

export const userOf = (res: Response): IUser => res.locals.user;
export const actorOf = (res: Response): Actor => res.locals.actor;

/**
 * The guard itself now lives in `@bgsc/shared` — it was five copies and three implementations
 * before the Sep 27 audit. Re-exported here so this service's routes keep importing it from the
 * file that also holds their service-specific helpers.
 */
export { requireActiveUser } from '@bgsc/shared';
