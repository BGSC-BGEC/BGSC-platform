import {
    Challenge,
    ChallengeParticipation,
    DomainEvent,
    Event,
    FeedbackTicket,
    FormSubmission,
    Notification,
    NotificationCategory,
    Team,
    User,
    subscribe,
} from '@bgsc/shared';
import {
    dedupe,
    deliverAnnouncement,
    fanOutToRegistrants,
    fanOutToStaff,
    refreshAnnouncementCards,
} from '../broadcast/broadcast';
import { TEMPLATES, render, renderMessage } from '../broadcast/templates';
import { createOne, retract } from '../notifications/notification.service';

/**
 * What this service reacts to.
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

/**
 * "You're in".
 *
 * `RegistrationCreated` is the ONE event for "this registration is now confirmed", whichever path
 * got it there — straight in on submit, an automatic promotion off the waitlist, or an organiser's
 * promotion (event-service's `RegistrationConfirmed` is retired). The dedupe key is the
 * registration AND which confirmation of it this is — a replay is still one card, but a row an
 * admin rejected and then confirmed again gets its second "you're in".
 *
 * The ordinal is counted at consume time from the row's history, so two confirmations landing
 * before the first event is consumed would share a key. ponytail: fine at campus scale; carry the
 * ordinal in the payload (as `ChallengeRejected.rejection_no` does) if that ever matters.
 */
async function notifyConfirmed(registration_id: string, event_id: string, user_id: string): Promise<void> {
    const [title, registration] = await Promise.all([
        eventTitle(event_id),
        FormSubmission.findById(registration_id)
            .select('status_history')
            .lean<{ status_history?: { to: string }[] }>(),
    ]);
    if (!title) return log(`registration.confirmed for event ${event_id}`, new Error('event_not_found'));
    const nth = Math.max(1, (registration?.status_history ?? []).filter((h) => h.to === 'confirmed').length);

    await createOne({
        user_id,
        ...renderMessage('registration.confirmed', { event_title: title }),
        data: { event_id, registration_id },
        dedupe_key: dedupe.registrationConfirmed(registration_id, nth),
    });
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
 * `PointsEarned` only: a spend is something the user just did on purpose, a refund and an
 * adjustment already carry their own explanation elsewhere, and an expiry is not news anybody wants
 * pushed at them. Earning is the one that is worth a card.
 *
 * The ledger publishes only on a *new* row — `record()` returns early on a replayed idempotency key
 * — so the transaction id is a dedupe key that cannot double-fire anyway.
 *
 * A challenge credit gets no card of its own: `ChallengeCompleted` already told every member that
 * the challenge was approved and what it pays, and a second card for the same approval is noise.
 */
async function onPointsEarned(p: PointsEarnedPayload): Promise<void> {
    if (!p.user_id || !p.transaction_id) return;
    if (p.source === 'challenge') return;

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
    /** 1 for the participation's first rejection, 2 for its second… (challenge-service). */
    rejection_no?: number;
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
            .select('member_user_ids status_history')
            .lean<{ member_user_ids: string[]; status_history?: { to: string }[] }>(),
    ]);
    if (!title || !participation) return;

    // Which rejection this is. The producer's `rejection_no` is exact; counting the history at
    // consume time is the fallback for an older producer (it can collapse two quick rejections).
    // At least 1, so a participation written without history still keys.
    const nth =
        typeof p.rejection_no === 'number' && p.rejection_no >= 1
            ? p.rejection_no
            : Math.max(1, (participation.status_history ?? []).filter((h) => h.to === 'rejected').length);

    const message = renderMessage('challenge.rejected', {
        challenge_title: title,
        // The template is strict about empty variables, and a reviewer is not obliged to give one.
        // `??` alone let '' through (the producer's schema trims, then accepts empty), which threw
        // and dropped the whole notice.
        reason: p.reason?.trim() || 'not stated',
    });

    for (const user_id of participation.member_user_ids ?? []) {
        try {
            await createOne({
                user_id,
                ...message,
                data: { challenge_id: p.challenge_id, participation_id: p.participation_id },
                dedupe_key: dedupe.challengeRejected(p.participation_id, nth),
            });
        } catch (err) {
            log(`challenge.rejected for ${user_id} on participation ${p.participation_id}`, err);
        }
    }
}

/* ------------------------------------------------------------------ *
 * Teams, auction and feedback
 *
 * Every card below goes through `createOne`, which applies the recipient's mute and refuses a
 * deleted or suspended account. Names shown in a card are read live (`deleted_at: null` for a
 * person), never trusted from a payload.
 * ------------------------------------------------------------------ */

interface TeamInviteCreatedPayload extends Record<string, unknown> {
    team_id: string;
    team_name?: string;
    owner: { type: string; id: string };
    user_id: string;
    invited_by: string;
}

/**
 * An invite is only worth a card while it is pending. It is read back from the team: that gives
 * the invite's own timestamp for the dedupe key (a re-invite after a lapse is a new card), and an
 * invite accepted, declined or withdrawn before this ran produces nothing.
 */
async function onTeamInviteCreated(p: TeamInviteCreatedPayload): Promise<void> {
    if (!p.team_id || !p.user_id) return;
    const team = await Team.findById(p.team_id)
        .select('name owner pending')
        .lean<{ name: string; owner: { type: string }; pending?: { user_id: string; direction: string; created_at: Date }[] }>();
    const invite = team?.pending?.find((x) => x.user_id === p.user_id && x.direction === 'invite');
    if (!team || !invite) return;

    const category: NotificationCategory = team.owner?.type === 'challenge' ? 'challenge' : 'event';
    await createOne({
        user_id: p.user_id,
        ...renderMessage('team.invited', { team_name: team.name }),
        category,
        data: { team_id: p.team_id, owner: p.owner, invited_by: p.invited_by },
        dedupe_key: dedupe.teamInvite(p.team_id, p.user_id, new Date(invite.created_at).getTime()),
    });
}

interface PlayerSoldPayload extends Record<string, unknown> {
    event_id: string;
    lot_id: string;
    player_user_id: string;
    team_id: string;
    captain_user_id?: string | null;
    amount: number;
}

/**
 * Two cards: the player learns where they went, the buying captain gets the receipt. The lot is
 * sold once, so `lot_id` per side is the whole dedupe key.
 *
 * The player's name is in the captain's TITLE only, so `onUserDeleted` can take it out again by
 * rewriting one field, without re-reading the team and the event.
 */
async function onPlayerSold(p: PlayerSoldPayload): Promise<void> {
    if (!p.lot_id || !p.player_user_id || !p.team_id) return;
    const [event_title, team, player] = await Promise.all([
        eventTitle(p.event_id),
        Team.findById(p.team_id).select('name').lean<{ name: string }>(),
        User.findOne({ _id: p.player_user_id, deleted_at: null })
            .select('username profile.full_name')
            .lean<{ username: string; profile?: { full_name?: string } }>(),
    ]);
    if (!event_title || !team) return log(`auction.sold for lot ${p.lot_id}`, new Error('event_or_team_not_found'));

    const data = { event_id: p.event_id, lot_id: p.lot_id, team_id: p.team_id, amount: p.amount };
    const vars = { team_name: team.name, amount: p.amount, event_title };

    await createOne({
        user_id: p.player_user_id,
        ...renderMessage('auction.sold.player', vars),
        data,
        dedupe_key: dedupe.auctionSold(p.lot_id, 'player'),
    });

    // No captain, or the captain bought themselves: one card is enough.
    if (!p.captain_user_id || p.captain_user_id === p.player_user_id) return;
    await createOne({
        user_id: p.captain_user_id,
        // A deleted player is not named, even to their buyer.
        ...renderMessage('auction.sold.captain', {
            ...vars,
            player_name: player?.profile?.full_name || player?.username || UNNAMED_PLAYER,
        }),
        data: { ...data, player_user_id: p.player_user_id },
        dedupe_key: dedupe.auctionSold(p.lot_id, 'captain'),
    });
}

/** What the captain's card calls a player who is deleted, at sale time or later. */
const UNNAMED_PLAYER = 'a new player';
/** The captain card's body once its player is erased. */
const ERASED_CAPTAIN_BODY = 'Your new player joined your team in the auction.';

interface UserDeletedPayload extends Record<string, unknown> {
    user_id: string;
}

/**
 * The one card that names someone other than its recipient is the captain's auction receipt, and
 * it lives ninety days. A player who deletes their account comes off it, the way every other
 * service erases its display copies (relationships.md §4).
 *
 * The "still deleted?" read is the guard the other snapshot consumers use: a delete followed by a
 * quick restore must not anonymize a live account because the events were consumed out of order.
 * Not undone by `UserRestored`: the card is a receipt, and a restored player's page carries the name.
 *
 * User Service replays every recent deletion on a timer, so this runs many times per deletion; the
 * partial `data.player_user_id` index keeps each run an index lookup, and the `$set` is a no-op once
 * applied. The body is overwritten too: cards rendered by an older template named the player there.
 * It cannot be re-rendered from `data` (no team or event name), so it gets generic text.
 */
async function onUserDeleted(p: UserDeletedPayload): Promise<void> {
    if (!p.user_id) return;
    if (!(await User.exists({ _id: p.user_id, deleted_at: { $ne: null } }))) return;
    await Notification.updateMany(
        { type: 'auction.sold.captain', 'data.player_user_id': p.user_id },
        {
            $set: {
                title: render(TEMPLATES['auction.sold.captain'].title, { player_name: UNNAMED_PLAYER }),
                body: ERASED_CAPTAIN_BODY,
            },
        }
    );
}

interface FeedbackRespondedPayload extends Record<string, unknown> {
    ticket_id: string;
    ticket_no: string;
    reporter_user_id: string | null;
    /** ISO time of the reply. Absent from older producers, which fall back to the ticket's own. */
    responded_at?: string;
}

/**
 * The reporter hears that staff replied. An anonymous ticket has no reporter (`null`) and reaches
 * nobody here — its reply goes to the contact address the feedback service holds. The reply text
 * itself stays on the ticket: the card is a pointer, not a copy.
 */
async function onFeedbackResponded(p: FeedbackRespondedPayload): Promise<void> {
    if (!p.ticket_id || !p.ticket_no || !p.reporter_user_id) return;
    // The payload's time names THIS reply. Reading the ticket instead gives whatever reply is on it
    // when the event is consumed, so two replies in quick succession collapsed onto one key.
    let respondedAt = p.responded_at ? Date.parse(p.responded_at) : NaN;
    if (Number.isNaN(respondedAt)) {
        const ticket = await FeedbackTicket.findById(p.ticket_id)
            .select('response')
            .lean<{ response?: { at?: Date } | null }>();
        respondedAt = ticket?.response?.at ? new Date(ticket.response.at).getTime() : 0;
    }

    await createOne({
        user_id: p.reporter_user_id,
        ...renderMessage('feedback.responded', { ticket_no: p.ticket_no }),
        data: { ticket_id: p.ticket_id, ticket_no: p.ticket_no },
        dedupe_key: dedupe.feedbackResponded(p.ticket_id, respondedAt),
    });
}

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
 * The Points Service publishes under a computed name (`EVENT_FOR[tx.type]` in `ledger.ts`), which a
 * search for `publish('PointsEarned'` does not find. The other four points events are deliberately
 * not consumed: see `onPointsEarned`.
 */
export function initializeConsumers(): void {
    subscribe('AnnouncementPublished', safe('announcement broadcast', onAnnouncementPublished));
    subscribe('AnnouncementUpdated', safe('announcement card refresh', onAnnouncementUpdated));
    subscribe('AnnouncementDeleted', safe('announcement retraction', onAnnouncementDeleted));
    // The one "now confirmed" event; see notifyConfirmed.
    subscribe('RegistrationCreated', safe('registration confirmation', onRegistrationCreated));
    subscribe('RegistrationWaitlisted', safe('waitlist notification', onRegistrationWaitlisted));
    subscribe('EventCancelled', safe('event cancellation notice', onEventCancelled));
    subscribe('PointsEarned', safe('points credit notice', onPointsEarned));
    subscribe('ChallengeCompleted', safe('challenge approval notice', onChallengeCompleted));
    subscribe('ChallengeRejected', safe('challenge rejection notice', onChallengeRejected));
    subscribe('FeedbackSubmitted', safe('feedback ticket notice', onFeedbackSubmitted));
    subscribe('FeedbackResponded', safe('feedback reply notice', onFeedbackResponded));
    subscribe('TeamInviteCreated', safe('team invite notice', onTeamInviteCreated));
    subscribe('PlayerSold', safe('auction sale notice', onPlayerSold));
    subscribe('UserDeleted', safe('deleted player anonymization', onUserDeleted));

    console.log('[notification-service] Event consumers initialized');
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = {
    onAnnouncementPublished,
    onRegistrationCreated,
    onAnnouncementUpdated,
    onAnnouncementDeleted,
    onRegistrationWaitlisted,
    onEventCancelled,
    onPointsEarned,
    onChallengeCompleted,
    onChallengeRejected,
    onFeedbackSubmitted,
    onFeedbackResponded,
    onTeamInviteCreated,
    onPlayerSold,
    onUserDeleted,
};

