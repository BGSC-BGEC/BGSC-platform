import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOTIFICATION_CATEGORY,
    NotificationCategory,
    NotificationPreference,
} from '@bgsc/shared';
import { UpdatePreferencesInput } from './notification.schemas';

/**
 * Per-category in-app toggles (Spec §10.3).
 *
 * The document's `_id` IS the user id, so there is no lookup key to get wrong and no second index.
 * An absent document means every default: nothing is created at signup, and there is no backfill
 * for the users who already exist.
 *
 * Boundary with `users.settings.notifications` (User/Auth Service's, relationships.md §1): the
 * global channel switch stays theirs, per-category granularity is ours. One question, one owner.
 */

export interface Preferences {
    in_app: Record<NotificationCategory, boolean>;
}

/** Defaults merged under whatever is stored, so a document written before a new category existed still reads. */
export async function get(userId: string): Promise<Preferences> {
    const doc = await NotificationPreference.findById(userId).lean();
    const stored = doc?.channels?.in_app ?? {};
    return {
        in_app: { ...DEFAULT_NOTIFICATION_PREFERENCES.in_app, ...stored },
    };
}

/**
 * Merge-update: only the leaves the body names are written, so toggling `event` does not silently
 * reset `announcement` to its default. Upserted, because the common case is a user who has never
 * had a preferences document.
 */
export async function update(userId: string, input: UpdatePreferencesInput): Promise<Preferences> {
    const set: Record<string, boolean> = {};
    for (const [category, value] of Object.entries(input.in_app ?? {})) {
        // The key is built from OUR enum after zod has validated it, never from raw request input:
        // a caller-supplied fragment inside a field path is a query-shape injection even when the
        // value it carries is a boolean.
        if (value !== undefined && (NOTIFICATION_CATEGORY as readonly string[]).includes(category)) {
            set[`channels.in_app.${category}`] = value;
        }
    }

    if (Object.keys(set).length > 0) {
        try {
            await NotificationPreference.updateOne({ _id: userId }, { $set: set }, { upsert: true });
        } catch (err) {
            // Two concurrent upserts for the same `_id` can both miss and both insert; Mongo
            // rejects the loser with a duplicate key rather than merging it. The document exists by
            // then, so the same update applied again is a plain update and cannot collide twice.
            if ((err as { code?: number }).code !== 11000) throw err;
            await NotificationPreference.updateOne({ _id: userId }, { $set: set });
        }
    }
    return get(userId);
}

/** One recipient's mute, for the per-user triggers. Absent document = default = not muted. */
export async function isMuted(userId: string, category: NotificationCategory): Promise<boolean> {
    return (await NotificationPreference.exists({ _id: userId, [`channels.in_app.${category}`]: false })) !== null;
}

/**
 * The users who have muted this category, as one query rather than one lookup per recipient.
 *
 * Muting is the rare case — the default is on and has no document at all — so the set this returns
 * is small even when the recipient list is not.
 */
export async function mutedUserIds(category: NotificationCategory): Promise<Set<string>> {
    const ids = await NotificationPreference.distinct('_id', { [`channels.in_app.${category}`]: false });
    return new Set(ids.filter((id): id is string => typeof id === 'string'));
}
