import { Bracket, Match, anonymizedSnapshot, subscribe } from '@bgsc/shared';

/**
 * The only thing a draw reacts to: the person behind a seed being deleted.
 *
 * A bracket freezes its participants deliberately — it is the record of who played — but a frozen
 * *name* is still a display copy of a deleted account, and this service serves it publicly on the
 * spectator view. The seed, the id and every result stay exactly as they were; what goes is the
 * name and the avatar (relationships.md §4).
 *
 * Nothing here may throw into the bus: `publish()` is fire-and-forget by contract.
 */

async function anonymize(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await Promise.all([
            Bracket.updateMany(
                { participant_type: 'user', 'participants.id': user_id },
                { $set: anonymizedSnapshot('participants.$[p].') },
                { arrayFilters: [{ 'p.id': user_id }] }
            ),
            // A fixture holds the same name twice over, once per side.
            Match.updateMany({ 'a.id': user_id }, { $set: anonymizedSnapshot('a.') }),
            Match.updateMany({ 'b.id': user_id }, { $set: anonymizedSnapshot('b.') }),
        ]);
    } catch (err) {
        console.error(`[bracket-service] anonymization failed for ${user_id}:`, err);
    }
}

export function initializeConsumers(): void {
    subscribe('UserDeleted', (event) => {
        void anonymize(event.payload as unknown as { user_id: string });
    });

    console.log('[bracket-service] Event consumers initialized');
}

/** Test seam: the selfcheck drives the handler directly, without the bus in the way. */
export const handlers = { anonymize };
