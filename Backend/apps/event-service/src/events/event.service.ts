import {
    Event,
    EventStatus,
    IEvent,
    ServiceError,
    publish,
    UserRole,
    UserStatus,
    FormSubmission,
    IFormSubmission,
    User,
    userSnapshotOf,
    AuctionLot,
    AuctionStatus,
    FormDefinition,
    DELETED_DISPLAY_NAME,
} from '@bgsc/shared';
import { AuctionConfigSchema, CreateEventInput, UpdateEventInput, QueryEventsInput, QueryParticipantsInput } from './event.schemas';
import { randomBytes } from 'crypto';
import { Actor, TERMINAL_STATUSES, assertEventAdmin, assertVisible, atLeast, escapeRegex, isEventAdmin } from './access';
import { asServiceError, promoteRegistration, recordAttendance } from '../clients/registration-client';
import { invalidateAuctionLiveCache } from '../auction/cache';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCER = 'event-service';

function isUuid(val: string): boolean {
    return UUID_RE.test(val);
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const slugBase = (title: string, date: Date) => `${slugify(title) || 'event'}-${date.getUTCFullYear()}`;
const slugSuffixed = (base: string) => `${base}-${randomBytes(3).toString('hex')}`;

/**
 * Lifecycle (event-model.md §5). `past` and `cancelled` are terminal. Anything not listed is a 409,
 * so `draft → past` (an EventCompleted for an event that never ran) and `ongoing → draft` (hiding a
 * running event) are gone. Every move is a compare-and-swap on the status it started from, so two
 * concurrent PATCHes cannot both publish the same transition.
 */
export const STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
    draft: ['upcoming', 'cancelled'],
    upcoming: ['ongoing', 'cancelled'],
    ongoing: ['past', 'cancelled'],
    past: [],
    cancelled: [],
};

export function validateEventInvariants(input: Partial<CreateEventInput>): void {
    if (input.start_at && input.end_at && input.start_at >= input.end_at) {
        throw new ServiceError(422, 'start_must_be_before_end');
    }

    if (input.registration) {
        const { opens_at, closes_at, roster_finalizes_at } = input.registration;
        if (opens_at && closes_at && opens_at >= closes_at) {
            throw new ServiceError(422, 'registration_opens_must_be_before_closes');
        }
        if (closes_at && input.start_at && closes_at > input.start_at) {
            throw new ServiceError(422, 'registration_closes_must_be_before_event_start');
        }
        if (roster_finalizes_at && closes_at && roster_finalizes_at < closes_at) {
            throw new ServiceError(422, 'roster_finalizes_must_be_after_closes');
        }
    }

    if (input.teaming) {
        if (input.teaming.is_teamed) {
            const min = input.teaming.team_size_min ?? 1;
            const max = input.teaming.team_size_max ?? min;
            if (min > max) {
                throw new ServiceError(422, 'team_size_min_exceeds_max');
            }
        }
    }

    if (input.scoring?.normalization) {
        const { lower, upper } = input.scoring.normalization;
        if (lower >= upper) {
            throw new ServiceError(422, 'normalization_lower_must_be_below_upper');
        }
    }

    if (input.scoring?.parameters) {
        const keys = new Set<string>();
        for (const p of input.scoring.parameters) {
            if (keys.has(p.key)) {
                throw new ServiceError(422, 'duplicate_scoring_parameter_key');
            }
            keys.add(p.key);
        }
    }
}

/**
 * The model's invariant hook throws a plain Error, which the error handler turns into a 500. The
 * specific checks above cover the common mistakes with their own codes; this runs the hook itself so
 * every other rule (form_id for non-DE, team sizes, elim_after_n, podium multipliers, ...) is a 422.
 */
async function assertValid(doc: IEvent): Promise<void> {
    try {
        await doc.validate();
    } catch (err) {
        throw new ServiceError(422, 'invalid_event', {
            message: (err as Error).message.replace(/^Event invariant: /, ''),
        });
    }
}

/** A core admin has edit rights, so it must be a live account ranked core or above. */
async function assertCoreAdmins(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const ok = await User.countDocuments({
        _id: { $in: unique },
        status: UserStatus.ACTIVE,
        deleted_at: null,
        role: { $in: [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER] },
    });
    if (ok !== unique.length) throw new ServiceError(422, 'invalid_core_admin');
}

/**
 * The form an event registers through must be a published form owned by that event.
 * A read of Registration Service's collection, not a write — reads are allowed across services.
 */
export async function assertEventForm(eventId: string, formId: string): Promise<void> {
    const form = await FormDefinition.findById(formId, { owner: 1, status: 1 }).lean();
    if (!form || form.owner?.type !== 'event' || form.owner.id !== eventId || form.status !== 'published') {
        throw new ServiceError(422, 'registration_form_invalid');
    }
}

const isDuplicateSlug = (err: unknown) =>
    (err as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000 &&
    Boolean((err as { keyPattern?: Record<string, unknown> }).keyPattern?.slug);

export async function createEvent(actor: Actor, input: CreateEventInput): Promise<IEvent> {
    validateEventInvariants(input);
    await assertCoreAdmins(input.core_admins);

    // Leaderboard & auction nullability invariants: normalized here rather than refused.
    const leaderboard =
        input.type === 'DE' ? null : input.leaderboard ?? { format: 'points_table' as const, elim_after_n: null, min_participants: 2 };
    const auction =
        input.type === 'ALL' ? { ...(input.auction ?? AuctionConfigSchema.parse({})), status: 'not_started' as const } : null;

    const base = slugBase(input.title, input.start_at);
    const event = new Event({
        ...input,
        slug: (await Event.exists({ slug: base })) ? slugSuffixed(base) : base,
        created_by: actor.id,
        core_admins: Array.from(new Set([actor.id, ...input.core_admins])),
        leaderboard,
        auction,
        counts: { registrations_confirmed: 0 },
        seat_holders: [],
    });
    await assertValid(event);
    // Created straight into `upcoming`: the same form rule as leaving draft. (A form must be owned by
    // the event, which does not exist yet — so in practice only a formless DE can skip the draft.)
    if (event.status !== 'draft' && event.registration.form_id) {
        await assertEventForm(event._id, event.registration.form_id);
    }

    // The probe above races a concurrent create, and the unique index also covers soft-deleted
    // events (which the old probe ignored), so an 11000 on slug is a retry, not a 500.
    for (let attempt = 0; ; attempt++) {
        try {
            await event.save();
            break;
        } catch (err) {
            if (!isDuplicateSlug(err) || attempt >= 3) throw err;
            event.slug = slugSuffixed(base);
        }
    }

    publish('EventCreated', PRODUCER, {
        event_id: event._id,
        slug: event.slug,
        title: event.title,
        status: event.status,
    });

    return event;
}

/**
 * Which events a viewer may see in a list. Drafts and unlisted events ("reachable by link only",
 * event-model.md) are shown to their own admins; coordinator+ sees everything.
 */
function listScope(viewer?: Actor): Record<string, unknown> {
    const publicScope = { status: { $ne: 'draft' }, visibility: 'public' };
    if (!viewer || !atLeast(viewer.role, UserRole.CORE)) return publicScope;
    if (atLeast(viewer.role, UserRole.COORDINATOR)) return {};
    return { $or: [publicScope, { core_admins: viewer.id }, { created_by: viewer.id }] };
}

function cursorCondition(cursor: string, sort: QueryEventsInput['sort']): Record<string, unknown> {
    if (sort !== 'date_asc' && sort !== 'date_desc') {
        throw new ServiceError(422, 'cursor_requires_date_sort');
    }
    const [date, id] = Buffer.from(cursor, 'base64').toString().split('|');
    const at = new Date(date);
    if (!id || Number.isNaN(at.getTime())) throw new ServiceError(422, 'invalid_cursor');
    const op = sort === 'date_asc' ? '$gt' : '$lt';
    return { $or: [{ start_at: { [op]: at } }, { start_at: at, _id: { $gt: id } }] };
}

export async function listEvents(
    query: QueryEventsInput,
    viewer?: Actor
): Promise<{
    events: IEvent[];
    next_cursor: string | null;
    total?: number;
    page?: number;
    limit: number;
    total_pages?: number;
}> {
    // Conditions are ANDed, never assigned over each other: the cursor's `$or` used to replace the
    // search's `$or`, so page two silently dropped the search.
    const conds: Record<string, unknown>[] = [{ deleted_at: null }, listScope(viewer)];
    const list = (s: string) => s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

    if (query.category) conds.push({ category: { $in: list(query.category) } });
    if (query.status) conds.push({ status: { $in: list(query.status) } });
    if (query.domain) conds.push({ domain: query.domain.toLowerCase() });
    if (query.type) conds.push({ type: query.type.toUpperCase() });
    if (query.tags) conds.push({ tags: { $in: list(query.tags) } });

    if (query.search?.trim()) {
        const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
        conds.push({ $or: [{ title: regex }, { description: regex }, { tags: query.search.trim().toLowerCase() }] });
    }

    if (query.from) conds.push({ start_at: { $gte: query.from } });
    if (query.to) conds.push({ start_at: { $lte: query.to } });

    const limit = query.limit;

    let sortObj: Record<string, 1 | -1> = { start_at: 1, _id: 1 };
    if (query.sort === 'date_desc') {
        sortObj = { start_at: -1, _id: 1 };
    } else if (query.sort === 'popular') {
        sortObj = { 'counts.registrations_confirmed': -1, start_at: 1, _id: 1 };
    } else if (query.sort === 'title') {
        sortObj = { title: 1, _id: 1 };
    }

    // `seat_holders` is internal bookkeeping (and grows with the event), not list payload.
    const projection = { seat_holders: 0 };

    // Page-based pagination (for admin dashboard / list views)
    if (query.page) {
        const filter = { $and: conds };
        const page = query.page;
        const skip = (page - 1) * limit;
        const [events, total] = await Promise.all([
            Event.find(filter, projection).sort(sortObj).skip(skip).limit(limit),
            Event.countDocuments(filter),
        ]);
        return {
            events,
            next_cursor: null,
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
        };
    }

    // Cursor pagination on (start_at, _id) — only meaningful for the date sorts.
    if (query.cursor) conds.push(cursorCondition(query.cursor, query.sort));

    const events = await Event.find({ $and: conds }, projection).sort(sortObj).limit(limit + 1);

    const hasMore = events.length > limit;
    const results = hasMore ? events.slice(0, limit) : events;

    let nextCursor: string | null = null;
    if (hasMore && results.length > 0 && (query.sort === 'date_asc' || query.sort === 'date_desc')) {
        const last = results[results.length - 1];
        nextCursor = Buffer.from(`${last.start_at.toISOString()}|${last._id}`).toString('base64');
    }

    return { events: results, next_cursor: nextCursor, limit };
}

export async function findByRef(ref: string, viewer?: Actor): Promise<IEvent> {
    const query = isUuid(ref) ? { _id: ref, deleted_at: null } : { slug: ref.toLowerCase(), deleted_at: null };

    const event = await Event.findOne(query, { seat_holders: 0 });
    if (!event) throw new ServiceError(404, 'not_found');
    assertVisible(event, viewer);
    return event;
}

/** Nested objects a PATCH merges into instead of replacing: a partial object must not wipe siblings. */
/** Auction states that let a league move to `past`. */
const AUCTION_DONE: AuctionStatus[] = ['not_started', 'finished'];

const NESTED_KEYS = new Set(['registration', 'teaming', 'points_pool', 'scoring', 'leaderboard']);

export async function updateEvent(ref: string, actor: Actor, input: UpdateEventInput): Promise<IEvent> {
    const event = await findByRef(ref, actor);
    assertEventAdmin(event, actor);

    // Past and cancelled events are records: registrations, ledger rows and boards point at them.
    if (TERMINAL_STATUSES.includes(event.status)) {
        throw new ServiceError(409, 'event_is_terminal');
    }

    const { status, ...fields } = input as Record<string, unknown> & { status?: EventStatus };
    const from = event.status;
    const current = event.toObject() as unknown as Record<string, unknown>;

    // Only the creator or coordinator+ decides who else administers the event. A core admin adding
    // arbitrary accounts (a plain `user` included) handed out edit rights nobody granted.
    if (fields.core_admins !== undefined) {
        if (event.created_by !== actor.id && !atLeast(actor.role, UserRole.COORDINATOR)) {
            throw new ServiceError(403, 'core_admins_owner_only');
        }
        await assertCoreAdmins(fields.core_admins as string[]);
    }

    // Nested objects are written as dotted paths (`registration.max_participants`), never as a whole
    // subdocument rebuilt from this (possibly stale) read — two admins editing different fields of
    // `registration` at once no longer undo each other. A null subdocument (leaderboard)
    // is set whole, since there is nothing to dot into.
    const set: Record<string, unknown> = {};
    const isPlainObject = (v: unknown): v is Record<string, unknown> =>
        v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        if (NESTED_KEYS.has(key) && isPlainObject(value) && current[key] != null) {
            for (const [sub, v] of Object.entries(value)) {
                if (v === undefined) continue;
                if (key === 'scoring' && sub === 'normalization' && isPlainObject(v)) {
                    for (const [n, nv] of Object.entries(v)) if (nv !== undefined) set[`scoring.normalization.${n}`] = nv;
                } else {
                    set[`${key}.${sub}`] = v;
                }
            }
        } else {
            set[key] = value;
        }
    }

    if (status && status !== from) {
        if (!STATUS_TRANSITIONS[from].includes(status)) {
            throw new ServiceError(409, 'invalid_status_transition', { from, to: status });
        }
        // Cancelling reverses points and drops boards (model doc §5: Coordinator+).
        if (status === 'cancelled' && !atLeast(actor.role, UserRole.COORDINATOR)) {
            throw new ServiceError(403, 'coordinator_required');
        }
        // A league completes only once its auction is over: a live or paused one would keep raising
        // and settling lots on a past event, and its rosters never lock (that waits on AuctionClosed).
        // One that never started has no lots in play.
        if (status === 'past' && event.auction && !AUCTION_DONE.includes(event.auction.status)) {
            throw new ServiceError(409, 'auction_not_finished');
        }
        set.status = status;
    }

    if (Object.keys(set).length === 0) return event;

    // Apply to the loaded document, then check the merged result.
    event.set(set);
    validateEventInvariants({
        start_at: event.start_at,
        end_at: event.end_at,
        registration: event.registration as CreateEventInput['registration'],
        teaming: event.teaming as CreateEventInput['teaming'],
        scoring: event.scoring as CreateEventInput['scoring'],
    });
    await assertValid(event);

    // Event ↔ form: leaving draft, or changing the form of a published event, needs a
    // published form that belongs to THIS event. A draft may point anywhere, or nowhere.
    const to = (set.status as EventStatus | undefined) ?? from;
    const formTouched = 'registration.form_id' in set || 'registration' in set;
    const leavingDraft = from === 'draft' && to !== 'draft' && to !== 'cancelled';
    if ((leavingDraft || (to !== 'draft' && to !== 'cancelled' && formTouched)) && event.registration.form_id) {
        await assertEventForm(event._id, event.registration.form_id);
    }

    // Write back the model-cast values (defaults filled, tags lowercased, created_by kept in
    // core_admins) — `$set` of the touched paths only.
    const casted = event.toObject() as unknown as Record<string, unknown>;
    for (const key of Object.keys(set)) set[key] = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], casted);

    // Lifecycle timestamps ride in the same CAS as the transition.
    const now = new Date();
    if (set.status === 'ongoing') set.started_at = now;
    if (set.status === 'past') set.completed_at = now;
    if (set.status === 'cancelled') set.cancelled_at = now;

    // CAS on the version validated above, not just the status: two PATCHes that each pass validation
    // against the same read could otherwise store a combination neither checked. The auction guard
    // rides along, so an auction started after the read cannot slip under a completion.
    const updated = await Event.findOneAndUpdate(
        {
            _id: event._id,
            status: from,
            updated_at: event.updated_at,
            deleted_at: null,
            ...(set.status === 'past' && event.auction ? { 'auction.status': { $in: AUCTION_DONE } } : {}),
        },
        { $set: set },
        { returnDocument: 'after', projection: { seat_holders: 0 } }
    );
    if (!updated) throw new ServiceError(409, 'event_changed_concurrently');

    if (set.status === 'cancelled') {
        // Bids on a cancelled event must stop too: the auction finishes and the lot on the block is
        // closed unsold (a lot mid-settlement finishes its keyed charge; see auction.service).
        await Event.updateOne(
            { _id: updated._id, 'auction.status': { $in: ['not_started', 'live', 'paused'] } },
            { $set: { 'auction.status': 'finished' } }
        );
        await AuctionLot.updateMany(
            { event_id: updated._id, status: 'on_block' },
            { $set: { status: 'unsold', closed_at: now }, $inc: { version: 1 } }
        );
        invalidateAuctionLiveCache(updated._id);
        publish('EventCancelled', PRODUCER, { event_id: updated._id, title: updated.title });
    } else if (set.status === 'ongoing') {
        publish('EventStarted', PRODUCER, { event_id: updated._id, title: updated.title });
    } else if (set.status === 'past') {
        publish('EventCompleted', PRODUCER, { event_id: updated._id, title: updated.title });
    }

    publish('EventUpdated', PRODUCER, { event_id: updated._id });
    return updated;
}

/** Model doc §5: a draft is deleted by Core+ who administers it (the route floors at core). */
export async function deleteEvent(ref: string, actor: Actor): Promise<{ deleted: boolean }> {
    const event = await findByRef(ref, actor);
    assertEventAdmin(event, actor);

    // CAS: a publish racing the delete must not leave a soft-deleted published event.
    const deleted = await Event.findOneAndUpdate(
        { _id: event._id, status: 'draft', deleted_at: null },
        { $set: { deleted_at: new Date() } }
    );
    if (!deleted) throw new ServiceError(409, 'cannot_delete_published_event');

    publish('EventDeleted', PRODUCER, { event_id: event._id });
    return { deleted: true };
}

/* ------------------------------------------------------------------ *
 * Seat contract — called by Registration Service
 * ------------------------------------------------------------------ */

export type ReserveResult =
    | { reserved: true }
    | { reserved: false; reason: 'capacity_full' | 'waitlist_disabled' | 'event_closed' | 'not_open' | 'event_not_found' };

const SEAT_OPEN_STATUSES: EventStatus[] = ['upcoming', 'ongoing'];

/**
 * Idempotent per registration id: the seat is `$addToSet` + `$inc` guarded by
 * `seat_holders: { $ne: id }`, so a retry (or a second instance) never counts it twice.
 *
 * `capacity_full` means "full, and this event waitlists"; `waitlist_disabled` means "full, no
 * waitlist" — the registration waitlists on the first and rejects on the second. The old code
 * answered `{ reserved: true, waitlisted: true }` for a waitlist place, which registration read as
 * a confirmed seat.
 */
export async function reserveSeat(eventId: string, registrationId: string): Promise<ReserveResult> {
    const event = await Event.findOne(
        { _id: eventId, deleted_at: null },
        { status: 1, registration: 1, seat_holders: { $elemMatch: { $eq: registrationId } } }
    );
    if (!event) return { reserved: false, reason: 'event_not_found' };
    if (event.seat_holders?.length) return { reserved: true };

    if (!SEAT_OPEN_STATUSES.includes(event.status)) return { reserved: false, reason: 'event_closed' };

    const now = new Date();
    if (event.registration.opens_at && now < event.registration.opens_at) {
        return { reserved: false, reason: 'not_open' };
    }
    if (event.registration.closes_at && now > event.registration.closes_at) {
        // After close, only a registration submitted before close may take a seat: a waitlist
        // promotion, or a captain approved after close. A new entry may not.
        const submittedInTime = await FormSubmission.exists({
            _id: registrationId,
            'owner.id': eventId,
            submitted_at: { $lte: event.registration.closes_at },
        });
        if (!submittedInTime) return { reserved: false, reason: 'event_closed' };
    }

    const max = event.registration.max_participants;
    const filter: Record<string, unknown> = {
        _id: eventId,
        deleted_at: null,
        status: { $in: SEAT_OPEN_STATUSES },
        seat_holders: { $ne: registrationId },
    };
    if (max !== null) filter['counts.registrations_confirmed'] = { $lt: max };

    // Seat, captain-pool and auction-status writes skip `updated_at`: it is the version an admin
    // PATCH CASes on, and bookkeeping must not make PATCHes fail during a registration rush.
    const claimed = await Event.updateOne(
        filter,
        { $addToSet: { seat_holders: registrationId }, $inc: { 'counts.registrations_confirmed': 1 } },
        { timestamps: false }
    );
    if (claimed.modifiedCount === 1) return { reserved: true };

    // Lost the CAS: already a holder (a concurrent retry), closed meanwhile, or full.
    const after = await Event.findOne(
        { _id: eventId },
        { status: 1, 'registration.waitlist_enabled': 1, seat_holders: { $elemMatch: { $eq: registrationId } } }
    );
    if (!after) return { reserved: false, reason: 'event_not_found' };
    if (after.seat_holders?.length) return { reserved: true };
    if (!SEAT_OPEN_STATUSES.includes(after.status)) return { reserved: false, reason: 'event_closed' };
    return { reserved: false, reason: after.registration.waitlist_enabled ? 'capacity_full' : 'waitlist_disabled' };
}

/** Idempotent: only a current holder releases, so a retried release cannot free a second seat. */
export async function releaseSeat(eventId: string, registrationId: string): Promise<{ released: boolean }> {
    const res = await Event.updateOne(
        { _id: eventId, seat_holders: registrationId },
        { $pull: { seat_holders: registrationId }, $inc: { 'counts.registrations_confirmed': -1 } },
        { timestamps: false }
    );
    return { released: res.modifiedCount === 1 };
}

/* ------------------------------------------------------------------ *
 * Registration-facing reads
 * ------------------------------------------------------------------ */

export async function getEventEligibility(
    ref: string,
    userId: string
): Promise<{
    eligible: boolean;
    reason: string | null;
    capacity_status: 'open' | 'waitlist_only' | 'full';
    seats_remaining: number | null;
    form_id: string | null;
    waitlist_enabled: boolean;
    requires_approval: boolean;
    is_teamed: boolean;
    captain_application_required: boolean;
    existing_registration_id: string | null;
}> {
    const event = await findByRef(ref);
    const now = new Date();

    // Rejected and cancelled rows do not hold the one-active-registration slot (the partial unique
    // index agrees), so they must not read as "already registered" here either.
    const existing = await FormSubmission.findOne(
        {
            'owner.type': 'event',
            'owner.id': event._id,
            'user.user_id': userId,
            status: { $nin: ['cancelled', 'rejected'] },
        },
        { _id: 1 }
    ).lean();

    const max = event.registration.max_participants;
    const confirmed = event.counts.registrations_confirmed;
    const isFull = max !== null && confirmed >= max;
    const seatsRemaining = max !== null ? Math.max(0, max - confirmed) : null;

    let capacityStatus: 'open' | 'waitlist_only' | 'full' = 'open';
    if (isFull) {
        capacityStatus = event.registration.waitlist_enabled ? 'waitlist_only' : 'full';
    }

    const baseResult = {
        seats_remaining: seatsRemaining,
        form_id: event.registration.form_id,
        waitlist_enabled: event.registration.waitlist_enabled,
        requires_approval: event.registration.requires_approval,
        is_teamed: event.teaming.is_teamed,
        captain_application_required: event.teaming.captain_application_required,
        existing_registration_id: existing ? existing._id : null,
    };
    const no = (reason: string, capacity = capacityStatus) => ({ eligible: false, reason, capacity_status: capacity, ...baseResult });

    if (existing) return no('already_registered');
    if (event.status === 'cancelled') return no('event_cancelled');
    if (event.status === 'past') return no('event_past');
    if (event.registration.opens_at && now < event.registration.opens_at) return no('not_yet_open');
    if (event.registration.closes_at && now > event.registration.closes_at) return no('registration_closed');
    if (isFull && !event.registration.waitlist_enabled) return no('capacity_full', 'full');
    // No usable form, no way to register — never answer "eligible" for that.
    if (!event.registration.form_id) return no('registration_form_unavailable');
    try {
        await assertEventForm(event._id, event.registration.form_id);
    } catch {
        return no('registration_form_unavailable');
    }

    return { eligible: true, reason: null, capacity_status: capacityStatus, ...baseResult };
}

export async function getMyEventRegistration(ref: string, userId: string): Promise<IFormSubmission | null> {
    const event = await findByRef(ref);
    return FormSubmission.findOne({
        'owner.type': 'event',
        'owner.id': event._id,
        'user.user_id': userId,
        status: { $ne: 'cancelled' },
    });
}

/**
 * Admin reads of an event's registrations: its own admins only, and still core+ — a creator or listed
 * admin demoted to `user` no longer reads the full list (the route has no role floor).
 */
const hasAdminRead = (event: IEvent, viewer?: Actor) => Boolean(viewer && atLeast(viewer.role, UserRole.CORE) && isEventAdmin(event, viewer));

export async function getEventParticipants(ref: string, query: QueryParticipantsInput, viewer?: Actor) {
    const event = await findByRef(ref, viewer);
    const hasAdminAccess = hasAdminRead(event, viewer);
    const filter: Record<string, unknown> = { 'owner.type': 'event', 'owner.id': event._id };
    // The public sees confirmed participants only, whatever `?status=` says — it used to list
    // rejected and cancelled registrations to anonymous callers.
    if (!hasAdminAccess) filter.status = 'confirmed';
    else if (query.status) filter.status = query.status;

    if (query.role) filter['context.event.role'] = query.role;
    if (query.attended !== undefined) filter['context.event.attended'] = query.attended;
    if (query.team_id) filter['context.event.team_id'] = query.team_id;
    if (query.search?.trim()) filter['user.display_name'] = new RegExp(escapeRegex(query.search.trim()), 'i');

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
        FormSubmission.find(filter, { user: 1, status: 1, context: 1, submitted_at: 1, waitlist_position: 1 })
            .sort({ submitted_at: 1, created_at: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        FormSubmission.countDocuments(filter),
    ]);

    const participants = submissions.map((sub) => ({
        registration_id: sub._id,
        user: sub.user,
        status: sub.status,
        role: sub.context?.event?.role ?? null,
        team_id: sub.context?.event?.team_id ?? null,
        base_price: hasAdminAccess ? sub.context?.event?.base_price ?? null : null,
        attended: sub.context?.event?.attended ?? null,
        submitted_at: sub.submitted_at,
        waitlist_position: sub.waitlist_position,
    }));

    return {
        event_id: event._id,
        participants,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
    };
}

/** Counts by status / role / attendance in one aggregate rather than loading every submission. */
async function submissionCounts(eventId: string) {
    const rows = await FormSubmission.aggregate<{
        _id: { status: string; role: string | null; attended: boolean | null };
        n: number;
    }>([
        { $match: { 'owner.type': 'event', 'owner.id': eventId } },
        {
            $group: {
                _id: {
                    status: '$status',
                    role: { $ifNull: ['$context.event.role', null] },
                    attended: { $ifNull: ['$context.event.attended', null] },
                },
                n: { $sum: 1 },
            },
        },
    ]);

    const c = { confirmed: 0, waitlisted: 0, cancelled: 0, rejected: 0, total: 0, attended: 0, absent: 0, unmarked: 0, solo: 0, captain: 0, member: 0 };
    for (const { _id, n } of rows) {
        c.total += n;
        if (_id.status === 'confirmed' || _id.status === 'waitlisted' || _id.status === 'cancelled' || _id.status === 'rejected') {
            c[_id.status] += n;
        }
        if (_id.status === 'confirmed') {
            if (_id.attended === true) c.attended += n;
            else if (_id.attended === false) c.absent += n;
            else c.unmarked += n;
        }
        if (_id.role === 'solo' || _id.role === 'captain' || _id.role === 'member') c[_id.role] += n;
    }
    return c;
}

/**
 * The same rule as the participant list: the public (and a demoted admin) gets the confirmed and
 * waitlist counts; rejected, cancelled, attendance and role breakdowns are admin reads.
 */
export async function getEventParticipantStats(ref: string, viewer?: Actor) {
    const event = await findByRef(ref, viewer);
    const c = await submissionCounts(event._id);
    const max = event.registration.max_participants;
    const capacity = {
        max_participants: max,
        is_full: max !== null && event.counts.registrations_confirmed >= max,
        waitlist_enabled: event.registration.waitlist_enabled,
    };
    if (!hasAdminRead(event, viewer)) {
        return { event_id: event._id, counts: { confirmed: c.confirmed, waitlisted: c.waitlisted }, capacity };
    }
    return {
        event_id: event._id,
        counts: {
            confirmed: c.confirmed,
            waitlisted: c.waitlisted,
            cancelled: c.cancelled,
            rejected: c.rejected,
            total_submissions: c.total,
            attended: c.attended,
            absent: c.absent,
            unmarked: c.unmarked,
            solo_count: c.solo,
            captain_count: c.captain,
            member_count: c.member,
        },
        capacity,
    };
}

// ponytail: admin lists capped at 1000 rows; add paging when an event's waitlist/attendance outgrows it.
const ADMIN_LIST_CAP = 1000;

export async function getEventWaitlist(ref: string, viewer: Actor) {
    const event = await findByRef(ref, viewer);
    assertEventAdmin(event, viewer);
    const filter: Record<string, unknown> = { 'owner.type': 'event', 'owner.id': event._id, status: 'waitlisted' };
    const [submissions, total] = await Promise.all([
        FormSubmission.find(filter, { user: 1, submitted_at: 1, waitlist_position: 1 })
            .sort({ waitlist_position: 1, submitted_at: 1 })
            .limit(ADMIN_LIST_CAP)
            .lean(),
        FormSubmission.countDocuments(filter),
    ]);

    return {
        event_id: event._id,
        waitlist: submissions.map((sub, idx) => ({
            position: idx + 1,
            registration_id: sub._id,
            user: sub.user,
            submitted_at: sub.submitted_at,
        })),
        total_waitlisted: total,
    };
}

/**
 * Promotion is Registration Service's write (it owns form_submissions): it CASes the row
 * waitlisted → confirmed and reserves the seat through the same contract as everyone else. This
 * used to flip the row here and `$inc` the seat count unconditionally, overbooking under a race.
 */
export async function promoteWaitlistedParticipant(ref: string, registrationId: string, actor: Actor): Promise<unknown> {
    const event = await findByRef(ref, actor);
    assertEventAdmin(event, actor);
    if (TERMINAL_STATUSES.includes(event.status)) throw new ServiceError(409, 'event_is_terminal');

    const row = await FormSubmission.findOne({ _id: registrationId, 'owner.type': 'event', 'owner.id': event._id }, { 'user.user_id': 1 }).lean();
    if (!row) throw new ServiceError(404, 'registration_not_found');
    // Nobody promotes their own registration, as nobody approves it (Registration's admin override).
    if (row.user.user_id === actor.id) throw new ServiceError(403, 'cannot_review_own_registration');

    try {
        return await promoteRegistration(registrationId, actor.id);
    } catch (err) {
        throw asServiceError(err);
    }
}

/** Attendance is marked by Registration Service, which owns the rows and publishes ParticipantAttended. */
export async function recordEventAttendance(
    ref: string,
    attendances: Array<{ registration_id: string; attended: boolean }>,
    actor: Actor
): Promise<{ updated_count: number; skipped: string[] }> {
    const event = await findByRef(ref, actor);
    assertEventAdmin(event, actor);
    // Owner decision: attendance is marked AND revoked only while the event is running.
    if (event.status !== 'ongoing' || Date.now() >= event.end_at.getTime()) {
        throw new ServiceError(409, 'attendance_window_closed');
    }

    try {
        return await recordAttendance({
            event_id: event._id,
            marked_by: actor.id,
            attendances: attendances.map((a) => ({ registration_id: a.registration_id, attended: a.attended })),
        });
    } catch (err) {
        throw asServiceError(err);
    }
}

export async function getEventAttendance(ref: string, viewer: Actor) {
    const event = await findByRef(ref, viewer);
    assertEventAdmin(event, viewer);
    const [c, submissions] = await Promise.all([
        submissionCounts(event._id),
        FormSubmission.find(
            { 'owner.type': 'event', 'owner.id': event._id, status: 'confirmed' },
            { user: 1, context: 1 }
        )
            .sort({ submitted_at: 1 })
            .limit(ADMIN_LIST_CAP)
            .lean(),
    ]);

    return {
        event_id: event._id,
        summary: { confirmed: c.confirmed, attended: c.attended, absent: c.absent, unmarked: c.unmarked },
        records: submissions.map((sub) => ({
            registration_id: sub._id,
            user: sub.user,
            attended: sub.context?.event?.attended ?? null,
            role: sub.context?.event?.role ?? null,
            team_id: sub.context?.event?.team_id ?? null,
        })),
    };
}

/* ------------------------------------------------------------------ *
 * Auction captains (type 'ALL' only)
 * ------------------------------------------------------------------ */

function assertAuctionLeague(event: IEvent): void {
    // The invariant is "auction != null exactly when type == 'ALL'". Creating an auction block on any
    // other type broke every later save of that event with a 500.
    if (event.type !== 'ALL' || !event.auction) {
        throw new ServiceError(422, 'event_is_not_an_auction_league');
    }
}

export async function addEventCaptain(ref: string, userId: string, actor: Actor): Promise<IEvent> {
    const event = await findByRef(ref, actor);
    assertEventAdmin(event, actor);
    assertAuctionLeague(event);
    if (event.auction!.status === 'finished') throw new ServiceError(409, 'auction_finished');

    if (!(await User.exists({ _id: userId, deleted_at: null }))) throw new ServiceError(404, 'user_not_found');

    const res = await Event.updateOne(
        { _id: event._id, type: 'ALL', 'auction.status': { $ne: 'finished' }, 'auction.captain_user_ids': { $ne: userId } },
        { $addToSet: { 'auction.captain_user_ids': userId } },
        { timestamps: false }
    );
    if (res.modifiedCount === 1) {
        invalidateAuctionLiveCache(event._id);
        publish('CaptainApproved', PRODUCER, { event_id: event._id, user_id: userId, approved_by: actor.id });
    }
    return (await Event.findById(event._id, { seat_holders: 0 }))!;
}

export async function removeEventCaptain(ref: string, userId: string, actor: Actor): Promise<IEvent> {
    const event = await findByRef(ref, actor);
    assertEventAdmin(event, actor);
    assertAuctionLeague(event);

    // `$pull`, not a read-filter-save of the whole array, which lost a concurrent `$addToSet`.
    await Event.updateOne({ _id: event._id }, { $pull: { 'auction.captain_user_ids': userId } }, { timestamps: false });
    invalidateAuctionLiveCache(event._id);
    return (await Event.findById(event._id, { seat_holders: 0 }))!;
}

export async function listEventCaptains(ref: string, viewer?: Actor) {
    const event = await findByRef(ref, viewer);
    const captainIds = event.auction?.captain_user_ids ?? [];
    const users = await User.find({ _id: { $in: captainIds } });

    return {
        event_id: event._id,
        captain_user_ids: captainIds,
        // A deleted account is shown as deleted, never by its real name.
        captains: users.map((u) =>
            u.deleted_at
                ? { user_id: u._id, display_name: DELETED_DISPLAY_NAME, avatar_url: null, deleted: true }
                : userSnapshotOf(u)
        ),
    };
}
