import {
    FEEDBACK_RATE_PER_HOUR,
    FEEDBACK_TRANSITIONS,
    FeedbackCategory,
    FeedbackKind,
    FeedbackSeverity,
    FeedbackStatus,
    FeedbackThrottle,
    FeedbackTicket,
    IFeedbackTicket,
    IUser,
    RoleName,
    ServiceError,
    User,
    config,
    publish,
    recordAudit,
    roleRank,
    userSnapshotOf,
} from '@bgsc/shared';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { allOf, keysetFilter, pageOf } from './cursor';
import { ListTicketsInput, SubmitContactInput, SubmitFeedbackInput, UpdateStatusInput } from './feedback.schemas';
import { FeedbackMailer } from './mailer';
import { ticketNo } from './ticketNo';

/**
 * Tickets: submission, the staff inbox, and the status ladder.
 *
 * The load-bearing rule in this file is the anonymous one. Spec §5.12 offers an anonymous toggle,
 * and a toggle that quietly keeps the submitter's id is worse than no toggle at all, because the
 * person believed it. So on that path there is no `reporter`, the audit row carries a null actor
 * **and a null ip**, and the only trace is the rate limiter's one-way hash.
 */

const PRODUCER = 'feedback-service';
const STAFF_FLOOR: RoleName = 'core';

/** Who is asking, as far as a public endpoint can tell. */
export interface Submitter {
    user: IUser | null;
    ip: string | null;
}

export interface Actor {
    id: string;
    role: RoleName;
    ip: string | null;
}

/* ------------------------------------------------------------------ *
 * Abuse control on a public write (plan §5)
 * ------------------------------------------------------------------ */

/**
 * The submitter's rate-limit key.
 *
 * An account id when there is one; otherwise the address — **hashed**, because it is only ever
 * compared for equality and a raw-IP column on an anonymous feedback form is a liability nobody
 * asked for. Keyed with the JWT secret so the hash cannot be reversed with a list of the
 * four billion addresses.
 */
export function subjectKey(submitter: Submitter): string {
    if (submitter.user) return `user:${submitter.user._id}`;
    const digest = createHash('sha256')
        .update(`${submitter.ip ?? 'unknown'}|${config.jwt.accessSecret}`)
        .digest('hex');
    return `ip:${digest}`;
}

/**
 * ponytail: a count-then-insert, so two requests arriving in the same millisecond can both pass and
 * put one extra ticket through. That is a cap on floods, not a gate on a resource — the failure
 * costs one row — and closing it properly means a counter document per subject with an atomic
 * `$inc`, which is the upgrade if a script ever makes it worth having.
 */
async function assertUnderRate(key: string): Promise<void> {
    const since = new Date(Date.now() - 3_600_000);
    const recent = await FeedbackThrottle.countDocuments({ subject_key: key, created_at: { $gte: since } });
    if (recent >= FEEDBACK_RATE_PER_HOUR) {
        throw new ServiceError(429, 'too_many_tickets', { retry_after_minutes: 60 });
    }
    await FeedbackThrottle.create({
        _id: uuid(),
        subject_key: key,
        expires_at: new Date(Date.now() + 3_600_000),
    });
}

/* ------------------------------------------------------------------ *
 * Submit
 * ------------------------------------------------------------------ */

interface SubmitOptions {
    kind: FeedbackKind;
    category: FeedbackCategory;
    severity: FeedbackSeverity;
}

async function create(
    input: SubmitFeedbackInput | SubmitContactInput,
    opts: SubmitOptions,
    submitter: Submitter
): Promise<IFeedbackTicket> {
    // An anonymous ticket has nowhere to send the Spec §5.12 receipt unless the submitter gives an
    // address, and a signed-out submitter is always anonymous whatever the toggle says.
    const anonymous = input.is_anonymous || submitter.user === null;
    const email = input.contact_email ?? (anonymous ? null : submitter.user!.email);
    if (anonymous && !email) throw new ServiceError(422, 'contact_email_required');

    await assertUnderRate(subjectKey(submitter));

    const ticket = await insertWithUniqueNumber({
        kind: opts.kind,
        category: opts.category,
        severity: opts.severity,
        subject: input.subject,
        description: input.description,
        attachments: input.attachments ?? [],
        event_id: input.event_id ?? null,
        is_anonymous: anonymous,
        reporter: anonymous ? null : userSnapshotOf(submitter.user!),
        contact_email: email,
        status: 'submitted',
    });

    await recordAudit({
        // Both null on the anonymous path, and that is the whole point: the audit trail must not
        // be the place the toggle is undone.
        actor_id: anonymous ? null : submitter.user!._id,
        action: 'feedback.submitted',
        target_type: 'feedback_ticket',
        target_id: ticket._id,
        new_value: { ticket_no: ticket.ticket_no, kind: ticket.kind, category: ticket.category },
        ip: anonymous ? null : submitter.ip,
    });

    // Best-effort: a ticket that is stored but whose receipt could not be sent is still a ticket.
    await FeedbackMailer.sendTicketReceipt(email!, ticket.ticket_no, ticket.subject).catch((err) =>
        console.error(`[feedback-service] receipt for ${ticket.ticket_no} failed:`, err)
    );

    // Staff notice. The Notification Service knows who staff are and how to fan out to a role
    // floor; this service should not learn either (plan §4).
    publish('FeedbackSubmitted', PRODUCER, {
        ticket_id: ticket._id,
        ticket_no: ticket.ticket_no,
        kind: ticket.kind,
        category: ticket.category,
        severity: ticket.severity,
        subject: ticket.subject,
    });

    return ticket;
}

/**
 * `ticket_no` is random and unique-indexed, so a collision is a retry rather than a read-then-write
 * race. Three attempts: at 2^40 possibilities the second is already paranoia.
 */
async function insertWithUniqueNumber(fields: Record<string, unknown>): Promise<IFeedbackTicket> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await FeedbackTicket.create({ _id: uuid(), ticket_no: ticketNo(), ...fields });
        } catch (err) {
            if ((err as { code?: number }).code !== 11000 || attempt === 2) throw err;
        }
    }
    throw new ServiceError(500, 'internal_error');
}

export const submitFeedback = (input: SubmitFeedbackInput, submitter: Submitter) =>
    create(input, { kind: 'feedback', category: input.category, severity: input.severity }, submitter);

export const submitContact = (input: SubmitContactInput, submitter: Submitter) =>
    create(input, { kind: 'contact', category: 'general', severity: 'low' }, submitter);

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

const isStaff = (role: RoleName | undefined): boolean => !!role && roleRank(role) >= roleRank(STAFF_FLOOR);

export interface ListResult {
    tickets: IFeedbackTicket[];
    next_cursor: string | null;
}

/**
 * One ticket.
 *
 * Staff see any ticket. Everyone else sees their own — and an anonymous ticket belongs to nobody,
 * so it is readable by whoever holds the number, which is exactly how the receipt email works.
 * A ticket that is none of those answers **404**, never 403: a stranger should not learn that a
 * number exists (`adding-a-service.md §6.6`).
 */
export async function getTicket(
    ticket_no: string,
    viewer: { id: string | null; role: RoleName | undefined }
): Promise<IFeedbackTicket> {
    const ticket = await FeedbackTicket.findOne({ ticket_no }).lean<IFeedbackTicket>();
    if (!ticket) throw new ServiceError(404, 'ticket_not_found');

    const mine = ticket.reporter?.user_id && ticket.reporter.user_id === viewer.id;
    const bearer = ticket.is_anonymous; // holding the number is the credential
    if (!isStaff(viewer.role) && !mine && !bearer) throw new ServiceError(404, 'ticket_not_found');
    return ticket;
}

export async function listMine(userId: string, input: ListTicketsInput): Promise<ListResult> {
    const conditions: Record<string, unknown>[] = [{ 'reporter.user_id': userId }];
    if (input.status) conditions.push({ status: input.status });
    if (input.cursor) conditions.push(keysetFilter(input.cursor));

    const rows = await FeedbackTicket.find(allOf(conditions))
        .sort({ created_at: -1, _id: -1 })
        .limit(input.limit)
        .lean<IFeedbackTicket[]>();

    const { rows: tickets, next_cursor } = pageOf(rows, input.limit);
    return { tickets, next_cursor };
}

/** The staff inbox. Filters are ANDed; the default order is newest first. */
export async function listInbox(input: ListTicketsInput): Promise<ListResult> {
    const conditions: Record<string, unknown>[] = [];
    if (input.status) conditions.push({ status: input.status });
    if (input.category) conditions.push({ category: input.category });
    if (input.severity) conditions.push({ severity: input.severity });
    if (input.kind) conditions.push({ kind: input.kind });
    if (input.event_id) conditions.push({ event_id: input.event_id });
    if (input.cursor) conditions.push(keysetFilter(input.cursor));

    const query = conditions.length > 0 ? allOf(conditions) : {};
    const rows = await FeedbackTicket.find(query)
        .sort({ created_at: -1, _id: -1 })
        .limit(input.limit)
        .lean<IFeedbackTicket[]>();

    const { rows: tickets, next_cursor } = pageOf(rows, input.limit);
    return { tickets, next_cursor };
}

/* ------------------------------------------------------------------ *
 * Triage
 * ------------------------------------------------------------------ */

/**
 * Move the ladder (Spec §5.12: Submitted → Under Review → Resolved → Closed).
 *
 * A compare-and-swap on the status it is moving *from*, so two reviewers acting at once produce one
 * transition and one history row rather than two. The legal moves are on the model, next to the
 * enum they belong to.
 */
export async function setStatus(
    ticket_no: string,
    input: UpdateStatusInput,
    actor: Actor
): Promise<IFeedbackTicket> {
    const current = await FeedbackTicket.findOne({ ticket_no });
    if (!current) throw new ServiceError(404, 'ticket_not_found');

    const allowed = FEEDBACK_TRANSITIONS[current.status as FeedbackStatus];
    if (!allowed.includes(input.status)) {
        throw new ServiceError(422, 'illegal_transition', { from: current.status, to: input.status });
    }

    const set: Record<string, unknown> = { status: input.status };
    if (input.response) {
        set.response = { body: input.response, by_user_id: actor.id, at: new Date() };
    }

    const updated = await FeedbackTicket.findOneAndUpdate(
        { ticket_no, status: current.status },
        {
            $set: set,
            $push: {
                status_history: {
                    from: current.status,
                    to: input.status,
                    by: actor.id,
                    at: new Date(),
                    reason: input.response ? 'response sent' : null,
                },
            },
        },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'ticket_changed');

    await recordAudit({
        actor_id: actor.id,
        action: 'feedback.status_changed',
        target_type: 'feedback_ticket',
        target_id: updated._id,
        previous_value: { status: current.status },
        new_value: { status: input.status, responded: !!input.response },
        ip: actor.ip,
    });

    if (input.response && updated.contact_email) {
        await FeedbackMailer.sendResponse(updated.contact_email, updated.ticket_no, input.response).catch((err) =>
            console.error(`[feedback-service] response mail for ${updated.ticket_no} failed:`, err)
        );
    }

    publish('FeedbackStatusChanged', PRODUCER, {
        ticket_id: updated._id,
        ticket_no: updated.ticket_no,
        from: current.status,
        to: updated.status,
    });

    return updated;
}

/** Triage. A reporter's "critical" is a wish; the severity that drives the inbox is staff's. */
export async function setSeverity(
    ticket_no: string,
    severity: FeedbackSeverity,
    actor: Actor
): Promise<IFeedbackTicket> {
    const updated = await FeedbackTicket.findOneAndUpdate(
        { ticket_no },
        { $set: { severity } },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(404, 'ticket_not_found');

    await recordAudit({
        actor_id: actor.id,
        action: 'feedback.severity_changed',
        target_type: 'feedback_ticket',
        target_id: updated._id,
        new_value: { severity },
        ip: actor.ip,
    });
    return updated;
}

/** The live user document behind a token, or null for a caller with no session. */
export async function submitterFor(
    user: { id: string } | undefined,
    ip: string | null
): Promise<Submitter> {
    if (!user) return { user: null, ip };
    const doc = await User.findById(user.id).select('+email');
    return { user: doc ?? null, ip };
}
