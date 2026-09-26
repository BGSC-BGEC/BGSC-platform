import { ChallengeParticipation, DomainEvent, User, anonymizedSnapshot, subscribe } from '@bgsc/shared';
import { unlink } from '../strava/strava.service';

/**
 * Four events: three about users, one from Hall of Fame.
 *
 * It notably does NOT consume `PointsEarned`: `reward.point_transaction_ids[]` is read back from
 * the ledger by idempotency key instead (participation.service.ts `fillRewardIds`), because
 * `record()` publishes nothing on a replay and a dropped message would leave the array short
 * forever.
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
 * Re-copy a user's display snapshot onto their solo participations, from the `users` document.
 * `deleted: false` too, so the same write is also the UserRestored undo of `anonymize`.
 *
 * Only solo participations carry a user snapshot; a team participation's `display_name` is the
 * team's, which Registration owns.
 */
async function writeSnapshot(user_id: string, opts: { restore: boolean }): Promise<void> {
    // A deleted user is never re-snapshotted: the lookup says so...
    const user = await User.findOne({ _id: user_id, deleted_at: null }).select('profile.full_name profile.avatar_url username');
    if (!user) return;

    await ChallengeParticipation.updateMany(
        {
            'participant.type': 'user',
            'participant.id': user_id,
            // ...and so does the write: a profile refresh that lost a race with UserDeleted (user
            // read alive, anonymization landed, then this) must not un-anonymize the rows. Only the
            // restore, which is the deliberate undo, may touch an anonymized row.
            ...(opts.restore ? {} : { 'participant.deleted': { $ne: true } }),
        },
        {
            $set: {
                'participant.display_name': user.profile?.full_name || user.username,
                'participant.avatar_url': user.profile?.avatar_url ?? null,
                'participant.deleted': false,
            },
        }
    );
}

/**
 * Snapshot refresh (relationships.md §4). Best-effort: a miss costs a stale display name on a
 * history row, never a broken record — snapshots are for display, and nothing here is read for
 * authorization or for the payout, which use `member_user_ids` and re-fetch by id.
 */
async function refreshSnapshot(p: ProfileUpdatedPayload): Promise<void> {
    const touched = p.changed_fields ?? [];
    if (touched.length > 0 && !touched.includes('full_name') && !touched.includes('avatar_url')) return;
    await writeSnapshot(p.user_id, { restore: false });
}

/** A restore re-snapshots unconditionally — there is no `changed_fields` to gate on. */
async function restoreSnapshot(p: { user_id: string }): Promise<void> {
    await writeSnapshot(p.user_id, { restore: true });
}

/**
 * The rows stay (relationships.md §3 "keep snapshot") — an approved participation is what a paid
 * ledger row references, and the reviewer audit has to keep making sense. Only the display copy of
 * the person is removed.
 *
 * The Strava link goes entirely: live third-party tokens for an account nobody can sign in to are
 * a liability with no reader, and the activities would otherwise still be served on the profile
 * feed. A restored account reconnects in one click.
 */
async function anonymize(p: { user_id: string }): Promise<void> {
    // User-service republishes UserDeleted for 7 days. A replay reaching us after
    // the account was restored must not anonymize it again or cut its Strava link: act only on an
    // account that is deleted NOW.
    if (!(await User.exists({ _id: p.user_id, deleted_at: { $ne: null } }))) return;
    // The wording and the flag come from `@bgsc/shared` now: six collections erase a display
    // snapshot on this event, and they cannot be allowed to disagree about what that means
    // (relationships.md §4).
    await ChallengeParticipation.updateMany(
        { 'participant.type': 'user', 'participant.id': p.user_id },
        { $set: anonymizedSnapshot('participant.') }
    );
    await unlink(p.user_id);
}

interface HallOfFameEntryCreatedPayload extends Record<string, unknown> {
    entry_id: string;
    source: { type: string; id: string };
    participation_id?: string | null;
}

/**
 * `reward.hall_of_fame_entry_id` is ours to write; Leaderboard announces the entry instead of
 * writing our collection. Consumed rather than read back lazily like `fillRewardIds`: the payload
 * already names the participation, so this is one idempotent `$set` with no lookup.
 */
async function recordHallOfFame(p: HallOfFameEntryCreatedPayload): Promise<void> {
    if (p.source?.type !== 'challenge' || !p.participation_id || !p.entry_id) return;
    await ChallengeParticipation.updateOne(
        { _id: p.participation_id, challenge_id: p.source.id, status: 'approved', reward: { $ne: null } },
        { $set: { 'reward.hall_of_fame_entry_id': p.entry_id } }
    );
}

export function initializeConsumers(): void {
    subscribe('UserProfileUpdated', safe('participant snapshot refresh', refreshSnapshot));
    subscribe('UserRestored', safe('participant snapshot restore', restoreSnapshot));
    subscribe('UserDeleted', safe('participant anonymization', anonymize));
    subscribe('HallOfFameEntryCreated', safe('hall of fame entry link', recordHallOfFame));
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = { refreshSnapshot, restoreSnapshot, anonymize, recordHallOfFame };
