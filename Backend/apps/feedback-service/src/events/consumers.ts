import { FeedbackTicket, User, anonymizedSnapshot, subscribe, userSnapshotOf } from '@bgsc/shared';

/**
 * Event bus consumers.
 *
 * `feedback_tickets.reporter` is a display snapshot of whoever filed the ticket, and this service
 * is its only writer (relationships.md §1). Two things can happen to the person behind it.
 *
 * Nothing here may throw into the bus: `publish()` is fire-and-forget by contract.
 */

const log = (what: string, err: unknown) => console.error(`[feedback-service] ${what} failed:`, err);

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

/**
 * A renamed reporter is renamed on their tickets. Best-effort and idempotent: a miss costs a stale
 * name in a staff inbox, never a broken ticket.
 */
async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    // A bio edit must not rewrite the collection; the same gate every snapshot consumer here uses.
    const touchesSnapshot = !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;

    try {
        // A late profile event for a deleted account must not put its name back.
        const user = await User.findOne({ _id: user_id, deleted_at: null });
        if (!user) return;
        const snapshot = userSnapshotOf(user);
        await FeedbackTicket.updateMany(
            { 'reporter.user_id': user_id, 'reporter.deleted': { $ne: true } },
            { $set: { 'reporter.display_name': snapshot.display_name, 'reporter.avatar_url': snapshot.avatar_url } }
        );
    } catch (err) {
        log(`snapshot refresh for ${user_id}`, err);
    }
}

/**
 * A deleted account's name comes off its tickets.
 *
 * Only *attributed* tickets are touched, because an anonymous one never carried a reporter in the
 * first place — which is the one case where this consumer has nothing to do, and that is the point.
 */
async function handleUserDeleted(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        // The reply address goes too: on an attributed ticket it is the account's own email.
        await FeedbackTicket.updateMany(
            { 'reporter.user_id': user_id },
            { $set: { ...anonymizedSnapshot('reporter.'), contact_email: null } }
        );
    } catch (err) {
        log(`anonymization for ${user_id}`, err);
    }
}

/**
 * A restored account gets its name back — and, where the delete erased it, the reply address.
 * Not gated on changed_fields: everything about the snapshot changed.
 */
async function handleUserRestored(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        // Only an account that is actually back: a stale UserRestored replayed after a new delete is a no-op.
        const user = await User.findOne({ _id: user_id, deleted_at: null }).select('+email');
        if (!user) return;
        const snapshot = userSnapshotOf(user);
        await FeedbackTicket.updateMany(
            { 'reporter.user_id': user_id },
            {
                $set: {
                    'reporter.display_name': snapshot.display_name,
                    'reporter.avatar_url': snapshot.avatar_url,
                    'reporter.deleted': false,
                },
            }
        );
        await FeedbackTicket.updateMany(
            { 'reporter.user_id': user_id, contact_email: null },
            { $set: { contact_email: user.email ?? null } }
        );
    } catch (err) {
        log(`restore for ${user_id}`, err);
    }
}

export function initializeConsumers(): void {
    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });
    subscribe('UserDeleted', (event) => {
        void handleUserDeleted(event.payload as unknown as { user_id: string });
    });
    subscribe('UserRestored', (event) => {
        void handleUserRestored(event.payload as unknown as { user_id: string });
    });

    console.log('[feedback-service] Event consumers initialized');
}

/** Test seam: the selfchecks drive the handlers directly, without the bus in the way. */
export const handlers = { handleUserProfileUpdated, handleUserDeleted, handleUserRestored };
