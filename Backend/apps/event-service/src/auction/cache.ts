/**
 * Ponytail / 2vCPU optimization: in-memory 750ms micro-cache for the auction live state.
 * High-velocity polling (50-1000 users) collapses from 3000 DB queries/sec to ~1.3 queries/sec.
 *
 * One entry is stored under every alias a client may poll (the ref it asked with, the `_id`, the
 * slug). Invalidation used to delete only the `_id` key, so a mutation made through the slug route
 * answered with the stale slug entry — `POST .../pause` replied `status: 'live'` (audit Sep 26).
 * Invalidation is now by event id, which catches every alias.
 *
 * ponytail: per-process. Two instances each serve up to 750ms of their own staleness.
 */

export interface CacheEntry<T> {
    eventId: string;
    /** What a draft check needs, so a cache hit cannot serve a draft to the public. */
    access: { status: 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled'; created_by: string; core_admins: string[] };
    payload: T;
    cachedAt: number;
    timerEndsAtMs: number | null;
}

export const LIVE_STATE_TTL_MS = 750;
export const LIVE_STATE_CACHE = new Map<string, CacheEntry<unknown>>();

export function invalidateAuctionLiveCache(eventId?: string): void {
    if (!eventId) return LIVE_STATE_CACHE.clear();
    for (const [key, entry] of LIVE_STATE_CACHE) {
        if (entry.eventId === eventId) LIVE_STATE_CACHE.delete(key);
    }
}
