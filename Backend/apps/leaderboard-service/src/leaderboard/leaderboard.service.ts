import {
    Challenge,
    Event,
    FormSubmission,
    IEvent,
    ILeaderboardEntry,
    ILeaderboardSnapshot,
    InternalCallError,
    LeaderboardEntry,
    LeaderboardSnapshot,
    PointTransaction,
    ServiceError,
    Team,
    User,
    DELETED_DISPLAY_NAME,
    callInternal,
    config,
    escapeRegex,
    isEventAdmin,
    normalize,
    publish,
    rawScore,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import {
    QueryGlobalLeaderboardInput,
    QueryEventLeaderboardInput,
    SubmitScoresInput,
} from './leaderboard.schemas';
import {
    cacheEventLeaderboard,
    cacheGlobalLeaderboard,
    checkInvestmentRateLimit,
    evictEventLeaderboard,
    getCachedGlobalLeaderboard,
} from './redis';

export interface Actor {
    id: string;
    role?: string;
}

/* ------------------------------------------------------------------ *
 * Points Service calls (leaderboard-model.md §6)
 * ------------------------------------------------------------------ */

/** Points Service may or may not have applied the call: never read as "nothing happened". */
export class PointsOutcomeUnknown extends Error {
    constructor() {
        super('points outcome unknown');
        Object.setPrototypeOf(this, PointsOutcomeUnknown.prototype);
    }
}

/**
 * The one way this service moves points: Points Service's internal routes. There is no fallback
 * that writes `users` or `point_transactions` here — the old one double-debited whenever a slow
 * points call had in fact landed (backend-audit-2026-09-26). A refusal is passed through as a
 * ServiceError; an unknown outcome (no answer, 5xx, or 409 `request_in_flight` while another writer
 * holds the key) is retried once with the same key and then thrown as `PointsOutcomeUnknown`.
 */
async function pointsCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await callInternal<T>(config.services.points, path, { body, timeoutMs: 5000 });
        } catch (err) {
            if (!(err instanceof InternalCallError)) throw err;
            if (err.outcomeUnknown || err.code === 'request_in_flight') {
                if (attempt === 0) continue;
                throw new PointsOutcomeUnknown();
            }
            // Our own service token refused: refused at the door, so nothing was applied — but a
            // deployment fault, not the member's request.
            if (err.status === 401 || err.status === 403) throw new ServiceError(503, 'points_unavailable');
            throw new ServiceError(err.status, err.code, err.details);
        }
    }
}

/** Debit for an investment. ServiceError: refused, nothing taken. PointsOutcomeUnknown: maybe taken. */
export async function debitPoints(userId: string, amount: number, entryId: string, requestId: string): Promise<void> {
    await pointsCall('/internal/points/spend', {
        user_id: userId,
        amount,
        reference: { type: 'leaderboard_entry', id: entryId },
        request_id: requestId,
    });
}

/**
 * Give back whatever the spend `requestId` took. Points refunds exactly that spend, once, under the
 * key the event-cancel sweep also uses. `nothing_taken` is final: Points voids the spend key when it
 * finds no spend, so a late spend can never land after this answer. `user_deleted` is final too: the
 * account is gone and no retry will ever pay it. `unknown` means ask again later.
 */
export async function refundPoints(
    userId: string,
    entryId: string,
    requestId: string
): Promise<'refunded' | 'nothing_taken' | 'user_deleted' | 'unknown'> {
    try {
        await pointsCall('/internal/points/refund', {
            user_id: userId,
            reference: { type: 'leaderboard_entry', id: entryId },
            request_id: requestId,
        });
        return 'refunded';
    } catch (err) {
        if (err instanceof ServiceError && err.code === 'spend_not_found') return 'nothing_taken';
        if (err instanceof ServiceError && err.code === 'user_not_found') {
            console.error(`[leaderboard-service] refund of ${requestId} (entry ${entryId}) dropped: user ${userId} is deleted`);
            return 'user_deleted';
        }
        console.error(`[leaderboard-service] refund of ${requestId} (entry ${entryId}) unconfirmed; the settle sweep retries it:`, err);
        return 'unknown';
    }
}

/* ------------------------------------------------------------------ *
 * Freeze state
 * ------------------------------------------------------------------ */

/** The newest snapshot decides: `frozen` (below threshold, final, cancelled) closes the board. */
async function latestSnapshot(eventId: string): Promise<ILeaderboardSnapshot | null> {
    return LeaderboardSnapshot.findOne({ event_id: eventId }).sort({ taken_at: -1 });
}

/** A board that no write may touch again: the event ended or was cancelled, or the final was taken. */
function isClosed(event: Pick<IEvent, 'status'> | null, latest: ILeaderboardSnapshot | null): boolean {
    return event?.status === 'past' || event?.status === 'cancelled' || latest?.reason === 'final';
}

/**
 * Recomputes for one event run one at a time in this process. Two concurrent recomputes each read
 * every entry and write ranks back, so the slower one used to overwrite the faster one's result
 * with a stale read (a lost investment in `final_score`).
 *
 * ponytail: per-process. `final_score` is derived inside the update from the stored
 * `invested_points`, so across instances only the rank order can be briefly stale, and the next
 * recompute repairs it. A Redis lock per event is the upgrade if instances multiply.
 */
const recomputeQueues = new Map<string, Promise<unknown>>();

function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const run = (recomputeQueues.get(key) ?? Promise.resolve()).catch(() => undefined).then(fn);
    const tail = run.catch(() => undefined);
    recomputeQueues.set(key, tail);
    void tail.then(() => {
        if (recomputeQueues.get(key) === tail) recomputeQueues.delete(key);
    });
    return run;
}

/**
 * Recompute raw scores (from the event's current weights), normalization, final scores and ranks
 * for every entry of an event. Saves entries, captures a snapshot, prunes old snapshots and
 * refreshes the Redis cache.
 *
 * A closed board is never rewritten: a late cancellation, team disband or in-flight investment
 * after the final used to write a `frozen: false` snapshot and reopen it.
 */
export interface Recomputed {
    allEntries: ILeaderboardEntry[];
    thresholdMet: boolean;
    /** True only for the call that wrote this event's final snapshot. */
    wroteFinal: boolean;
}

export function recomputeEventRanks(
    eventId: string,
    reason: 'score_update' | 'investment' | 'final' | 'freeze'
): Promise<Recomputed> {
    return serialized(eventId, () => recompute(eventId, reason));
}

async function recompute(
    eventId: string,
    reason: 'score_update' | 'investment' | 'final' | 'freeze'
): Promise<Recomputed> {
    const [event, latest] = await Promise.all([Event.findById(eventId), latestSnapshot(eventId)]);
    const allEntries = await LeaderboardEntry.find({ event_id: eventId });
    const minParticipants = event?.leaderboard?.min_participants ?? 1;

    // Closed: report what stands. A replayed EventCompleted still gets its entries (for the podium)
    // without a second final snapshot.
    const closed = latest?.reason === 'final' || event?.status === 'cancelled' || (reason !== 'final' && isClosed(event, latest));
    if (closed || allEntries.length === 0) {
        return { allEntries, thresholdMet: allEntries.length > 0 && allEntries.length >= minParticipants, wroteFinal: false };
    }

    const original = new Map(
        allEntries.map((e) => [e._id, { raw_score: e.raw_score, normalized_score: e.normalized_score, final_score: e.final_score, rank: e.rank }])
    );

    if (reason === 'score_update' || reason === 'final') {
        const params = event?.scoring?.parameters ?? [];
        const { lower = 0, upper = 1000 } = event?.scoring?.normalization ?? {};
        // Raw from the CURRENT weights: an admin editing a weight mid-event must not leave half the
        // field scored under the old formula.
        for (const e of allEntries) e.raw_score = rawScore(e.raw ?? {}, params);

        // Min-max over entries that have actually been scored. An unscored registrant (raw 0) is not
        // a data point: counting it pinned the minimum at 0, and under penalty scoring (negative
        // weights) it became the maximum and took rank 1 without playing.
        const scored = allEntries.filter((e) => e.last_scored_at);
        let minRaw = Infinity;
        let maxRaw = -Infinity;
        for (const e of scored) {
            if (e.raw_score < minRaw) minRaw = e.raw_score;
            if (e.raw_score > maxRaw) maxRaw = e.raw_score;
        }
        for (const e of allEntries) {
            e.normalized_score = e.last_scored_at ? normalize(e.raw_score, minRaw, maxRaw, lower, upper) : 0;
        }
    }
    for (const e of allEntries) {
        e.final_score = Math.round(((e.normalized_score || 0) + (e.invested_points || 0)) * 100) / 100;
    }

    // Deterministic: active before eliminated, final_score DESC, participant.display_name ASC.
    allEntries.sort((a, b) => {
        const aElim = a.stats?.eliminated ? 1 : 0;
        const bElim = b.stats?.eliminated ? 1 : 0;
        if (aElim !== bElim) return aElim - bElim;
        if (b.final_score !== a.final_score) return b.final_score - a.final_score;
        return a.participant.display_name.localeCompare(b.participant.display_name);
    });

    const thresholdMet = allEntries.length >= minParticipants;
    for (let i = 0; i < allEntries.length; i++) {
        const e = allEntries[i];
        e.previous_rank = e.rank;
        // Below threshold, ranks keep their last computed value (leaderboard-model.md §7).
        e.rank = thresholdMet ? i + 1 : (e.previous_rank ?? null);
    }

    // Only entries whose numbers changed. `final_score` is derived in the update from the stored
    // `invested_points`, never written from this read: an investment landing while this ran keeps
    // its points. The driver's bulkWrite, because Mongoose refuses a pipeline update here.
    const ops = allEntries
        .filter((e) => {
            const o = original.get(e._id)!;
            return o.rank !== e.rank || o.raw_score !== e.raw_score || o.normalized_score !== e.normalized_score || o.final_score !== e.final_score;
        })
        .map((e) => ({
            updateOne: {
                filter: { _id: e._id },
                update: [
                    {
                        $set: {
                            raw_score: e.raw_score,
                            normalized_score: e.normalized_score,
                            final_score: { $round: [{ $add: [e.normalized_score, '$invested_points'] }, 2] },
                            rank: e.rank,
                            previous_rank: e.previous_rank,
                            updated_at: '$$NOW',
                        },
                    },
                ],
            },
        }));
    if (ops.length > 0) {
        await LeaderboardEntry.collection.bulkWrite(ops as unknown as Parameters<typeof LeaderboardEntry.collection.bulkWrite>[0]);
    }

    const everRanked = allEntries.some((e) => e.rank !== null);
    const belowThreshold = !thresholdMet && everRanked && reason !== 'final';
    await LeaderboardSnapshot.create({
        _id: uuid(),
        event_id: eventId,
        taken_at: new Date(),
        reason: belowThreshold ? 'freeze' : reason,
        frozen: reason === 'final' || reason === 'freeze' || belowThreshold,
        ranks: allEntries
            .filter((e) => e.rank !== null)
            .map((e) => ({ participant_id: e.participant.id, rank: e.rank!, final_score: e.final_score })),
    });

    // Announced once, on the transition, not on every recompute while it stays frozen.
    if (belowThreshold && !latest?.frozen) {
        publish('LeaderboardFrozen', 'leaderboard-service', { event_id: eventId, reason: 'below_threshold' });
    }

    // Batch-prune snapshots only past 25, keeping the newest 20.
    const snapshotCount = await LeaderboardSnapshot.countDocuments({ event_id: eventId });
    if (snapshotCount > 25) {
        const old = await LeaderboardSnapshot.find({ event_id: eventId }).sort({ taken_at: -1 }).skip(20).select('_id');
        if (old.length > 0) await LeaderboardSnapshot.deleteMany({ _id: { $in: old.map((s) => s._id) } });
    }

    await cacheEventLeaderboard(
        eventId,
        allEntries.map((e) => ({ participant_id: e.participant.id, final_score: e.final_score })),
        reason === 'final'
    );

    return { allEntries, thresholdMet, wroteFinal: reason === 'final' };
}

/**
 * The final podium for `LeaderboardFrozen`: places 1-3 of a board that met its threshold, a team
 * expanded to its member user ids (contract: points pays each member under their own key).
 */
export async function podiumOf(
    entries: ILeaderboardEntry[],
    thresholdMet: boolean
): Promise<{ place: number; participant: { type: string; id: string }; user_ids: string[] }[]> {
    if (!thresholdMet) return [];
    const top = entries
        .filter((e) => e.rank !== null && e.rank <= 3 && !e.stats?.eliminated)
        .sort((a, b) => a.rank! - b.rank!);
    const podium = [];
    for (const e of top) {
        let user_ids = [e.participant.id];
        if (e.participant.type === 'team') {
            const team = await Team.findById(e.participant.id).select('members.user_id').lean();
            user_ids = team?.members.map((m) => m.user_id) ?? [];
        }
        podium.push({ place: e.rank!, participant: { type: e.participant.type, id: e.participant.id }, user_ids });
    }
    return podium;
}

/**
 * Final recompute and `LeaderboardFrozen{podium}`. Published only by the call that wrote the final
 * snapshot — N instances receiving one EventCompleted must not announce it N times — unless the
 * replay sweep asks to re-announce on purpose (Points dedupes by key).
 */
export async function finalizeEvent(eventId: string, republish = false): Promise<boolean> {
    const { allEntries, thresholdMet, wroteFinal } = await recomputeEventRanks(eventId, 'final');
    if (!wroteFinal && !republish) return false;
    publish('LeaderboardFrozen', 'leaderboard-service', {
        event_id: eventId,
        reason: 'final',
        podium: await podiumOf(allEntries, thresholdMet),
    });
    return true;
}

/**
 * Freeze a cancelled event's board. Serialized with recomputes, so a recompute already queued cannot
 * write an unfrozen snapshot after this one.
 */
export function freezeCancelled(eventId: string): Promise<void> {
    return serialized(eventId, async () => {
        const entries = await LeaderboardEntry.find({ event_id: eventId }).select('participant rank final_score').lean();
        await LeaderboardSnapshot.create({
            _id: uuid(),
            event_id: eventId,
            taken_at: new Date(),
            reason: 'freeze',
            frozen: true,
            ranks: entries
                .filter((e) => e.rank !== null)
                .map((e) => ({ participant_id: e.participant.id, rank: e.rank!, final_score: e.final_score })),
        });
        await evictEventLeaderboard(eventId);
    });
}

/* ------------------------------------------------------------------ *
 * Unsettled investments
 * ------------------------------------------------------------------ */

const pullPending = (entryId: string, requestId: string) =>
    LeaderboardEntry.updateOne({ _id: entryId }, { $pull: { pending_requests: { request_id: requestId } } });

/**
 * Refund a request that will never be applied, then forget it. Marked `refund` first, so the
 * investing call's own `$inc` (which requires `apply`) can no longer land it after the money is back.
 * If Points cannot confirm, the request stays pending and the sweep asks again.
 */
export async function settleByRefund(entryId: string, requestId: string, userId: string): Promise<boolean> {
    const marked = await LeaderboardEntry.updateOne(
        { _id: entryId, 'pending_requests.request_id': requestId },
        { $set: { 'pending_requests.$.settle': 'refund' } }
    );
    // No longer pending: the investing call's `$inc` applied it (the points are on the entry), or
    // another settle already gave it back. Refunding now would pay the user twice.
    if (!marked.matchedCount) return true;
    const outcome = await refundPoints(userId, entryId, requestId);
    if (outcome === 'unknown') return false;
    await pullPending(entryId, requestId);
    return true;
}

/**
 * The repair half of the two-step investment (debit, then `$inc`): any request still pending after
 * `olderThanMs` never reached its `$inc` — a crash, a timeout, an unknown debit — so whatever it took
 * is given back.
 */
export async function settlePendingInvestments(olderThanMs = 60_000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const entries = await LeaderboardEntry.find({ 'pending_requests.at': { $lt: cutoff } })
        .select('pending_requests')
        .limit(100)
        .lean();
    let settled = 0;
    for (const entry of entries) {
        for (const p of entry.pending_requests.filter((r) => r.at < cutoff)) {
            if (await settleByRefund(entry._id, p.request_id, p.user_id)) settled++;
        }
    }
    return settled;
}

/* ------------------------------------------------------------------ *
 * Global leaderboard
 * ------------------------------------------------------------------ */

/** Names for the board; a deleted account reads as deleted, never its old name. */
async function displayUsers(ids: string[]) {
    const users = await User.find({ _id: { $in: ids } })
        .select('_id username deleted_at profile.full_name profile.avatar_url')
        .lean();
    return new Map(
        users.map((u) => [
            u._id,
            u.deleted_at
                ? { username: undefined, profile: { full_name: DELETED_DISPLAY_NAME, avatar_url: null } }
                : u,
        ])
    );
}

/**
 * Global leaderboard: points earned, net of reversals. A participation credit taken back when its
 * event was cancelled is a negative `adjust` that is not an admin's manual one; counting only
 * `earn` kept a cancelled event's points on the board forever.
 */
export async function getGlobalLeaderboard(query: QueryGlobalLeaderboardInput) {
    const { period, domain, source, limit, page } = query;
    const skip = (page - 1) * limit;

    // Redis ZSET cache first; Mongo is truth.
    const cached = await getCachedGlobalLeaderboard(period, domain, source ?? 'all', skip, limit);
    if (cached) {
        const userIds = cached.rows.map((p) => p.user_id);
        const userMap = await displayUsers(userIds);

        const standings = cached.rows.map((item, index) => {
            const u = userMap.get(item.user_id);
            return {
                rank: skip + index + 1,
                user_id: item.user_id,
                display_name: u?.profile?.full_name || u?.username || 'Unknown',
                username: u?.username,
                avatar_url: u?.profile?.avatar_url || null,
                points: item.total_points,
            };
        });

        return {
            period,
            domain,
            source: source ?? 'all',
            page,
            limit,
            total: cached.total,
            total_pages: Math.ceil(cached.total / limit) || 1,
            standings,
        };
    }

    let boundaryDate: Date | null = null;
    const now = Date.now();
    if (period === 'semester') {
        boundaryDate = new Date(now - 120 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
        boundaryDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    } else if (period === 'week') {
        boundaryDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    // $and, never a spread: two of these carry a top-level $or.
    const conditions: Record<string, unknown>[] = [
        { $or: [{ type: 'earn' }, { type: 'adjust', amount: { $lt: 0 }, reason: { $ne: 'admin.manual' } }] },
    ];
    if (boundaryDate) conditions.push({ created_at: { $gte: boundaryDate } });
    if (source && source !== 'all') conditions.push({ source });

    if (domain !== 'all') {
        const challengeDomain =
            domain === 'sports' || domain === 'esports' || domain === 'general' ? domain : null;
        const [eventIds, challengeIds] = await Promise.all([
            Event.find({ domain }).distinct('_id'),
            challengeDomain
                ? Challenge.find({ domain: challengeDomain }).distinct('_id')
                : Promise.resolve([]),
        ]);
        conditions.push({
            $or: [
                { 'reference.type': 'event', 'reference.id': { $in: eventIds } },
                { 'reference.type': 'challenge', 'reference.id': { $in: challengeIds } },
            ],
        });
    }

    const pipeline = [
        { $match: { $and: conditions } },
        { $group: { _id: '$user_id', total_points: { $sum: '$amount' } } },
        { $match: { total_points: { $gt: 0 } } },
        // Ties by user id DESCENDING — the order ZREVRANGE returns equal scores in, so a page reads
        // the same from the cache and from Mongo.
        { $sort: { total_points: -1, _id: -1 } as Record<string, 1 | -1> },
    ];

    const aggregateResult = (await PointTransaction.aggregate(pipeline)) as {
        _id: string;
        total_points: number;
    }[];

    const total = aggregateResult.length;
    const paged = aggregateResult.slice(skip, skip + limit);

    const userIds = paged.map((p) => p._id);
    const userMap = await displayUsers(userIds);

    const standings = paged.map((item, index) => {
        const u = userMap.get(item._id);
        return {
            rank: skip + index + 1,
            user_id: item._id,
            display_name: u?.profile?.full_name || u?.username || 'Unknown',
            username: u?.username,
            avatar_url: u?.profile?.avatar_url || null,
            points: item.total_points,
        };
    });

    // Populate Redis cache asynchronously
    void cacheGlobalLeaderboard(
        period,
        domain,
        source ?? 'all',
        aggregateResult.map((r) => ({ user_id: r._id, total_points: r.total_points }))
    );

    return {
        period,
        domain,
        source: source ?? 'all',
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
        standings,
    };
}


/* ------------------------------------------------------------------ *
 * Event reads
 * ------------------------------------------------------------------ */

/**
 * What a public read shows of an entry. Never `registration_id`, `scored_by`, the version or the
 * investment bookkeeping — those were being served raw to anonymous callers.
 */
const PUBLIC_ENTRY_FIELDS = [
    '_id',
    'event_id',
    'participant',
    'raw',
    'raw_score',
    'normalized_score',
    'invested_points',
    'final_score',
    'stats',
    'rank',
    'previous_rank',
    'last_scored_at',
] as const;
const PUBLIC_ENTRY_SELECT = PUBLIC_ENTRY_FIELDS.join(' ');

export type PublicEntry = Pick<ILeaderboardEntry, (typeof PUBLIC_ENTRY_FIELDS)[number]>;

export function publicEntry(e: ILeaderboardEntry | Record<string, unknown>): PublicEntry {
    const doc = (typeof (e as ILeaderboardEntry).toObject === 'function' ? (e as ILeaderboardEntry).toObject() : e) as Record<string, unknown>;
    return Object.fromEntries(PUBLIC_ENTRY_FIELDS.map((k) => [k, doc[k]])) as PublicEntry;
}

/**
 * An event as the public sees it: by id or slug, never deleted, never a draft. A draft's board is
 * not public, and answering for it confirmed the draft exists.
 */
async function publicEvent(ref: string, select?: string): Promise<IEvent> {
    const query = Event.findOne({ $or: [{ _id: ref }, { slug: ref }], deleted_at: null, status: { $ne: 'draft' } });
    const event = await (select ? query.select(select) : query);
    if (!event) throw new ServiceError(404, 'event_not_found');
    if (event.type === 'DE' || !event.leaderboard) throw new ServiceError(400, 'no_leaderboard_for_event');
    return event;
}

export async function getEventLeaderboard(ref: string, query: QueryEventLeaderboardInput) {
    const event = await publicEvent(ref, '_id title slug type leaderboard');

    const filter: Record<string, unknown> = { event_id: event._id };
    const search = query.search?.trim();
    if (search) {
        // A literal substring, never a pattern: `(` was a 500 and `(a+)+$` a backtracking bomb.
        filter['participant.display_name'] = { $regex: escapeRegex(search), $options: 'i' };
    }

    const totalCount = await LeaderboardEntry.countDocuments(filter);
    const totalEventEntries = search ? await LeaderboardEntry.countDocuments({ event_id: event._id }) : totalCount;
    const thresholdMet = totalEventEntries >= event.leaderboard!.min_participants;

    const skip = (query.page - 1) * query.limit;
    const entries = await LeaderboardEntry.find(filter)
        .select(PUBLIC_ENTRY_SELECT)
        .sort(
            thresholdMet
                ? { rank: 1, 'participant.display_name': 1 }
                : { final_score: -1, 'participant.display_name': 1 }
        )
        .skip(skip)
        .limit(query.limit)
        .lean();

    return {
        event_id: event._id,
        event_title: event.title,
        format: event.leaderboard!.format,
        min_participants: event.leaderboard!.min_participants,
        threshold_met: thresholdMet,
        page: query.page,
        limit: query.limit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / query.limit) || 1,
        standings: entries,
    };
}

/**
 * Top 3 Podium
 */
export async function getPodium(ref: string) {
    const event = await publicEvent(ref, '_id type leaderboard');

    const totalEventEntries = await LeaderboardEntry.countDocuments({ event_id: event._id });
    const thresholdMet = totalEventEntries >= event.leaderboard!.min_participants;

    const entries = await LeaderboardEntry.find({ event_id: event._id, rank: { $in: [1, 2, 3] } })
        .select(PUBLIC_ENTRY_SELECT)
        .sort({ rank: 1 })
        .lean();

    return {
        event_id: event._id,
        threshold_met: thresholdMet,
        podium: entries,
    };
}

/** The entry the actor plays in: their team's on a teamed event, their own otherwise. */
async function ownEntry(event: IEvent, actorId: string): Promise<ILeaderboardEntry | null> {
    if (event.teaming?.is_teamed) {
        const team = await Team.findOne({
            'owner.type': 'event',
            'owner.id': event._id,
            'members.user_id': actorId,
            status: { $ne: 'disbanded' },
        });
        return team ? LeaderboardEntry.findOne({ event_id: event._id, 'participant.id': team._id }) : null;
    }
    return LeaderboardEntry.findOne({ event_id: event._id, 'participant.id': actorId });
}

/**
 * Participant's own entry (user or team)
 */
export async function getMyEntry(ref: string, actorId: string): Promise<PublicEntry> {
    const event = await publicEvent(ref);
    const entry = await ownEntry(event, actorId);
    if (!entry) throw new ServiceError(404, 'entry_not_found');
    return publicEntry(entry);
}

/* ------------------------------------------------------------------ *
 * Score entry
 * ------------------------------------------------------------------ */

/**
 * An entry for a participant the consumers have not built yet (a missed bus message), but only
 * for someone actually in the event: a confirmed registration (solo) or a locked team of this
 * event. Anyone else is refused — scoring used to mint entries for any user or any team.
 * Returned unsaved; the caller saves once every participant has resolved.
 */
async function entryFromRegistration(event: IEvent, participantId: string): Promise<ILeaderboardEntry | null> {
    if (event.teaming?.is_teamed) {
        const team = await Team.findOne({
            _id: participantId,
            'owner.type': 'event',
            'owner.id': event._id,
            status: 'locked',
        });
        if (!team) return null;
        return new LeaderboardEntry({
            _id: uuid(),
            event_id: event._id,
            participant: { type: 'team', id: team._id, display_name: team.name, avatar_url: team.logo_url || null },
            registration_id: null,
        });
    }
    const registration = await FormSubmission.findOne({
        'owner.type': 'event',
        'owner.id': event._id,
        'user.user_id': participantId,
        status: 'confirmed',
    }).select('_id');
    if (!registration) return null;
    const user = await User.findOne({ _id: participantId, deleted_at: null });
    if (!user) return null;
    return new LeaderboardEntry({
        _id: uuid(),
        event_id: event._id,
        participant: {
            type: 'user',
            id: user._id,
            display_name: user.profile?.full_name || user.username,
            avatar_url: user.profile?.avatar_url || null,
        },
        registration_id: registration._id,
    });
}

/**
 * Score entry. Only an admin of THIS event: being core somewhere used to be enough
 * to score, and so rank, any event on the platform. `actor` is the live user document's id and role.
 */
export async function submitScores(ref: string, actor: Actor, input: SubmitScoresInput) {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }], deleted_at: null });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (!isEventAdmin(event, { id: actor.id, role: actor.role ?? '' })) {
        throw event.status === 'draft' ? new ServiceError(404, 'event_not_found') : new ServiceError(403, 'forbidden');
    }
    if (event.type === 'DE' || !event.leaderboard || !event.scoring) {
        throw new ServiceError(400, 'no_leaderboard_for_event');
    }
    if (event.status === 'cancelled') {
        throw new ServiceError(400, 'event_cancelled');
    }
    if (event.status === 'draft') {
        throw new ServiceError(400, 'event_in_draft');
    }

    const latest = await latestSnapshot(event._id);
    if (isClosed(event, latest)) {
        throw new ServiceError(409, 'leaderboard_final');
    }
    if (latest?.frozen) {
        throw new ServiceError(400, 'leaderboard_frozen');
    }

    const paramMap = new Map(event.scoring.parameters.map((p) => [p.key, p]));

    for (const scoreItem of input.scores) {
        for (const [key, val] of Object.entries(scoreItem.raw)) {
            const param = paramMap.get(key);
            if (!param) {
                throw new ServiceError(400, 'invalid_scoring_parameter', { key });
            }
            if (param.kind === 'int' && (!Number.isInteger(val) || typeof val !== 'number')) {
                throw new ServiceError(400, 'invalid_parameter_type', { key, expected: 'int' });
            }
            if (param.kind === 'float' && typeof val !== 'number') {
                throw new ServiceError(400, 'invalid_parameter_type', { key, expected: 'float' });
            }
            if (param.kind === 'bool' && typeof val !== 'boolean') {
                throw new ServiceError(400, 'invalid_parameter_type', { key, expected: 'bool' });
            }
        }
    }

    // Resolve every participant before writing anything: a bad id halfway through used to leave the
    // earlier entries rescored with nothing recomputed. A repeated id keeps its last score.
    const planned = new Map<string, { entry: ILeaderboardEntry; raw: Record<string, number | boolean> }>();
    for (const scoreItem of input.scores) {
        const existing = planned.get(scoreItem.participant_id)?.entry;
        const entry =
            existing ??
            (await LeaderboardEntry.findOne({ event_id: event._id, 'participant.id': scoreItem.participant_id })) ??
            (await entryFromRegistration(event, scoreItem.participant_id));
        if (!entry) {
            throw new ServiceError(404, 'participant_not_found', { participant_id: scoreItem.participant_id });
        }
        planned.set(scoreItem.participant_id, { entry, raw: scoreItem.raw });
    }

    for (const { entry, raw } of planned.values()) {
        entry.raw = raw;
        entry.raw_score = rawScore(raw, event.scoring.parameters);
        entry.last_scored_at = new Date();
        entry.scored_by = actor.id;
        await entry.save();
    }

    const { thresholdMet } = await recomputeEventRanks(event._id, 'score_update');

    publish('LeaderboardUpdated', 'leaderboard-service', {
        event_id: event._id,
        reason: 'score_update',
        changed_participant_ids: [...planned.keys()],
    });

    return { count: planned.size, threshold_met: thresholdMet };
}

/* ------------------------------------------------------------------ *
 * Investment
 * ------------------------------------------------------------------ */

/** Test seam: runs between the debit and the `$inc` — the window a final freeze can land in. */
export const investHooks: { afterDebit: () => Promise<void> } = { afterDebit: async () => undefined };

const replayOf = (entry: ILeaderboardEntry) => ({
    entry: publicEntry(entry),
    previous_rank: entry.previous_rank,
    new_rank: entry.rank,
    replayed: true,
});

/**
 * Points investment by a confirmed participant (leaderboard-model.md §6).
 *
 * Two steps across two services, so each is recorded before the next:
 *   1. the request goes on the entry as `pending` — a crash from here on is found by the sweep;
 *   2. the debit, keyed on (user, entry, request_id) so a client retry is the same debit;
 *   3. one conditional update that applies it: `$inc`, cap in the filter, `pending` -> `applied`.
 * A request that does not reach 3 is refunded (now if the debit's outcome is known, by the sweep if
 * not). A request applied after the board closed is undone and refunded. Nothing is ever refunded
 * on the assumption that "nothing was taken" — only on Points' final answer.
 *
 * `requestId` is the client's idempotency key (body `request_id` or `Idempotency-Key`); absent, one
 * is generated for this request only.
 */
export async function investPoints(ref: string, actor: Actor, amount: number, requestId: string = uuid()) {
    const event = await publicEvent(ref);
    if (event.status !== 'ongoing') {
        throw new ServiceError(400, 'event_not_ongoing');
    }
    if (!event.points_pool?.investment_enabled) {
        throw new ServiceError(400, 'investment_disabled');
    }
    if (amount < 10) {
        throw new ServiceError(400, 'minimum_investment_not_met', {
            message: 'minimum investment is 10 points',
        });
    }

    const entry = await ownEntry(event, actor.id);
    if (!entry) {
        throw new ServiceError(403, 'not_a_participant');
    }
    if (entry.applied_requests?.includes(requestId)) return replayOf(entry);
    // A cancelled registration mid-event leaves an eliminated entry behind; points spent on it buy
    // nothing.
    if (entry.stats?.eliminated) {
        throw new ServiceError(409, 'entry_eliminated');
    }

    const latest = await latestSnapshot(event._id);
    if (isClosed(event, latest) || latest?.frozen) {
        throw new ServiceError(400, 'leaderboard_frozen');
    }

    const cap = event.points_pool.investment_cap;
    const capped = cap !== null && cap !== undefined;
    if (capped && entry.invested_points + amount > cap) {
        throw new ServiceError(400, 'investment_cap_exceeded');
    }

    await checkInvestmentRateLimit(actor.id, event._id);

    // 1. Pending, once per request id.
    const marked = await LeaderboardEntry.updateOne(
        { _id: entry._id, 'pending_requests.request_id': { $ne: requestId }, applied_requests: { $ne: requestId } },
        { $push: { pending_requests: { request_id: requestId, user_id: actor.id, amount, at: new Date(), settle: 'apply' } } }
    );
    if (!marked.modifiedCount) {
        const now = await LeaderboardEntry.findById(entry._id);
        if (now?.applied_requests.includes(requestId)) return replayOf(now);
        throw new ServiceError(409, 'investment_in_flight');
    }

    // 2. Debit.
    try {
        await debitPoints(actor.id, amount, entry._id, requestId);
    } catch (err) {
        // Unknown: the request stays pending and the sweep settles it on Points' final answer.
        if (err instanceof PointsOutcomeUnknown) throw new ServiceError(503, 'investment_pending', { request_id: requestId });
        await pullPending(entry._id, requestId); // refused: nothing was taken
        throw err;
    }

    await investHooks.afterDebit();

    // 3. Apply: only if still pending as `apply`, not eliminated, and under the cap.
    const updated = await LeaderboardEntry.findOneAndUpdate(
        {
            _id: entry._id,
            'stats.eliminated': { $ne: true },
            pending_requests: { $elemMatch: { request_id: requestId, settle: 'apply' } },
            ...(capped ? { invested_points: { $lte: cap - amount } } : {}),
        },
        {
            $inc: { invested_points: amount, version: 1 },
            $pull: { pending_requests: { request_id: requestId } },
            $push: { applied_requests: requestId },
        },
        { returnDocument: 'after' }
    );
    if (!updated) {
        await settleByRefund(entry._id, requestId, actor.id);
        const now = await LeaderboardEntry.findById(entry._id).select('stats');
        throw now?.stats?.eliminated
            ? new ServiceError(409, 'entry_eliminated')
            : new ServiceError(400, 'investment_cap_exceeded');
    }

    // The board may have closed (final, freeze, cancel) while this was in flight: an investment
    // counted after the final is undone and refunded, not left to buy a rank nobody can see.
    const [nowEvent, nowLatest] = await Promise.all([Event.findById(event._id).select('status'), latestSnapshot(event._id)]);
    if (isClosed(nowEvent, nowLatest) || nowLatest?.frozen) {
        const undone = await LeaderboardEntry.updateOne(
            { _id: entry._id, applied_requests: requestId },
            {
                $inc: { invested_points: -amount, version: 1 },
                $pull: { applied_requests: requestId },
                $push: { pending_requests: { request_id: requestId, user_id: actor.id, amount, at: new Date(), settle: 'refund' } },
            }
        );
        if (undone.modifiedCount) await settleByRefund(entry._id, requestId, actor.id);
        throw new ServiceError(400, 'leaderboard_frozen');
    }

    const priorRank = entry.rank;
    let refreshed: ILeaderboardEntry | undefined;
    try {
        const { allEntries } = await recomputeEventRanks(event._id, 'investment');
        refreshed = allEntries.find((e) => e._id === updated._id);
    } catch (err) {
        // The points moved and the entry holds them; the next recompute places it.
        console.error(`[leaderboard-service] recompute after investment on ${event._id} failed:`, err);
    }
    const newRank = refreshed?.rank ?? updated.rank ?? null;

    publish('LeaderboardInvestmentMade', 'leaderboard-service', {
        event_id: event._id,
        user_id: actor.id,
        amount,
        previous_rank: priorRank,
        new_rank: newRank,
    });

    return {
        entry: publicEntry(refreshed ?? updated),
        previous_rank: priorRank,
        new_rank: newRank,
        replayed: false,
    };
}

/**
 * Advisory Rank Projection (Read-only math)
 */
export async function projectInvestment(ref: string, actor: Actor, amount: number) {
    const event = await publicEvent(ref);
    const entry = await ownEntry(event, actor.id);
    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    const allEntries = await LeaderboardEntry.find({ event_id: event._id }).select('_id participant final_score');
    const projectedFinalScore =
        Math.round((entry.normalized_score + entry.invested_points + amount) * 100) / 100;

    const simulated = allEntries.map((e) => ({
        id: e.participant.id,
        name: e.participant.display_name,
        final_score: String(e._id) === String(entry._id) ? projectedFinalScore : e.final_score,
    }));

    simulated.sort((a, b) => {
        if (b.final_score !== a.final_score) {
            return b.final_score - a.final_score;
        }
        return a.name.localeCompare(b.name);
    });

    const index = simulated.findIndex((s) => s.id === entry.participant.id);
    const thresholdMet = allEntries.length >= event.leaderboard!.min_participants;
    const projectedRank = thresholdMet ? index + 1 : null;

    return {
        current_score: entry.final_score,
        projected_score: projectedFinalScore,
        current_rank: entry.rank,
        projected_rank: projectedRank,
        amount,
    };
}

/**
 * Event Snapshots (Recent 20)
 */
export async function getSnapshots(ref: string) {
    const event = await publicEvent(ref, '_id type leaderboard');
    return LeaderboardSnapshot.find({ event_id: event._id })
        .select('_id event_id taken_at reason frozen ranks')
        .sort({ taken_at: -1 })
        .limit(20)
        .lean();
}
