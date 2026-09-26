import { FormDefinition, FormDefinitionVersion, FormSubmission, Team, User, anonymizedSnapshot, subscribe, userSnapshotOf } from '@bgsc/shared';
import { promoteNext } from '../registrations/registration.service';
import { disbandEventTeams, lockReadyRosters } from '../teams/team.service';

/**
 * Event bus consumers:
 *  - a released seat pulls the next person off the waitlist;
 *  - an event starting (or its auction closing) locks the ready rosters;
 *  - an event cancelled disbands its open teams;
 *  - a changed profile rewrites the user snapshots this service owns (relationships.md §4);
 *  - a deleted account erases them, and a restored one writes them back.
 */

const logged = (what: string) => (err: unknown) => console.error(`[registration-service] ${what} consumer failed:`, err);

export function initializeConsumers(): void {
    subscribe('RegistrationCancelled', (event) => {
        void handleRegistrationCancelled(event.payload as unknown as CancelledPayload).catch(logged('RegistrationCancelled'));
    });

    subscribe('EventStarted', (event) => {
        const { event_id } = event.payload as { event_id?: string };
        if (event_id) void lockReadyRosters(event_id).catch(logged('EventStarted'));
    });

    subscribe('AuctionClosed', (event) => {
        const { event_id } = event.payload as { event_id?: string };
        if (event_id) void lockReadyRosters(event_id).catch(logged('AuctionClosed'));
    });

    subscribe('EventCancelled', (event) => {
        const { event_id } = event.payload as { event_id?: string };
        if (event_id) void disbandEventTeams(event_id).catch(logged('EventCancelled'));
    });

    subscribe('UserProfileUpdated', (event) => {
        void handleUserProfileUpdated(event.payload as unknown as ProfileUpdatedPayload);
    });

    subscribe('UserDeleted', (event) => {
        void handleUserDeleted(event.payload as unknown as { user_id: string });
    });

    subscribe('UserRestored', (event) => {
        void refreshSnapshots((event.payload as unknown as { user_id: string }).user_id, { restore: true });
    });

    console.log('[registration-service] Event consumers initialized');
}

interface ProfileUpdatedPayload {
    user_id: string;
    changed_fields?: string[];
}

/**
 * `form_submissions.user` and `teams.members[]` store a display snapshot of the user, and this
 * service is the only writer of both (relationships.md §1). Best-effort and idempotent, per the
 * snapshot policy: a missed event costs a stale name, not a broken record.
 */
async function handleUserProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    const { user_id, changed_fields } = payload;
    if (!user_id) return;

    // changed_fields is load-bearing: a bio edit must not trigger two collection-wide updates.
    const touchesSnapshot = !changed_fields || changed_fields.some((f) => f === 'full_name' || f === 'avatar_url');
    if (!touchesSnapshot) return;
    await refreshSnapshots(user_id, { restore: false });
}

/**
 * Re-snapshot from a LIVE `users` row (a deleted account never re-appears).
 *
 * A profile refresh never touches a copy already marked deleted — a late `UserProfileUpdated`
 * racing a `UserDeleted` used to write the real name back. `UserRestored` is the one path that
 * clears the flag.
 */
async function refreshSnapshots(userId: string | undefined, opts: { restore: boolean }): Promise<void> {
    if (!userId) return;
    try {
        const user = await User.findOne({ _id: userId, deleted_at: null });
        if (!user) return;
        const snapshot = userSnapshotOf(user);
        const liveOnly = opts.restore ? {} : { 'user.deleted': { $ne: true } };
        const memberFilter = opts.restore ? { 'm.user_id': userId } : { 'm.user_id': userId, 'm.deleted': { $ne: true } };

        await Promise.all([
            FormSubmission.updateMany(
                { 'user.user_id': userId, ...liveOnly },
                {
                    $set: {
                        'user.display_name': snapshot.display_name,
                        'user.avatar_url': snapshot.avatar_url,
                        'user.deleted': false,
                    },
                }
            ),
            Team.updateMany(
                { 'members.user_id': userId },
                {
                    $set: {
                        'members.$[m].display_name': snapshot.display_name,
                        'members.$[m].avatar_url': snapshot.avatar_url,
                        'members.$[m].deleted': false,
                    },
                },
                { arrayFilters: [memberFilter] }
            ),
        ]);
    } catch (err) {
        console.error(`[registration-service] Snapshot refresh failed for ${userId}:`, err);
    }
}

interface CancelledPayload {
    owner: { type: string; id: string | null };
    registration_id: string;
    freed_seat: boolean;
}

/**
 * `freed_seat` is set only when the Event Service confirmed the release, so a failed release no
 * longer promotes someone into a seat that is still held. Promotion itself is exclusive per row.
 */
async function handleRegistrationCancelled(payload: CancelledPayload): Promise<void> {
    const { owner, freed_seat } = payload;
    if (!freed_seat || owner?.type !== 'event' || !owner.id) return;
    await promoteNext(owner.id);
}

/** Answer types that are contact details, not answers to the event's questions. */
const PII_TYPES = new Set(['email', 'phone']);

/**
 * A deleted account's name comes off every roster and participant list this service owns, and the
 * contact details it typed into forms (email/phone answers) are removed from its registrations.
 * `user_id` is kept: it is a reference, and the rows that point at it still resolve.
 *
 * ponytail: other answers (free text, files) are retained under the retention policy — files are
 * private, readable only by the event's admins. Masking more is a policy change.
 */
async function handleUserDeleted(payload: { user_id: string }): Promise<void> {
    const { user_id } = payload;
    if (!user_id) return;

    try {
        await Promise.all([
            FormSubmission.updateMany({ 'user.user_id': user_id }, { $set: anonymizedSnapshot('user.') }),
            Team.updateMany(
                { 'members.user_id': user_id },
                { $set: anonymizedSnapshot('members.$[m].') },
                { arrayFilters: [{ 'm.user_id': user_id }] }
            ),
        ]);

        // Bounded by one person's registrations: a handful of rows, one form read each.
        const rows = await FormSubmission.find({ 'user.user_id': user_id }).select('form_id').limit(1000).lean();
        const formIds = [...new Set(rows.map((r) => r.form_id))];
        // Every version of the form: a row made on an older one may hold a contact answer under a
        // key the current fields have since dropped or retyped.
        const [forms, versions] = await Promise.all([
            FormDefinition.find({ _id: { $in: formIds } }).select('fields.key fields.type').lean(),
            FormDefinitionVersion.find({ form_id: { $in: formIds } }).select('form_id fields.key fields.type').lean(),
        ]);
        const piiKeys = new Map<string, Set<string>>();
        for (const def of [...forms.map((f) => ({ form_id: f._id, fields: f.fields })), ...versions]) {
            const keys = piiKeys.get(def.form_id) ?? piiKeys.set(def.form_id, new Set()).get(def.form_id)!;
            for (const f of def.fields) if (PII_TYPES.has(f.type)) keys.add(`answers.${f.key}`);
        }
        for (const [formId, keys] of piiKeys) {
            if (keys.size === 0) continue;
            await FormSubmission.updateMany(
                { 'user.user_id': user_id, form_id: formId },
                { $unset: Object.fromEntries([...keys].map((k) => [k, ''])) }
            );
        }
    } catch (err) {
        console.error(`[registration-service] anonymization failed for ${user_id}:`, err);
    }
}
