import {
    Challenge,
    ChallengeParticipation,
    DomainEvent,
    Event,
    subscribe,
} from '@bgsc/shared';
import {
    dedupe,
    deliverAnnouncement,
    fanOutToRegistrants,
    fanOutToStaff,
    refreshAnnouncementCards,
} from '../broadcast/broadcast';
import { renderMessage } from '../broadcast/templates';
import { createOne, retract } from '../notifications/notification.service';

/**
 * What this service reacts to (be2-broadcast-service-plan.md §3).
 *
 * Every handler is idempotent by construction: the dedupe key is derived from the document that
 * caused the notification, never from the message, so a replay, a Redis redelivery and a second
 * instance all collapse onto the same row.
 *
 * Nothing here may throw into the bus: `publish()` is fire-and-forget by contract, and the write
 * that produced the event has already committed.
 */

const log = (what: string, err: unknown) => console.error(`[notification-service] ${what} failed:`, err);

/** Fan a payload into a handler without ever letting it reject onto the bus. */
const safe =
    <P extends Record<string, unknown>>(what: string, handler: (p: P) => Promise<void>) =>
    (event: DomainEvent<P>): void => {
        handler(event.payload).catch((err) => log(what, err));
    };

/* ------------------------------------------------------------------ *
 * Announcements — the broadcast path
 * ------------------------------------------------------------------ */

interface AnnouncementPublishedPayload extends Record<string, unknown> {
    announcement_id: string;
}

async function onAnnouncementPublished(p: AnnouncementPublishedPayload): Promise<void> {
    if (!p.announcement_id) return;
    await deliverAnnouncement(p.announcement_id);
}

interface AnnouncementUpdatedPayload extends Record<string, unknown> {
    announcement_id: string;
    changed_fields?: string[];
}

/**
 * Keep delivered cards honest. An announcement's title and body stay editable after publish, and a
 * card is a snapshot of them — so an edit that fixes a wrong time has to reach the inbox, or four
 * hundred people keep reading the wrong one until the card expires.
 *
 * `changed_fields` is load-bearing exactly as it is in every other snapshot consumer in this repo:
 * a pinning or priority edit must not rewrite rows across the collection.
 */
async function onAnnouncementUpdated(p: AnnouncementUpdatedPayload): Promise<void> {
    if (!p.announcement_id) return;
    const touchesCard = !p.changed_fields || p.changed_fields.some((f) => f === 'title' || f === 'body');
    if (!touchesCard) return;

    await refreshAnnouncementCards(p.announcement_id);
}

interface AnnouncementDeletedPayload extends Record<string, unknown> {
    announcement_id: string;
}

/**
 * A retraction, not a notification. A soft-deleted announcement 404s on its deep link and is gone
 * from the feed, so leaving the inbox card behind gives every recipient something that opens onto
 * nothing.
 *
 * Dispatch rows are deliberately left alone: a WhatsApp message that already went out cannot be
 * recalled, and the ledger is the record that it did.
 */
async function onAnnouncementDeleted(p: AnnouncementDeletedPayload): Promise<void> {
    if (!p.announcement_id) return;
    await retract(dedupe.announcement(p.announcement_id));
}

/* ------------------------------------------------------------------ *
 * Per-user triggers (Spec §10.2 event notifications)
 * ------------------------------------------------------------------ */

/** Titles are read, never taken from the payload: a notification with a blank name is worse than none. */
async function eventTitle(eventId: string): Promise<string | null> {
    const event = await Event.findById(eventId).select('title').lean<{ title: string }>();
    return event?.title ?? null;
}

interface RegistrationConfirmedPayload extends Record<string, unknown> {
    registration_id: string;
    event_id: string;
    user_id: string;
}

/**
 * "You're in" — and it arrives by two different names.
 *
 * `RegistrationCreated` (registration-service) is the ordinary path: the seat was reserved and the
 * registration went straight to confirmed. `RegistrationConfirmed` (event-service) is the *other*
 * path: an organiser promoted somebody off the waitlist. Listening to only the second one — which
 * is what the first version of this file did — means the common case, a person who simply signed up
 * and got in, is told nothing at all.
 *
 * One dedupe key covers both, so a person promoted off the waitlist gets their waitlist card and
 * exactly one confirmation, whichever event arrives.
 */
async function notifyConfirmed(registration_id: string, event_id: string, user_id: string): Promise<void> {
    const title = await eventTitle(event_id);
    if (!title) return log(`registration.confirmed for event ${event_id}`, new Error('event_not_found'));

    await createOne({
        user_id,
        ...renderMessage('registration.confirmed', { event_title: title }),
        data: { event_id, registration_id },
        dedupe_key: dedupe.registrationConfirmed(registration_id),
    });
}

async function onRegistrationConfirmed(p: RegistrationConfirmedPayload): Promise<void> {
    await notifyConfirmed(p.registration_id, p.event_id, p.user_id);
}

interface RegistrationCreatedPayload extends Record<string, unknown> {
    registration_id: string;
    owner: { type: string; id: string };
    user_id: string;
    role?: string;
}

/**
 * Registrations also cover challenges and standalone forms; only an event registration is a seat
 * at something, so only that one is worth a card.
 */
async function onRegistrationCreated(p: RegistrationCreatedPayload): Promise<void> {
    if (p.owner?.type !== 'event') return;
    await notifyConfirmed(p.registration_id, p.owner.id, p.user_id);
}

interface RegistrationWaitlistedPayload extends Record<string, unknown> {
    registration_id: string;
    owner: { type: string; id: string };
    user_id: string;
    position: number;
}

async function onRegistrationWaitlisted(p: RegistrationWaitlistedPayload): Promise<void> {
    // Registrations also cover challenges and generic forms; only an event has a waitlist to be
    // told a position in.
    if (p.owner?.type !== 'event') return;

    const title = await eventTitle(p.owner.id);
    if (!title) return log(`registration.waitlisted for event ${p.owner.id}`, new Error('event_not_found'));

    await createOne({
        user_id: p.user_id,
        ...renderMessage('registration.waitlisted', { event_title: title, position: p.position }),
        data: { event_id: p.owner.id, registration_id: p.registration_id, position: p.position },
        dedupe_key: dedupe.registrationWaitlisted(p.registration_id),
    });
}

interface EventCancelledPayload extends Record<string, unknown> {
    event_id: string;
}

async function onEventCancelled(p: EventCancelledPayload): Promise<void> {
    const title = await eventTitle(p.event_id);
    if (!title) return log(`event.cancelled for event ${p.event_id}`, new Error('event_not_found'));

    await fanOutToRegistrants(
        p.event_id,
        renderMessage('event.cancelled', { event_title: title }),
        dedupe.eventCancelled(p.event_id),
        { event_id: p.event_id }
    );
}

/* ------------------------------------------------------------------ *
 * Points (Spec §10.2 System Notifications: "[X] points awarded for [Reason]")
 * ------------------------------------------------------------------ */

interface PointsEarnedPayload extends Record<string, unknown> {
    transaction_id: string;
    user_id: string;
    amount: number;
    balance_after: number;
    reason: string;
    source: string;
}

/**
 * Deferred on Sep 26 on a false premise — the plan recorded that the Points Service published
 * nothing, when `ledger.ts` has always published five events under a computed name that a
 * `publish('` search cannot see. Built once the audit corrected that (plan D15).
 *
 * `PointsEarned` only: a spend is something the user just did on purpose, a refund and an
 * adjustment already carry their own explanation elsewhere, and an expiry is not news anybody wants
 * pushed at them. Earning is the one that is worth a card.
 *
 * The ledger publishes only on a *new* row — `record()` returns early on a replayed idempotency key
 * — so the transaction id is a dedupe key that cannot double-fire anyway.
 */
async function onPointsEarned(p: PointsEarnedPayload): Promise<void> {
    if (!p.user_id || !p.transaction_id) return;

    await createOne({
        user_id: p.user_id,
        ...renderMessage('points.earned', {
            amount: p.amount,
            // The ledger's reason is a machine key ('event.participation'); the card reads it aloud.
            reason: humanReason(p.reason),
            balance: p.balance_after,
        }),
        data: { transaction_id: p.transaction_id, amount: p.amount, source: p.source },
        dedupe_key: dedupe.pointsEarned(p.transaction_id),
    });
}

/** `event.participation` -> `Event participation`. One place, so the wording is consistent. */
function humanReason(reason: string): string {
    if (!reason) return 'Points awarded';
    const words = reason.replace(/[._]/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ------------------------------------------------------------------ *
 * Challenges
 * ------------------------------------------------------------------ */

async function challengeTitle(challengeId: string): Promise<string | null> {
    const challenge = await Challenge.findById(challengeId).select('title').lean<{ title: string }>();
    return challenge?.title ?? null;
}

interface ChallengeCompletedPayload extends Record<string, unknown> {
    participation_id: string;
    challenge_id: string;
    member_user_ids: string[];
    award_points: number;
}

/**
 * One row per member, solo or team — the same fan-out the Points Service pays out to, from the
 * same snapshotted roster, so the people told they earned points are exactly the people credited.
 *
 * Sequential rather than `Promise.all`: a failure on one member must not lose the others, and the
 * list is a team roster, not a mailing list.
 */
async function onChallengeCompleted(p: ChallengeCompletedPayload): Promise<void> {
    const title = await challengeTitle(p.challenge_id);
    if (!title) return log(`challenge.approved for ${p.challenge_id}`, new Error('challenge_not_found'));

    const message = renderMessage('challenge.approved', {
        challenge_title: title,
        award_points: p.award_points,
    });

    for (const user_id of p.member_user_ids ?? []) {
        try {
            await createOne({
                user_id,
                ...message,
                data: { challenge_id: p.challenge_id, participation_id: p.participation_id },
                dedupe_key: dedupe.challengeApproved(p.participation_id),
            });
        } catch (err) {
            log(`challenge.approved for ${user_id} on participation ${p.participation_id}`, err);
        }
    }
}

interface ChallengeRejectedPayload extends Record<string, unknown> {
    participation_id: string;
    challenge_id: string;
    reason?: string | null;
}

/**
 * The payload carries no recipients — a rejection is about a participation, and who it belongs to
 * is on that document. Read rather than guessed, which also means a participation deleted in the
 * meantime notifies nobody instead of throwing.
 */
async function onChallengeRejected(p: ChallengeRejectedPayload): Promise<void> {
    const [title, participation] = await Promise.all([
        challengeTitle(p.challenge_id),
        ChallengeParticipation.findById(p.participation_id)
            .select('member_user_ids')
            .lean<{ member_user_ids: string[] }>(),
    ]);
    if (!title || !participation) return;

    const message = renderMessage('challenge.rejected', {
        challenge_title: title,
        // The template is strict about empty variables, and a reviewer is not obliged to give one.
        reason: p.reason ?? 'not stated',
    });

    for (const user_id of participation.member_user_ids ?? []) {
        try {
            await createOne({
                user_id,
                ...message,
                data: { challenge_id: p.challenge_id, participation_id: p.participation_id },
                dedupe_key: dedupe.challengeRejected(p.participation_id),
            });
        } catch (err) {
            log(`challenge.rejected for ${user_id} on participation ${p.participation_id}`, err);
        }
    }
}

/* ------------------------------------------------------------------ *
 * Feedback (Staff notice for submitted tickets)
 * ------------------------------------------------------------------ */

interface FeedbackSubmittedPayload extends Record<string, unknown> {
    ticket_id: string;
    ticket_no: string;
    kind: string;
    category: string;
    subject?: string;
}

async function onFeedbackSubmitted(p: FeedbackSubmittedPayload): Promise<void> {
    if (!p.ticket_id || !p.ticket_no) return;

    await fanOutToStaff(
        renderMessage('feedback.submitted', {
            kind: p.kind ? p.kind.toUpperCase() : 'Feedback',
            ticket_no: p.ticket_no,
            subject: p.subject || 'New support ticket',
            category: p.category || 'general',
        }),
        dedupe.feedbackSubmitted(p.ticket_id),
        { ticket_id: p.ticket_id, ticket_no: p.ticket_no, kind: p.kind }
    );
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

/**
 * `PointsEarned` is consumed here since Sep 27. The plan's D15 had deferred it on the grounds that
 * the Points Service published nothing — it does, through a computed name (`EVENT_FOR[tx.type]` in
 * `ledger.ts`) that a search for `publish('` cannot see. The other four points events are
 * deliberately not consumed: see `onPointsEarned`.
 */
export function initializeConsumers(): void {
    subscribe('AnnouncementPublished', safe('announcement broadcast', onAnnouncementPublished));
    subscribe('AnnouncementUpdated', safe('announcement card refresh', onAnnouncementUpdated));
    subscribe('AnnouncementDeleted', safe('announcement retraction', onAnnouncementDeleted));
    // Both names for the same good news; see notifyConfirmed.
    subscribe('RegistrationCreated', safe('registration confirmation', onRegistrationCreated));
    subscribe('RegistrationConfirmed', safe('waitlist promotion', onRegistrationConfirmed));
    subscribe('RegistrationWaitlisted', safe('waitlist notification', onRegistrationWaitlisted));
    subscribe('EventCancelled', safe('event cancellation notice', onEventCancelled));
    subscribe('PointsEarned', safe('points credit notice', onPointsEarned));
    subscribe('ChallengeCompleted', safe('challenge approval notice', onChallengeCompleted));
    subscribe('ChallengeRejected', safe('challenge rejection notice', onChallengeRejected));
    subscribe('FeedbackSubmitted', safe('feedback ticket notice', onFeedbackSubmitted));

    console.log('[notification-service] Event consumers initialized');
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = {
    onAnnouncementPublished,
    onRegistrationCreated,
    onAnnouncementUpdated,
    onAnnouncementDeleted,
    onRegistrationConfirmed,
    onRegistrationWaitlisted,
    onEventCancelled,
    onPointsEarned,
    onChallengeCompleted,
    onChallengeRejected,
    onFeedbackSubmitted,
};

