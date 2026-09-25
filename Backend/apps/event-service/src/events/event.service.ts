import { Event, IEvent, ServiceError, publish, UserRole, FormSubmission, IFormSubmission, User, userSnapshotOf } from '@bgsc/shared';
import {
    CreateEventInput,
    UpdateEventInput,
    QueryEventsInput,
    QueryParticipantsInput,
} from './event.schemas';
import { randomBytes } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCER = 'event-service';

export function isUuid(val: string): boolean {
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

export async function generateUniqueSlug(title: string, date: Date): Promise<string> {
    const year = date.getFullYear();
    const baseSlug = `${slugify(title)}-${year}`;
    let slug = baseSlug;
    let attempts = 0;

    while (await Event.exists({ slug, deleted_at: null })) {
        attempts++;
        const suffix = randomBytes(2).toString('hex');
        slug = `${baseSlug}-${suffix}`;
        if (attempts > 10) break;
    }

    return slug;
}

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

export async function createEvent(
    actor: { id: string; role: string },
    input: CreateEventInput
): Promise<IEvent> {
    validateEventInvariants(input);

    const slug = await generateUniqueSlug(input.title, input.start_at);
    const coreAdmins = Array.from(new Set([actor.id, ...input.core_admins]));

    // Leaderboard & auction nullability invariants
    let leaderboard = input.leaderboard;
    if (input.type === 'DE') {
        leaderboard = null;
    } else if (!leaderboard) {
        leaderboard = { format: 'points_table', elim_after_n: null, min_participants: 2 };
    }

    let auction = input.auction;
    if (input.type !== 'ALL') {
        auction = null;
    }

    const event = await Event.create({
        ...input,
        slug,
        created_by: actor.id,
        core_admins: coreAdmins,
        leaderboard,
        auction,
        counts: {
            registrations_confirmed: 0,
            registrations_waitlisted: 0,
            teams: 0,
        },
    });

    publish('EventCreated', PRODUCER, {
        event_id: event._id,
        slug: event.slug,
        title: event.title,
        status: event.status,
    });

    return event;
}

export async function listEvents(
    query: QueryEventsInput,
    viewer?: { id: string; role: string }
): Promise<{
    events: IEvent[];
    next_cursor: string | null;
    total?: number;
    page?: number;
    limit: number;
    total_pages?: number;
}> {
    const filter: Record<string, unknown> = { deleted_at: null };

    // Categories filter
    if (query.category) {
        const cats = query.category.split(',').map((c) => c.trim().toLowerCase());
        filter.category = cats.length === 1 ? cats[0] : { $in: cats };
    }

    // Status filter
    const isAdmin = viewer && [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER].includes(viewer.role as UserRole);
    if (query.status) {
        const statuses = query.status.split(',').map((s) => s.trim().toLowerCase());
        // Non-admins can never view drafts
        const safeStatuses = isAdmin ? statuses : statuses.filter((s) => s !== 'draft');
        filter.status = safeStatuses.length === 1 ? safeStatuses[0] : { $in: safeStatuses };
    } else if (!isAdmin) {
        filter.status = { $ne: 'draft' };
    }

    // Domain & Type
    if (query.domain) filter.domain = query.domain.toLowerCase();
    if (query.type) filter.type = query.type.toUpperCase();

    // Tags filter
    if (query.tags) {
        const tags = query.tags.split(',').map((t) => t.trim().toLowerCase());
        filter.tags = tags.length === 1 ? tags[0] : { $in: tags };
    }

    // Search query on title, tags or description
    if (query.search) {
        const regex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
            { title: regex },
            { description: regex },
            { tags: query.search.trim().toLowerCase() },
        ];
    }

    // Date range
    if (query.from || query.to) {
        const dateFilter: Record<string, Date> = {};
        if (query.from) dateFilter.$gte = new Date(query.from);
        if (query.to) dateFilter.$lte = new Date(query.to);
        filter.start_at = dateFilter;
    }

    const limit = Math.min(100, query.limit || 20);

    // Sort definition
    let sortObj: Record<string, 1 | -1> = { start_at: 1, _id: 1 };
    if (query.sort === 'date_desc') {
        sortObj = { start_at: -1, _id: 1 };
    } else if (query.sort === 'popular') {
        sortObj = { 'counts.registrations_confirmed': -1, start_at: 1 };
    } else if (query.sort === 'title') {
        sortObj = { title: 1, _id: 1 };
    }

    // Page-based pagination (for admin dashboard / list views)
    if (query.page) {
        const page = Math.max(1, query.page);
        const skip = (page - 1) * limit;
        const [events, total] = await Promise.all([
            Event.find(filter).sort(sortObj).skip(skip).limit(limit),
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

    // Cursor pagination (based on start_at + _id)
    if (query.cursor) {
        try {
            const [cursorDate, cursorId] = Buffer.from(query.cursor, 'base64').toString().split('|');
            filter.$or = [
                { start_at: { $gt: new Date(cursorDate) } },
                { start_at: new Date(cursorDate), _id: { $gt: cursorId } },
            ];
        } catch {
            throw new ServiceError(422, 'invalid_cursor');
        }
    }

    const events = await Event.find(filter)
        .sort(sortObj)
        .limit(limit + 1);

    const hasMore = events.length > limit;
    const results = hasMore ? events.slice(0, limit) : events;

    let nextCursor: string | null = null;
    if (hasMore && results.length > 0) {
        const last = results[results.length - 1];
        nextCursor = Buffer.from(`${last.start_at.toISOString()}|${last._id}`).toString('base64');
    }

    return { events: results, next_cursor: nextCursor, limit };
}

export async function findByRef(
    ref: string,
    viewer?: { id: string; role: string }
): Promise<IEvent> {
    const query = isUuid(ref)
        ? { _id: ref, deleted_at: null }
        : { slug: ref.toLowerCase(), deleted_at: null };

    const event = await Event.findOne(query);
    if (!event) throw new ServiceError(404, 'not_found');

    if (event.status === 'draft') {
        const isCoreAdmin = viewer && (event.core_admins.includes(viewer.id) || event.created_by === viewer.id);
        const isPrivileged = viewer && [UserRole.COORDINATOR, UserRole.FOUNDER].includes(viewer.role as UserRole);
        if (!isCoreAdmin && !isPrivileged) {
            throw new ServiceError(404, 'not_found');
        }
    }

    return event;
}

export async function updateEvent(
    ref: string,
    actor: { id: string; role: string },
    input: UpdateEventInput
): Promise<IEvent> {
    const event = await findByRef(ref, actor);

    const isCoreAdmin = event.core_admins.includes(actor.id) || event.created_by === actor.id;
    const isPrivileged = [UserRole.COORDINATOR, UserRole.FOUNDER].includes(actor.role as UserRole);
    if (!isCoreAdmin && !isPrivileged) {
        throw new ServiceError(403, 'forbidden');
    }

    validateEventInvariants({
        start_at: input.start_at ?? event.start_at,
        end_at: input.end_at ?? event.end_at,
        registration: input.registration ? { ...event.registration, ...input.registration } : event.registration,
        teaming: input.teaming ? { ...event.teaming, ...input.teaming } : event.teaming,
        scoring: input.scoring ? { ...event.scoring, ...input.scoring } : event.scoring,
    });

    // Check status transition validity
    let statusTransition: string | null = null;
    if (input.status && input.status !== event.status) {
        if (event.status === 'cancelled' || event.status === 'past') {
            throw new ServiceError(409, 'event_is_terminal');
        }
        statusTransition = input.status;
    }

    Object.assign(event, input);
    await event.save();

    if (statusTransition === 'cancelled') {
        publish('EventCancelled', PRODUCER, { event_id: event._id });
    } else if (statusTransition === 'ongoing') {
        publish('EventStarted', PRODUCER, { event_id: event._id });
    } else if (statusTransition === 'past') {
        publish('EventCompleted', PRODUCER, { event_id: event._id });
    }

    publish('EventUpdated', PRODUCER, { event_id: event._id });
    return event;
}

export async function deleteEvent(
    ref: string,
    actor: { id: string; role: string }
): Promise<{ deleted: boolean }> {
    const event = await findByRef(ref, actor);

    const isPrivileged = [UserRole.COORDINATOR, UserRole.FOUNDER].includes(actor.role as UserRole);
    if (!isPrivileged) {
        throw new ServiceError(403, 'forbidden');
    }

    if (event.status !== 'draft') {
        throw new ServiceError(409, 'cannot_delete_published_event');
    }

    event.deleted_at = new Date();
    await event.save();

    publish('EventDeleted', PRODUCER, { event_id: event._id });
    return { deleted: true };
}

export async function reserveSeat(
    eventId: string,
    registrationId: string,
    _idempotencyKey: string
): Promise<{ reserved: boolean; waitlisted?: boolean; reason?: string }> {
    const event = await Event.findOne({ _id: eventId, deleted_at: null });
    if (!event) return { reserved: false, reason: 'event_not_found' };

    const now = new Date();
    if (event.status === 'cancelled' || event.status === 'past') {
        return { reserved: false, reason: 'event_closed' };
    }
    if (event.registration.closes_at && now > event.registration.closes_at) {
        return { reserved: false, reason: 'event_closed' };
    }

    const max = event.registration.max_participants;

    // Check if this was a waitlist promotion
    const existingSub = await FormSubmission.findById(registrationId);
    const wasWaitlisted = existingSub && existingSub.status === 'waitlisted';

    if (max !== null) {
        const updated = await Event.findOneAndUpdate(
            {
                _id: eventId,
                'counts.registrations_confirmed': { $lt: max },
            },
            { $inc: { 'counts.registrations_confirmed': 1 } },
            { returnDocument: 'after' }
        );

        if (!updated) {
            if (wasWaitlisted) {
                return { reserved: false, reason: 'capacity_full' };
            }
            if (!event.registration.waitlist_enabled) {
                return { reserved: false, reason: 'capacity_full' };
            }
            // Waitlist enabled -> seat reserved on waitlist
            await Event.updateOne({ _id: eventId }, { $inc: { 'counts.registrations_waitlisted': 1 } });
            return { reserved: true, waitlisted: true };
        }

        if (wasWaitlisted) {
            await Event.updateOne(
                { _id: eventId, 'counts.registrations_waitlisted': { $gt: 0 } },
                { $inc: { 'counts.registrations_waitlisted': -1 } }
            );
        }
        return { reserved: true, waitlisted: false };
    }

    // Capacity unlimited
    await Event.updateOne({ _id: eventId }, { $inc: { 'counts.registrations_confirmed': 1 } });
    if (wasWaitlisted) {
        await Event.updateOne(
            { _id: eventId, 'counts.registrations_waitlisted': { $gt: 0 } },
            { $inc: { 'counts.registrations_waitlisted': -1 } }
        );
    }
    return { reserved: true, waitlisted: false };
}

export async function releaseSeat(
    eventId: string,
    _registrationId: string
): Promise<{ released: boolean }> {
    await Event.updateOne(
        { _id: eventId, 'counts.registrations_confirmed': { $gt: 0 } },
        { $inc: { 'counts.registrations_confirmed': -1 } }
    );
    return { released: true };
}

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

    const existing = await FormSubmission.findOne({
        'owner.type': 'event',
        'owner.id': event._id,
        'user.user_id': userId,
        status: { $ne: 'cancelled' },
    });

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

    if (existing) {
        return {
            eligible: false,
            reason: 'already_registered',
            capacity_status: capacityStatus,
            ...baseResult,
        };
    }

    if (event.status === 'draft') {
        return { eligible: false, reason: 'event_draft', capacity_status: capacityStatus, ...baseResult };
    }
    if (event.status === 'cancelled') {
        return { eligible: false, reason: 'event_cancelled', capacity_status: capacityStatus, ...baseResult };
    }
    if (event.status === 'past') {
        return { eligible: false, reason: 'event_past', capacity_status: capacityStatus, ...baseResult };
    }

    if (event.registration.opens_at && now < event.registration.opens_at) {
        return { eligible: false, reason: 'not_yet_open', capacity_status: capacityStatus, ...baseResult };
    }
    if (event.registration.closes_at && now > event.registration.closes_at) {
        return { eligible: false, reason: 'registration_closed', capacity_status: capacityStatus, ...baseResult };
    }

    if (isFull && !event.registration.waitlist_enabled) {
        return { eligible: false, reason: 'capacity_full', capacity_status: 'full', ...baseResult };
    }

    return {
        eligible: true,
        reason: null,
        capacity_status: capacityStatus,
        ...baseResult,
    };
}

export async function getMyEventRegistration(
    ref: string,
    userId: string
): Promise<IFormSubmission | null> {
    const event = await findByRef(ref);
    return FormSubmission.findOne({
        'owner.type': 'event',
        'owner.id': event._id,
        'user.user_id': userId,
        status: { $ne: 'cancelled' },
    });
}

export async function getEventParticipants(
    ref: string,
    query: QueryParticipantsInput,
    viewer?: { id: string; role: string }
): Promise<{
    event_id: string;
    participants: Array<{
        registration_id: string;
        user: { user_id: string; display_name: string; avatar_url: string | null };
        status: string;
        role: string | null;
        team_id: string | null;
        base_price: number | null;
        attended: boolean | null;
        submitted_at: Date | null;
        waitlist_position: number | null;
    }>;
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}> {
    const event = await findByRef(ref, viewer);
    const filter: Record<string, unknown> = {
        'owner.type': 'event',
        'owner.id': event._id,
    };

    const isCoreAdmin = viewer && (event.core_admins.includes(viewer.id) || event.created_by === viewer.id);
    const isPrivileged = viewer && [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER].includes(viewer.role as UserRole);
    const hasAdminAccess = isCoreAdmin || isPrivileged;

    if (query.status) {
        filter.status = query.status;
    } else if (!hasAdminAccess) {
        // Public only sees confirmed participants
        filter.status = 'confirmed';
    }

    if (query.role) {
        filter['context.event.role'] = query.role;
    }
    if (query.attended !== undefined) {
        filter['context.event.attended'] = query.attended;
    }
    if (query.team_id) {
        filter['context.event.team_id'] = query.team_id;
    }
    if (query.search) {
        filter['user.display_name'] = new RegExp(query.search.trim(), 'i');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 20);
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
        FormSubmission.find(filter)
            .sort({ submitted_at: 1, created_at: 1 })
            .skip(skip)
            .limit(limit),
        FormSubmission.countDocuments(filter),
    ]);

    const participants = submissions.map((sub) => ({
        registration_id: sub._id,
        user: sub.user,
        status: sub.status,
        role: sub.context.event?.role ?? null,
        team_id: sub.context.event?.team_id ?? null,
        base_price: hasAdminAccess ? (sub.context.event?.base_price ?? null) : null,
        attended: sub.context.event?.attended ?? null,
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

export async function getEventParticipantStats(
    ref: string,
    viewer?: { id: string; role: string }
): Promise<{
    event_id: string;
    counts: {
        confirmed: number;
        waitlisted: number;
        cancelled: number;
        rejected: number;
        total_submissions: number;
        attended: number;
        absent: number;
        unmarked: number;
        solo_count: number;
        captain_count: number;
        member_count: number;
    };
    capacity: {
        max_participants: number | null;
        is_full: boolean;
        waitlist_enabled: boolean;
    };
}> {
    const event = await findByRef(ref, viewer);
    const submissions = await FormSubmission.find({
        'owner.type': 'event',
        'owner.id': event._id,
    });

    let confirmed = 0;
    let waitlisted = 0;
    let cancelled = 0;
    let rejected = 0;
    let attended = 0;
    let absent = 0;
    let unmarked = 0;
    let solo = 0;
    let captain = 0;
    let member = 0;

    for (const sub of submissions) {
        if (sub.status === 'confirmed') confirmed++;
        else if (sub.status === 'waitlisted') waitlisted++;
        else if (sub.status === 'cancelled') cancelled++;
        else if (sub.status === 'rejected') rejected++;

        if (sub.status === 'confirmed') {
            if (sub.context.event?.attended === true) attended++;
            else if (sub.context.event?.attended === false) absent++;
            else unmarked++;
        }

        const role = sub.context.event?.role;
        if (role === 'solo') solo++;
        else if (role === 'captain') captain++;
        else if (role === 'member') member++;
    }

    const max = event.registration.max_participants;
    return {
        event_id: event._id,
        counts: {
            confirmed,
            waitlisted,
            cancelled,
            rejected,
            total_submissions: submissions.length,
            attended,
            absent,
            unmarked,
            solo_count: solo,
            captain_count: captain,
            member_count: member,
        },
        capacity: {
            max_participants: max,
            is_full: max !== null && confirmed >= max,
            waitlist_enabled: event.registration.waitlist_enabled,
        },
    };
}

export async function getEventWaitlist(
    ref: string,
    viewer?: { id: string; role: string }
): Promise<{
    event_id: string;
    waitlist: Array<{
        position: number;
        registration_id: string;
        user: { user_id: string; display_name: string; avatar_url: string | null };
        submitted_at: Date | null;
    }>;
    total_waitlisted: number;
}> {
    const event = await findByRef(ref, viewer);
    const submissions = await FormSubmission.find({
        'owner.type': 'event',
        'owner.id': event._id,
        status: 'waitlisted',
    }).sort({ submitted_at: 1, created_at: 1 });

    const waitlist = submissions.map((sub, idx) => ({
        position: idx + 1,
        registration_id: sub._id,
        user: sub.user,
        submitted_at: sub.submitted_at,
    }));

    return {
        event_id: event._id,
        waitlist,
        total_waitlisted: waitlist.length,
    };
}

export async function promoteWaitlistedParticipant(
    ref: string,
    registrationId: string,
    actor: { id: string; role: string },
    adminOverride: boolean = false
): Promise<IFormSubmission> {
    const event = await findByRef(ref, actor);
    const isCoreAdmin = event.core_admins.includes(actor.id) || event.created_by === actor.id;
    const isPrivileged = [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER].includes(actor.role as UserRole);
    if (!isCoreAdmin && !isPrivileged) {
        throw new ServiceError(403, 'forbidden');
    }

    const sub = await FormSubmission.findOne({
        _id: registrationId,
        'owner.type': 'event',
        'owner.id': event._id,
        status: 'waitlisted',
    });
    if (!sub) {
        throw new ServiceError(404, 'waitlisted_participant_not_found');
    }

    const max = event.registration.max_participants;
    if (max !== null && event.counts.registrations_confirmed >= max && !adminOverride) {
        throw new ServiceError(409, 'capacity_full_cannot_promote_without_override');
    }

    sub.status = 'confirmed';
    sub.confirmed_at = new Date();
    sub.waitlist_position = null;
    sub.status_history.push({
        from: 'waitlisted',
        to: 'confirmed',
        by: actor.id,
        at: new Date(),
        reason: 'admin_promoted_from_waitlist',
    });
    await sub.save();

    const updatedWithWaitlist = await Event.findOneAndUpdate(
        { _id: event._id, 'counts.registrations_waitlisted': { $gt: 0 } },
        {
            $inc: {
                'counts.registrations_confirmed': 1,
                'counts.registrations_waitlisted': -1,
            },
        }
    );
    if (!updatedWithWaitlist) {
        await Event.updateOne(
            { _id: event._id },
            {
                $inc: { 'counts.registrations_confirmed': 1 },
                $set: { 'counts.registrations_waitlisted': 0 },
            }
        );
    }

    publish('RegistrationConfirmed', PRODUCER, {
        registration_id: sub._id,
        event_id: event._id,
        user_id: sub.user.user_id,
        promoted_by: actor.id,
    });

    return sub;
}

export async function recordEventAttendance(
    ref: string,
    attendances: Array<{ registration_id: string; attended: boolean; note?: string }>,
    actor: { id: string; role: string }
): Promise<{ updated_count: number }> {
    const event = await findByRef(ref, actor);
    const isCoreAdmin = event.core_admins.includes(actor.id) || event.created_by === actor.id;
    const isPrivileged = [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER].includes(actor.role as UserRole);
    if (!isCoreAdmin && !isPrivileged) {
        throw new ServiceError(403, 'forbidden');
    }

    let count = 0;
    for (const item of attendances) {
        const sub = await FormSubmission.findOne({
            _id: item.registration_id,
            'owner.type': 'event',
            'owner.id': event._id,
        });
        if (sub && sub.context.event) {
            const previousAttended = sub.context.event.attended;
            sub.context.event.attended = item.attended;
            await sub.save();
            count++;

            if (item.attended && previousAttended !== true) {
                publish('ParticipantAttended', PRODUCER, {
                    event_id: event._id,
                    registration_id: sub._id,
                    user_id: sub.user.user_id,
                    marked_by: actor.id,
                });
            }
        }
    }

    return { updated_count: count };
}

export async function getEventAttendance(
    ref: string,
    viewer?: { id: string; role: string }
): Promise<{
    event_id: string;
    summary: { confirmed: number; attended: number; absent: number; unmarked: number };
    records: Array<{
        registration_id: string;
        user: { user_id: string; display_name: string; avatar_url: string | null };
        attended: boolean | null;
        role: string | null;
        team_id: string | null;
    }>;
}> {
    const event = await findByRef(ref, viewer);
    const submissions = await FormSubmission.find({
        'owner.type': 'event',
        'owner.id': event._id,
        status: 'confirmed',
    }).sort({ submitted_at: 1 });

    let attended = 0;
    let absent = 0;
    let unmarked = 0;

    const records = submissions.map((sub) => {
        const att = sub.context.event?.attended ?? null;
        if (att === true) attended++;
        else if (att === false) absent++;
        else unmarked++;

        return {
            registration_id: sub._id,
            user: sub.user,
            attended: att,
            role: sub.context.event?.role ?? null,
            team_id: sub.context.event?.team_id ?? null,
        };
    });

    return {
        event_id: event._id,
        summary: {
            confirmed: submissions.length,
            attended,
            absent,
            unmarked,
        },
        records,
    };
}

export async function addEventCaptain(
    ref: string,
    userId: string,
    actor: { id: string; role: string }
): Promise<IEvent> {
    const event = await findByRef(ref, actor);
    const isCoreAdmin = event.core_admins.includes(actor.id) || event.created_by === actor.id;
    const isPrivileged = [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER].includes(actor.role as UserRole);
    if (!isCoreAdmin && !isPrivileged) {
        throw new ServiceError(403, 'forbidden');
    }

    if (!event.auction) {
        event.auction = {
            k_multiplier: 1.0,
            min_bid_increment: 100,
            bid_timer_seconds: 5,
            oc_override_quota: 3 / 7,
            oc_captain_override_quota: 3 / 7,
            status: 'not_started',
            captain_user_ids: [],
            purse_per_team: null,
        };
    }

    if (!event.auction!.captain_user_ids.includes(userId)) {
        event.auction!.captain_user_ids.push(userId);
        await event.save();
        publish('CaptainApproved', PRODUCER, {
            event_id: event._id,
            user_id: userId,
            approved_by: actor.id,
        });
    }

    return event;
}

export async function removeEventCaptain(
    ref: string,
    userId: string,
    actor: { id: string; role: string }
): Promise<IEvent> {
    const event = await findByRef(ref, actor);
    const isCoreAdmin = event.core_admins.includes(actor.id) || event.created_by === actor.id;
    const isPrivileged = [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER].includes(actor.role as UserRole);
    if (!isCoreAdmin && !isPrivileged) {
        throw new ServiceError(403, 'forbidden');
    }

    if (event.auction) {
        event.auction.captain_user_ids = event.auction.captain_user_ids.filter((id) => id !== userId);
        await event.save();
    }

    return event;
}

export async function listEventCaptains(
    ref: string
): Promise<{ event_id: string; captain_user_ids: string[]; captains: Array<{ user_id: string; display_name: string; avatar_url: string | null }> }> {
    const event = await findByRef(ref);
    const captainIds = event.auction?.captain_user_ids ?? [];
    const users = await User.find({ _id: { $in: captainIds } });

    const captains = users.map((u) => userSnapshotOf(u));

    return {
        event_id: event._id,
        captain_user_ids: captainIds,
        captains,
    };
}
