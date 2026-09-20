import { ChallengeParticipation, DomainEvent, User, subscribe } from '@bgsc/shared';

/**
 * This service consumes two user events and nothing else.
 *
 * It notably does NOT consume `PointsEarned`: `reward.point_transaction_ids[]` is read back from
 * the ledger by idempotency key instead (participation.service.ts `fillRewardIds`), because
 * `record()` publishes nothing on a replay and a dropped message would leave the array short
 * forever (be2-challenge-service-plan.md D7).
 *
 * Nothing here may throw into the bus: `publish()` is fire-and-forget by contract, and the write
 * that produced the event has already committed.
 */

const log = (what: string, err: unknown) => console.error(`[challenge-service] ${what} failed:`, err);

const safe =
    <P extends Record<string, unknown>>(what: string, handler: (p: P) => Promise<void>) =>
    (event: DomainEvent<P>): void => {
        handler(event.payload).catch((err) => log(what, err));
    };

interface ProfileUpdatedPayload extends Record<string, unknown> {
    user_id: string;
    changed_fields?: string[];
}

/**
 * Snapshot refresh (relationships.md §4). Best-effort: a miss costs a stale display name on a
 * history row, never a broken record — snapshots are for display, and nothing here is read for
 * authorization or for the payout, which use `member_user_ids` and re-fetch by id.
 *
 * Only solo participations carry a user snapshot; a team participation's `display_name` is the
 * team's, which Registration owns.
 */
async function refreshSnapshot(p: ProfileUpdatedPayload): Promise<void> {
    const touched = p.changed_fields ?? [];
    if (touched.length > 0 && !touched.includes('full_name') && !touched.includes('avatar_url')) return;

    const user = await User.findOne({ _id: p.user_id, deleted_at: null }).select('profile.full_name profile.avatar_url username');
    if (!user) return;

    await ChallengeParticipation.updateMany(
        { 'participant.type': 'user', 'participant.id': p.user_id },
        {
            $set: {
                'participant.display_name': user.profile?.full_name || user.username,
                'participant.avatar_url': user.profile?.avatar_url ?? null,
            },
        }
    );
}

/**
 * The rows stay (relationships.md §3 "keep snapshot") — an approved participation is what a paid
 * ledger row references, and the reviewer audit has to keep making sense. Only the display copy of
 * the person is removed.
 */
async function anonymize(p: { user_id: string }): Promise<void> {
    await ChallengeParticipation.updateMany(
        { 'participant.type': 'user', 'participant.id': p.user_id },
        { $set: { 'participant.display_name': 'Deleted user', 'participant.avatar_url': null } }
    );
}

export function initializeConsumers(): void {
    subscribe('UserProfileUpdated', safe('participant snapshot refresh', refreshSnapshot));
    subscribe('UserDeleted', safe('participant anonymization', anonymize));
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = { refreshSnapshot, anonymize };
