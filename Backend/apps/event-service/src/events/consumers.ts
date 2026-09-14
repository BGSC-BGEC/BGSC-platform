import { Event, subscribe, User, userSnapshotOf } from '@bgsc/shared';

/**
 * Event-service domain event consumers:
 * 1. CaptainApproved: When Core approves a captain request in registration-service,
 *    add the user_id to event.auction.captain_user_ids (Spec §5.5, event-model.md §3).
 * 2. UserProfileUpdated: Refresh contact snapshots in event.contacts.
 */

interface CaptainApprovedPayload {
    event_id: string;
    user_id: string;
    registration_id: string;
    approved_by: string;
}

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

export function initializeConsumers(): void {
    subscribe('CaptainApproved', (event) => {
        void handleCaptainApproved(event.payload as unknown as CaptainApprovedPayload);
    });

    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    console.log('[event-service] Event consumers initialized');
}

async function handleCaptainApproved(payload: CaptainApprovedPayload): Promise<void> {
    const { event_id, user_id } = payload;
    if (!event_id || !user_id) return;

    try {
        const ev = await Event.findById(event_id);
        if (!ev) return;

        // If auction block exists, add to captain_user_ids
        if (ev.auction) {
            await Event.updateOne(
                { _id: event_id, 'auction.captain_user_ids': { $ne: user_id } },
                { $addToSet: { 'auction.captain_user_ids': user_id } }
            );
        } else if (ev.type === 'ALL' || ev.type === 'LE') {
            // Initialize default auction block if missing on auction/league event
            await Event.updateOne(
                { _id: event_id },
                {
                    $set: {
                        auction: {
                            k_multiplier: 1.0,
                            min_bid_increment: 100,
                            bid_timer_seconds: 5,
                            oc_override_quota: 3 / 7,
                            status: 'not_started',
                            captain_user_ids: [user_id],
                            purse_per_team: null,
                        },
                    },
                }
            );
        }
        console.log(`[event-service] Added captain ${user_id} to event ${event_id}`);
    } catch (err) {
        console.error(`[event-service] Failed to handle CaptainApproved for ${user_id} on event ${event_id}:`, err);
    }
}

async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    const touchesSnapshot = !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;

    try {
        const user = await User.findById(user_id);
        if (!user) return;
        const snapshot = userSnapshotOf(user);

        // Update contacts snapshot in events
        await Event.updateMany(
            { 'contacts.user_id': user_id },
            {
                $set: {
                    'contacts.$[c].display_name': snapshot.display_name,
                },
            },
            { arrayFilters: [{ 'c.user_id': user_id }] }
        );
    } catch (err) {
        console.error(`[event-service] Failed to update contact snapshot for user ${user_id}:`, err);
    }
}
