import {
    FormDefinition,
    FormSubmission,
    IFormSubmission,
    ServiceError,
    SubmissionStatus,
    User,
    publish,
    userSnapshotOf,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { validateAnswers } from './validation';
import { reserveSeat, releaseSeat } from '../clients/event-client';

interface SubmitRegistrationInput {
    form_id: string;
    owner: { type: 'event' | 'challenge' | 'generic'; id: string | null };
    answers: Record<string, unknown>;
    files?: { field_key: string; url: string; name: string; size: number; mime: string }[];
    context?: any;
    user_id: string;
    is_admin: boolean;
}

/**
 * The one place a submission's status changes.
 *
 * Three separate handlers used to set `status` inline and each got it wrong in the same two ways:
 * they read `from` after overwriting it, and they left `waitlist_position` set on a row that was
 * no longer waitlisted — which the model's invariant rejects, so cancelling a waitlisted
 * registration threw. Both are impossible to reintroduce from here.
 */
export async function transition(
    submission: IFormSubmission,
    to: SubmissionStatus,
    by: string,
    reason: string | null
): Promise<void> {
    const from = submission.status;
    submission.status = to;

    // The invariant is "set exactly when waitlisted", so every other status clears it.
    submission.waitlist_position = to === 'waitlisted' ? await nextWaitlistPosition(submission.owner.id) : null;

    /**
     * A team seat belongs to a confirmed registration — the model refuses to save any other
     * combination. Leaving the link behind meant an admin demoting or rejecting a confirmed team
     * member hit that invariant as an unhandled 500 rather than performing the demotion.
     *
     * ponytail: this drops the registration's side of the link only. The team's roster still lists
     * them until someone removes them; reconciling it belongs in a consumer of this status change,
     * alongside the same gap on cancel and disband.
     */
    if (to !== 'confirmed' && submission.context.event?.team_id) {
        submission.context.event.team_id = null;
    }

    if (to === 'confirmed' && !submission.confirmed_at) submission.confirmed_at = new Date();
    if (to === 'cancelled') submission.cancelled_at = new Date();

    submission.status_history.push({ from, to, by, at: new Date(), reason });
}

/**
 * ponytail: max+1, not count+1. Counting gives two people the same position as soon as anyone
 * ahead of them is promoted or cancels. Still a read-then-write, so two simultaneous submissions
 * can collide — positions are display order, not a lock. Make it an atomic $inc on the event if
 * that ever matters.
 */
async function nextWaitlistPosition(ownerId: string | null): Promise<number> {
    const last = await FormSubmission.findOne({ 'owner.id': ownerId, status: 'waitlisted' })
        .sort({ waitlist_position: -1 })
        .select('waitlist_position');
    return (last?.waitlist_position ?? 0) + 1;
}

/**
 * Ask the Event Service for a seat and record the answer.
 *
 * The submission's own id is the idempotency key: a retry after a timeout must present the key the
 * first attempt used, or the seat is counted twice (plan §D1). A random key per call, which is what
 * this did before, cannot deduplicate anything.
 */
async function reserveAndSettle(submission: IFormSubmission, by: string, reason: string): Promise<void> {
    const result = await reserveSeat(submission.owner.id!, submission._id, submission._id);

    if (result.reserved) {
        await transition(submission, 'confirmed', by, reason);
        await submission.save();
        await publishCreated(submission);
        return;
    }

    // Capacity is full but the event takes a waitlist; anything else is a refusal.
    const waitlisted = result.reason === 'capacity_full';
    await transition(submission, waitlisted ? 'waitlisted' : 'rejected', 'system', result.reason ?? null);
    await submission.save();

    if (waitlisted) {
        publish('RegistrationWaitlisted', 'registration-service', {
            registration_id: submission._id,
            owner: submission.owner,
            user_id: submission.user.user_id,
            position: submission.waitlist_position!,
        });
    }
}

function publishCreated(submission: IFormSubmission): void {
    publish('RegistrationCreated', 'registration-service', {
        registration_id: submission._id,
        owner: submission.owner,
        user_id: submission.user.user_id,
        role: submission.context.event?.role ?? 'solo',
    });
}

export async function submitRegistration(input: SubmitRegistrationInput): Promise<IFormSubmission> {
    // 1. Load form definition
    const form = await FormDefinition.findById(input.form_id);
    if (!form) {
        throw new ServiceError(404, 'form_not_found');
    }
    if (form.status !== 'published') {
        throw new ServiceError(400, 'form_not_published');
    }
    if (form.owner.type !== input.owner.type || form.owner.id !== input.owner.id) {
        throw new ServiceError(400, 'owner_mismatch');
    }

    // 2. Validate answers against form fields
    const validationErrors = validateAnswers(input.answers, form.fields, input.files ?? [], {
        isAdmin: input.is_admin,
    });
    if (validationErrors.length > 0) {
        throw new ServiceError(400, 'validation_failed', validationErrors);
    }

    // 3. Build the display snapshot. `users` is read directly: every service reads it, only
    //    User/Auth Service writes it (relationships.md §1).
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
        files: input.files ?? [],
        context: buildContext(input.owner.type, input.context),
        status: 'draft',
        waitlist_position: null,
        status_history: [],
        submitted_at: new Date(),
    });
    await transition(submission, 'submitted', input.user_id, null);

    // 4. Insert. The unique partial index, not a prior read, is what rejects duplicates.
    try {
        await submission.save();
    } catch (err: any) {
        if (err.code === 11000) {
            throw new ServiceError(409, 'already_registered');
        }
        throw err;
    }

    // 5. Non-event registrations have no capacity to reserve.
    if (input.owner.type !== 'event' || !input.owner.id) {
        await transition(submission, 'confirmed', 'system', 'auto_confirmed');
        await submission.save();
        publishCreated(submission);
        return submission;
    }

    // 6. A captain waits for approval before occupying a seat (plan §D8).
    if (submission.context.event?.captain_application.status === 'pending') {
        return submission;
    }

    try {
        await reserveAndSettle(submission, 'system', 'seat_reserved');
    } catch (err) {
        // The Event Service was unreachable — not a refusal. The row stays `submitted`, which is
        // exactly what it means, and the response carries that status rather than claiming a seat.
        // Retry is safe: the idempotency key is the submission id, which does not change.
        console.error(`[registration-service] reserve-seat failed for ${submission._id}:`, err);
    }

    return submission;
}

function buildContext(ownerType: string, inputContext: any): any {
    if (ownerType === 'event') {
        return {
            event: {
                role: inputContext?.event?.role ?? 'solo',
                team_id: null,
                team_visibility: inputContext?.event?.team_visibility ?? 'open',
                // Member-set by design (plan §0.6). ponytail: registration-model.md §4 also wants
                // "auction event + role 'member' => base_price > 0", which needs the event's type
                // — Event Service's to answer. Enforce it here once that call exists.
                base_price: inputContext?.event?.base_price ?? null,
                captain_application: {
                    status: inputContext?.event?.role === 'captain' ? 'pending' : 'none',
                    reviewed_by: null,
                    reviewed_at: null,
                    note: null,
                },
                attended: null,
            },
        };
    }
    if (ownerType === 'challenge') {
        return { challenge: { team_id: inputContext?.challenge?.team_id ?? null } };
    }
    return {};
}

export async function getRegistration(registrationId: string): Promise<IFormSubmission> {
    const registration = await FormSubmission.findById(registrationId);
    if (!registration) {
        throw new ServiceError(404, 'registration_not_found');
    }
    return registration;
}

export async function getMyRegistration(ownerId: string, userId: string): Promise<IFormSubmission | null> {
    return FormSubmission.findOne({
        'owner.id': ownerId,
        'user.user_id': userId,
        status: { $nin: ['cancelled', 'rejected'] },
    });
}

export async function listRegistrations(filter: {
    owner_id?: string;
    status?: string;
    user_id?: string;
}): Promise<IFormSubmission[]> {
    const query: Record<string, unknown> = {};
    if (filter.owner_id) query['owner.id'] = filter.owner_id;
    if (filter.status) query.status = filter.status;
    if (filter.user_id) query['user.user_id'] = filter.user_id;

    return FormSubmission.find(query).sort({ submitted_at: -1 });
}

export async function updateRegistration(
    registrationId: string,
    userId: string,
    updates: { answers?: Record<string, unknown>; files?: any[] }
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);

    if (registration.user.user_id !== userId) {
        throw new ServiceError(403, 'not_owner');
    }

    const form = await FormDefinition.findById(registration.form_id);
    if (!form) throw new ServiceError(404, 'form_not_found');

    // Spec: `never` is closed the moment it is submitted; `always` stays open. `closes_at` belongs
    // to the event's registration window, which the Event Service owns — until it exists, treat it
    // as open and let the edit through.
    // ponytail: swap this branch for the event's closes_at once BE-1's Event Service is up.
    if (form.settings.allow_edit_until === 'never') {
        throw new ServiceError(400, 'edits_not_allowed');
    }
    if (registration.status === 'cancelled' || registration.status === 'rejected') {
        throw new ServiceError(400, 'cannot_edit_inactive_registration');
    }

    const answers = updates.answers ?? registration.answers;
    const files = updates.files ?? registration.files;

    /**
     * An edit replaces the whole answer set, so anything the editor cannot send is destroyed by
     * omission. `admin_only` fields are exactly that: the validator strips them from a non-admin's
     * payload, so without carrying the stored values across, an owner editing their own
     * registration silently wiped whatever an admin had filled in — a seed, a bib number, an
     * assessment. Held aside before validation and restored after.
     */
    const adminOnly: Record<string, unknown> = {};
    for (const field of form.fields) {
        if (field.admin_only && registration.answers[field.key] !== undefined) {
            adminOnly[field.key] = registration.answers[field.key];
        }
    }

    const validationErrors = validateAnswers(answers, form.fields, files, { isAdmin: false });
    if (validationErrors.length > 0) {
        throw new ServiceError(400, 'validation_failed', validationErrors);
    }

    registration.answers = { ...answers, ...adminOnly };
    registration.files = files;
    registration.markModified('answers');

    await registration.save();
    return registration;
}

export async function cancelRegistration(
    registrationId: string,
    userId: string,
    isAdmin: boolean,
    reason?: string
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);

    if (registration.user.user_id !== userId && !isAdmin) {
        throw new ServiceError(403, 'not_owner');
    }
    if (registration.status === 'cancelled') {
        throw new ServiceError(409, 'already_cancelled');
    }

    // Read before the transition overwrites it: only a confirmed registration holds a seat.
    const heldSeat = registration.status === 'confirmed';

    await transition(registration, 'cancelled', userId, reason ?? 'user_cancel');
    await registration.save();

    if (heldSeat && registration.owner.type === 'event' && registration.owner.id) {
        try {
            await releaseSeat(registration.owner.id, registration._id);
        } catch (err) {
            // The cancel stands; the seat count is repaired by the Event Service's nightly recount.
            console.error(`[registration-service] release-seat failed for ${registration._id}:`, err);
        }
    }

    publish('RegistrationCancelled', 'registration-service', {
        registration_id: registration._id,
        owner: registration.owner,
        user_id: registration.user.user_id,
        // Only a released seat opens a slot for the waitlist; a waitlisted user cancelling does not.
        freed_seat: heldSeat,
        reason: reason ?? 'user_cancel',
    });

    return registration;
}

export async function updateCaptainApplication(
    registrationId: string,
    reviewedBy: string,
    status: 'approved' | 'declined',
    note?: string
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);

    if (!registration.context.event) {
        throw new ServiceError(400, 'not_event_registration');
    }
    if (registration.context.event.captain_application.status !== 'pending') {
        throw new ServiceError(409, 'application_not_pending');
    }

    registration.context.event.captain_application.status = status;
    registration.context.event.captain_application.reviewed_by = reviewedBy;
    registration.context.event.captain_application.reviewed_at = new Date();
    registration.context.event.captain_application.note = note ?? null;
    await registration.save();

    if (status === 'declined') {
        await transition(registration, 'rejected', reviewedBy, 'captain_declined');
        await registration.save();
        return registration;
    }

    // Approved: now it may take a seat (plan §D8).
    try {
        await reserveAndSettle(registration, reviewedBy, 'captain_approved');
    } catch (err) {
        console.error(`[registration-service] reserve-seat failed after approval of ${registration._id}:`, err);
    }

    publish('CaptainApproved', 'registration-service', {
        registration_id: registration._id,
        event_id: registration.owner.id!,
        user_id: registration.user.user_id,
    });

    return registration;
}

/**
 * Admin override. Moving a registration in or out of `confirmed` moves a seat with it — skipping
 * that was how the event's capacity counter drifted every time an admin touched a row.
 */
export async function updateRegistrationStatus(
    registrationId: string,
    adminId: string,
    status: 'confirmed' | 'waitlisted' | 'rejected',
    reason?: string
): Promise<IFormSubmission> {
    const registration = await getRegistration(registrationId);

    // A cancelled registration is the user's decision, not a status an admin flips back — and
    // confirming one would reserve a seat for somebody who gave it up. Re-registering is the path.
    if (registration.status === 'cancelled') {
        throw new ServiceError(409, 'registration_cancelled');
    }
    if (registration.status === status) {
        throw new ServiceError(409, 'already_in_status');
    }

    const wasConfirmed = registration.status === 'confirmed';
    if (wasConfirmed === (status === 'confirmed')) {
        // No seat changes hands; just record the move.
        await transition(registration, status, adminId, reason ?? 'admin_override');
        await registration.save();
        return registration;
    }

    const isEvent = registration.owner.type === 'event' && registration.owner.id;

    if (status === 'confirmed') {
        if (isEvent) {
            // A refusal is a 409 the admin can act on; an unreachable Event Service is a 503, not
            // the 500 an unwrapped fetch failure would produce.
            const result = await reserveSeat(registration.owner.id!, registration._id, registration._id).catch(
                (err) => {
                    console.error(`[registration-service] reserve-seat failed for ${registration._id}:`, err);
                    throw new ServiceError(503, 'event_service_unavailable');
                }
            );
            if (!result.reserved) {
                throw new ServiceError(409, result.reason ?? 'seat_unavailable');
            }
        }
        await transition(registration, status, adminId, reason ?? 'admin_override');
        await registration.save();
        publishCreated(registration);
        return registration;
    }

    await transition(registration, status, adminId, reason ?? 'admin_override');
    await registration.save();
    if (isEvent) {
        try {
            await releaseSeat(registration.owner.id!, registration._id);
        } catch (err) {
            console.error(`[registration-service] release-seat failed for ${registration._id}:`, err);
        }
    }
    return registration;
}
