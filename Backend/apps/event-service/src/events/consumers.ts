import { AuctionLot, Event, anonymizedSnapshot, subscribe, User, userSnapshotOf } from '@bgsc/shared';

/**
 * Event-service domain event consumers:
 * 1. CaptainApproved: When Core approves a captain request in registration-service,
 *    add the user_id to event.auction.captain_user_ids (Spec §5.5, event-model.md §3).
 * 2. UserProfileUpdated: Refresh contact snapshots in event.contacts.
 * 3. UserDeleted: erase those same snapshots, and the player name on any auction lot.
 *
 * (3) was added by the whole-backend audit on Sep 27: five services held a display copy of a user
 * and only one erased it on deletion, while the documented policy said the UI would render
 * "deleted user" — which it cannot, because a snapshot carries no deletion signal and
 * `GET /users/:ref` answers 404 for a deleted account (relationships.md §4).
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

interface RegistrationCancelledPayload {
    registration_id: string;
    owner?: { type: string; id: string };
    user_id: string;
    freed_seat: boolean;
    reason: string;
}

export function initializeConsumers(): void {
    subscribe('CaptainApproved', (event) => {
        void handleCaptainApproved(event.payload as unknown as CaptainApprovedPayload);
    });

    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    subscribe('UserDeleted', (event) => {
        void handleUserDeleted(event.payload as unknown as { user_id: string });
    });

    subscribe('RegistrationCancelled', (event) => {
        void handleRegistrationCancelled(event.payload as unknown as RegistrationCancelledPayload);
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
            // Only add captain if auction hasn't reached a terminal state
            if (!['paused', 'finished'].includes(ev.auction.status)) {
                await Event.updateOne(
                    { _id: event_id, 'auction.captain_user_ids': { $ne: user_id } },
                    { $addToSet: { 'auction.captain_user_ids': user_id } }
                );
            }
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

/**
 * A deleted account's name comes off the contact strip and off any auction lot it was sold on.
 *
 * The lot's `sold_amount`, its team and its bid history are untouched: a purse was spent and the
 * ledger says so. What goes is the name a client would print.
 */
async function handleUserDeleted(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await Promise.all([
            Event.updateMany(
                { 'contacts.user_id': user_id },
                { $set: anonymizedSnapshot('contacts.$[c].') },
                { arrayFilters: [{ 'c.user_id': user_id }] }
            ),
            AuctionLot.updateMany({ 'player.user_id': user_id }, { $set: anonymizedSnapshot('player.') }),
        ]);
    } catch (err) {
        console.error(`[event-service] anonymization failed for ${user_id}:`, err);
    }
}

/**
 * When a registration is cancelled with freed_seat === false, it was a waitlisted registration.
 * Decrement counts.registrations_waitlisted so waitlist count does not drift.
 */
async function handleRegistrationCancelled(payload: RegistrationCancelledPayload): Promise<void> {
    if (!payload.owner || payload.owner.type !== 'event' || !payload.owner.id) return;
    if (!payload.freed_seat) {
        try {
            await Event.updateOne(
                { _id: payload.owner.id, 'counts.registrations_waitlisted': { $gt: 0 } },
                { $inc: { 'counts.registrations_waitlisted': -1 } }
            );
        } catch (err) {
            console.error(`[event-service] failed to decrement waitlist count for event ${payload.owner.id}:`, err);
        }
    }
}
