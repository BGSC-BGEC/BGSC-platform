import {
    FormSubmission,
    REGISTERED_STATUS,
    ROLE_RANK,
    RoleName,
    ServiceError,
    roleRank,
} from '@bgsc/shared';

/**
 * Who may see which announcement.
 *
 * Its own file because the feed, the single-doc read, the unread count and the Heads strip all
 * build the same predicate — and two copies of an authorization rule is how one of them goes stale.
 */

/** Never return a soft-deleted announcement from any read path. */
export const alive = { deleted_at: null };

export interface Viewer {
    /** null for a guest. */
    id: string | null;
    role: RoleName;
    confirmed_event_ids: string[];
}

/**
 * The event-scoped check is server-side: the viewer's confirmed registrations are read here, never
 * taken from the request. A client-supplied list is a client-supplied audience.
 *
 * Served by the `{ 'user.user_id': 1, 'owner.type': 1, submitted_at: -1 }` index on
 * form_submissions — its two-key prefix is the selective part, and `status` then filters the
 * handful of candidates that survive. No index of our own is needed.
 *
 * ponytail: no cache. One indexed `distinct` per feed load at campus scale. announcement-model.md §4
 * suggests caching it for 60s; add that when a profiler asks, not before.
 */
export async function confirmedEventIds(userId: string): Promise<string[]> {
    const ids = await FormSubmission.distinct('owner.id', {
        'user.user_id': userId,
        'owner.type': 'event',
        status: REGISTERED_STATUS,
    });
    return ids.filter((id): id is string => typeof id === 'string');
}

export async function viewerFor(user?: { id: string; role: RoleName }): Promise<Viewer> {
    if (!user) return { id: null, role: 'guest', confirmed_event_ids: [] };
    return { id: user.id, role: user.role, confirmed_event_ids: await confirmedEventIds(user.id) };
}

/**
 * Every min_role at or below `role`, as a filter. ROLE_RANK is ordered, so the allowed set is a
 * prefix of it. roleRank() answers -1 for a role it does not know, which slices to [] and matches
 * nothing: an unrecognised role sees nothing rather than everything.
 *
 * Its own filter because the composer's list drops the rest of the audience gate but never this
 * part — core+ may see drafts and other people's event scopes, not a founder-only announcement.
 */
export function rankFilter(role: RoleName): Record<string, unknown> {
    return { 'audience.min_role': { $in: ROLE_RANK.slice(0, roleRank(role) + 1) } };
}

/**
 * The visibility rule as a Mongo filter rather than an in-memory predicate.
 *
 * announcement-model.md §4 says to filter `min_role` in memory and §6 shows it in the query; §6 is
 * right. MongoDB applies the whole filter during the index scan, so `.limit(20)` returns twenty
 * *matching* documents. Filtering in application code after the limit returns short pages and a
 * cursor that skipped nothing — which is a correctness bug, not a cosmetic one.
 */
export function audienceFilter(viewer: Viewer): Record<string, unknown> {
    return {
        ...alive,
        status: 'published',
        ...rankFilter(viewer.role),
        $or: [
            { 'audience.event_id': null },
            // A guest's list is empty, and `$in: []` matches nothing — so this arm drops out on
            // its own and the $or correctly reduces to "unscoped announcements only".
            { 'audience.event_id': { $in: viewer.confirmed_event_ids } },
        ],
    };
}

/* ------------------------------------------------------------------ *
 * Keyset pagination
 * ------------------------------------------------------------------ */

/**
 * Sort keys, by list. `published_at` is non-null for every published or archived announcement,
 * `scheduled_for` for every scheduled one (model invariants), and `created_at` is set by the
 * timestamps plugin on every document — so none needs the null-boundary branch that user-service's
 * generic version carries.
 */
export type SortField = 'published_at' | 'created_at' | 'scheduled_for';
const SORT_FIELDS: SortField[] = ['published_at', 'created_at', 'scheduled_for'];

/** A list's order: one key, one direction, with `_id` breaking ties in the same direction. */
export interface Order {
    field: SortField;
    dir: 1 | -1;
}

interface Cursor {
    /** Which field the boundary value belongs to. Encoded so a cursor cannot cross lists. */
    f: SortField;
    /** ISO date of the sort field on the last row of the previous page. */
    v: string;
    /** Tiebreaker. Without it, rows sharing a timestamp straddle the page boundary and vanish. */
    id: string;
}

export const encodeCursor = (c: Cursor): string =>
    Buffer.from(JSON.stringify(c)).toString('base64url');

function decodeCursor(raw: string, expected: SortField): Cursor {
    let c: Cursor;
    try {
        c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    } catch {
        throw new ServiceError(422, 'invalid_cursor');
    }
    // `v` lands inside a query filter, so anything but a string is an operator document in
    // disguise: `{ v: { $ne: null } }` would become `{ published_at: { $ne: null } }` below.
    if (typeof c?.id !== 'string' || typeof c?.v !== 'string' || !SORT_FIELDS.includes(c?.f)) {
        throw new ServiceError(422, 'invalid_cursor');
    }
    if (c.f !== expected) throw new ServiceError(422, 'invalid_cursor');
    if (Number.isNaN(new Date(c.v).getTime())) throw new ServiceError(422, 'invalid_cursor');
    return c;
}

/** Keyset condition on the compound key `(field, _id)`, in the order's direction. */
export function keysetFilter(order: Order, raw: string): Record<string, unknown> {
    const c = decodeCursor(raw, order.field);
    const at = new Date(c.v);
    const past = order.dir === -1 ? '$lt' : '$gt';
    return { $or: [{ [order.field]: { [past]: at } }, { [order.field]: at, _id: { [past]: c.id } }] };
}

/**
 * Combine filters with `$and`, never by spreading.
 *
 * `audienceFilter` carries a top-level `$or` and so does `keysetFilter`; `{ ...a, ...b }` keeps
 * only the second. The one silently dropped is the audience gate, so the bug leaks role-gated
 * announcements to guests on page two and looks perfect on page one.
 */
export function allOf(conditions: Record<string, unknown>[]): Record<string, unknown> {
    // Always a fresh object: callers add `$text` to the result, and handing back the caller's
    // own condition would mutate it.
    return conditions.length === 1 ? { ...conditions[0] } : { $and: conditions };
}
