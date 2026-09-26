import { AuctionLot, Event, FormSubmission, anonymizedSnapshot, subscribe, User, userSnapshotOf } from '@bgsc/shared';
import { releaseSeat } from './event.service';
import { invalidateAuctionLiveCache } from '../auction/cache';

/**
 * Event-service domain event consumers:
 * 1. CaptainApproved (Registration Service publishes it on every captain confirmation): add the
 *    captain to `auction.captain_user_ids` of an auction league (Spec §5.5).
 * 2. UserProfileUpdated / UserRestored: re-snapshot the name on `events.contacts` and on auction lots.
 * 3. UserDeleted: anonymize those same snapshots, and drop the contact detail.
 * 4. RegistrationCancelled: release the seat (idempotent) — a safety net for a release-seat call
 *    Registration Service could not complete.
 */

interface CaptainApprovedPayload {
    event_id: string;
    user_id: string;
}

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

interface RegistrationCancelledPayload {
    registration_id: string;
    owner?: { type: string; id: string | null };
    user_id?: string;
    role?: string;
    previous_status?: string;
    /** True when Registration's own release-seat call confirmed the seat came back. */
    freed_seat?: boolean;
}

/** Rows that may have held a seat when they left (a `submitted` one after a reserve whose answer was lost). */
const MAY_HAVE_HELD_SEAT = ['confirmed', 'submitted'];

const log = (what: string, err: unknown) => console.error(`[event-service] ${what} failed:`, err);

export function initializeConsumers(): void {
    subscribe('CaptainApproved', (event) => void handleCaptainApproved(event.payload as unknown as CaptainApprovedPayload));
    subscribe('UserProfileUpdated', (event) => void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload));
    subscribe('UserRestored', (event) =>
        void resnapshotUser((event.payload as unknown as { user_id: string }).user_id, { restore: true })
    );
    subscribe('UserDeleted', (event) => void handleUserDeleted(event.payload as unknown as { user_id: string }));
    subscribe('RegistrationCancelled', (event) =>
        void handleRegistrationCancelled(event.payload as unknown as RegistrationCancelledPayload)
    );

    console.log('[event-service] Event consumers initialized');
}

/**
 * Only an auction league (`type: 'ALL'`) has captains. This used to create an auction block on
 * `LE` events through `updateOne`, which skips the model's invariant hook — every later save of
 * that event then failed it with a 500. A captain approved while the auction is
 * paused is added too; only a finished auction is closed to new captains.
 */
export async function handleCaptainApproved(payload: CaptainApprovedPayload): Promise<void> {
    const { event_id, user_id } = payload;
    if (!event_id || !user_id) return;
    try {
        const res = await Event.updateOne(
            { _id: event_id, type: 'ALL', auction: { $ne: null }, 'auction.status': { $ne: 'finished' } },
            { $addToSet: { 'auction.captain_user_ids': user_id } },
            { timestamps: false } // bookkeeping: `updated_at` is the admin PATCH's version
        );
        if (res.modifiedCount === 1) invalidateAuctionLiveCache(event_id);
    } catch (err) {
        log(`CaptainApproved for ${user_id} on event ${event_id}`, err);
    }
}

/**
 * Contacts carry a name only; lots carry the player's full display snapshot.
 *
 * A deleted user never re-appears. The user is read with `deleted_at: null`, and a
 * plain profile refresh skips copies already marked deleted — only UserRestored (`restore`) may
 * un-delete them, so a profile update racing a deletion cannot write the real name back.
 */
export async function resnapshotUser(userId: string, opts: { restore?: boolean } = {}): Promise<void> {
    if (!userId) return;
    try {
        const user = await User.findOne({ _id: userId, deleted_at: null });
        if (!user) return;
        const snapshot = userSnapshotOf(user);

        await Promise.all([
            Event.updateMany(
                { 'contacts.user_id': userId },
                { $set: { 'contacts.$[c].display_name': snapshot.display_name, 'contacts.$[c].deleted': false } },
                { arrayFilters: [opts.restore ? { 'c.user_id': userId } : { 'c.user_id': userId, 'c.deleted': { $ne: true } }] }
            ),
            AuctionLot.updateMany(
                opts.restore ? { 'player.user_id': userId } : { 'player.user_id': userId, 'player.deleted': { $ne: true } },
                { $set: { player: snapshot } }
            ),
        ]);
    } catch (err) {
        log(`snapshot refresh for user ${userId}`, err);
    }
}

async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const touchesSnapshot = payload.changed_fields?.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!payload.user_id || !touchesSnapshot) return;
    await resnapshotUser(payload.user_id);
}

/**
 * A deleted account's name comes off the contact strip and off any auction lot it was sold on, and
 * its contact detail (a phone number or handle) is dropped — that is personal data, not a label.
 *
 * The lot's `sold_amount`, its team and its bid history are untouched: a purse was spent and the
 * ledger says so. What goes is the name a client would print.
 */
export async function handleUserDeleted(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await Promise.all([
            Event.updateMany(
                { 'contacts.user_id': user_id },
                {
                    $set: {
                        'contacts.$[c].display_name': anonymizedSnapshot()['display_name'],
                        'contacts.$[c].deleted': true,
                        'contacts.$[c].contact': null,
                    },
                },
                { arrayFilters: [{ 'c.user_id': user_id }] }
            ),
            AuctionLot.updateMany({ 'player.user_id': user_id }, { $set: anonymizedSnapshot('player.') }),
        ]);
    } catch (err) {
        log(`anonymization for ${user_id}`, err);
    }
}

export async function handleRegistrationCancelled(payload: RegistrationCancelledPayload): Promise<void> {
    if (payload.owner?.type !== 'event' || !payload.owner.id || !payload.registration_id) return;
    try {
        // Safety net for a release Registration could not complete — and only that. When this
        // cancellation already freed the seat (`freed_seat`), or the row never held one (it left the
        // waitlist), any seat it holds now is a fresh one: an admin re-confirm reserves BEFORE it
        // flips the row, so "not confirmed right now" used to strip that seat mid-confirm and leave a
        // confirmed row seatless. A row confirmed again by now keeps its seat too.
        // ponytail: a re-confirm racing a cancel whose own release failed can still lose its seat here;
        // the seat reconciliation sweep does not re-add it. Closing that needs a per-seat generation.
        const mayHold = payload.previous_status === undefined || MAY_HAVE_HELD_SEAT.includes(payload.previous_status);
        if (!payload.freed_seat && mayHold) {
            const row = await FormSubmission.findById(payload.registration_id).select('status').lean();
            if (row?.status !== 'confirmed') await releaseSeat(payload.owner.id, payload.registration_id);
        }

        // A confirmed captain who is cancelled leaves `auction.captain_user_ids` — a
        // cancelled captain could otherwise keep bidding (placeBid also re-checks the registration).
        if (payload.role === 'captain' && payload.previous_status === 'confirmed' && payload.user_id) {
            const res = await Event.updateOne(
                { _id: payload.owner.id, type: 'ALL' },
                { $pull: { 'auction.captain_user_ids': payload.user_id } },
                { timestamps: false }
            );
            if (res.modifiedCount === 1) invalidateAuctionLiveCache(payload.owner.id);
        }
    } catch (err) {
        log(`cancellation handling for registration ${payload.registration_id}`, err);
    }
}
