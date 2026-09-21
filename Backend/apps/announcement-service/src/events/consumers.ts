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
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    // changed_fields is load-bearing: user-service emits this for any profile write, and a bio
    // edit must not trigger a collection-wide update.
    const touchesSnapshot =
        !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;

    try {
        const user = await User.findById(user_id);
        if (!user) return;
        const snapshot = userSnapshotOf(user);

        await Announcement.updateMany(
            { 'author.user_id': user_id },
            {
                $set: {
                    'author.display_name': snapshot.display_name,
                    'author.avatar_url': snapshot.avatar_url,
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
