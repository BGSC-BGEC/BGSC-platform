import { IUser, RoleName, User, UserStatus, roleRank } from '@bgsc/shared';
import { NextFunction, Request, Response } from 'express';

/**
 * Who may write here.
 *
 * `requireActiveUser(floor)` ranks the **live user document**, not the token's role claim, which
 * stays valid for up to fifteen minutes after a suspension or a demotion — and the writes it guards
 * here are triage decisions on other people's complaints. Lifted from
 * `announcement-service/src/announcements/actor.ts`, where the same reasoning is written out.
 *
 * Submission is deliberately NOT guarded by it: Spec §5.12 makes the page public, and a bug report
 * that requires a login is a bug report nobody files.
 */


export interface Actor {
    id: string;
    role: RoleName;
    ip: string | null;
}

export const actorOf = (req: Request): Actor => ({
    id: req.actor!._id,
    role: req.actor!.role as RoleName,
    ip: req.ip ?? null,
});

/**
 * The guard itself now lives in `@bgsc/shared` — it was five copies and three implementations
 * before the Sep 27 audit. Re-exported here so this service's routes keep importing it from the
 * file that also holds their service-specific helpers.
 */
export { requireActiveUser } from '@bgsc/shared';
