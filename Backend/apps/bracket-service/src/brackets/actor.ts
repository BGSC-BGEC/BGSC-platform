import { IEvent, IUser, RoleName, ServiceError, User, UserStatus, roleRank } from '@bgsc/shared';
import { NextFunction, Request, Response } from 'express';

/**
 * Who may write here.
 *
 * Two layers, and both are needed:
 *
 *  - `requireActiveUser(floor)` ranks the **live user document**, not the token's role claim, which
 *    stays valid for up to fifteen minutes after a suspension or a demotion. Lifted from
 *    `announcement-service/src/announcements/actor.ts`, where the same reasoning is written out.
 *  - `assertMayScore` then applies the **event's own** rule: a core admin of that event, or anyone
 *    coordinator or above. `event.service.ts:280` already gates attendance and captain grants this
 *    way, and scoring somebody else's tournament is not a smaller act than marking attendance at it
 *    (plan D14).
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

/** A core admin of this event, or coordinator+. Anything else is a 403. */
export function assertMayScore(event: Pick<IEvent, 'core_admins' | 'created_by'>, actor: Actor): void {
    const ownsEvent = event.core_admins.includes(actor.id) || event.created_by === actor.id;
    if (ownsEvent || roleRank(actor.role) >= roleRank('coordinator')) return;
    throw new ServiceError(403, 'forbidden');
}

/** Who is looking, as far as an `optionalAuth` route can tell. */
export interface Viewer {
    id: string | null;
    role: RoleName | undefined;
}

/**
 * A draft event is not public, and neither is its draw.
 *
 * `event.service.ts:262` answers **404** for a draft event unless the viewer is one of its core
 * admins or coordinator+. A bracket read that did not apply the same rule would publish the
 * participant list and the seeding of an event the Event Service refuses to admit exists — the leak
 * being a different service, not a different permission.
 *
 * Unlisted events are deliberately NOT gated here, for the same reason they are not gated there:
 * `unlisted` means "not in the listing", and the link still works.
 */
export function assertEventVisible(
    event: Pick<IEvent, 'status' | 'core_admins' | 'created_by'>,
    viewer: Viewer
): void {
    if (event.status !== 'draft') return;

    const isCoreAdmin = viewer.id !== null && (event.core_admins.includes(viewer.id) || event.created_by === viewer.id);
    const isPrivileged = !!viewer.role && roleRank(viewer.role) >= roleRank('coordinator');
    if (!isCoreAdmin && !isPrivileged) throw new ServiceError(404, 'bracket_not_found');
}

/**
 * The guard itself now lives in `@bgsc/shared` — it was five copies and three implementations
 * before the Sep 27 audit. Re-exported here so this service's routes keep importing it from the
 * file that also holds their service-specific helpers.
 */
export { requireActiveUser } from '@bgsc/shared';
