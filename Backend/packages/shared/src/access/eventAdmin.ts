import { Event, IEvent } from '../models/Event';
import { ROLE_RANK, RoleName } from '../models/shared';
import { ServiceError } from '../errors';

// Ranked against the ladder directly, not via middleware/requireRole: that file relies on the
// Express `req.user` augmentation declared elsewhere, and ts-node compiling it in isolation fails.
const rank = (role: string): number => ROLE_RANK.indexOf(role as RoleName);

/**
 * Who administers an event: its creator, a listed core admin, or coordinator+.
 *
 * One definition for every service that acts on an event's data. Audit #2 found that event, auction
 * and bracket writes checked this while registration, forms, teams, leaderboard scores, points
 * awards and media albums only checked "is core" — so any core member could confirm, reject, score
 * or pay out on any event on the platform.
 *
 * Always pass the LIVE actor (the document `requireActiveUser` loaded), never the token claim.
 */

export interface EventActor {
    id: string;
    role: string;
}

type AdminFields = Pick<IEvent, 'created_by' | 'core_admins'>;

export function isEventAdmin(event: AdminFields, actor?: EventActor | null): boolean {
    if (!actor) return false;
    return (
        event.created_by === actor.id ||
        (event.core_admins ?? []).includes(actor.id) ||
        rank(actor.role) >= rank('coordinator')
    );
}

/**
 * Load a live event and require the actor to administer it.
 *
 * A draft the actor cannot administer answers 404 (it does not exist for them); a visible event
 * answers 403 (they can see it, they may not change it) — the same split event-service uses.
 */
export async function requireEventAdmin(
    eventId: string | null | undefined,
    actor: EventActor
): Promise<IEvent> {
    const event = eventId ? await Event.findOne({ _id: eventId, deleted_at: null }) : null;
    if (!event) throw new ServiceError(404, 'event_not_found');
    if (!isEventAdmin(event, actor)) {
        throw new ServiceError(event.status === 'draft' ? 404 : 403, event.status === 'draft' ? 'event_not_found' : 'forbidden');
    }
    return event;
}

/** User text inside a `$regex`: literal, never a pattern. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
