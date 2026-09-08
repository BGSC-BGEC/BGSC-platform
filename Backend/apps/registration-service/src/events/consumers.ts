import { FormSubmission, Team, User, publish, subscribe, userSnapshotOf } from '@bgsc/shared';
import { transition } from '../registrations/registration.service';
import { reserveSeat } from '../clients/event-client';

/**
 * Event bus consumers:
 *  - a released seat pulls the next person off the waitlist (plan §5.2 / §D6);
 *  - a changed profile rewrites the user snapshots this service owns (relationships.md §4).
 */

export function initializeConsumers(): void {
    subscribe('RegistrationCancelled', (event) => {
        void handleRegistrationCancelled(event.payload as unknown as CancelledPayload);
    });

    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    console.log('[registration-service] Event consumers initialized');
}

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

/**
 * `form_submissions.user` and `teams.members[]` store a display snapshot of the user, and this
 * service is the only writer of both (relationships.md §1). Without this consumer they were
 * written once at registration and never again — a user who changed their name kept the old one
 * on every roster and participant list forever.
 *
 * Best-effort and idempotent, per the snapshot policy: a missed event costs a stale name, not
 * a broken record, so a failure here never propagates.
 */
async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    // changed_fields is load-bearing: user-service emits this for any profile write, and a bio
    // edit must not trigger two collection-wide updates.
    const touchesSnapshot =
        !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;

    try {
        const user = await User.findById(user_id);
        if (!user) return;
        const snapshot = userSnapshotOf(user);

        await Promise.all([
            FormSubmission.updateMany(
                { 'user.user_id': user_id },
                { $set: { 'user.display_name': snapshot.display_name, 'user.avatar_url': snapshot.avatar_url } }
            ),
            // Positional $ updates the matched member; the filter guarantees there is one.
            Team.updateMany(
                { 'members.user_id': user_id },
                {
                    $set: {
                        'members.$[m].display_name': snapshot.display_name,
                        'members.$[m].avatar_url': snapshot.avatar_url,
                    },
                },
                { arrayFilters: [{ 'm.user_id': user_id }] }
            ),
        ]);
    } catch (err) {
        console.error(`[registration-service] Snapshot refresh failed for ${user_id}:`, err);
    }
}

interface CancelledPayload {
    owner: { type: string; id: string | null };
    registration_id: string;
    freed_seat: boolean;
}

async function handleRegistrationCancelled(payload: CancelledPayload): Promise<void> {
    const { owner, freed_seat } = payload;

    // A waitlisted user cancelling frees nothing — only a confirmed registration held a seat.
    // Without this, every waitlist cancellation triggered a pointless promotion attempt.
    if (!freed_seat || owner.type !== 'event' || !owner.id) {
        return;
    }

    const nextInLine = await FormSubmission.findOne({
        'owner.id': owner.id,
        status: 'waitlisted',
    }).sort({ waitlist_position: 1 });

    if (!nextInLine) return;

    try {
        // Keyed on the registration id, so a retried promotion cannot claim a second seat.
        const result = await reserveSeat(owner.id, nextInLine._id, nextInLine._id);
        if (!result.reserved) return;

        await transition(nextInLine, 'confirmed', 'system', 'promoted_from_waitlist');
        await nextInLine.save();

        publish('RegistrationCreated', 'registration-service', {
            registration_id: nextInLine._id,
            owner: nextInLine.owner,
            user_id: nextInLine.user.user_id,
            role: nextInLine.context.event?.role ?? 'solo',
        });

        console.log(`[registration-service] Promoted ${nextInLine._id} off the waitlist for event ${owner.id}`);
    } catch (err) {
        // Non-fatal: the seat is free and an admin can still confirm by hand.
        console.error('[registration-service] Waitlist promotion failed:', err);
    }
}
