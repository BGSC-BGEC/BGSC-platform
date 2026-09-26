import { IEvent, RoleName, ServiceError, isEventAdmin, requireEventAdmin } from '@bgsc/shared';
import { Request } from 'express';

/**
 * Who may write here.
 *
 * Two layers, and both are needed:
 *
 *  - `requireActiveUser(floor)` (from `@bgsc/shared`, on the routes) ranks the **live user
 *    document**, not the token's role claim, which stays valid for up to fifteen minutes after a
 *    suspension or a demotion.
 *  - `adminEventOr404` then applies the **event's own** rule: a core admin of that event, or anyone
 *    coordinator or above — the rule event-service gates attendance and captain grants with, and
 *    scoring somebody else's tournament is not a smaller act than marking attendance at it.
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
 * Load the event and require the actor to administer it — the shared `requireEventAdmin` (a core
 * admin of the event, its creator, or coordinator+). Visibility comes first: a draft the actor may
 * not see is a 404 under the caller's own not-found code, a visible event they may not touch a
 * 403. Checking permission first (403, then the draft check) confirmed drafts to outsiders.
 */
export async function adminEventOr404(eventId: string, actor: Actor, notFound = 'event_not_found'): Promise<IEvent> {
    try {
        return await requireEventAdmin(eventId, { id: actor.id, role: actor.role });
    } catch (err) {
        if (err instanceof ServiceError && err.status === 404) throw new ServiceError(404, notFound);
        throw err;
    }
}

/** Who is looking, as far as an `optionalAuth` route can tell. */
export interface Viewer {
    id: string | null;
    role: RoleName | undefined;
}

export const viewerOf = (req: Request): Viewer => ({ id: req.user?.id ?? null, role: req.user?.role as RoleName | undefined });

/** `__v` is mongoose bookkeeping and never leaves; a document or a lean row alike. */
export const strip = <T extends object>(doc: T): Omit<T, '__v'> => {
    const plain = typeof (doc as { toObject?: unknown }).toObject === 'function'
        ? (doc as unknown as { toObject: () => T }).toObject()
        : doc;
    const { __v, ...rest } = plain as T & { __v?: number };
    return rest as Omit<T, '__v'>;
};

/**
 * A draft event is not public, and neither is its draw.
 *
 * Event Service answers **404** for a draft event unless the viewer administers it
 * (`isEventAdmin`: its creator, a core admin, or coordinator+). A bracket read that did not apply
 * the same rule would publish the participant list and the seeding of an event the Event Service
 * refuses to admit exists — the leak being a different service, not a different permission.
 *
 * Unlisted events are deliberately NOT gated here, for the same reason they are not gated there:
 * `unlisted` means "not in the listing", and the link still works.
 */
export function assertEventVisible(
    event: Pick<IEvent, 'status' | 'core_admins' | 'created_by'>,
    viewer: Viewer,
    /**
     * The caller's own "not found" code. A draft must answer exactly what a missing event answers
     * on the same route — two different 404 codes are an oracle for "a draft exists here".
     */
    notFound = 'bracket_not_found'
): void {
    if (event.status !== 'draft') return;
    const who = viewer.id && viewer.role ? { id: viewer.id, role: viewer.role } : null;
    if (!isEventAdmin(event, who)) throw new ServiceError(404, notFound);
}
