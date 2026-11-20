import {
    Announcement,
    AnnouncementStatus,
    FormSubmission,
    IAnnouncement,
    REGISTERED_STATUS,
    ROLE_RANK,
    RoleName,
    ServiceError,
    User,
    UserStatus,
    roleRank,
} from '@bgsc/shared';
import { alive, rankFilter } from './audience';

/**
 * Broadcast analytics for the composer: how many people an announcement can reach, and how many of
 * them have read it. Read-only; coordinator+ (route floor).
 *
 * WHO IS ELIGIBLE. The same rule `audienceFilter` / `isVisibleTo` apply to a reader, turned around to
 * count readers instead of filtering announcements:
 *   - role ranks at or above `audience.min_role`, and
 *   - if `audience.event_id` is set, the user holds a `confirmed` (REGISTERED_STATUS) event
 *     submission for it — exactly what `confirmedEventIds` reads for the feed.
 * Restricted to accounts that are `active` and not deleted, so the denominator is "people who can
 * open the app and see it today". Guests have no account and no read state, so they are never counted.
 *
 * WHAT COUNTS AS READ. Exactly the inverse of `withUnread` in reads.ts — a user has read it when
 *     announcements.last_seen_at >= published_at   (watermark: tab opened / "mark all read")
 *  OR announcements.read_ids contains the id       (card opened individually)
 *
 * APPROXIMATIONS (there is no per-read event log — relationships.md §7 `announcement_reads` is the
 * upgrade path if exact numbers are ever needed):
 *  1. The watermark marks everything published before it as read, so "read" means "the user opened
 *     the Announcements tab (or hit read-all) after it went out, or opened the card" — it is
 *     "seen in the feed", not "opened the card". This is an UPPER bound on card opens.
 *  2. `read_ids` is capped at READ_IDS_CAP (200). A card opened individually whose id has been
 *     evicted from the cap, and which the watermark does not cover, is no longer counted. Rare, and it
 *     can only UNDER-count.
 *  3. Eligibility is evaluated NOW (current role, current confirmed registrations, current account
 *     status), not as of the publish time. A reader since demoted / unregistered / suspended drops out
 *     of both numerator and denominator; a user who joined later is in the denominator.
 *  4. `read_ids` is not checked against visibility when written (reads.ts `markRead`), so reads are
 *     only ever counted within the eligible set — never "read by someone who could not see it".
 */

export interface AnnouncementStats {
    announcement_id: string;
    status: IAnnouncement['status'];
    published_at: Date | null;
    audience: { min_role: RoleName; event_id: string | null };
    /** Active, non-deleted accounts that satisfy the audience rule today. */
    eligible: number;
    /** Of those, how many have it read per the rule above. */
    read: number;
    /** read / eligible, 0..1, or null when nobody is eligible. */
    read_rate: number | null;
}

/** The user-side filter for "can see an announcement with this audience". */
async function eligibleUserFilter(audience: { min_role: RoleName; event_id: string | null }) {
    const filter: Record<string, unknown> = {
        status: UserStatus.ACTIVE,
        deleted_at: null,
        // ROLE_RANK is ordered, so "at or above min_role" is a suffix of it. An unknown min_role
        // ranks -1, which would slice from the end — clamp to 0 so it reads as "everyone" like
        // `roleRank(viewer) >= -1` does on the feed side.
        role: { $in: ROLE_RANK.slice(Math.max(roleRank(audience.min_role), 0)) },
    };
    if (audience.event_id) {
        const ids = await FormSubmission.distinct('user.user_id', {
            'owner.type': 'event',
            'owner.id': audience.event_id,
            status: REGISTERED_STATUS,
        });
        filter._id = { $in: ids.filter((id): id is string => typeof id === 'string') };
    }
    return filter;
}

/**
 * Two `countDocuments` per announcement over `users`. Neither read-state field is indexed: at campus
 * scale the user collection scan is cheap and this is an admin-only screen. If it grows, index
 * `announcements.last_seen_at` and `announcements.read_ids` on User.
 */
async function statsFor(
    a: Pick<IAnnouncement, '_id' | 'status' | 'published_at' | 'audience'>,
    eligibleCache: Map<string, Promise<{ filter: Record<string, unknown>; count: number }>>
): Promise<AnnouncementStats> {
    const audience = { min_role: a.audience.min_role, event_id: a.audience.event_id ?? null };
    const key = `${audience.min_role}|${audience.event_id ?? ''}`;
    let entry = eligibleCache.get(key);
    if (!entry) {
        entry = eligibleUserFilter(audience).then(async (filter) => ({
            filter,
            count: await User.countDocuments(filter),
        }));
        eligibleCache.set(key, entry);
    }
    const { filter, count: eligible } = await entry;

    // published_at is non-null for published/archived (model invariant); the caller only passes those.
    const publishedAt = a.published_at as Date;
    const read = await User.countDocuments({
        $and: [
            filter,
            {
                $or: [
                    { 'announcements.last_seen_at': { $gte: publishedAt } },
                    { 'announcements.read_ids': a._id },
                ],
            },
        ],
    });

    return {
        announcement_id: a._id,
        status: a.status,
        published_at: a.published_at,
        audience,
        eligible,
        read,
        read_rate: eligible > 0 ? read / eligible : null,
    };
}

const BROADCAST = { status: { $in: ['published', 'archived'] as AnnouncementStatus[] } };

/** One announcement. 404 if missing, deleted, above the caller's rank, or never published. */
export async function statsForOne(id: string, role: RoleName): Promise<AnnouncementStats> {
    const a = await Announcement.findOne({ _id: id, ...alive, ...rankFilter(role) })
        .select('_id status published_at audience')
        .lean<Pick<IAnnouncement, '_id' | 'status' | 'published_at' | 'audience'>>();
    if (!a) throw new ServiceError(404, 'announcement_not_found');
    if (a.status !== 'published' && a.status !== 'archived') {
        throw new ServiceError(409, 'not_published');
    }
    return statsFor(a, new Map());
}

/**
 * Many at once, for the History list. Ids the caller cannot see, or that were never published, are
 * simply absent from the result rather than failing the batch.
 */
export async function statsForMany(ids: string[], role: RoleName): Promise<AnnouncementStats[]> {
    const docs = await Announcement.find({ _id: { $in: ids }, ...alive, ...rankFilter(role), ...BROADCAST })
        .select('_id status published_at audience')
        .lean<Pick<IAnnouncement, '_id' | 'status' | 'published_at' | 'audience'>[]>();
    const cache = new Map<string, Promise<{ filter: Record<string, unknown>; count: number }>>();
    return Promise.all(docs.map((a) => statsFor(a, cache)));
}
