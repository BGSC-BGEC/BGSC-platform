import { Announcement, IAnnouncement, ServiceError, User } from '@bgsc/shared';
import { Viewer, allOf, audienceFilter } from './audience';

/**
 * Read / unread state.
 *
 * There is no `announcement_reads` collection: state lives on the User document as
 * `{ last_seen_at, read_ids[] }`. This service is its only writer — the agreed cross-service
 * exception (relationships.md §1), which is why these two writes live here and not in User Service.
 *
 * The two fields answer one question together. `last_seen_at` is a watermark: everything published
 * at or before it is read. `read_ids` holds the cards opened individually since. Both the badge and
 * the per-card dot use both: opening a card lowers the badge, and "read all" clears the dots too.
 */

/** announcement-model.md §3. Enforced by Mongo's own `$slice`, not by reading the array first. */
export const READ_IDS_CAP = 200;

/** Opening the Announcements tab, or "mark all read". One write, no read. */
export async function markAllRead(userId: string): Promise<Date> {
    const last_seen_at = new Date();
    await User.updateOne({ _id: userId }, { $set: { 'announcements.last_seen_at': last_seen_at } });
    return last_seen_at;
}

/**
 * Per-card dot. `$slice` caps the array server-side, so there is no read-modify-write and no race.
 *
 * The `$ne` guard makes a replay a no-op: `$addToSet` cannot take `$slice`, so without it a second
 * call on the same announcement appends a duplicate and the cap evicts a genuinely older entry.
 *
 * ponytail: the id is not checked against `announcements`. Marking a non-existent one read costs
 * a slot in the caller's own capped array and nothing else — no other user's state is reachable
 * from here — and this is the most frequent write in the service, so it does not buy a lookup.
 */
export async function markRead(userId: string, announcementId: string): Promise<void> {
    await User.updateOne(
        { _id: userId, 'announcements.read_ids': { $ne: announcementId } },
        {
            $push: {
                'announcements.read_ids': { $each: [announcementId], $slice: -READ_IDS_CAP },
            },
        }
    );
}

/**
 * One indexed count against the same audience filter the feed uses. No fan-out.
 *
 * ponytail: counts from the watermark only, so opening single cards does not lower the badge until
 * the tab is opened (which calls read-all). Subtracting `read_ids` would need them inside the count
 * filter — add a `_id: { $nin }` when the badge has to track single reads.
 */
export async function unreadCount(viewer: Viewer): Promise<number> {
    const user = await User.findById(viewer.id).select('announcements.last_seen_at announcements.read_ids');
    if (!user) throw new ServiceError(401, 'unauthorized');

    // Never seen the tab: everything currently visible is unread.
    const since = user.announcements?.last_seen_at ?? new Date(0);
    const opened = user.announcements?.read_ids ?? [];

    return Announcement.countDocuments(
        allOf([audienceFilter(viewer), { published_at: { $gt: since } }, { _id: { $nin: opened } }])
    );
}

/**
 * Stamp `unread` on each card from the one user document it takes to know.
 *
 * Unread means published after the watermark and not opened since. A draft or scheduled item (the
 * composer's view) has no publish time and is never unread.
 *
 * At the 200 cap an old entry falls off `read_ids`, but the watermark still covers it, so the dot
 * only returns on a card newer than the last time the tab was opened — at which point it is right.
 * The upgrade path for exact per-card history is `announcement_reads` (relationships.md §7).
 */
export async function withUnread<T extends Pick<IAnnouncement, '_id' | 'published_at'>>(
    userId: string,
    cards: T[]
): Promise<(T & { unread: boolean })[]> {
    const user = await User.findById(userId).select('announcements');
    const seen = user?.announcements?.last_seen_at ?? null;
    const read = new Set(user?.announcements?.read_ids ?? []);
    return cards.map((a) => ({
        ...a,
        unread: !!a.published_at && (!seen || a.published_at > seen) && !read.has(a._id),
    }));
}
