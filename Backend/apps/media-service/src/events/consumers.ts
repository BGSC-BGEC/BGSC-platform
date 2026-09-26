import { subscribe, User, userSnapshotOf, Media, anonymizedSnapshot } from '@bgsc/shared';
import { mediaService } from '../media/media.service';

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

interface UserPayload {
    user_id: string;
}

interface EventCompletedPayload {
    event_id: string;
    title?: string;
}

/**
 * Event bus consumers. `media.uploader` is a display snapshot and this service is its only writer.
 * Nothing here may throw into the bus: `publish()` is fire-and-forget by contract.
 */
export function initializeConsumers(): void {
    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    subscribe('UserDeleted', (event) => {
        void handleUserDeleted(event.payload as unknown as UserPayload);
    });

    subscribe('UserRestored', (event) => {
        void handleUserRestored(event.payload as unknown as UserPayload);
    });

    subscribe('EventCompleted', (event) => {
        void handleEventCompleted(event.payload as unknown as EventCompletedPayload);
    });

    console.log('[media-service] Event consumers initialized');
}

/** Copy the live name and avatar onto every item the user uploaded. */
async function resnapshot(user_id: string, restored: boolean): Promise<void> {
    // Only a live account, and a rename skips snapshots already erased — only a restore lifts
    // them — so a late event never puts a deleted user's name back.
    const user = await User.findOne({ _id: user_id, deleted_at: null });
    if (!user) return;
    const snapshot = userSnapshotOf(user);
    await Media.updateMany(
        restored ? { 'uploader.user_id': user_id } : { 'uploader.user_id': user_id, 'uploader.deleted': { $ne: true } },
        {
            $set: {
                'uploader.display_name': snapshot.display_name,
                'uploader.avatar_url': snapshot.avatar_url,
                ...(restored ? { 'uploader.deleted': false } : {}),
            },
        }
    );
}

async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    const touchesSnapshot =
        !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;

    try {
        await resnapshot(user_id, false);
    } catch (err) {
        console.error(`[media-service] Snapshot refresh failed for user ${user_id}:`, err);
    }
}

/** The shared erasure, so the flag the UI renders from is raised here like everywhere else. */
async function handleUserDeleted(payload: UserPayload): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        // UserDeleted is republished for days: a replay after a restore must not erase it again.
        if (!(await User.exists({ _id: user_id, deleted_at: { $ne: null } }))) return;
        await Media.updateMany({ 'uploader.user_id': user_id }, { $set: anonymizedSnapshot('uploader.') });
    } catch (err) {
        console.error(`[media-service] Anonymization failed for user ${user_id}:`, err);
    }
}

/** Never gated on changed_fields: a restored account's whole snapshot changed. */
async function handleUserRestored(payload: UserPayload): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await resnapshot(user_id, true);
    } catch (err) {
        console.error(`[media-service] Restore failed for user ${user_id}:`, err);
    }
}

async function handleEventCompleted(payload: EventCompletedPayload): Promise<void> {
    const { event_id, title } = payload;
    if (!event_id) return;

    try {
        await mediaService.ensureEventAlbum(event_id, title);
    } catch (err) {
        console.error(`[media-service] Auto album creation failed for event ${event_id}:`, err);
    }
}

/** Test seam: the selfcheck drives the handlers directly, without the bus in the way. */
export const handlers = { handleUserProfileUpdated, handleUserDeleted, handleUserRestored, handleEventCompleted };
