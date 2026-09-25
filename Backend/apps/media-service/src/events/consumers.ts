import { subscribe, User, userSnapshotOf, Media, MediaAlbum } from '@bgsc/shared';

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

interface UserDeletedPayload {
    user_id: string;
}

interface EventCompletedPayload {
    event_id: string;
    title?: string;
}

export function initializeConsumers(): void {
    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    subscribe('UserDeleted', (event) => {
        void handleUserDeleted(event.payload as unknown as UserDeletedPayload);
    });

    subscribe('EventCompleted', (event) => {
        void handleEventCompleted(event.payload as unknown as EventCompletedPayload);
    });

    console.log('[media-service] Event consumers initialized');
}

async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    const touchesSnapshot =
        !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;

    try {
        const user = await User.findById(user_id);
        if (!user) return;
        const snapshot = userSnapshotOf(user);

        await Media.updateMany(
            { 'uploader.user_id': user_id },
            {
                $set: {
                    'uploader.display_name': snapshot.display_name,
                    'uploader.avatar_url': snapshot.avatar_url,
                },
            }
        );
    } catch (err) {
        console.error(`[media-service] Snapshot refresh failed for user ${user_id}:`, err);
    }
}

async function handleUserDeleted(payload: UserDeletedPayload): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await Media.updateMany(
            { 'uploader.user_id': user_id },
            {
                $set: {
                    'uploader.display_name': 'Deleted User',
                    'uploader.avatar_url': null,
                },
            }
        );
    } catch (err) {
        console.error(`[media-service] Anonymization failed for user ${user_id}:`, err);
    }
}

async function handleEventCompleted(payload: EventCompletedPayload): Promise<void> {
    const { event_id, title } = payload;
    if (!event_id) return;

    try {
        const existing = await MediaAlbum.findOne({ event_id });
        if (!existing) {
            await MediaAlbum.create({
                title: title ? `${title} Album` : `Event ${event_id} Album`,
                category: 'event',
                event_id,
                created_by: 'system',
                is_public: true,
            });
        }
    } catch (err) {
        console.error(`[media-service] Auto album creation failed for event ${event_id}:`, err);
    }
}
