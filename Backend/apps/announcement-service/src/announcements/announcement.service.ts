import {
    ANNOUNCEMENT_PRIORITY,
    ANNOUNCEMENT_STATUS,
    Announcement,
    AnnouncementStatus,
    AuditLog,
    Event,
    IAnnouncement,
    IAuditLog,
    IUser,
    ROLE_GATED_CATEGORY,
    ROLE_GATED_MIN_ROLE,
    RoleName,
    ServiceError,
    User,
    UserRole,
    UserStatus,
    expiryFor,
    isVisibleTo,
    publish,
    recordAudit,
    roleRank,
    userSnapshotOf,
} from '@bgsc/shared';
import { Error as MongooseError } from 'mongoose';
import { v4 as uuid } from 'uuid';
import {
    Order,
    Viewer,
    alive,
    allOf,
    audienceFilter,
    encodeCursor,
    keysetFilter,
    rankFilter,
} from './audience';
import {
    CreateAnnouncementInput,
    ListAnnouncementsInput,
    RecordDeliveryInput,
    UpdateAnnouncementInput,
} from './announcement.schemas';

/**
 * Data access, invariant guards and domain events. HTTP concerns stay in the controller.
 *
 * Audit policy. Mongo runs standalone here, so a write and its audit row cannot commit together
 * and the order decides which half-failure is possible:
 *
 *  - create / update audit FIRST. A failed audit refuses the write (500, nothing changed). A write
 *    that fails after its row leaves a row for a change that never landed — detectable, and the
 *    same trade `user-service`'s `changeRole` makes.
 *  - compare-and-swap transitions (publish, schedule, unschedule, delete, the scheduler) audit
 *    AFTER winning the claim. Auditing first would also record the loser of every double-click.
 *    The transition has committed by then and its event must still go out, so a failed audit is
 *    logged loudly rather than thrown — a 500 would tell the client a publish that went out did not.
 */

const PRODUCER = 'announcement-service';

/**
 * The fourth author field the shared `userSnapshotOf` does not carry. Snapshotted at create, so
 * the announcement stays attributed as it was written even if the author is promoted later
 * (Spec §5.2: attribution is historical).
 */
const ROLE_LABEL: Record<RoleName, string> = {
    guest: 'Guest',
    user: 'Member',
    member: 'Member',
    core: 'Core',
    coordinator: 'Coordinator',
    founder: 'Founder',
};

const priorityRank = (p: string) => ANNOUNCEMENT_PRIORITY.indexOf(p as never);

/**
 * Identity recorded on a write. `id` is null only for a system action (the scheduler). `ip` follows
 * `req.ip`, which is the client's address because the gateway appends it to X-Forwarded-For and
 * `createServiceApp` trusts exactly that one hop.
 */
export interface Actor {
    id: string | null;
    ip: string | null;
}

/** A person making a write. The scheduler is an Actor, never an Editor. */
export interface Editor extends Actor {
    id: string;
    /** The live role from `requireActiveUser`, not the token's claim. */
    role: RoleName;
}

/**
 * How each status lists. Published and archived read newest first; drafts have no publish time, so
 * newest-created first; scheduled items are a queue, so soonest first — the next thing to go out is
 * the thing the composer needs to see.
 */
const ORDER: Record<AnnouncementStatus, Order> = {
    draft: { field: 'created_at', dir: -1 },
    scheduled: { field: 'scheduled_for', dir: 1 },
    published: { field: 'published_at', dir: -1 },
    archived: { field: 'published_at', dir: -1 },
};

/**
 * Safety bound on the pinned scan, not a page size — pinning is meant to be a handful of
 * announcements at a time. If it is ever genuinely exceeded, the fix is a numeric `priority_rank`
 * on the model so Mongo can do the ordering, not a larger scan.
 */
const PINNED_SCAN_CAP = 100;

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */

/**
 * The model's `pre('validate')` hook throws a plain Error, which the shared handler reports as a
 * 500. Every refusal below therefore has to happen *before* `.save()`, or a client typo reads as
 * a server fault.
 */
async function assertEventExists(eventId: string): Promise<void> {
    if (!(await Event.exists({ _id: eventId, deleted_at: null }))) {
        throw new ServiceError(404, 'event_not_found');
    }
}

/** Defence in depth: today's composer floor is already core, which is also the teams floor. */
function assertMayTagTeams(categories: string[], role: RoleName): void {
    if (categories.includes(ROLE_GATED_CATEGORY) && roleRank(role) < roleRank(ROLE_GATED_MIN_ROLE)) {
        throw new ServiceError(403, 'forbidden');
    }
}

/**
 * A composer may not write an announcement they themselves could not read. Without this, a core
 * member can target `founder` and lose sight of their own post the moment it is saved.
 */
function assertMinRoleWithinRank(minRole: RoleName | undefined, role: RoleName): void {
    if (minRole && roleRank(minRole) > roleRank(role)) {
        throw new ServiceError(422, 'min_role_above_own_rank');
    }
}

/**
 * `pinned_until <= expires_at` is a model invariant, but a draft has no `expires_at` — the hook's
 * guard short-circuits on null and lets any pin date through. It only becomes checkable at the
 * moment a publish time is known, and by then the hook's failure is a 500 (or, on the scheduler's
 * `findOneAndUpdate` path, no failure at all: query updates skip document middleware entirely and
 * would write an invalid document in silence).
 */
function assertPinWithinExpiry(a: IAnnouncement, publishAt: Date): void {
    if (a.pinned_until && a.pinned_until > expiryFor(publishAt)) {
        throw new ServiceError(422, 'pinned_until_after_expiry');
    }
}

/**
 * A live announcement the editor's rank can see. Every write goes through the same rank gate as
 * `GET /:id`, with the same 404 — otherwise a known id is a way to edit what you cannot read.
 */
async function loadForEdit(id: string, editor: Editor) {
    const a = await Announcement.findOne({ _id: id, ...alive, ...rankFilter(editor.role) });
    if (!a) throw new ServiceError(404, 'announcement_not_found');
    await assertMayEdit(a, editor);
    return a;
}

/** `ROLE_LABEL` read backwards, for an author whose account no longer exists. */
const RANK_OF_LABEL: Record<string, RoleName> = {
    Guest: 'guest',
    Member: 'member',
    Core: 'core',
    Coordinator: 'coordinator',
    Founder: 'founder',
};

/**
 * Owner decision (audit #2): an announcement is changed only by its author, or by someone who
 * STRICTLY outranks the author. Before this, any core member could rewrite, publish or delete a
 * coordinator's post as long as its audience floor was within their rank.
 *
 * The author's rank is their live role — a demoted author no longer shields their posts from the
 * rank they left, and a promoted one gains the protection. An author whose account is gone falls
 * back to the historical `role_label`. 403, not 404: the editor can already read it.
 */
async function assertMayEdit(a: Pick<IAnnouncement, 'author'>, editor: Editor): Promise<void> {
    if (a.author.user_id === editor.id) return;
    const author = await User.findById(a.author.user_id).select('role').lean<{ role: RoleName }>();
    const authorRole = author?.role ?? RANK_OF_LABEL[a.author.role_label] ?? 'founder';
    if (roleRank(editor.role) <= roleRank(authorRole)) {
        throw new ServiceError(403, 'not_author_or_senior');
    }
}

/**
 * Perform a status transition as a compare-and-swap, so two concurrent callers cannot both make it.
 *
 * A read-then-write check lets both halves of a double-clicked Publish through — and each emits
 * its own `AnnouncementPublished`. Week 4's Broadcast Service turns that into two WhatsApp sends to
 * every mapped community group, which is exactly what Spec §9.4's rate limit exists to prevent.
 *
 * Filtering on the statuses the transition is legal *from* means the loser matches nothing. On a
 * miss, "gone" and "someone else got there" are different answers, so they get different codes.
 */
async function claim(
    id: string,
    editor: Editor,
    from: readonly AnnouncementStatus[],
    set: Record<string, unknown>,
    lostCode: string,
    publishAt?: Date
): Promise<IAnnouncement> {
    const scope = { _id: id, ...alive, ...rankFilter(editor.role) };
    // Authorship first: `author` never changes, so a check ahead of the CAS cannot go stale.
    const target = await Announcement.findOne(scope).select('author').lean<Pick<IAnnouncement, 'author'>>();
    if (!target) throw new ServiceError(404, 'announcement_not_found');
    await assertMayEdit(target, editor);

    const claimed = await Announcement.findOneAndUpdate(
        { ...scope, status: { $in: from }, ...(publishAt ? pinFitsExpiry(publishAt) : {}) },
        { $set: set },
        { returnDocument: 'after' }
    );
    if (claimed) return claimed;
    if (!(await Announcement.exists(scope))) throw new ServiceError(404, 'announcement_not_found');
    // Still claimable by status, so it was the pin that refused: a PATCH moved `pinned_until` after
    // this request's own check ran.
    if (publishAt && (await Announcement.exists({ ...scope, status: { $in: from } }))) {
        throw new ServiceError(422, 'pinned_until_after_expiry');
    }
    throw new ServiceError(409, lostCode);
}

/**
 * `assertPinWithinExpiry` again, inside the claim's filter. The assert ran on the document this
 * request loaded; a draft PATCH of `pinned_until` can land between that load and the claim, and the
 * claim is a query update — no hook — so it would publish a pin that outlasts the announcement.
 */
function pinFitsExpiry(publishAt: Date): Record<string, unknown> {
    return { $or: [{ pinned_until: null }, { pinned_until: { $lte: expiryFor(publishAt) } }] };
}

/** The committed-transition half of the audit policy (file header). Never throws. */
async function auditCommitted(entry: Parameters<typeof recordAudit>[0]): Promise<void> {
    try {
        await recordAudit(entry);
    } catch (err) {
        console.error('[announcement-service] AUDIT WRITE FAILED after commit:', {
            action: entry.action,
            target_id: entry.target_id,
            err,
        });
    }
}

/**
 * The `$set` that publishes. `expires_at` is written explicitly because every publish goes through
 * a query update, which runs no document middleware. The 'teams' role floor needs no such
 * treatment: the hook raised it on the save that created the draft, so it is correct on disk.
 *
 * `delivery.*.requested`: Spec §6.4 auto-sends WhatsApp on publish. Week 4's Broadcast Service reads
 * these flags and writes the per-category rows back.
 */
export function publishedSet(now: Date): Record<string, unknown> {
    return {
        status: 'published',
        published_at: now,
        expires_at: expiryFor(now),
        'delivery.whatsapp.requested': true,
        'delivery.push.requested': true,
    };
}

/** Everything that follows a won publish claim, for the HTTP path and the scheduler alike. */
export async function announcePublished(a: IAnnouncement, actor: Actor): Promise<void> {
    publish('AnnouncementPublished', PRODUCER, {
        announcement_id: a._id,
        categories: a.categories,
        priority: a.priority,
        author_user_id: a.author.user_id,
        audience: a.audience,
    });
    await auditCommitted({
        actor_id: actor.id,
        action: 'announcement.published',
        target_type: 'announcement',
        target_id: a._id,
        new_value: { published_at: a.published_at, expires_at: a.expires_at },
        ip: actor.ip,
    });
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function get(id: string, viewer: Viewer, isAdmin: boolean): Promise<IAnnouncement> {
    const a = await Announcement.findOne({ _id: id, ...alive }).lean();
    // 404 rather than 403 throughout: a viewer who may not see an announcement should not learn
    // that it exists.
    if (!a) throw new ServiceError(404, 'announcement_not_found');

    // core+ bypasses the status and event gates, or the composer could not open its own draft —
    // isVisibleTo() refuses everything that is not published, which is right for everyone else.
    // The rank gate is never bypassed: a core member does not read a founder-only announcement.
    const visible = isAdmin
        ? roleRank(viewer.role) >= roleRank(a.audience.min_role)
        : isVisibleTo(a, viewer);
    if (!visible) throw new ServiceError(404, 'announcement_not_found');
    return a as unknown as IAnnouncement;
}

export interface ListResult {
    announcements: IAnnouncement[];
    next_cursor: string | null;
}

export async function list(
    viewer: Viewer,
    input: ListAnnouncementsInput,
    isAdmin: boolean
): Promise<ListResult> {
    // A non-admin is pinned to 'published' whatever the query string says.
    const status = isAdmin ? input.status ?? 'published' : 'published';
    const order = ORDER[status];

    const conditions: Record<string, unknown>[] = [
        // The event gate is for readers. A composer needs every scope — a coordinator who is not
        // registered for event X still has to find the announcement they scoped to it — and
        // `GET /:id` bypasses the same gates for core+, so the list matches it. The rank gate
        // stays, exactly as it does there.
        isAdmin ? { ...alive, status, ...rankFilter(viewer.role) } : audienceFilter(viewer),
    ];
    if (input.category) conditions.push({ categories: input.category });
    if (input.priority) conditions.push({ priority: input.priority });
    if (input.event_id) conditions.push({ 'audience.event_id': input.event_id });
    // "My drafts" for the composer; "everything this head has said" for a reader.
    if (input.author_id) conditions.push({ 'author.user_id': input.author_id });
    if (input.pinned) conditions.push({ pinned_until: { $gt: new Date() } });
    if (input.cursor) conditions.push(keysetFilter(order, input.cursor));

    const query = allOf(conditions);
    // `$text` must be top level and may not sit inside `$or`; keeping it out of the `$and` array
    // removes the question entirely. It does mean the text index drives the scan, so the sort
    // below becomes an in-memory sort — fine inside a 4-month window.
    if (input.q) query.$text = { $search: input.q };

    // The pinned list is ordered by priority, which Mongo cannot do (below), so the *whole* set
    // has to come back before the limit is applied. Fetching `limit + 1` and reordering the page
    // would answer the banner's `limit=1` with whatever is newest — the one question it is asked.
    const docs = await Announcement.find(query)
        .sort({ [order.field]: order.dir, _id: order.dir })
        .limit(input.pinned ? PINNED_SCAN_CAP : input.limit + 1)
        .lean();

    // The banner: `priority` is a string enum, so sorting it in Mongo gives
    // urgent > normal > important — alphabetical, and wrong. Ordered here instead, over the
    // whole pinned set, then cut to the page.
    if (input.pinned) {
        docs.sort(
            (a, b) =>
                priorityRank(b.priority) - priorityRank(a.priority) ||
                (b.published_at?.getTime() ?? 0) - (a.published_at?.getTime() ?? 0)
        );
        return { announcements: docs.slice(0, input.limit), next_cursor: null };
    }

    const hasMore = docs.length > input.limit;
    const page = hasMore ? docs.slice(0, input.limit) : docs;
    const last = page[page.length - 1];

    let next_cursor: string | null = null;
    if (hasMore && last) {
        const boundary = last[order.field] as Date;
        next_cursor = encodeCursor({ f: order.field, v: boundary.toISOString(), id: last._id });
    }

    return { announcements: page, next_cursor };
}

export interface HeadEntry {
    coordinator: { user_id: string; display_name: string; avatar_url: string | null; role_label: string };
    announcement: IAnnouncement | null;
}

/**
 * Spec §5.2 Tab 1, "What Our Heads Have to Say": the latest announcement per coordinator.
 *
 * Driven by who holds the role *today*, not by `author.role_label` — that field is a deliberate
 * historical snapshot, so grouping on it would keep a demoted coordinator in the strip forever.
 * Returning an entry with `announcement: null` is what makes the Spec's "if a coordinator has no
 * announcements, a meme is displayed" implementable on the client.
 */
export async function heads(viewer: Viewer): Promise<HeadEntry[]> {
    const coordinators = await User.find({
        role: { $in: [UserRole.COORDINATOR, UserRole.FOUNDER] },
        status: UserStatus.ACTIVE,
        deleted_at: null,
    }).select('_id username role profile.full_name profile.avatar_url');

    if (coordinators.length === 0) return [];

    const latest = await Announcement.aggregate<{ _id: string; doc: IAnnouncement }>([
        { $match: allOf([audienceFilter(viewer), { 'author.user_id': { $in: coordinators.map((c) => c._id) } }]) },
        { $sort: { published_at: -1 } },
        { $group: { _id: '$author.user_id', doc: { $first: '$$ROOT' } } },
    ]);

    const byAuthor = new Map(latest.map((row) => [row._id, row.doc]));

    return coordinators.map((c) => ({
        coordinator: { ...userSnapshotOf(c), role_label: ROLE_LABEL[c.role as RoleName] },
        announcement: byAuthor.get(c._id) ?? null,
    }));
}

/**
 * Every audit row written against one announcement, newest first. Deleted announcements included:
 * "who deleted this" is the question a trail is most often opened to answer.
 */
export async function auditTrail(id: string): Promise<IAuditLog[]> {
    // No rank filter: the route floor is founder, the top of the ladder.
    if (!(await Announcement.exists({ _id: id }))) {
        throw new ServiceError(404, 'announcement_not_found');
    }
    return AuditLog.find({ target_type: 'announcement', target_id: id })
        .sort({ created_at: -1 })
        .limit(50)
        .lean<IAuditLog[]>();
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/** `author` is the live user document `requireActiveUser` loaded — its role, not the token's. */
export async function create(input: CreateAnnouncementInput, author: IUser, actor: Actor): Promise<IAnnouncement> {
    assertMayTagTeams(input.categories, author.role);
    assertMinRoleWithinRank(input.audience?.min_role, author.role);
    if (input.audience?.event_id) await assertEventExists(input.audience.event_id);

    const a = new Announcement({
        _id: uuid(),
        title: input.title,
        body: input.body,
        media_url: input.media_url ?? null,
        categories: input.categories,
        tags: input.tags ?? [],
        priority: input.priority ?? 'normal',
        audience: {
            // The model raises this to `core` on its own when 'teams' is tagged. Not rejected
            // here: silent correction is the documented behaviour, and the response echoes the
            // stored document so the composer sees what was actually saved.
            min_role: input.audience?.min_role ?? 'guest',
            event_id: input.audience?.event_id ?? null,
        },
        author: { ...userSnapshotOf(author), role_label: ROLE_LABEL[author.role] },
        status: 'draft',
        scheduled_for: null,
        published_at: null,
        expires_at: null,
        pinned_until: input.pinned_until ?? null,
    });

    // Validate first so the audit row records what the hook corrected (the 'teams' raise), then
    // audit, then write — the audit policy in the file header.
    await a.validate();
    await recordAudit({
        actor_id: actor.id,
        action: 'announcement.created',
        target_type: 'announcement',
        target_id: a._id,
        new_value: { title: a.title, categories: a.categories, audience: a.audience, status: a.status },
        ip: actor.ip,
    });
    await a.save();
    return a;
}

export async function update(id: string, patch: UpdateAnnouncementInput, editor: Editor): Promise<IAnnouncement> {
    const a = await loadForEdit(id, editor);

    // announcement-model.md §2.2: once it has left draft, categories and audience are frozen —
    // the WhatsApp fan-out already went out against them, and Week 4 re-deriving from a changed
    // list would double-send. The model does not enforce this; it has to be refused here.
    const touchesAudience =
        patch.audience && (patch.audience.min_role !== undefined || patch.audience.event_id !== undefined);
    if (a.status !== 'draft' && (patch.categories || touchesAudience)) {
        throw new ServiceError(409, 'categories_frozen_after_publish');
    }

    if (patch.categories) assertMayTagTeams(patch.categories, editor.role);
    assertMinRoleWithinRank(patch.audience?.min_role, editor.role);
    if (patch.audience?.event_id) await assertEventExists(patch.audience.event_id);

    const before = a.toObject();

    if (patch.title !== undefined) a.title = patch.title;
    if (patch.body !== undefined) a.body = patch.body;
    if (patch.media_url !== undefined) a.media_url = patch.media_url;
    if (patch.categories !== undefined) a.categories = patch.categories;
    if (patch.tags !== undefined) a.tags = patch.tags;
    if (patch.priority !== undefined) a.priority = patch.priority;
    if (patch.pinned_until !== undefined) a.pinned_until = patch.pinned_until;
    if (patch.audience) {
        if (patch.audience.min_role !== undefined) a.audience.min_role = patch.audience.min_role;
        if (patch.audience.event_id !== undefined) a.audience.event_id = patch.audience.event_id;
    }

    // A published announcement has expires_at already; a scheduled one has a known publish time.
    // Both are checkable here, and checking here is the only chance for the scheduled case — the
    // tick publishes it through findOneAndUpdate, which runs no validation at all.
    const publishAt = a.published_at ?? a.scheduled_for;
    if (publishAt) assertPinWithinExpiry(a, publishAt);

    // Run the hook before diffing, so a corrected value is what gets recorded.
    await a.validate();
    const { previous, next } = diffPair(before, a.toObject());
    // A patch that restates current values changes nothing: no row, no event, no write.
    if (Object.keys(next).length === 0) return a;

    await recordAudit({
        actor_id: editor.id,
        action: 'announcement.updated',
        target_type: 'announcement',
        target_id: a._id,
        previous_value: previous,
        new_value: next,
        ip: editor.ip,
    });

    // Every guard above ran against the status this request loaded. If a publish, the scheduler
    // or a delete moved the document since, the save must not land — otherwise a category edit
    // checked against 'draft' reaches an announcement whose fan-out already went out.
    a.$where = { status: a.status, deleted_at: null };
    try {
        await a.save();
    } catch (err) {
        // Not-found for a scalar edit; VersionError when the edit touched an array (categories,
        // tags), because Mongoose adds `__v` to the same conditional update.
        if (err instanceof MongooseError.DocumentNotFoundError || err instanceof MongooseError.VersionError) {
            throw new ServiceError(409, 'announcement_changed');
        }
        throw err;
    }

    publish('AnnouncementUpdated', PRODUCER, { announcement_id: a._id, changed_fields: Object.keys(next) });
    return a;
}

/** Two-sided diff: previous = old values of changed keys, next = new values. */
function diffPair(
    before: object,
    after: object
): { previous: Record<string, unknown>; next: Record<string, unknown> } {
    const previous: Record<string, unknown> = {};
    const next: Record<string, unknown> = {};
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    for (const k of Object.keys(a)) {
        if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
            previous[k] = b[k];
            next[k] = a[k];
        }
    }
    return { previous, next };
}

/** Send Now (no `scheduledFor`) and Schedule for Later are one route — Spec §6.4 is one control. */
export async function publishOrSchedule(
    id: string,
    scheduledFor: Date | undefined,
    editor: Editor
): Promise<IAnnouncement> {
    const a = await loadForEdit(id, editor);
    if (a.status === 'published' || a.status === 'archived') {
        throw new ServiceError(409, 'already_published');
    }

    if (scheduledFor) {
        // Without this the tick would publish it a minute later, which is a confusing way to
        // say "now".
        if (scheduledFor.getTime() <= Date.now()) {
            throw new ServiceError(422, 'scheduled_for_must_be_future');
        }
        assertPinWithinExpiry(a, scheduledFor);

        // From 'scheduled' too: moving a scheduled announcement to another time is a reschedule,
        // not a second publish, and should not need an unschedule round-trip first.
        const scheduled = await claim(
            id,
            editor,
            ['draft', 'scheduled'],
            { status: 'scheduled', scheduled_for: scheduledFor },
            'already_published',
            scheduledFor
        );

        publish('AnnouncementScheduled', PRODUCER, {
            announcement_id: scheduled._id,
            scheduled_for: scheduled.scheduled_for,
        });
        await auditCommitted({
            actor_id: editor.id,
            action: 'announcement.scheduled',
            target_type: 'announcement',
            target_id: scheduled._id,
            new_value: { scheduled_for: scheduled.scheduled_for },
            ip: editor.ip,
        });
        return scheduled;
    }

    const now = new Date();
    assertPinWithinExpiry(a, now);

    const published = await claim(id, editor, ['draft', 'scheduled'], publishedSet(now), 'already_published', now);
    await announcePublished(published, editor);
    return published;
}

export async function unschedule(id: string, editor: Editor): Promise<IAnnouncement> {
    // Compare-and-swap on status='scheduled': a concurrent publishOrSchedule would otherwise
    // be silently overwritten — `status='published'` would revert to `'draft'`, the emitted
    // AnnouncementPublished would point at a doc that no longer reflects it.
    const a = await claim(id, editor, ['scheduled'], { status: 'draft', scheduled_for: null }, 'not_scheduled');

    await auditCommitted({
        actor_id: editor.id,
        action: 'announcement.unscheduled',
        target_type: 'announcement',
        target_id: a._id,
        previous_value: { status: 'scheduled' },
        new_value: { status: 'draft', scheduled_for: null },
        ip: editor.ip,
    });
    return a;
}

export async function remove(id: string, editor: Editor): Promise<IAnnouncement> {
    // The `alive` precondition inside `claim` is what makes this a CAS: the second of two
    // concurrent deletes matches nothing and answers 404, so `AnnouncementDeleted` is emitted once.
    const deleted = await claim(id, editor, ANNOUNCEMENT_STATUS, { deleted_at: new Date() }, 'announcement_not_found');

    publish('AnnouncementDeleted', PRODUCER, { announcement_id: deleted._id, deleted_by: editor.id });
    await auditCommitted({
        actor_id: editor.id,
        action: 'announcement.deleted',
        target_type: 'announcement',
        target_id: deleted._id,
        previous_value: { deleted_at: null },
        new_value: { deleted_at: deleted.deleted_at },
        ip: editor.ip,
    });
    return deleted;
}

/* ------------------------------------------------------------------ *
 * Delivery writeback
 * ------------------------------------------------------------------ */

type StoredDeliveryRow = IAnnouncement['delivery']['whatsapp']['per_category'][number];

const MASK = '••••';
const UNMAPPED = '(unmapped)';

/**
 * The composer's label for a destination: enough to tell two groups apart, not the destination.
 * Idempotent — an already-masked label (what the Notification Service sends) passes unchanged —
 * which is what lets `maskLegacyGroupIds` run on every boot. Mirrors `dispatch.ts:maskDestination`.
 */
export function maskGroupId(groupId: string): string {
    if (groupId === UNMAPPED || groupId.startsWith(MASK)) return groupId;
    return groupId.length <= 4 ? MASK : `${MASK}${groupId.slice(-4)}`;
}

/**
 * One-off repair, run idempotently at boot: receipts written before masking existed carry the raw
 * destination (a phone number — PII) in `delivery.whatsapp.per_category.group_id`. Masks them in
 * place and touches nothing else; a second run finds nothing to do.
 *
 * ponytail: loads each affected document. There are a handful — WhatsApp never ran configured in
 * production — so no bulk pipeline.
 */
export async function maskLegacyGroupIds(): Promise<number> {
    const legacy = await Announcement.find({
        'delivery.whatsapp.per_category': {
            $elemMatch: { group_id: { $nin: [UNMAPPED], $not: new RegExp(`^${MASK}`) } },
        },
    })
        .select('delivery.whatsapp.per_category')
        .lean<Pick<IAnnouncement, '_id' | 'delivery'>[]>();

    let masked = 0;
    for (const a of legacy) {
        for (const row of a.delivery.whatsapp.per_category) {
            const label = maskGroupId(row.group_id);
            if (label === row.group_id) continue;
            // Guarded on the raw value, so a receipt that landed in between is not overwritten.
            await Announcement.updateOne(
                { _id: a._id },
                { $set: { 'delivery.whatsapp.per_category.$[r].group_id': label } },
                { arrayFilters: [{ 'r.category': row.category, 'r.group_id': row.group_id }] }
            );
            masked += 1;
        }
    }
    return masked;
}

/**
 * Write one category's receipt, newest-wins. Returns whether it landed.
 *
 * Two writers call this for the same announcement — the broadcast's own writeback and the
 * notification sweep's retry — and their requests can arrive in either order. Two rules make the
 * outcome independent of that order:
 *
 *  - The dispatch row's `revision` travels with the receipt, and an in-place update applies only
 *    over an OLDER one. A stale snapshot arriving last matches nothing and is dropped, instead of
 *    putting `pending` back over `sent`.
 *  - When the category has no row yet, both writers miss the update and race to append. The `$ne`
 *    guard lets only one append; the loser must not treat that as done — its receipt may be the
 *    newer — so it goes round once more and lands through the revision-guarded update.
 *
 * `alive` is on every write, not only on the load: a delete can land in between, and a receipt
 * written onto a soft-deleted announcement is a write to a document no read path returns.
 */
async function applyWhatsAppRow(id: string, stored: StoredDeliveryRow): Promise<boolean> {
    for (let pass = 0; pass < 2; pass += 1) {
        const updated = await Announcement.updateOne(
            {
                _id: id,
                ...alive,
                'delivery.whatsapp.per_category': {
                    // `$not: { $gte }` so a row stored before `revision` existed is still replaceable.
                    $elemMatch: { category: stored.category, revision: { $not: { $gte: stored.revision } } },
                },
            },
            { $set: { 'delivery.whatsapp.per_category.$[r]': stored } },
            { arrayFilters: [{ 'r.category': stored.category }] }
        );
        if ((updated.matchedCount ?? 0) > 0) return true;

        const appended = await Announcement.updateOne(
            { _id: id, ...alive, 'delivery.whatsapp.per_category.category': { $ne: stored.category } },
            { $push: { 'delivery.whatsapp.per_category': stored } }
        );
        if ((appended.matchedCount ?? 0) > 0) return true;
        // Neither matched: the row exists with a revision at least as new (stale — the second pass
        // misses again and we stop), or another writer appended it a moment ago (the second pass
        // replaces it if ours is newer).
    }
    return false;
}

/**
 * Record what the Notification Service's broadcast actually did, per channel.
 *
 * The internal route was built only once it had a caller: Week 4's broadcast is
 * that caller. It is the ONLY write to `delivery.*` — publishing sets the two `requested` flags and
 * nothing else, because group ids are the broadcaster's configuration, not this service's.
 *
 * Every refusal happens before any write. Query updates run no document middleware, so the model's
 * `pre('validate')` guard on `delivery.whatsapp.per_category[].category` never fires here — and it
 * throws a plain `Error`, which would surface as a 500 for what is a caller mistake.
 */
export async function recordDelivery(id: string, input: RecordDeliveryInput): Promise<IAnnouncement> {
    const a = await Announcement.findOne({ _id: id, ...alive });
    if (!a) throw new ServiceError(404, 'announcement_not_found');
    // Delivery describes a broadcast, and only a published announcement has had one. An archived
    // one still accepts a late receipt: it was published, it just aged out of the feed.
    if (a.status !== 'published' && a.status !== 'archived') {
        throw new ServiceError(409, 'not_published');
    }

    for (const row of input.whatsapp ?? []) {
        if (!a.categories.includes(row.category)) {
            throw new ServiceError(422, 'category_not_on_announcement', { category: row.category });
        }
    }

    for (const row of input.whatsapp ?? []) {
        const stored = {
            category: row.category,
            // Masked here as well as by the sender: this document is served to every core+ reader,
            // so a raw destination must not land on it whoever sent it.
            group_id: maskGroupId(row.group_id),
            status: row.status,
            message_id: row.message_id ?? null,
            attempted_at: row.attempted_at ?? null,
            error: row.error ?? null,
            revision: row.revision,
        };

        if (await applyWhatsAppRow(id, stored)) {
            publish('AnnouncementDelivered', PRODUCER, {
                announcement_id: id,
                channel: 'whatsapp',
                category: row.category,
                status: row.status,
            });
        }
    }

    if (input.push) {
        // `$not: { $gte }` rather than `$lt`, so a document written before `revision` existed
        // (the field absent) still accepts its first receipt.
        const applied = await Announcement.updateOne(
            { _id: id, ...alive, 'delivery.push.revision': { $not: { $gte: input.push.revision } } },
            {
                $set: {
                    'delivery.push.status': input.push.status,
                    'delivery.push.sent_count': input.push.sent_count ?? null,
                    'delivery.push.revision': input.push.revision,
                },
            }
        );
        if ((applied.matchedCount ?? 0) > 0) {
            publish('AnnouncementDelivered', PRODUCER, {
                announcement_id: id,
                channel: 'push',
                category: null,
                status: input.push.status,
            });
        }
    }

    // No audit row: `AuditLog` records human actions with an actor and an IP (AuditLog.ts), and the
    // delivery block already carries the full per-category history of the machine ones.
    const fresh = await Announcement.findOne({ _id: id, ...alive });
    if (!fresh) throw new ServiceError(404, 'announcement_not_found');
    return fresh;
}
