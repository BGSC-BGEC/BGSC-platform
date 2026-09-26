import { Announcement, User, anonymizedSnapshot, subscribe, userSnapshotOf } from '@bgsc/shared';

/**
 * Event bus consumers.
 *
 * `announcements.author` is a display snapshot of the user who wrote it, and this service is its
 * only writer (relationships.md §4). Without this consumer the name is written once at create and
 * never again — a coordinator who changes their name keeps the old one on every announcement they
 * have ever posted.
 */

export function initializeConsumers(): void {
    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    subscribe('UserDeleted', (event) => {
        void handleUserDeleted(event.payload as unknown as { user_id: string });
    });

    // Deletion is restorable (Spec §11.2.1). Without this a restored coordinator stays "[deleted]"
    // on everything they signed, however many times they later edit their profile.
    subscribe('UserRestored', (event) => {
        void resnapshot((event.payload as { user_id?: string }).user_id, { restoring: true });
    });

    console.log('[announcement-service] Event consumers initialized');
}

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

/**
 * Best-effort and idempotent, per the snapshot policy: a missed event costs a stale name, not a
 * broken record, so a failure here never propagates.
 *
 * `role_label` is deliberately NOT refreshed. Spec §5.2 makes attribution historical — an
 * announcement stays signed by the role its author held when they wrote it.
 */
async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { changed_fields } = payload;

    // changed_fields is load-bearing: user-service emits this for any profile write, and a bio
    // edit must not trigger a collection-wide update.
    if (!changed_fields?.some((f) => f === 'full_name' || f === 'avatar_url')) return;
    await resnapshot(payload.user_id, { restoring: false });
}

/**
 * Re-copy the author snapshot from the live user — the profile refresh and the restore share it.
 *
 * `deleted: false` is written every time: `handleUserDeleted` sets it, and a refresh that only
 * copied the name left a restored author flagged deleted forever. A user who is currently deleted
 * is never read (`deleted_at: null`), so a late profile event cannot un-anonymize
 * them — and only the restore itself may touch rows already flagged deleted.
 */
async function resnapshot(user_id: string | undefined, opts: { restoring: boolean }): Promise<void> {
    if (!user_id) return;
    try {
        const user = await User.findOne({ _id: user_id, deleted_at: null });
        if (!user) return;
        const snapshot = userSnapshotOf(user);

        await Announcement.updateMany(
            opts.restoring ? { 'author.user_id': user_id } : { 'author.user_id': user_id, 'author.deleted': { $ne: true } },
            {
                $set: {
                    'author.display_name': snapshot.display_name,
                    'author.avatar_url': snapshot.avatar_url,
                    'author.deleted': false,
                },
            }
        );
    } catch (err) {
        console.error(`[announcement-service] Snapshot refresh failed for ${user_id}:`, err);
    }
}

/**
 * A deleted coordinator's name comes off the announcements they signed.
 *
 * `role_label` stays: Spec §5.2 makes attribution historical, and "Coordinator" is a statement
 * about the office, not about the person. What goes is the name and the avatar — the display copy
 * the client would otherwise print (relationships.md §4).
 */
async function handleUserDeleted(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await Announcement.updateMany({ 'author.user_id': user_id }, { $set: anonymizedSnapshot('author.') });
    } catch (err) {
        console.error(`[announcement-service] anonymization failed for ${user_id}:`, err);
    }
}
