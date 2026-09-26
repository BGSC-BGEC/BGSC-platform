import { Bracket, Match, User, anonymizedSnapshot, subscribe, userSnapshotOf } from '@bgsc/shared';

/**
 * What a draw reacts to: the person behind a seed being deleted, renamed, or restored.
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
        // Still deleted? A UserDeleted delivered late — after a UserRestored — must not erase a
        // live account's name.
        if (!(await User.exists({ _id: user_id, deleted_at: { $ne: null } }))) return;
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

/**
 * Re-snapshot a person's name wherever it sits in a draw. The same write serves a rename
 * (`UserProfileUpdated`, gated on the fields a snapshot carries) and a restored account
 * (`UserRestored`, never gated — everything about the snapshot changed).
 *
 * The seed, the id and the results are untouched; only the display copy follows the account.
 */
async function resnapshot(payload: { user_id: string; changed_fields?: string[] }, gated: boolean): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;
    if (gated && changed_fields && !changed_fields.some((f) => f === 'full_name' || f === 'avatar_url')) return;

    try {
        // Only a live account: a late event about a deleted user must not put the
        // name back. A rename also skips seats already anonymized; only a restore lifts them.
        const user = await User.findOne({ _id: user_id, deleted_at: null });
        if (!user) return;
        const { display_name, avatar_url } = userSnapshotOf(user);
        const live = (path: string) => (gated ? { [path]: { $ne: true } } : {});
        await Promise.all([
            Bracket.updateMany(
                { participant_type: 'user', 'participants.id': user_id },
                {
                    $set: {
                        'participants.$[p].display_name': display_name,
                        'participants.$[p].avatar_url': avatar_url,
                        'participants.$[p].deleted': false,
                    },
                },
                { arrayFilters: [{ 'p.id': user_id, ...live('p.deleted') }] }
            ),
            // A fixture side has no avatar; the name and the flag are all it carries.
            Match.updateMany({ 'a.id': user_id, ...live('a.deleted') }, { $set: { 'a.display_name': display_name, 'a.deleted': false } }),
            Match.updateMany({ 'b.id': user_id, ...live('b.deleted') }, { $set: { 'b.display_name': display_name, 'b.deleted': false } }),
        ]);
    } catch (err) {
        console.error(`[bracket-service] snapshot refresh failed for ${user_id}:`, err);
    }
}

const onProfileUpdated = (p: { user_id: string; changed_fields?: string[] }) => resnapshot(p, true);
const onUserRestored = (p: { user_id: string }) => resnapshot(p, false);

export function initializeConsumers(): void {
    subscribe('UserDeleted', (event) => {
        void anonymize(event.payload as unknown as { user_id: string });
    });
    subscribe('UserProfileUpdated', (event) => {
        void onProfileUpdated(event.payload as unknown as { user_id: string; changed_fields?: string[] });
    });
    subscribe('UserRestored', (event) => {
        void onUserRestored(event.payload as unknown as { user_id: string });
    });

    console.log('[bracket-service] Event consumers initialized');
}

/** Test seam: the selfcheck drives the handler directly, without the bus in the way. */
export const handlers = { anonymize, onProfileUpdated, onUserRestored };
