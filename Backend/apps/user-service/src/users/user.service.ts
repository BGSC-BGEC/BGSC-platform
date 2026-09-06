import { isUuid, UpdateProfileInput, UpdateSettingsInput, ListUsersInput } from './user.schemas';
import {
    IUser,
    User,
    UserRole,
    UserStatus,
    publish,
    recordAudit,
    ServiceError,
} from '@bgsc/shared';

/**
 * All Mongo access for the User Service. Controllers do HTTP; this does data, events and audit.
 * Keeping the writes here is what makes "every role change is audited" checkable in one file.
 */

const PRODUCER = 'user-service';

/** Never return soft-deleted users from any read path. */
const alive = { deleted_at: null };


/** `:ref` is a UUID or a username — one route, resolved here (be2-user-service-plan.md §3.1). */
export async function findByRef(ref: string): Promise<IUser | null> {
    return isUuid(ref)
        ? User.findOne({ _id: ref, ...alive })
        : User.findOne({ username: ref.toLowerCase(), ...alive });
}

export async function findById(id: string): Promise<IUser | null> {
    return User.findOne({ _id: id, ...alive });
}

/**
 * Load the caller's own record for a *mutating* route.
 *
 * `requireAuth` only verifies the token. Suspension clears the refresh token, but an access token
 * already issued stays valid for its full 15 minutes (Spec §11.1) — so without this check an
 * account suspended for abuse keeps write access for another quarter of an hour, which is exactly
 * the window that matters. The self routes already load the document, so the check is free.
 *
 * Reads and self-deletion stay allowed: a suspended user may see their own record and may still
 * exercise deletion.
 */
export async function findActiveSelf(id: string): Promise<IUser> {
    const user = await findById(id);
    if (!user) throw new ServiceError(404, 'not_found');
    if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_VERIFICATION) {
        throw new ServiceError(403, 'account_' + user.status);
    }
    return user;
}

/** Flat input -> nested paths, so a partial PATCH never clobbers sibling fields. */
function profilePaths(input: UpdateProfileInput): Record<string, unknown> {
    const set: Record<string, unknown> = {};
    if (input.full_name !== undefined) set['profile.full_name'] = input.full_name;
    if (input.bio !== undefined) set['profile.bio'] = input.bio;
    if (input.phone_number !== undefined) set['profile.phone_number'] = input.phone_number;
    if (input.interests !== undefined) set['profile.interests'] = input.interests;
    for (const [k, v] of Object.entries(input.social_links ?? {})) {
        if (v !== undefined) set[`profile.social_links.${k}`] = v;
    }
    return set;
}

export async function updateProfile(user: IUser, input: UpdateProfileInput): Promise<IUser> {
    const set = profilePaths(input);

    // `{ social_links: {} }` passes the schema's "not empty" refine but resolves to no paths.
    // Mongoose drops an empty $set silently, so without this we would emit a change event for
    // a write that never happened.
    if (Object.keys(set).length === 0) return user;

    const updated = (await User.findOneAndUpdate({ _id: user._id, ...alive }, { $set: set }, { returnDocument: 'after' }))!;

    // changed_fields is load-bearing: relationships.md §4 uses it to skip snapshot rewrites when
    // neither display_name nor avatar_url moved.
    publish('UserProfileUpdated', PRODUCER, {
        user_id: user._id,
        changed_fields: Object.keys(set).map((k) => k.replace(/^profile\./, '')),
    });

    return updated;
}

export async function updateSettings(user: IUser, input: UpdateSettingsInput): Promise<IUser> {
    // Same empty-$set guard as updateProfile.
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input.notifications ?? {})) {
        if (v !== undefined) set[`settings.notifications.${k}`] = v;
    }
    if (input.privacy?.is_profile_public !== undefined) {
        set['settings.privacy.is_profile_public'] = input.privacy.is_profile_public;
    }
    if (input.theme !== undefined) set['settings.theme'] = input.theme;
    if (Object.keys(set).length === 0) return user;

    return (await User.findOneAndUpdate({ _id: user._id, ...alive }, { $set: set }, { returnDocument: 'after' }))!;
}

/** Touch-on-request, used by the admin "Last Active Epoch" column. Fire-and-forget. */
export function touchLastActive(userId: string): void {
    User.updateOne({ _id: userId }, { $set: { last_active_at: new Date() } })
        .exec()
        .catch((err) => console.error('touchLastActive failed:', err));
}


/**
 * Apply a state change and its audit row so that neither can exist without the other.
 *
 *   1. claim   — one atomic conditional update. Losing the race means nothing happened, so there is
 *                nothing to audit and the caller gets a clean 4xx instead of a 500.
 *   2. audit   — only now, and only once, because only one caller got here.
 *   3. rollback — if the audit write fails, undo the claim rather than leave a change with no trail.
 *
 * Earlier this code audited *before* the update, to guarantee no unaudited privilege change. That
 * was wrong under ordinary concurrency: five simultaneous callers wrote five audit rows for one
 * real transition, and a fabricated audit entry is worse than a missing one because it is believed.
 * Claim-then-audit-with-rollback gives both properties instead of trading one for the other.
 */
async function auditedTransition<T>(opts: {
    claim: () => Promise<T | null>;
    conflict: ServiceError;
    audit: (claimed: T) => Promise<unknown>;
    rollback: (claimed: T) => Promise<unknown>;
}): Promise<T> {
    const claimed = await opts.claim();
    if (claimed === null || claimed === undefined) throw opts.conflict;
    const won: T = claimed;

    try {
        await opts.audit(won);
    } catch (auditErr) {
        try {
            await opts.rollback(won);
        } catch (rollbackErr) {
            // Both failed: the change stands with no audit row. Loud, because it needs a human.
            console.error('CRITICAL: audit write failed and rollback failed. Unaudited state change.', {
                auditErr,
                rollbackErr,
            });
        }
        throw auditErr;
    }

    return won;
}

/** Self-service restore window (D11). After this, only an admin can bring the account back. */
export const RESTORE_WINDOW_DAYS = 30;

/**
 * What deletion actually does, stated so the client gate can show it verbatim rather than
 * paraphrasing it (Spec §11.2.1). Versioned: the audit row records which text was agreed to, so
 * changing the wording later does not rewrite what past users consented to.
 */
export const RETENTION_DISCLOSURE_VERSION = '2026-09-06';
export const RETENTION_DISCLOSURE = {
    version: RETENTION_DISCLOSURE_VERSION,
    restore_window_days: RESTORE_WINDOW_DAYS,
    hidden_immediately: [
        'your profile, from search and from everyone else',
        'your account, from the admin user list',
        'your active sessions — you are signed out everywhere',
    ],
    retained_indefinitely: [
        'your profile details, including name, email and phone number',
        'your event registrations and attendance',
        'your points ledger and every transaction in it',
        'your leaderboard placements and team memberships',
        'your challenge submissions and their outcomes',
    ],
    notes: [
        `You can restore your account by signing in within ${RESTORE_WINDOW_DAYS} days.`,
        'Nothing is erased. This platform keeps your data after deletion.',
        'Consenting to research use is optional and does not change what is kept.',
    ],
} as const;

/** Load the caller's own record even when soft-deleted — the only path allowed to see one. */
export async function findSelfIncludingDeleted(id: string): Promise<IUser | null> {
    return User.findOne({ _id: id });
}

export function restorableUntil(deletedAt: Date): Date {
    return new Date(deletedAt.getTime() + RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Deletion hides the account. Nothing is destroyed and no purge job exists (Spec §11.2.1, D10) —
 * the 30 days govern self-service restore, not erasure. The gate that collects this consent must
 * say so; RETENTION_DISCLOSURE is what it should say.
 */
export async function softDelete(
    user: IUser,
    actorId: string,
    opts: { reason?: string | null; research_consent: boolean }
): Promise<{ deleted_at: Date; restorable_until: Date }> {
    const now = new Date();
    const until = restorableUntil(now);

    await auditedTransition<IUser>({
        // Only the caller that flips deleted_at from null proceeds; the rest are already-deleted.
        claim: () =>
            User.findOneAndUpdate(
                { _id: user._id, deleted_at: null },
                {
                    $set: {
                        deleted_at: now,
                        status: UserStatus.DELETED,
                        refresh_token_hash: null,
                        deletion: {
                            reason: opts.reason ?? null,
                            research_consent: opts.research_consent,
                            restorable_until: until,
                            disclosure_version: RETENTION_DISCLOSURE_VERSION,
                        },
                    },
                },
                { returnDocument: 'before' }
            ),
        conflict: new ServiceError(409, 'already_deleted'),
        audit: (before) =>
            recordAudit({
                actor_id: actorId,
                action: 'user.deleted',
                target_type: 'user',
                target_id: user._id,
                previous_value: { status: before.status, deleted_at: null },
                new_value: {
                    status: UserStatus.DELETED,
                    deleted_at: now,
                    research_consent: opts.research_consent,
                    disclosure_version: RETENTION_DISCLOSURE_VERSION,
                    restorable_until: until,
                },
                reason: opts.reason ?? null,
            }),
        rollback: (before) =>
            User.updateOne(
                { _id: user._id },
                { $set: { deleted_at: null, status: before.status, deletion: null } }
            ),
    });

    publish('UserDeleted', PRODUCER, {
        user_id: user._id,
        research_consent: opts.research_consent,
        restorable_until: until,
    });

    return { deleted_at: now, restorable_until: until };
}

/**
 * Undo a deletion (D11). Signing in during the window is what triggers this, so BE-1's login must
 * let a soft-deleted user authenticate — otherwise they can never reach this endpoint.
 */
export async function restoreSelf(user: IUser, actorId: string): Promise<IUser> {
    if (!user.deleted_at) throw new ServiceError(409, 'not_deleted');

    const until = user.deletion?.restorable_until ?? restorableUntil(user.deleted_at);
    if (new Date() > until) throw new ServiceError(410, 'restore_window_expired');

    await auditedTransition<IUser>({
        // Whoever flips deleted_at back to null wins; a double-click loses cleanly with 409.
        claim: () =>
            User.findOneAndUpdate(
                { _id: user._id, deleted_at: { $ne: null } },
                { $set: { deleted_at: null, status: UserStatus.ACTIVE, deletion: null } },
                { returnDocument: 'before' }
            ),
        conflict: new ServiceError(409, 'not_deleted'),
        audit: (prev) =>
            recordAudit({
                actor_id: actorId,
                action: 'user.restored',
                target_type: 'user',
                target_id: user._id,
                previous_value: { status: prev.status, deleted_at: prev.deleted_at },
                new_value: { status: UserStatus.ACTIVE, deleted_at: null },
                reason: 'self-service restore within the window',
            }),
        rollback: (prev) =>
            User.updateOne(
                { _id: user._id },
                { $set: { deleted_at: prev.deleted_at, status: prev.status, deletion: prev.deletion } }
            ),
    });
    publish('UserRestored', PRODUCER, { user_id: user._id });
    return (await User.findById(user._id))!;
}

/**
 * Spec §5.15.5: role changes are audited, and an admin cannot demote their own active session.
 * Promotion to coordinator/founder is refused at the schema (ASSIGNABLE_ROLES) because it requires
 * Founder 2FA that does not exist yet.
 */
export async function changeRole(
    target: IUser,
    newRole: UserRole,
    actor: { id: string; role: UserRole },
    reason: string
): Promise<IUser> {
    if (target._id === actor.id) throw new ServiceError(409, 'cannot_change_own_role');
    // Guard the other direction too: a coordinator must not be demoted by the assignable-role list.
    if (target.role === UserRole.COORDINATOR || target.role === UserRole.FOUNDER) {
        throw new ServiceError(501, 'requires_2fa');
    }
    if (target.role === newRole) throw new ServiceError(409, 'no_change');

    const previous = target.role;

    // Audit BEFORE applying. Mongo is standalone here, so there is no transaction to wrap the pair
    // in; one of the two orderings has to fail badly. If the write lands first and the audit throws,
    // a privilege change exists with no trail — which is exactly what §7.3 forbids. This way a
    // failure leaves an audit row for a change that did not happen, which is detectable (the row's
    // previous_value still matches the live value) and harmless by comparison.
    await recordAudit({
        actor_id: actor.id,
        action: 'user.role_changed',
        target_type: 'user',
        target_id: target._id,
        previous_value: { role: previous },
        new_value: { role: newRole },
        reason,
    });

    const updated = (await User.findOneAndUpdate(
        { _id: target._id, ...alive },
        { $set: { role: newRole } },
        { returnDocument: 'after' }
    ))!;

    publish('UserRoleChanged', PRODUCER, {
        user_id: target._id,
        old_role: previous,
        new_role: newRole,
        changed_by: actor.id,
    });

    return updated;
}

export async function changeStatus(
    target: IUser,
    newStatus: UserStatus,
    actor: { id: string; role: UserRole },
    reason: string
): Promise<IUser> {
    if (target._id === actor.id) throw new ServiceError(409, 'cannot_change_own_status');
    if (target.role === UserRole.FOUNDER) throw new ServiceError(403, 'forbidden');
    if (target.status === newStatus) throw new ServiceError(409, 'no_change');

    const previous = target.status;
    const set: Record<string, unknown> = { status: newStatus };
    // Suspension must end the session, not just flag the account.
    if (newStatus === UserStatus.SUSPENDED) set.refresh_token_hash = null;

    // Audit first — same reasoning as changeRole.
    await recordAudit({
        actor_id: actor.id,
        action: newStatus === UserStatus.SUSPENDED ? 'user.suspended' : 'user.reactivated',
        target_type: 'user',
        target_id: target._id,
        previous_value: { status: previous },
        new_value: { status: newStatus },
        reason,
    });

    const updated = (await User.findOneAndUpdate({ _id: target._id, ...alive }, { $set: set }, { returnDocument: 'after' }))!;

    if (newStatus === UserStatus.SUSPENDED) {
        publish('UserDisabled', PRODUCER, { user_id: target._id, reason, disabled_by: actor.id });
    }

    return updated;
}

export interface ListResult {
    users: IUser[];
    next_cursor: string | null;
}

interface Cursor {
    /** Value of the sort field on the last row of the previous page. `null` is a real value here. */
    v: string | number | null;
    /** Tiebreaker. Without it, rows sharing a sort value straddle the page boundary and vanish. */
    id: string;
}

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');

function decodeCursor(raw: string): Cursor | null {
    try {
        const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
        if (typeof c?.id !== 'string') return null;
        // `v` is client-supplied and lands inside a query filter. Anything but a primitive is a
        // Mongo operator document in disguise: `{ v: { $ne: null } }` becomes `{ field: { $ne: null } }`
        // in the equality branch of keysetFilter. Schema casting happens to reject it on a Number
        // path today, but that is the schema saving us, not this code.
        const t = typeof c.v;
        if (c.v !== null && t !== 'string' && t !== 'number') return null;
        return c;
    } catch {
        return null;
    }
}

/**
 * Keyset pagination on the compound key `(sortField, _id)`, descending.
 *
 * Filtering on the sort field alone is wrong twice over: rows that tie with the boundary value are
 * skipped entirely, and a null boundary value ends the walk early. Both matter here — `points_balance`
 * defaults to 0 for everyone, and `last_active_at` is null until a user first calls `/users/me`.
 *
 * BSON orders null before every number and date, so a descending sort puts nulls last; the null
 * branch therefore only has to continue on `_id`, and the non-null branch has to reach forward into
 * the nulls explicitly because `$lt` is type-bracketed and never matches null on its own.
 */
function keysetFilter(sort: string, c: Cursor): Record<string, unknown> {
    if (c.v === null) {
        return { [sort]: null, _id: { $lt: c.id } };
    }
    return {
        $or: [
            { [sort]: { $lt: c.v } },
            { [sort]: c.v, _id: { $lt: c.id } },
            { [sort]: null },
        ],
    };
}

/** Admin table (Spec §5.15.5). Keyset pagination — no skip/offset. */
export async function listUsers(input: ListUsersInput): Promise<ListResult> {
    const filter: Record<string, unknown> = { ...alive };
    if (input.role) filter.role = input.role;
    if (input.status) filter.status = input.status;
    if (input.q) filter.$text = { $search: input.q };

    const created: Record<string, Date> = {};
    if (input.joined_after) created.$gte = input.joined_after;
    if (input.joined_before) created.$lte = input.joined_before;
    if (Object.keys(created).length) filter.created_at = created;

    const conditions: Record<string, unknown>[] = [filter];
    if (input.cursor) {
        const c = decodeCursor(input.cursor);
        if (!c) throw new ServiceError(422, 'invalid_cursor');
        conditions.push(keysetFilter(input.sort, c));
    }

    const query = conditions.length > 1 ? { $and: conditions } : filter;

    const users = await User.find(query)
        .sort({ [input.sort]: -1, _id: -1 })
        .limit(input.limit + 1);

    const hasMore = users.length > input.limit;
    const page = hasMore ? users.slice(0, input.limit) : users;
    const last = page[page.length - 1];

    let next_cursor: string | null = null;
    if (hasMore && last) {
        const raw = (last as unknown as Record<string, unknown>)[input.sort];
        next_cursor = encodeCursor({
            v: raw instanceof Date ? raw.toISOString() : ((raw as number | null) ?? null),
            id: last._id,
        });
    }

    return { users: page, next_cursor };
}

/**
 * User search (Spec §13.1). Elasticsearch is out of MVP; a Mongo text index covers campus scale.
 * ponytail: text index. Swap for Elasticsearch when fuzzy/typo tolerance is actually needed.
 */
export async function searchUsers(q: string, limit: number): Promise<IUser[]> {
    const filter = { ...alive, status: { $in: [UserStatus.ACTIVE, UserStatus.PENDING_VERIFICATION] } };

    let byText: IUser[] = [];
    try {
        byText = await User.find({ ...filter, $text: { $search: q } }, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit);
    } catch (err) {
        // IndexNotFound (27): the text index has not finished building, or the collection predates it.
        // Search degrading to prefix-only beats search returning 500.
        if ((err as { code?: number }).code !== 27) throw err;
        console.error('User text index missing — falling back to prefix search.');
    }
    if (byText.length > 0) return byText;

    // A text index only matches whole words, so "an" never finds "ana". Fall back to a prefix scan,
    // which is what a search-as-you-type box actually needs.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return User.find({ ...filter, username: { $regex: `^${safe}`, $options: 'i' } }).limit(limit);
}

export async function snapshots(ids: string[]): Promise<IUser[]> {
    return User.find({ _id: { $in: ids } }); // includes soft-deleted: snapshots must still resolve
}

/**
 * Who may this viewer see full PII for?
 *
 * Spec §11.2 says "friends or admin roles" without naming them. Resolved as: Coordinator+ always;
 * Core only for users registered in an event they administer (Spec §7.1 grants Core "full access to
 * manage events they are assigned to", and §5.5 puts coordinator contact points on the event page).
 * Everyone else, never.
 *
 * `'all'` and `'none'` cost nothing. Only a Core viewer pays the two queries, and the result is a
 * set so a page of search results is one lookup rather than one per row.
 */
export type PiiScope = 'all' | 'none' | Set<string>;

export async function piiScopeFor(viewer?: { id: string; role: UserRole }): Promise<PiiScope> {
    if (!viewer) return 'none';
    if (viewer.role === UserRole.COORDINATOR || viewer.role === UserRole.FOUNDER) return 'all';
    if (viewer.role !== UserRole.CORE) return 'none';

    const { Event } = await import('@bgsc/shared');
    const { FormSubmission } = await import('@bgsc/shared');

    // Every event this Core admin is assigned to, cancelled ones included — a cancelled event still
    // needs its participants contacted.
    const eventIds = await Event.find({ core_admins: viewer.id, deleted_at: null }).distinct('_id');
    if (eventIds.length === 0) return 'none';

    const userIds = await FormSubmission.find({
        'owner.type': 'event',
        'owner.id': { $in: eventIds },
        status: 'confirmed',
    }).distinct('user.user_id');

    return new Set<string>(userIds as string[]);
}

/** `elevated` flag for one target, given a resolved scope. */
export function scopeAllows(scope: PiiScope, targetId: string): boolean {
    if (scope === 'all') return true;
    if (scope === 'none') return false;
    return scope.has(targetId);
}

/** Re-exported so callers importing the service do not need a second import. */
export { ServiceError };
