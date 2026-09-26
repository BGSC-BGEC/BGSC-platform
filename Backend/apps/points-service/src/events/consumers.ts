import {
    AuditLog,
    DomainEvent,
    Event,
    FormSubmission,
    IPointTransaction,
    LeaderboardEntry,
    PointTransaction,
    idempotencyKey,
    recordAudit,
    subscribe,
} from '@bgsc/shared';
import { record, signed } from '../points/ledger';
import { payPodium, refundSpend } from '../points/points.service';
import { resolve } from '../rules/rules.service';

/**
 * What this service reacts to. Every handler is idempotent by
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
 * Participation — paid on attendance, not on registration
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
    // Attendance pays a registration that still stands. A roster marked after the user cancelled
    // (or one naming a waitlisted row) would otherwise pay for a seat nobody held — and the
    // cancel's reversal has already run and found nothing to reverse.
    const stillAttended = () =>
        FormSubmission.exists({
            _id: p.registration_id,
            'owner.type': 'event',
            'owner.id': p.event_id,
            'user.user_id': p.user_id,
            status: 'confirmed',
            'context.event.attended': true,
        });
    if (!(await stillAttended())) {
        log(`participation credit for registration ${p.registration_id}`, new Error('registration_not_confirmed'));
        return;
    }

    const resolved = await resolve('event.participation', event.points_pool?.participation);
    if (!resolved) return; // rule disabled, or this event pays nothing for turning up

    const { tx, replayed } = await record({
        user_id: p.user_id,
        amount: signed('earn', resolved.amount),
        type: 'earn',
        source: 'event',
        reason: 'event.participation',
        // The event, not the registration: "all points for event X" is then one indexed query,
        // and the registration id is already the idempotency key.
        reference: { type: 'event', id: p.event_id },
        idempotency_key: idempotencyKey.eventParticipation(p.registration_id),
        actor: { type: 'system', user_id: null },
        expires_at: resolved.expires_at,
    });
    // A revocation or cancel may have been processed while this credit was being written, and
    // found nothing to reverse. Re-read now that the row exists; the reversal key is one per credit.
    if (!replayed && !(await stillAttended())) await reverseCredit(tx, 'attendance_revoked');
}

/* ------------------------------------------------------------------ *
 * Reversals
 * ------------------------------------------------------------------ */

/**
 * A credit taken back is a negative `adjust`, never a `refund` — a refund is a spend given back
 * (points-model.md §4). The amount comes from the original row, so a rule edited in between cannot
 * leave the user up or down a few points — less whatever of it already expired, which the expiry
 * sweep has taken once (its row is negative). Fully expired: nothing is left to take back.
 *
 * ponytail: read-then-write against the expiry sweep, which checks for this reversal the same way;
 * both landing in the same instant takes the expired part twice. Expiry is off by default.
 */
async function reverseCredit(credit: IPointTransaction, why: string): Promise<void> {
    const expired = await PointTransaction.findOne({ idempotency_key: idempotencyKey.expire(credit._id) }).select('amount');
    const remaining = credit.amount + (expired?.amount ?? 0);
    if (remaining <= 0) return;
    await record({
        user_id: credit.user_id,
        amount: -remaining,
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

/**
 * `RegistrationCancelled` and `ParticipantAttendanceRevoked` both land here: either way the credit
 * the registration earned is taken back under the one reversal key per credit, so the two (and an
 * event cancel) can never reverse it twice.
 *
 * ponytail: attendance revoked and then marked again pays nothing the second time — the credit's
 * key and its reversal's key both already exist. Re-crediting needs a per-marking key; not worth it
 * until an admin actually toggles a roster back and forth.
 */
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
        // every future spend. Visible in the ledger, fixable with an admin adjust.
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
    // credit first is a debit they cannot afford, so it is refused and they keep points for an
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
                // Same key as the leaderboard's compensation: a spend already given back replays.
                await refundSpend(spend, 'refund: event_cancelled');
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
 * Challenge completion — the Sunday seam
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

    // One row per member, solo or team. Sequential, not Promise.all: each row
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

/* ------------------------------------------------------------------ *
 * Final leaderboard — podium points (the automated half)
 * ------------------------------------------------------------------ */

interface FrozenPayload extends Record<string, unknown> {
    event_id: string;
    reason: 'below_threshold' | 'final';
    podium?: { place: number; participant: { type: string; id: string }; user_ids: string[] }[];
}

/**
 * Pays `event.podium.<place>` to every user the final standings name. Same function and key as the
 * admin route, so a manual award before or after this is a replay, never a second payment.
 */
const BENIGN_PODIUM_SKIPS = new Set(['place_not_awarded', 'event_pays_no_podium', 'rule_disabled']);

async function payFinalPodium(p: FrozenPayload): Promise<void> {
    if (p.reason !== 'final') return;
    for (const slot of p.podium ?? []) {
        for (const user_id of slot.user_ids ?? []) {
            try {
                await payPodium({ event_id: p.event_id, place: slot.place, user_id }, { type: 'system' });
            } catch (err) {
                const code = (err as { code?: string })?.code;
                // A place the event does not pay (past its multipliers, a zero pool, the rule
                // switched off) is expected. Anything else is a winner the standings named and
                // nobody paid: said loudly, and kept where the admin's event ledger read shows it
                // (once per event, place and user).
                if (code && BENIGN_PODIUM_SKIPS.has(code)) continue;
                console.error(`[points-service] PODIUM CONFLICT: place ${slot.place} for ${user_id} on event ${p.event_id}:`, err);
                const seen = await AuditLog.exists({
                    action: 'points.podium_conflict',
                    target_id: p.event_id,
                    'new_value.place': slot.place,
                    'new_value.user_id': user_id,
                });
                if (!seen) {
                    await recordAudit({
                        actor_id: null,
                        action: 'points.podium_conflict',
                        target_type: 'event',
                        target_id: p.event_id,
                        new_value: { place: slot.place, user_id, error: code ?? String(err) },
                    }).catch((auditErr) => log('podium conflict audit', auditErr));
                }
            }
        }
    }
}

/**
 * `RegistrationCreated` and `RegistrationConfirmed` are deliberately NOT subscribed: points are
 * paid for turning up, not for signing up. Re-adding them is the obvious wrong fix for
 * "the user has no points yet", so the selfcheck pins it.
 */
export function initializeConsumers(): void {
    subscribe('ParticipantAttended', safe('participation credit', creditParticipation));
    subscribe('RegistrationCancelled', safe('participation reversal', reverseParticipation));
    subscribe('ParticipantAttendanceRevoked', safe('attendance revocation', (p: CancelledPayload) =>
        reverseParticipation({ ...p, reason: p.reason ?? 'attendance_revoked' })));
    subscribe('EventCancelled', safe('event cancellation sweep', onEventCancelled));
    subscribe('ChallengeCompleted', safe('challenge award', creditChallenge));
    subscribe('LeaderboardFrozen', safe('podium award', payFinalPodium));
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = {
    creditParticipation,
    reverseParticipation,
    onEventCancelled,
    creditChallenge,
    payFinalPodium,
};
