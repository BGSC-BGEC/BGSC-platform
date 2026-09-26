import {
    ACTIVE_SUBMISSION_STATUS,
    Challenge,
    Event,
    FormDefinition,
    FormDefinitionVersion,
    FormField,
    FormSubmission,
    FormUpload,
    IFormDefinition,
    IFormSubmission,
    InternalCallError,
    ServiceError,
    SubmissionStatus,
    User,
    publish,
    userSnapshotOf,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { SubmissionFile, validateAnswers } from './validation';
import { releaseSeatQuietly, reserveSeat, settleRefusal } from '../clients/event-client';
import { captainHasTeam, detachRegistration, refuseLeavingDuringAuction } from '../teams/team.service';
import { FileRefInput } from './registration.schemas';
import { Actor, OwnerRef, isOwnerAdmin, ownerOfId, requireOwnerAdmin } from '../access';
import { privatePathOf } from '../storage/storage';

const PRODUCER = 'registration-service';

/**
 * An InternalCallError from the Event Service, as this service's answer: a refusal keeps its code
 * as a 409; "no answer" — and 401/403, which mean OUR token or routing is wrong, not that the event
 * said no — is a 503 the caller can retry.
 */
export function seatCallError(err: unknown): unknown {
    if (!(err instanceof InternalCallError)) return err;
    if (err.outcomeUnknown || err.status === 401 || err.status === 403) return new ServiceError(503, 'event_service_unavailable');
    return new ServiceError(409, err.code);
}

/**
 * No `is_admin`: nobody fills admin_only fields on their own submission — not even an event admin
 * registering for their own event. Admin answers go through `updateAdminAnswers`.
 */
interface SubmitRegistrationInput {
    form_id: string;
    owner: { type: 'event' | 'challenge' | 'generic'; id: string | null };
    answers: Record<string, unknown>;
    files?: FileRefInput[];
    context?: { event?: { role: 'solo' | 'captain' | 'member'; team_visibility?: 'open' | 'invite_only' | 'closed'; base_price?: number | null } };
    user_id: string;
}

/* ------------------------------------------------------------------ *
 * Status changes
 * ------------------------------------------------------------------ */

/**
 * Status change on a submission that has not been saved yet (a new one), which only ever moves to
 * `submitted` or `confirmed`. Every change to a STORED row goes through `casTransition` instead.
 */
function transition(submission: IFormSubmission, to: 'submitted' | 'confirmed', by: string, reason: string | null): void {
    submission.status_history.push({ from: submission.status, to, by, at: new Date(), reason });
    submission.status = to;
    if (to === 'confirmed') submission.confirmed_at = new Date();
}

/**
 * The one way a stored registration changes status: a compare-and-swap on the status the caller
 * read. Cancel, admin override and captain approval were read → check → `save()`, and scalar sets
 * carry no version check, so a double-clicked cancel released two seats and promoted two people.
 * Returns null when the row moved underneath the caller.
 *
 * A query update skips the model's pre-validate hook, so the invariants it enforces are written
 * here: waitlist_position exactly when waitlisted, team link only while confirmed.
 */
async function casTransition(
    sub: IFormSubmission,
    to: SubmissionStatus,
    by: string,
    reason: string | null,
    opts: { filter?: Record<string, unknown>; set?: Record<string, unknown> } = {}
): Promise<IFormSubmission | null> {
    const from = sub.status;
    const now = new Date();
    const set: Record<string, unknown> = {
        ...opts.set,
        status: to,
        waitlist_position: to === 'waitlisted' ? await nextWaitlistPosition(sub.owner.id) : null,
    };
    if (to !== 'confirmed' && sub.context?.event) set['context.event.team_id'] = null;
    if (to === 'confirmed' && !sub.confirmed_at) set.confirmed_at = now;
    if (to === 'cancelled') set.cancelled_at = now;

    try {
        return await FormSubmission.findOneAndUpdate(
            { _id: sub._id, status: from, ...opts.filter },
            { $set: set, $push: { status_history: { from, to, by, at: now, reason } } },
            { returnDocument: 'after' }
        );
    } catch (err: any) {
        // Reviving a rejected row while the user holds a newer active one.
        if (err?.code === 11000) throw new ServiceError(409, 'already_registered');
        throw err;
    }
}

/**
 * ponytail: max+1, not count+1. Still a read-then-write, so two simultaneous waitlistings can share
 * a position — positions are display order, not a lock (promotion orders by position then by
 * submitted_at). Make it an atomic counter if that ever matters.
 */
async function nextWaitlistPosition(ownerId: string | null): Promise<number> {
    const last = await FormSubmission.findOne({ 'owner.id': ownerId, status: 'waitlisted' })
        .sort({ waitlist_position: -1 })
        .select('waitlist_position');
    return (last?.waitlist_position ?? 0) + 1;
}

const isEventRow = (sub: IFormSubmission): boolean => sub.owner.type === 'event' && !!sub.owner.id;

/**
 * A row just became `confirmed` — on ANY path (submit, resubmit, approval, admin confirm, waitlist
 * promotion, internal promote). `RegistrationCreated` is the one "now confirmed" event
 * (RegistrationConfirmed is retired), and an approved captain joins the event's captain pool on
 * `CaptainApproved` — which used to fire only when approval and seat landed in the same call, so a
 * captain confirmed later (promotion, admin) never reached the pool.
 */
function announceConfirmed(submission: IFormSubmission): void {
    publish('RegistrationCreated', PRODUCER, {
        registration_id: submission._id,
        owner: submission.owner,
        user_id: submission.user.user_id,
        role: submission.context.event?.role ?? 'solo',
    });
    const ev = submission.context.event;
    if (ev?.role === 'captain' && ev.captain_application.status === 'approved') {
        publish('CaptainApproved', PRODUCER, {
            registration_id: submission._id,
            event_id: submission.owner.id!,
            user_id: submission.user.user_id,
            approved_by: ev.captain_application.reviewed_by ?? 'system',
        });
    }
}

function publishWaitlisted(sub: IFormSubmission): void {
    publish('RegistrationWaitlisted', PRODUCER, {
        registration_id: sub._id,
        owner: sub.owner,
        user_id: sub.user.user_id,
        position: sub.waitlist_position!,
    });
}

/**
 * A registration left `confirmed` (or gave up a seat it may have held). `freed_seat` is true only
 * when the Event Service confirmed the release. `previous_status` tells a waitlist exit from a
 * seat; `role` lets the Event Service drop a departing captain from the auction pool.
 */
function publishLeft(sub: IFormSubmission, previousStatus: SubmissionStatus, freedSeat: boolean, reason: string): void {
    publish('RegistrationCancelled', PRODUCER, {
        registration_id: sub._id,
        owner: sub.owner,
        user_id: sub.user.user_id,
        role: sub.context.event?.role ?? null,
        previous_status: previousStatus,
        status: sub.status,
        freed_seat: freedSeat,
        reason,
    });
}

/** Rows that may hold an event seat: confirmed, or submitted after a reserve whose answer was lost. */
const MAY_HOLD_SEAT: SubmissionStatus[] = ['confirmed', 'submitted'];

/**
 * Release a seat this row was given but does not use — unless the row is in fact confirmed. A CAS
 * loser used to release unconditionally, and when the winner had confirmed the SAME row (two
 * admins, or an admin and a promotion) that took the winner's seat away.
 */
async function releaseUnlessConfirmed(sub: IFormSubmission): Promise<IFormSubmission | null> {
    const now = await FormSubmission.findById(sub._id);
    if (now?.status !== 'confirmed') await releaseSeatQuietly(sub.owner.id!, sub._id);
    return now;
}

/* ------------------------------------------------------------------ *
 * Seats
 * ------------------------------------------------------------------ */

/**
 * Ask the Event Service for a seat and settle the row on the answer: reserved →
 * confirmed; `capacity_full` → waitlisted; any other refusal → rejected. Reserve is idempotent per
 * registration id on the Event Service, so a retry — or a second caller — never counts twice.
 *
 * Throws `InternalCallError` when the answer is unknown or refused at the HTTP level; the row is
 * then untouched and still `submitted`, and the stranded sweep (or a resubmit) retries it.
 */
export async function reserveAndSettle(sub: IFormSubmission, by: string, reason: string): Promise<IFormSubmission> {
    const eventId = sub.owner.id!;
    const result = await reserveSeat(eventId, sub._id);

    if (result.reserved) {
        const done = await casTransition(sub, 'confirmed', by, reason).catch(async (err) => {
            await releaseUnlessConfirmed(sub);
            throw err;
        });
        if (!done) return (await releaseUnlessConfirmed(sub)) ?? sub;
        announceConfirmed(done);
        return done;
    }

    const to = settleRefusal(result.reason);
    const done = await casTransition(sub, to, 'system', result.reason);
    if (done && to === 'waitlisted') publishWaitlisted(done);
    return done ?? (await FormSubmission.findById(sub._id)) ?? sub;
}

export type PromoteOutcome =
    | { outcome: 'promoted'; registration: IFormSubmission }
    | { outcome: 'refused'; reason: string }
    | { outcome: 'skipped'; reason: string }
    | { outcome: 'raced' };

/**
 * waitlisted → confirmed. Exclusive by CAS: any number of instances (each processes the
 * event) or concurrent cancels may try the same row; reserve is idempotent per registration, and
 * only one status swap can win.
 *
 * A deleted account is never promoted into a seat: its row is cancelled instead
 * and the caller moves on to the next head.
 */
export async function promoteRegistration(sub: IFormSubmission, by: string, reason = 'promoted_from_waitlist'): Promise<PromoteOutcome> {
    if (sub.status !== 'waitlisted' || !isEventRow(sub)) return { outcome: 'raced' };
    const eventId = sub.owner.id!;

    if (!(await User.exists({ _id: sub.user.user_id, deleted_at: null }))) {
        const gone = await casTransition(sub, 'cancelled', 'system', 'user_deleted');
        if (gone) publishLeft(gone, 'waitlisted', false, 'user_deleted');
        return { outcome: 'skipped', reason: 'user_deleted' };
    }

    const result = await reserveSeat(eventId, sub._id);
    if (!result.reserved) return { outcome: 'refused', reason: result.reason };

    const done = await casTransition(sub, 'confirmed', by, reason);
    if (!done) {
        await releaseUnlessConfirmed(sub);
        return { outcome: 'raced' };
    }
    announceConfirmed(done);
    return { outcome: 'promoted', registration: done };
}

/** Heads tried per call: a head that raced or was skipped moves on to the next one, bounded. */
const PROMOTE_ATTEMPTS = 10;

/**
 * Last status change was an admin moving the row onto the waitlist, from any status: a seat is
 * waitlisted by the system only when the event said `capacity_full`.
 */
const ADMIN_DEMOTED = {
    $let: {
        vars: { last: { $arrayElemAt: ['$status_history', -1] } },
        in: { $and: [{ $eq: ['$$last.to', 'waitlisted'] }, { $ne: ['$$last.by', 'system'] }] },
    },
};

/**
 * A seat came free: offer it to the head of the waitlist. A head another instance just promoted
 * (raced), or one whose account is gone (skipped), is passed over for the next; a refusal stops —
 * the event has no seat. A row an admin demoted is never a candidate: the demotion stands until an
 * admin promotes it, instead of the freed seat (or the next sweep) handing it straight back.
 *
 * Returns true when someone was promoted.
 */
export async function promoteNext(eventId: string): Promise<boolean> {
    const tried = new Set<string>();
    for (let attempt = 0; attempt < PROMOTE_ATTEMPTS; attempt++) {
        const next = await FormSubmission.findOne({
            'owner.type': 'event',
            'owner.id': eventId,
            status: 'waitlisted',
            _id: { $nin: [...tried] },
            $expr: { $not: [ADMIN_DEMOTED] },
        }).sort({ waitlist_position: 1, submitted_at: 1 });
        if (!next) return false;
        tried.add(next._id);
        try {
            const res = await promoteRegistration(next, 'system');
            if (res.outcome === 'promoted') {
                console.log(`[registration-service] Promoted ${next._id} off the waitlist for event ${eventId}`);
                return true;
            }
            if (res.outcome === 'refused') return false;
        } catch (err) {
            // Non-fatal: the seat stays free, and the promotion sweep tries again.
            console.error('[registration-service] Waitlist promotion failed:', err);
            return false;
        }
    }
    return false;
}

/* ------------------------------------------------------------------ *
 * Submit
 * ------------------------------------------------------------------ */

/** The field set a submission at `version` was validated against — the archive, unless it is current. */
async function fieldsAt(form: IFormDefinition, version: number): Promise<FormField[]> {
    if (form.version === version) return form.fields;
    const archived = await FormDefinitionVersion.findOne({ form_id: form._id, version });
    if (!archived) throw new ServiceError(409, 'form_version_not_found');
    return archived.fields;
}

/**
 * `files[]` names uploads; everything stored about them is read from the upload record, which must
 * be this user's, for this form and this field. An unknown reference is a validation failure, not a
 * silently trusted URL.
 *
 * `existing` is the row's own stored files: on an edit, a reference to a file ALREADY on this
 * submission is kept as stored — rows written before `form_uploads` existed have no upload record,
 * and resending them used to fail every edit.
 */
async function resolveFiles(
    refs: FileRefInput[],
    userId: string,
    formId: string,
    existing: SubmissionFile[] = []
): Promise<SubmissionFile[]> {
    if (refs.length === 0) return [];
    const uploads = await FormUpload.find({ user_id: userId, form_id: formId, url: { $in: refs.map((r) => r.url) } });
    const byKey = new Map<string, SubmissionFile>(existing.map((f) => [`${f.field_key}|${f.url}`, f]));
    for (const u of uploads) byKey.set(`${u.field_key}|${u.url}`, u);

    const resolved: SubmissionFile[] = [];
    const unknown: { key: string; code: string; message: string }[] = [];
    for (const ref of refs) {
        const upload = byKey.get(`${ref.field_key}|${ref.url}`);
        if (!upload) {
            unknown.push({ key: ref.field_key, code: 'unknown_upload', message: 'File was not uploaded for this field' });
            continue;
        }
        resolved.push({ field_key: upload.field_key, url: upload.url, name: upload.name, size: upload.size, mime: upload.mime });
    }
    if (unknown.length > 0) throw new ServiceError(422, 'validation_failed', unknown);
    return resolved;
}

type EventTeaming = { is_teamed?: boolean; captain_application_required?: boolean } | undefined;

function buildContext(ownerType: string, inputContext: SubmitRegistrationInput['context'], teaming: EventTeaming): any {
    if (ownerType === 'event') {
        const role = inputContext?.event?.role ?? 'solo';
        // registration-model.md §3.2.1: captain/member exist only on a teamed event, solo only on
        // one that is not. The role is the client's claim, so it is checked against the event.
        if ((role === 'solo') === !!teaming?.is_teamed) throw new ServiceError(422, 'role_mismatch');
        return {
            event: {
                role,
                team_id: null,
                team_visibility: inputContext?.event?.team_visibility ?? 'open',
                // Member-set by design. ponytail: registration-model.md §3.2.1 also wants
                // "auction event + role 'member' => base_price > 0"; enforce once it is needed.
                base_price: inputContext?.event?.base_price ?? null,
                captain_application: {
                    // Without `captain_application_required` a captain is approved by registering.
                    status: role !== 'captain' ? 'none' : teaming?.captain_application_required ? 'pending' : 'approved',
                    reviewed_by: null,
                    reviewed_at: null,
                    note: null,
                },
                attended: null,
            },
        };
    }
    // The team link on a challenge row is not the submitter's to choose.
    if (ownerType === 'challenge') return { challenge: { team_id: null } };
    return {};
}

/**
 * A challenge's form takes registrations only while the challenge is `active` and inside its
 * window (`window.opens_at..closes_at`, a null bound is open) — the event path gets the same from
 * the Event Service's seat call, a challenge has no such call.
 */
async function requireChallengeOpen(challengeId: string | null): Promise<void> {
    const challenge = await Challenge.findOne({ _id: challengeId, deleted_at: null }).select('status window').lean();
    if (!challenge) throw new ServiceError(404, 'challenge_not_found');
    if (challenge.status !== 'active') throw new ServiceError(409, 'challenge_not_active');
    const now = Date.now();
    const { opens_at, closes_at } = challenge.window ?? {};
    if (opens_at && now < new Date(opens_at).getTime()) throw new ServiceError(409, 'challenge_not_open');
    if (closes_at && now > new Date(closes_at).getTime()) throw new ServiceError(409, 'challenge_closed');
}

export async function submitRegistration(input: SubmitRegistrationInput): Promise<IFormSubmission> {
    const form = await FormDefinition.findById(input.form_id);
    if (!form || form.status !== 'published') {
        throw new ServiceError(form ? 409 : 404, form ? 'form_not_published' : 'form_not_found');
    }
    if (form.owner.type !== input.owner.type || form.owner.id !== input.owner.id) {
        throw new ServiceError(400, 'owner_mismatch');
    }

    /**
     * One active registration per owner. For an event the form must be THE event's registration
     * form: a second published form for the same event was a second seat for the same person, and
     * the unique index is per form.
     */
    let teaming: EventTeaming;
    let needsApproval = false;
    if (input.owner.type === 'event') {
        const event = await Event.findOne({ _id: input.owner.id, deleted_at: null })
            .select('registration.form_id registration.requires_approval teaming.is_teamed teaming.captain_application_required')
            .lean();
        if (!event) throw new ServiceError(404, 'event_not_found');
        if (event.registration?.form_id !== form._id) throw new ServiceError(409, 'not_registration_form');
        teaming = event.teaming;
        // The row waits `submitted`, holding no seat, until an admin confirms it (which reserves).
        needsApproval = !!event.registration.requires_approval;
    }
    if (input.owner.type === 'challenge') await requireChallengeOpen(input.owner.id);

    const scope = { ...(input.owner.id ? { 'owner.id': input.owner.id } : { form_id: form._id }), 'user.user_id': input.user_id };

    /**
     * An admin's rejection stands: `rejected` frees the unique slot (so a system refusal — event
     * full, window closed — can be retried), which also let a user an admin had rejected simply
     * submit again. A declined captain application is not a ban and may re-register (e.g. as a
     * member). The admin can still move the row back with the status override.
     */
    const lastRejected = await FormSubmission.findOne({ ...scope, status: 'rejected' }).sort({ updated_at: -1 }).select('status_history');
    const rejection = lastRejected?.status_history[lastRejected.status_history.length - 1];
    if (rejection && rejection.by !== 'system' && rejection.reason !== 'captain_declined') {
        throw new ServiceError(409, 'registration_rejected');
    }

    const existing = await FormSubmission.findOne({ ...scope, status: { $in: ACTIVE_SUBMISSION_STATUS } });
    if (existing) {
        // A row stranded `submitted` by a reserve whose answer never came back. Resubmitting is the
        // retry: reserve is idempotent per registration, so it cannot count twice. A row waiting
        // for an admin is not stranded.
        const stranded =
            existing.form_id === form._id &&
            existing.status === 'submitted' &&
            isEventRow(existing) &&
            !needsApproval &&
            existing.context.event?.captain_application.status !== 'pending';
        if (!stranded) throw new ServiceError(409, 'already_registered');
        try {
            return await reserveAndSettle(existing, 'system', 'seat_reserved');
        } catch (err) {
            throw seatCallError(err);
        }
    }

    const files = await resolveFiles(input.files ?? [], input.user_id, form._id);
    const validationErrors = validateAnswers(input.answers, form.fields, files, { isAdmin: false });
    if (validationErrors.length > 0) {
        throw new ServiceError(422, 'validation_failed', validationErrors);
    }

    // `users` is read directly: every service reads it, only User/Auth Service writes it.
    const user = await User.findById(input.user_id);
    if (!user) {
        throw new ServiceError(404, 'user_not_found');
    }

    const submission = new FormSubmission({
        _id: uuid(),
        form_id: input.form_id,
        form_version: form.version,
        owner: input.owner,
        user: userSnapshotOf(user),
        answers: input.answers,
        files,
        context: buildContext(input.owner.type, input.context, teaming),
        status: 'draft',
        waitlist_position: null,
        status_history: [],
        submitted_at: new Date(),
    });
    transition(submission, 'submitted', input.user_id, null);

    // Non-event registrations have no capacity to reserve: confirmed in the same insert.
    const noSeat = !isEventRow(submission);
    if (noSeat) transition(submission, 'confirmed', 'system', 'auto_confirmed');

    // The unique partial index, not the read above, is what finally rejects a concurrent duplicate.
    try {
        await submission.save();
    } catch (err: any) {
        if (err.code === 11000) throw new ServiceError(409, 'already_registered');
        throw err;
    }

    if (noSeat) {
        announceConfirmed(submission);
        return submission;
    }

    // A captain waits for approval before occupying a seat, and so does everyone on an event that
    // approves registrations by hand.
    if (needsApproval || submission.context.event?.captain_application.status === 'pending') {
        return submission;
    }

    try {
        return await reserveAndSettle(submission, 'system', 'seat_reserved');
    } catch (err) {
        // Not a refusal: the row stays `submitted`, which is exactly what it means, and the
        // stranded sweep (or a resubmit) retries the same registration id.
        console.error(`[registration-service] reserve-seat failed for ${submission._id}:`, err);
        return submission;
    }
}

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

export async function getRegistration(registrationId: string): Promise<IFormSubmission> {
    const registration = await FormSubmission.findById(registrationId);
    if (!registration) {
        throw new ServiceError(404, 'registration_not_found');
    }
    return registration;
}

/**
 * The registration's owner, or an admin of what it belongs to (an event's admins,
 * core+ for challenge/generic). Anyone else gets a 404, not a 403: a 403 confirms it exists.
 */
export async function getOwnRegistration(registrationId: string, actor: Actor): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);
    if (registration.user.user_id !== actor.id && !(await isOwnerAdmin(registration.owner, actor))) {
        throw new ServiceError(404, 'registration_not_found');
    }
    return registration;
}

export async function getMyRegistration(ownerId: string, userId: string): Promise<IFormSubmission | null> {
    return FormSubmission.findOne({
        'owner.id': ownerId,
        'user.user_id': userId,
        status: { $in: ACTIVE_SUBMISSION_STATUS },
    });
}

/**
 * The admin list is scoped to ONE owner the actor administers — `owner_id` (event or challenge) or
 * `form_id` (which also covers generic forms). Without one of those, or without admin rights over
 * it, the list is the caller's own registrations: "core+ sees all" used to mean every answer to
 * every event on the platform.
 */
export async function listRegistrations(
    filter: { owner_id?: string; form_id?: string; status?: string; user_id?: string; limit: number; offset: number },
    actor: Actor
): Promise<IFormSubmission[]> {
    let owner: OwnerRef | null = null;
    if (filter.form_id) {
        const form = await FormDefinition.findById(filter.form_id).select('owner').lean();
        owner = form ? (form.owner as OwnerRef) : null;
    } else if (filter.owner_id) {
        owner = await ownerOfId(filter.owner_id);
    }
    const admin = !!owner && (await isOwnerAdmin(owner, actor));

    const query: Record<string, unknown> = {};
    if (filter.owner_id) query['owner.id'] = filter.owner_id;
    if (filter.form_id) query.form_id = filter.form_id;
    if (filter.status) query.status = filter.status;
    query['user.user_id'] = admin ? filter.user_id : actor.id;
    if (query['user.user_id'] === undefined) delete query['user.user_id'];

    return FormSubmission.find(query).sort({ submitted_at: -1, _id: 1 }).skip(filter.offset).limit(filter.limit);
}

/**
 * The stored file for one field of a registration, for the authed download route.
 * Owner or owner-admin only; everyone else, and a field with no file, is a 404.
 */
export async function registrationFile(
    registrationId: string,
    fieldKey: string,
    actor: Actor
): Promise<{ path: string; name: string; mime: string }> {
    const registration = await getOwnRegistration(registrationId, actor);
    const file = registration.files.find((f) => f.field_key === fieldKey);
    const path = file ? privatePathOf(file.url) : null;
    if (!file || !path) throw new ServiceError(404, 'file_not_found');
    return { path, name: file.name, mime: file.mime };
}

/* ------------------------------------------------------------------ *
 * Edit
 * ------------------------------------------------------------------ */

/**
 * The owner's registration window: the event's `registration.closes_at`, a challenge's
 * `window.closes_at` (null = evergreen). A generic form has no window. It bounds both
 * `allow_edit_until: 'closes_at'` (once treated as always open) and a user's own cancel.
 */
async function windowOpen(owner: IFormSubmission['owner']): Promise<boolean> {
    const now = Date.now();
    if (owner.type === 'event' && owner.id) {
        const event = await Event.findById(owner.id).select('registration.closes_at').lean();
        return !!event && now <= new Date(event.registration.closes_at).getTime();
    }
    if (owner.type === 'challenge' && owner.id) {
        const challenge = await Challenge.findById(owner.id).select('window.closes_at').lean();
        const closes = challenge?.window?.closes_at;
        return !!challenge && (!closes || now <= new Date(closes).getTime());
    }
    return true;
}

export async function updateRegistration(
    registrationId: string,
    userId: string,
    updates: { answers?: Record<string, unknown>; files?: FileRefInput[] }
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);
    // Only the owner edits their answers; admins set admin_only answers through updateAdminAnswers.
    if (registration.user.user_id !== userId) throw new ServiceError(404, 'registration_not_found');
    if (registration.status === 'cancelled' || registration.status === 'rejected') {
        throw new ServiceError(409, 'cannot_edit_inactive_registration');
    }

    const form = await FormDefinition.findById(registration.form_id);
    if (!form) throw new ServiceError(404, 'form_not_found');
    if (form.status === 'archived') throw new ServiceError(409, 'form_archived');
    if (form.settings.allow_edit_until === 'never') throw new ServiceError(409, 'edits_not_allowed');
    if (form.settings.allow_edit_until === 'closes_at' && !(await windowOpen(registration.owner))) {
        throw new ServiceError(409, 'edit_window_closed');
    }

    /**
     * Validated against the field set the registration was made against, and it keeps that
     * version. Validating against the form's current fields meant an unpublished v2 draft judged a
     * v1 answer that still claimed to be v1.
     */
    const fields = await fieldsAt(form, registration.form_version);

    /**
     * An edit replaces the owner's answer set, and admin_only answers are the ones the owner cannot
     * send. They are left untouched — and kept OUT of what gets validated: re-validating
     * stored answers as a non-admin refused every files-only edit once an admin had filled one in.
     */
    const adminKeys = new Set(fields.filter((f) => f.admin_only).map((f) => f.key));
    const stored = (registration.toObject().answers ?? {}) as Record<string, unknown>;
    const heldAnswers: Record<string, unknown> = {};
    for (const key of adminKeys) if (stored[key] !== undefined) heldAnswers[key] = stored[key];
    const storedFiles = registration.toObject().files as SubmissionFile[];
    const heldFiles = storedFiles.filter((f) => adminKeys.has(f.field_key));

    const answers: Record<string, unknown> = updates.answers ?? Object.fromEntries(Object.entries(stored).filter(([k]) => !adminKeys.has(k)));
    const files = updates.files
        ? await resolveFiles(updates.files, userId, form._id, storedFiles.filter((f) => !adminKeys.has(f.field_key)))
        : storedFiles.filter((f) => !adminKeys.has(f.field_key));

    const validationErrors = validateAnswers(answers, fields, files, { isAdmin: false, adminAnswers: heldAnswers });
    if (validationErrors.length > 0) {
        throw new ServiceError(422, 'validation_failed', validationErrors);
    }

    // Per key, never the whole object: a concurrent admin-answers write must not be reverted by the
    // copy of the admin keys this edit read earlier.
    const set: Record<string, unknown> = { files: [...files, ...heldFiles] };
    for (const [k, v] of Object.entries(answers)) set[`answers.${k}`] = v;
    const unset = Object.fromEntries(Object.keys(stored).filter((k) => !adminKeys.has(k) && !Object.prototype.hasOwnProperty.call(answers, k)).map((k) => [`answers.${k}`, '']));
    const updated = await FormSubmission.findOneAndUpdate(
        { _id: registration._id, status: { $in: ACTIVE_SUBMISSION_STATUS } },
        { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'cannot_edit_inactive_registration');
    return updated;
}

/**
 * An admin of the owner fills the form's admin_only fields on SOMEONE ELSE's registration — the
 * only way those fields are ever written (self-submit used to let a core member set them on their
 * own registration). Only admin_only, non-file keys; `null`/`''` clears one.
 *
 * ponytail: answers only. An admin_only FILE field has no write path yet; add an admin upload when a
 * form needs one.
 */
export async function updateAdminAnswers(
    registrationId: string,
    actor: Actor,
    answers: Record<string, unknown>
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);
    await requireOwnerAdmin(registration.owner, actor);
    if (registration.user.user_id === actor.id) throw new ServiceError(403, 'cannot_set_own_admin_answers');
    if (registration.status === 'cancelled') throw new ServiceError(409, 'registration_cancelled');

    const form = await FormDefinition.findById(registration.form_id);
    if (!form) throw new ServiceError(404, 'form_not_found');
    const adminFields = (await fieldsAt(form, registration.form_version)).filter((f) => f.admin_only && f.type !== 'file');
    const allowed = new Set(adminFields.map((f) => f.key));

    const errors = Object.keys(answers)
        .filter((k) => !allowed.has(k))
        .map((k) => ({ key: k, code: 'not_admin_field', message: `Field '${k}' is not an admin field` }));
    const provided = adminFields
        .filter((f) => Object.prototype.hasOwnProperty.call(answers, f.key))
        // Checked as plain optional fields: the admin is filling them, visibility is the user's view.
        .map((f) => ({ ...(typeof (f as any).toObject === 'function' ? (f as any).toObject() : f), admin_only: false, visible_if: null, required: false }));
    const values = { ...answers };
    for (const k of Object.keys(values)) if (!allowed.has(k)) delete values[k];
    errors.push(...validateAnswers(values, provided as FormField[], [], { isAdmin: true }));
    if (errors.length > 0) throw new ServiceError(422, 'validation_failed', errors);

    const set: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};
    for (const f of provided) {
        if (Object.prototype.hasOwnProperty.call(values, f.key)) set[`answers.${f.key}`] = values[f.key];
        else unset[`answers.${f.key}`] = '';
    }
    const updated = await FormSubmission.findOneAndUpdate(
        { _id: registration._id, status: { $ne: 'cancelled' } },
        { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'registration_cancelled');
    return updated;
}

/* ------------------------------------------------------------------ *
 * Cancel / admin moves
 * ------------------------------------------------------------------ */

/**
 * A captain gives up their seat only once nobody else depends on it: a team with other members is
 * disbanded (or handed over) first, or it is left with a seatless captain.
 *
 * ponytail: read-then-write; a join landing between this read and the status CAS still strands
 * that one team. A roster-side guard is the upgrade if it ever happens.
 */
async function refuseCaptainWithTeam(sub: IFormSubmission): Promise<void> {
    if (sub.context.event?.role === 'captain' && (await captainHasTeam(sub.owner.id!, sub.user.user_id))) {
        throw new ServiceError(409, 'captain_has_team');
    }
}

/** Owner (inside the registration window), or an admin of the owner (any time). Anyone else: 404. */
export async function cancelRegistration(registrationId: string, actor: Actor, reason?: string): Promise<IFormSubmission> {
    const registration = await getOwnRegistration(registrationId, actor);
    if (registration.status === 'cancelled') {
        throw new ServiceError(409, 'already_cancelled');
    }
    // Cancelling a rejected row would erase the rejection that `submitRegistration` checks for —
    // the ban lifted by the person it bans. It holds nothing to give back anyway.
    if (registration.status === 'rejected') throw new ServiceError(409, 'registration_rejected');
    const admin = await isOwnerAdmin(registration.owner, actor);
    if (!(await windowOpen(registration.owner)) && !admin) throw new ServiceError(409, 'cancel_window_closed');
    if (registration.status === 'confirmed') {
        await refuseCaptainWithTeam(registration);
        // A player bought in a running auction stays until it finishes; an admin may still remove them.
        if (!admin) await refuseLeavingDuringAuction(registration.context.event?.team_id);
    }

    const from = registration.status;
    const done = await casTransition(registration, 'cancelled', actor.id, reason ?? 'user_cancel');
    if (!done) {
        const now = await getRegistration(registrationId);
        throw new ServiceError(409, now.status === 'cancelled' ? 'already_cancelled' : 'status_changed');
    }

    // Idempotent on the Event Service, so asking for a `submitted` row is safe — and it gives back a
    // seat a lost reserve answer left behind.
    const released = isEventRow(done) && MAY_HOLD_SEAT.includes(from) ? await releaseSeatQuietly(done.owner.id!, done._id) : false;
    if (from === 'confirmed') await detachRegistration(done._id, done.user.user_id, actor.id, 'registration_cancelled');

    publishLeft(done, from, released, reason ?? 'user_cancel');
    return done;
}

/** An admin of the owner, acting on someone ELSE's registration: nobody approves or overrides their own. */
async function requireAdminOfOther(sub: IFormSubmission, actor: Actor): Promise<void> {
    await requireOwnerAdmin(sub.owner, actor);
    if (sub.user.user_id === actor.id) throw new ServiceError(403, 'cannot_review_own_registration');
}

/** The captain application's answer when an admin moves a still-pending captain by hand. */
function applicationFor(sub: IFormSubmission, to: SubmissionStatus, by: string): Record<string, unknown> | undefined {
    if (sub.context.event?.captain_application.status !== 'pending') return undefined;
    return {
        'context.event.captain_application.status': to === 'rejected' ? 'declined' : 'approved',
        'context.event.captain_application.reviewed_by': by,
        'context.event.captain_application.reviewed_at': new Date(),
    };
}

export async function updateCaptainApplication(
    registrationId: string,
    actor: Actor,
    status: 'approved' | 'declined',
    note?: string
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);
    await requireAdminOfOther(registration, actor);
    if (!registration.context.event) {
        throw new ServiceError(400, 'not_event_registration');
    }
    /**
     * Pending AND still `submitted`, checked in the write itself. Without the status half an
     * approval resurrected a cancelled captain into a seat, and approving one an admin had already
     * confirmed reserved a second seat.
     */
    if (registration.context.event.captain_application.status !== 'pending' || registration.status !== 'submitted') {
        throw new ServiceError(409, 'application_not_pending');
    }

    const pending = { 'context.event.captain_application.status': 'pending' };
    const review = {
        'context.event.captain_application.status': status,
        'context.event.captain_application.reviewed_by': actor.id,
        'context.event.captain_application.reviewed_at': new Date(),
        'context.event.captain_application.note': note ?? null,
    };

    if (status === 'declined') {
        const done = await casTransition(registration, 'rejected', actor.id, 'captain_declined', { filter: pending, set: review });
        if (!done) throw new ServiceError(409, 'application_not_pending');
        return done;
    }

    const approved = await FormSubmission.findOneAndUpdate(
        { _id: registration._id, status: 'submitted', ...pending },
        { $set: review },
        { returnDocument: 'after' }
    );
    if (!approved) throw new ServiceError(409, 'application_not_pending');

    // Approved: now it may take a seat. `CaptainApproved` goes out when — on whichever
    // path — the row actually becomes confirmed (announceConfirmed).
    try {
        return await reserveAndSettle(approved, actor.id, 'captain_approved');
    } catch (err) {
        // Still `submitted` and approved; the stranded sweep, a resubmit or an admin confirm settles it.
        console.error(`[registration-service] reserve-seat failed after approval of ${registration._id}:`, err);
        return approved;
    }
}

/**
 * Admin override. Moving a registration into or out of `confirmed` moves a seat with it, and moving
 * it out tells everyone who counted it (leaderboard, points, the waitlist).
 */
export async function updateRegistrationStatus(
    registrationId: string,
    actor: Actor,
    status: 'confirmed' | 'waitlisted' | 'rejected',
    reason?: string
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);
    await requireAdminOfOther(registration, actor);

    // A cancelled registration is the user's decision; re-registering is the path back.
    if (registration.status === 'cancelled') throw new ServiceError(409, 'registration_cancelled');
    if (registration.status === status) throw new ServiceError(409, 'already_in_status');
    const isEvent = isEventRow(registration);
    // Only an event has seats; a waitlisted challenge or generic row would never be promoted.
    if (status === 'waitlisted' && !isEvent) throw new ServiceError(409, 'no_waitlist');

    const from = registration.status;
    const why = reason ?? 'admin_override';
    const application = applicationFor(registration, status, actor.id);
    if (from === 'confirmed') await refuseCaptainWithTeam(registration);

    if (status === 'confirmed') {
        if (isEvent) {
            let result;
            try {
                result = await reserveSeat(registration.owner.id!, registration._id);
            } catch (err) {
                console.error(`[registration-service] reserve-seat failed for ${registration._id}:`, err);
                throw seatCallError(err);
            }
            if (!result.reserved) {
                // Approving a `submitted` row into a full event waitlists it, as a submit would. By
                // the system, so promotion picks it up: an admin move onto the waitlist is parked.
                if (from === 'submitted' && result.reason === 'capacity_full') {
                    const parked = await casTransition(registration, 'waitlisted', 'system', result.reason, { set: application });
                    if (!parked) throw new ServiceError(409, 'status_changed');
                    publishWaitlisted(parked);
                    return parked;
                }
                throw new ServiceError(409, result.reason);
            }
        }

        let done: IFormSubmission | null;
        try {
            done = await casTransition(registration, 'confirmed', actor.id, why, { set: application });
        } catch (err) {
            if (isEvent) await releaseUnlessConfirmed(registration); // e.g. 11000: the user re-registered
            throw err;
        }
        if (!done) {
            // Lost the CAS. If the winner confirmed this same row, the seat is theirs to keep.
            if (isEvent) await releaseUnlessConfirmed(registration);
            throw new ServiceError(409, 'status_changed');
        }
        announceConfirmed(done);
        return done;
    }

    const done = await casTransition(registration, status, actor.id, why, { set: application });
    if (!done) throw new ServiceError(409, 'status_changed');

    const released = isEvent && MAY_HOLD_SEAT.includes(from) ? await releaseSeatQuietly(done.owner.id!, done._id) : false;
    if (from === 'confirmed') await detachRegistration(done._id, done.user.user_id, actor.id, 'registration_demoted');
    // A demotion used to publish nothing: the leaderboard kept the entry and the freed seat never
    // reached the waitlist. The demoted row itself is never promoted back (ADMIN_DEMOTED).
    if (from === 'confirmed' || released) publishLeft(done, from, released, 'admin_demoted');
    if (status === 'waitlisted') publishWaitlisted(done);
    return done;
}

/* ------------------------------------------------------------------ *
 * Attendance (Event Service calls this through /internal)
 * ------------------------------------------------------------------ */

/**
 * Only a `confirmed` registration of that event can be marked — attendance on a cancelled or
 * waitlisted row paid participation points to someone who never held a seat. Each row flips by CAS
 * on its previous value, so a retried batch publishes nothing twice.
 */
export async function recordAttendance(
    eventId: string,
    markedBy: string,
    items: { registration_id: string; attended: boolean }[]
): Promise<{ updated_count: number; skipped: string[] }> {
    // Last write wins inside one batch.
    const wanted = new Map(items.map((i) => [i.registration_id, i.attended]));
    let updated = 0;
    const skipped: string[] = [];

    for (const [registrationId, attended] of wanted) {
        const reg = await FormSubmission.findOne({
            _id: registrationId,
            'owner.type': 'event',
            'owner.id': eventId,
            status: 'confirmed',
        });
        if (!reg?.context.event) {
            skipped.push(registrationId);
            continue;
        }
        const previous = reg.context.event.attended ?? null;
        if (previous === attended) continue; // already so

        const res = await FormSubmission.updateOne(
            { _id: registrationId, status: 'confirmed', 'context.event.attended': previous },
            { $set: { 'context.event.attended': attended } }
        );
        if (res.modifiedCount === 0) {
            skipped.push(registrationId); // changed underneath us; the caller can resend
            continue;
        }
        updated++;

        const payload = { event_id: eventId, registration_id: registrationId, user_id: reg.user.user_id, marked_by: markedBy };
        if (attended && previous !== true) publish('ParticipantAttended', PRODUCER, payload);
        else if (!attended && previous === true) publish('ParticipantAttendanceRevoked', PRODUCER, payload);
    }

    return { updated_count: updated, skipped };
}
