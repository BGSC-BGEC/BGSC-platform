import { ServiceError } from '@bgsc/shared';

/**
 * Keyset pagination. Copied from `points-service/src/points/cursor.ts` with the sort field made a
 * parameter, because the two lists here order on different columns (`created_at` for the catalog,
 * `accepted_at` for participations, `start_date` for Strava activities).
 *
 * Never skip/offset: a row inserted mid-pagination shifts every later page by one, and the catalog
 * is written by admins while it is being browsed.
 */

interface Cursor {
    /** ISO date of the sort field on the last row of the previous page. */
    v: string;
    /** Tiebreaker. Without it, rows sharing a timestamp straddle the page boundary and vanish. */
    id: string;
}

const encodeCursor = (value: Date, id: string): string =>
    Buffer.from(JSON.stringify({ v: value.toISOString(), id } satisfies Cursor)).toString('base64url');

function decodeCursor(raw: string): Cursor {
    let c: Cursor;
    try {
        c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
    } catch {
        throw new ServiceError(422, 'invalid_cursor');
    }
    // `v` lands inside a query filter, so anything but a string is an operator document in
    // disguise: `{ v: { $ne: null } }` would become `{ created_at: { $ne: null } }` below.
    if (typeof c?.id !== 'string' || typeof c?.v !== 'string') throw new ServiceError(422, 'invalid_cursor');
    if (Number.isNaN(new Date(c.v).getTime())) throw new ServiceError(422, 'invalid_cursor');
    return c;
}

export type Direction = 'asc' | 'desc';

/**
 * Keyset condition on the compound key `(field, _id)`.
 *
 * Descending is the default everywhere — newest first is what a browser and a history list want.
 * The reviewer queue is the exception: it is a work queue, so it runs ascending, oldest submission
 * first (challenge-model.md §5).
 */
export function keysetFilter(field: string, raw: string, dir: Direction = 'desc'): Record<string, unknown> {
    const c = decodeCursor(raw);
    const at = new Date(c.v);
    const op = dir === 'asc' ? '$gt' : '$lt';
    return { $or: [{ [field]: { [op]: at } }, { [field]: at, _id: { [op]: c.id } }] };
}

/** The sort that matches `keysetFilter`. Kept next to it so the two cannot drift apart. */
export function keysetSort(field: string, dir: Direction = 'desc'): Record<string, 1 | -1> {
    const d = dir === 'asc' ? 1 : -1;
    return { [field]: d, _id: d };
}

/**
 * Combine filters with `$and`, never by spreading: `keysetFilter` carries a top-level `$or` and so
 * does the catalog's `{_id} | {slug}` lookup, and `{ ...a, ...b }` keeps only the second one. Here
 * that would drop either the cursor (endless first page) or the ownership filter (one user reading
 * another's participations).
 */
export function allOf(conditions: Record<string, unknown>[]): Record<string, unknown> {
    return conditions.length === 1 ? { ...conditions[0] } : { $and: conditions };
}

/** One page plus the cursor that continues it. `limit` is already capped by zod. */
export function pageOf<T extends { _id: string }>(
    rows: T[],
    limit: number,
    field: string
): { rows: T[]; next_cursor: string | null } {
    // A full page means "there may be more"; a short one is definitively the end.
    if (rows.length < limit) return { rows, next_cursor: null };
    const last = rows[rows.length - 1];
    const value = field.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | null)?.[k], last);
    // Not every sort field is always present: `submission.submitted_at` is null on a participation
    // nobody has submitted. Calling `.toISOString()` on that is a 500 on a read path, so a row we
    // cannot build a cursor from ends the page instead. The caller sees a short page, which is the
    // same contract as any other end-of-list.
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return { rows, next_cursor: null };
    return { rows, next_cursor: encodeCursor(value, last._id) };
}
