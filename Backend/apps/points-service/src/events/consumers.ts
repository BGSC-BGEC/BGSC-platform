import {
    DomainEvent,
    Event,
    IPointTransaction,
    LeaderboardEntry,
    PointTransaction,
    idempotencyKey,
    subscribe,
} from '@bgsc/shared';
import { record, signed } from '../points/ledger';
import { resolve } from '../rules/rules.service';

/**
 * What this service reacts to (be2-points-service-plan.md §5). Every handler is idempotent by
 * construction: the key is derived from the document that caused it, never from the message, so a
 * replay, a Redis redelivery and a second instance all collapse to the same row.
 *
 * Nothing here may throw into the bus: `publish()` is fire-and-forget by contract, and the write
 * that produced the event has already committed.
 */

const log = (what: string, err: unknown) => console.error(`[points-service] ${what} failed:`, err);

/** Fan a payload into a handler without ever letting it reject onto the bus. */
const safe =
    <P extends Record<string, unknown>>(what: string, handler: (p: P) => Promise<void>) =>
    (event: DomainEvent<P>): void => {
        handler(event.payload).catch((err) => log(what, err));
    };

/* ------------------------------------------------------------------ *
 * Participation — paid on attendance, not on registration (plan D10)
 * ------------------------------------------------------------------ */

interface AttendedPayload extends Record<string, unknown> {
    event_id: string;
    registration_id: string;
    user_id: string;
}

async function creditParticipation(p: AttendedPayload): Promise<void> {
    const event = await Event.findOne({ _id: p.event_id, deleted_at: null }).select('points_pool status');
    if (!event) {
        // The Event Service published attendance for an event this service cannot read. Paying the
        // rule default here would invent an amount for something that may not exist; refusing to
        // guess and saying so is the honest failure.
        log(`participation credit for event ${p.event_id}`, new Error('event_not_found'));
        return;
    }
    // `recordEventAttendance` (event.service.ts) has no status guard, so attendance can be marked
    // on a cancelled event — after this service's cancel sweep has already reversed everyone. The
    // credit would then stand forever, points awarded for an event that did not happen. Cancelled
    // events pay nobody, whatever order the messages arrive in.
    if (event.status === 'cancelled') {
        log(`participation credit for event ${p.event_id}`, new Error('event_cancelled'));
        return;
    }

    const resolved = await resolve('event.participation', event.points_pool?.participation);
    if (!resolved) return; // rule disabled, or this event pays nothing for turning up

    await record({
        user_id: p.user_id,
        amount: signed('earn', resolved.amount),
        type: 'earn',
        source: 'event',
        reason: 'event.participation',
        // The event, not the registration: "all points for event X" is then one indexed query,
        // and the registration id is already the idempotency key (plan §5.1).
        reference: { type: 'event', id: p.event_id },
        idempotency_key: idempotencyKey.eventParticipation(p.registration_id),
        actor: { type: 'system', user_id: null },
        expires_at: resolved.expires_at,
    });
}

/* ------------------------------------------------------------------ *
 * Reversals
 * ------------------------------------------------------------------ */

/**
 * A credit taken back is a negative `adjust`, never a `refund` — a refund is a spend given back
 * (points-model.md §4). The amount comes from the original row, so a rule edited in between cannot
 * leave the user up or down a few points.
 */
async function reverseCredit(credit: IPointTransaction, why: string): Promise<void> {
    await record({
        user_id: credit.user_id,
        amount: -credit.amount,
        type: 'adjust',
        source: credit.source,
        reason: credit.reason,
        reference: credit.reference,
        idempotency_key: idempotencyKey.participationReversal(credit._id),
        actor: { type: 'system', user_id: null },
        note: `reversal: ${why}`,
    });
}

interface CancelledPayload extends Record<string, unknown> {
    registration_id: string;
    reason?: string;
}

async function reverseParticipation(p: CancelledPayload): Promise<void> {
    const credit = await PointTransaction.findOne({
        idempotency_key: idempotencyKey.eventParticipation(p.registration_id),
    });
    // The common case now that points are paid on attendance: most cancellations happen before the
    // event, so there is nothing to reverse and this costs one indexed read.
    if (!credit) return;

    try {
        await reverseCredit(credit, p.reason ?? 'registration_cancelled');
    } catch (err) {
        // 409 insufficient_points: the user already spent what they earned. Leaving the credit
        // standing beats a negative balance, which would break `balance = Σ amount` and block
        // every future spend (plan D9). Visible in the ledger, fixable with an admin adjust.
        log(`participation reversal for registration ${p.registration_id}`, err);
    }
}

/* ------------------------------------------------------------------ *
 * Event cancelled — reverse participations, refund investments
 * ------------------------------------------------------------------ */

interface EventCancelledPayload extends Record<string, unknown> {
    event_id: string;
}

async function onEventCancelled(p: EventCancelledPayload): Promise<void> {
    // Refunds BEFORE reversals, and the order is load-bearing. A participant who invested
    // everything they earned on this event sits at a zero balance; reversing their participation
    // credit first is a debit they cannot afford, so it is refused (D9) and they keep points for an
    // event that never happened. Paying the investment back first makes the reversal affordable,
    // and the pair nets to zero. Giving back before taking away is the general rule.
    //
    // (a) every leaderboard investment made on this event's entries. Investments are
    // non-refundable except here (leaderboard-model.md §6).
    const entryIds = await LeaderboardEntry.distinct('_id', { event_id: p.event_id });
    if (entryIds.length > 0) {
        const spends = PointTransaction.find({
            'reference.type': 'leaderboard_entry',
            'reference.id': { $in: entryIds },
            type: 'spend',
        }).cursor();

        for await (const spend of spends) {
            try {
                await record({
                    user_id: spend.user_id,
                    // A refund is always positive: the spend row was negative.
                    amount: signed('refund', spend.amount),
                    type: 'refund',
                    source: spend.source,
                    reason: spend.reason,
                    reference: spend.reference,
                    idempotency_key: idempotencyKey.eventCancelRefund(spend._id),
                    actor: { type: 'system', user_id: null },
                    note: 'refund: event_cancelled',
                });
            } catch (err) {
                log(`investment refund for transaction ${spend._id}`, err);
            }
        }
    }

    // (b) every participation credit this event paid out.
    const credits = PointTransaction.find({
        'reference.type': 'event',
        'reference.id': p.event_id,
        reason: 'event.participation',
        type: 'earn',
    }).cursor();

    for await (const credit of credits) {
        try {
            await reverseCredit(credit, 'event_cancelled');
        } catch (err) {
            log(`participation reversal for transaction ${credit._id}`, err);
        }
    }
}

/* ------------------------------------------------------------------ *
 * Challenge completion — the Sunday seam (plan §5.5)
 * ------------------------------------------------------------------ */

interface ChallengeCompletedPayload extends Record<string, unknown> {
    participation_id: string;
    challenge_id: string;
    member_user_ids: string[];
    /** The snapshot's amount — what the challenge was worth when it was accepted. */
    award_points: number;
}

async function creditChallenge(p: ChallengeCompletedPayload): Promise<void> {
    const resolved = await resolve('challenge.completed', p.award_points);
    if (!resolved) return;

    // One row per member, solo or team (Challenge.ts:271). Sequential, not Promise.all: each row
    // moves the same collection and a failure on one member must not lose the others.
    for (const user_id of p.member_user_ids ?? []) {
        try {
            await record({
                user_id,
                amount: signed('earn', resolved.amount),
                type: 'earn',
                source: 'challenge',
                reason: 'challenge.completed',
                reference: { type: 'challenge', id: p.challenge_id },
                idempotency_key: idempotencyKey.challengeCompleted(p.participation_id, user_id),
                actor: { type: 'system', user_id: null },
                expires_at: resolved.expires_at,
            });
        } catch (err) {
            log(`challenge award for ${user_id} on participation ${p.participation_id}`, err);
        }
    }
}

/**
 * `RegistrationCreated` and `RegistrationConfirmed` are deliberately NOT subscribed: points are
 * paid for turning up, not for signing up (plan D10). Re-adding them is the obvious wrong fix for
 * "the user has no points yet", so the selfcheck pins it.
 */
export function initializeConsumers(): void {
    subscribe('ParticipantAttended', safe('participation credit', creditParticipation));
    subscribe('RegistrationCancelled', safe('participation reversal', reverseParticipation));
    subscribe('EventCancelled', safe('event cancellation sweep', onEventCancelled));
    subscribe('ChallengeCompleted', safe('challenge award', creditChallenge));
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = {
    creditParticipation,
    reverseParticipation,
    onEventCancelled,
    creditChallenge,
};
