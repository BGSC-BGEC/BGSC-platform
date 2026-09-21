import { ServiceError } from '@bgsc/shared';

/**
 * Keyset pagination for the ticket lists. Ordered by `created_at` descending with `_id` breaking
 * ties — the same helper as `points-service/src/points/cursor.ts` and
 * `notification-service/src/notifications/cursor.ts`.
 *
 * Never skip/offset: tickets only arrive at the head, so an offset page walks further every time
 * and a ticket filed mid-pagination shifts every later page by one — the reader sees a row twice
 * and never sees the one it displaced.
 */

interface Cursor {
    /** ISO date of `created_at` on the last row of the previous page. */
    v: string;
    /** Tiebreaker. Without it, rows sharing a timestamp straddle the page boundary and vanish. */
    id: string;
}

export const encodeCursor = (created_at: Date, id: string): string =>
    Buffer.from(JSON.stringify({ v: created_at.toISOString(), id } satisfies Cursor)).toString('base64url');

function decodeCursor(raw: string): Cursor {
    let c: Cursor;
    try {
        c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    } catch {
        throw new ServiceError(422, 'invalid_cursor');
    }
    // `v` lands inside a query filter, so anything but a string is an operator document in
    // disguise: `{ v: { $ne: null } }` would become `{ created_at: { $ne: null } }` below and
    // return the whole collection.
    if (typeof c?.id !== 'string' || typeof c?.v !== 'string') throw new ServiceError(422, 'invalid_cursor');
    if (Number.isNaN(new Date(c.v).getTime())) throw new ServiceError(422, 'invalid_cursor');
    return c;
}

/** Keyset condition on the compound key `(created_at, _id)`, descending. */
export function keysetFilter(raw: string): Record<string, unknown> {
    const c = decodeCursor(raw);
    const at = new Date(c.v);
    return { $or: [{ created_at: { $lt: at } }, { created_at: at, _id: { $lt: c.id } }] };
}

/**
 * Combine filters with `$and`, never by spreading: `keysetFilter` carries a top-level `$or`, and
 * `{ ...a, ...b }` keeps only the second one. Here that would drop either the cursor (an endless
 * first page) or the reporter filter (one person reading another's tickets).
 */
export function allOf(conditions: Record<string, unknown>[]): Record<string, unknown> {
    return conditions.length === 1 ? { ...conditions[0] } : { $and: conditions };
}

/** One page plus the cursor that continues it. `limit` is already capped by zod. */
export function pageOf<T extends { created_at: Date; _id: string }>(
    rows: T[],
    limit: number
): { rows: T[]; next_cursor: string | null } {
    // A full page means "there may be more"; a short one is definitively the end.
    if (rows.length < limit) return { rows, next_cursor: null };
    const last = rows[rows.length - 1];
    return { rows, next_cursor: encodeCursor(last.created_at, last._id) };
}
