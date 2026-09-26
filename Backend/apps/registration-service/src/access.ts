import { Challenge, Event, EventActor, RoleName, ServiceError, isEventAdmin, requireEventAdmin, roleRank } from '@bgsc/shared';
import { Request } from 'express';

/**
 * Who administers the thing a form, registration or team belongs to.
 *
 *  - an EVENT's data: `isEventAdmin` — its creator, a listed core admin, or coordinator+. Any core
 *    member used to be able to confirm, reject, read answers and lock rosters on every event;
 *  - a CHALLENGE's or a generic form's data: core+, by design (challenges are platform-run).
 *
 * Always the LIVE actor (`requireActiveUser` loads it), never the token claim.
 */

export type Actor = EventActor;

const isCore = (actor: Actor) => roleRank(actor.role as RoleName) >= roleRank('core');

/** The live actor. Every route that calls this mounts `requireActiveUser`. */
export function actorOf(req: Request): Actor {
    if (!req.actor) throw new ServiceError(401, 'unauthorized');
    return { id: req.actor._id, role: req.actor.role };
}

export interface OwnerRef {
    type: 'event' | 'challenge' | 'generic';
    id: string | null;
}

export async function isOwnerAdmin(owner: OwnerRef, actor: Actor): Promise<boolean> {
    if (owner.type !== 'event') return isCore(actor);
    if (!owner.id) return false;
    const event = await Event.findOne({ _id: owner.id, deleted_at: null }).select('created_by core_admins').lean();
    return !!event && isEventAdmin(event, actor);
}

/** Throws: 404 for an event the actor cannot see or that does not exist, 403 otherwise. */
export async function requireOwnerAdmin(owner: OwnerRef, actor: Actor, nonEventFloor: RoleName = 'core'): Promise<void> {
    if (owner.type === 'event') {
        await requireEventAdmin(owner.id, actor);
        return;
    }
    if (roleRank(actor.role as RoleName) < roleRank(nonEventFloor)) throw new ServiceError(403, 'forbidden');
}

/** The owner an id refers to: an event if one exists with that id, else a challenge. */
export async function ownerOfId(ownerId: string): Promise<OwnerRef | null> {
    if (await Event.exists({ _id: ownerId, deleted_at: null })) return { type: 'event', id: ownerId };
    if (await Challenge.exists({ _id: ownerId })) return { type: 'challenge', id: ownerId };
    return null;
}

/**
 * `isOwnerAdmin`, memoised per owner for one request — a page of forms or registrations shares a
 * handful of owners, not one each.
 */
export function ownerAdminCache(actor: Actor) {
    const seen = new Map<string, Promise<boolean>>();
    return (owner: OwnerRef): Promise<boolean> => {
        const key = `${owner.type}:${owner.id}`;
        if (!seen.has(key)) seen.set(key, isOwnerAdmin(owner, actor));
        return seen.get(key)!;
    };
}
