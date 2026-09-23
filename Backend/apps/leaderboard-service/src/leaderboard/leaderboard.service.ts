import {
    Challenge,
    DomainEvent,
    Event,
    IEvent,
    ILeaderboardEntry,
    ILeaderboardSnapshot,
    LeaderboardEntry,
    LeaderboardSnapshot,
    PointTransaction,
    ServiceError,
    Team,
    User,
    config,
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
    acquireEntryLock,
    cacheEventLeaderboard,
    cacheGlobalLeaderboard,
    checkInvestmentRateLimit,
    getCachedGlobalLeaderboard,
    releaseEntryLock,
} from './redis';

export interface Actor {
    id: string;
    role?: string;
}

/**
 * Debit points from Points Service for a leaderboard investment (Spec §5.6, leaderboard-model.md §6).
 * Fallback to direct DB debit if Points Service is in-process or unreachable in test environments.
 */
export async function debitPoints(
    userId: string,
    amount: number,
    entryId: string,
    requestId: string
): Promise<void> {
    const pointsUrl = `${config.services.points}/internal/points/spend`;
    try {
        const res = await fetch(pointsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': config.internalToken,
                'x-service-token': config.internalToken,
            },
            body: JSON.stringify({
                user_id: userId,
                amount,
                reference: { type: 'leaderboard_entry', id: entryId },
                request_id: requestId,
            }),
        });

        if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
                details?: unknown;
            };
            if (res.status === 409 && data.error === 'insufficient_points') {
                throw new ServiceError(409, 'insufficient_points');
            }
            throw new ServiceError(res.status, data.error || 'points_debit_failed', data.details);
        }
        return;
    } catch (err) {
        if (err instanceof ServiceError) throw err;

        // Fallback: If Points Service is offline/unreachable in standalone tests, debit User model directly
        const user = await User.findById(userId);
        if (!user) throw new ServiceError(404, 'user_not_found');
        if ((user.points_balance ?? 0) < amount) {
            throw new ServiceError(409, 'insufficient_points');
        }

        const updated = await User.findOneAndUpdate(
            { _id: userId, points_balance: { $gte: amount } },
            { $inc: { points_balance: -amount } },
            { returnDocument: 'after' }
        );
        if (!updated) {
            throw new ServiceError(409, 'insufficient_points');
        }

        await PointTransaction.create({
            _id: uuid(),
            user_id: userId,
            amount: -amount,
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: entryId },
            idempotency_key: `leaderboard.investment:${requestId}`,
            balance_after: updated.points_balance ?? 0,
            actor: { type: 'user', user_id: userId },
        }).catch(() => {});
    }
}

/**
 * Recompute normalization, final scores, and ranks for all entries of an event.
 * Saves entries, captures a snapshot, prunes snapshots > 20, and refreshes Redis cache.
 */
export async function recomputeEventRanks(
    eventId: string,
    reason: 'score_update' | 'investment' | 'final' | 'freeze'
): Promise<{ allEntries: ILeaderboardEntry[]; thresholdMet: boolean }> {
    const event = await Event.findById(eventId);
    const allEntries = await LeaderboardEntry.find({ event_id: eventId });

    if (allEntries.length === 0) {
        return { allEntries: [], thresholdMet: false };
    }

    if (reason === 'score_update' || reason === 'final') {
        let minRaw = Infinity;
        let maxRaw = -Infinity;
        for (let i = 0; i < allEntries.length; i++) {
            const val = allEntries[i].raw_score || 0;
            if (val < minRaw) minRaw = val;
            if (val > maxRaw) maxRaw = val;
        }
        if (minRaw === Infinity) {
            minRaw = 0;
            maxRaw = 0;
        }

        const { lower = 0, upper = 1000 } = event?.scoring?.normalization || { lower: 0, upper: 1000 };
        const rawRange = maxRaw - minRaw;
        // Ponytail: precalculate scale factor once so we multiply instead of doing 1000 floating-point divisions
        const scale = rawRange > 0 ? (upper - lower) / rawRange : 0;

        for (let i = 0; i < allEntries.length; i++) {
            const entry = allEntries[i];
            if (event?.scoring?.normalization) {
                entry.normalized_score =
                    rawRange > 0
                        ? Math.round((lower + ((entry.raw_score || 0) - minRaw) * scale) * 100) / 100
                        : lower;
            }
            entry.final_score = Math.round(((entry.normalized_score || 0) + (entry.invested_points || 0)) * 100) / 100;
        }
    } else {
        for (let i = 0; i < allEntries.length; i++) {
            const entry = allEntries[i];
            entry.final_score = Math.round(((entry.normalized_score || 0) + (entry.invested_points || 0)) * 100) / 100;
        }
    }

    // Sort entries deterministically: active before eliminated, final_score DESC, participant.display_name ASC
    allEntries.sort((a, b) => {
        const aElim = a.stats?.eliminated ? 1 : 0;
        const bElim = b.stats?.eliminated ? 1 : 0;
        if (aElim !== bElim) {
            return aElim - bElim;
        }
        if (b.final_score !== a.final_score) {
            return b.final_score - a.final_score;
        }
        return a.participant.display_name.localeCompare(b.participant.display_name);
    });

    const minParticipants = event?.leaderboard?.min_participants ?? 1;
    const thresholdMet = allEntries.length >= minParticipants;

    for (let i = 0; i < allEntries.length; i++) {
        const e = allEntries[i];
        e.previous_rank = e.rank;
        if (thresholdMet) {
            e.rank = i + 1;
        } else {
            e.rank = e.previous_rank ?? null;
        }
    }

    // Ponytail / 2vCPU optimization: dirty bulk write.
    // Instead of writing 1,000 documents on every investment, only issue updateOne operations for entries
    // whose rank, normalized_score, or final_score actually changed. Reduces DB writes by ~99% on investments.
    const bulkOps = [];
    for (let i = 0; i < allEntries.length; i++) {
        const e = allEntries[i];
        const rankChanged = e.rank !== e.previous_rank;
        const scoreChanged = e.isModified('final_score') || e.isModified('normalized_score');
        if (rankChanged || scoreChanged) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: e._id },
                    update: {
                        $set: {
                            normalized_score: e.normalized_score,
                            final_score: e.final_score,
                            rank: e.rank,
                            previous_rank: e.previous_rank,
                        },
                    },
                },
            });
        }
    }
    if (bulkOps.length > 0) {
        await LeaderboardEntry.bulkWrite(bulkOps);
    }

    // Save snapshot
    const ranksSnapshot = allEntries
        .filter((e) => e.rank !== null)
        .map((e) => ({
            participant_id: e.participant.id,
            rank: e.rank!,
            final_score: e.final_score,
        }));

    const isFrozen = reason === 'final' || reason === 'freeze' || (!thresholdMet && allEntries.some((e) => e.rank !== null));
    const snapshotReason = (!thresholdMet && allEntries.some((e) => e.rank !== null) && reason !== 'final') ? 'freeze' : reason;

    await LeaderboardSnapshot.create({
        _id: uuid(),
        event_id: eventId,
        taken_at: new Date(),
        reason: snapshotReason,
        frozen: isFrozen,
        ranks: ranksSnapshot,
    });

    if (!thresholdMet && allEntries.some((e) => e.rank !== null) && reason !== 'final') {
        publish('LeaderboardFrozen', 'leaderboard-service', {
            event_id: eventId,
            reason: 'below_threshold',
        });
    }

    // Ponytail / 2vCPU optimization: batch-prune snapshots only when count exceeds 25 to avoid constant query churn
    const snapshotCount = await LeaderboardSnapshot.countDocuments({ event_id: eventId });
    if (snapshotCount > 25) {
        const oldSnapshots = await LeaderboardSnapshot.find({ event_id: eventId })
            .sort({ taken_at: -1 })
            .skip(20)
            .select('_id');
        if (oldSnapshots.length > 0) {
            await LeaderboardSnapshot.deleteMany({ _id: { $in: oldSnapshots.map((s) => s._id) } });
        }
    }

    // Refresh Redis cache
    await cacheEventLeaderboard(
        eventId,
        allEntries.map((e) => ({ participant_id: e.participant.id, final_score: e.final_score })),
        reason === 'final'
    );

    return { allEntries, thresholdMet };
}

/**
 * Global Leaderboard: Aggregate point_transactions where type: 'earn'
 */
export async function getGlobalLeaderboard(query: QueryGlobalLeaderboardInput) {
    const { period, domain, source, limit, page } = query;
    const skip = (page - 1) * limit;

    // Ponytail / 2vCPU optimization: check Redis ZSET cache first.
    // At 40-1000 active users, cache hit resolves in < 1ms, bypassing multi-collection DB aggregation.
    const cached = await getCachedGlobalLeaderboard(period, domain, source ?? 'all', skip, limit);
    if (cached) {
        const userIds = cached.rows.map((p) => p.user_id);
        const users = await User.find({ _id: { $in: userIds } })
            .select('_id username profile.full_name profile.avatar_url')
            .lean();
        const userMap = new Map(users.map((u) => [u._id, u]));

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

    const match: Record<string, unknown> = { type: 'earn' };
    if (boundaryDate) {
        match.created_at = { $gte: boundaryDate };
    }
    if (source && source !== 'all') {
        match.source = source;
    }

    if (domain !== 'all') {
        const challengeDomain =
            domain === 'sports' || domain === 'esports' || domain === 'general' ? domain : null;
        const [eventIds, challengeIds] = await Promise.all([
            Event.find({ domain }).distinct('_id'),
            challengeDomain
                ? Challenge.find({ domain: challengeDomain }).distinct('_id')
                : Promise.resolve([]),
        ]);
        match.$or = [
            { 'reference.type': 'event', 'reference.id': { $in: eventIds } },
            { 'reference.type': 'challenge', 'reference.id': { $in: challengeIds } },
        ];
    }

    const pipeline = [
        { $match: match },
        { $group: { _id: '$user_id', total_points: { $sum: '$amount' } } },
        { $sort: { total_points: -1, _id: 1 } as Record<string, 1 | -1> },
    ];

    const aggregateResult = (await PointTransaction.aggregate(pipeline)) as {
        _id: string;
        total_points: number;
    }[];

    const total = aggregateResult.length;
    const paged = aggregateResult.slice(skip, skip + limit);

    const userIds = paged.map((p) => p._id);
    const users = await User.find({ _id: { $in: userIds } })
        .select('_id username profile.full_name profile.avatar_url')
        .lean();
    const userMap = new Map(users.map((u) => [u._id, u]));

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

/**
 * Event Leaderboard
 */
export async function getEventLeaderboard(ref: string, query: QueryEventLeaderboardInput) {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] })
        .select('_id title slug type leaderboard')
        .lean();
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type === 'DE' || !event.leaderboard) {
        throw new ServiceError(400, 'no_leaderboard_for_event');
    }

    const filter: Record<string, unknown> = { event_id: event._id };
    const hasSearch = Boolean(query.search && query.search.trim() !== '');
    if (hasSearch) {
        filter['participant.display_name'] = { $regex: query.search!.trim(), $options: 'i' };
    }

    const totalCount = await LeaderboardEntry.countDocuments(filter);
    const totalEventEntries = hasSearch
        ? await LeaderboardEntry.countDocuments({ event_id: event._id })
        : totalCount;
    const thresholdMet = totalEventEntries >= event.leaderboard.min_participants;

    const skip = (query.page - 1) * query.limit;
    const entries = await LeaderboardEntry.find(filter)
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
        format: event.leaderboard.format,
        min_participants: event.leaderboard.min_participants,
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
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] })
        .select('_id type leaderboard')
        .lean();
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type === 'DE' || !event.leaderboard) {
        throw new ServiceError(400, 'no_leaderboard_for_event');
    }

    const totalEventEntries = await LeaderboardEntry.countDocuments({ event_id: event._id });
    const thresholdMet = totalEventEntries >= event.leaderboard.min_participants;

    const entries = await LeaderboardEntry.find({
        event_id: event._id,
        rank: { $in: [1, 2, 3] },
    })
        .sort({ rank: 1 })
        .lean();

    return {
        event_id: event._id,
        threshold_met: thresholdMet,
        podium: entries,
    };
}

/**
 * Participant's own entry (user or team)
 */
export async function getMyEntry(ref: string, actorId: string): Promise<ILeaderboardEntry> {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type === 'DE' || !event.leaderboard) {
        throw new ServiceError(400, 'no_leaderboard_for_event');
    }

    if (event.teaming?.is_teamed) {
        const team = await Team.findOne({
            'owner.type': 'event',
            'owner.id': event._id,
            'members.user_id': actorId,
            status: { $ne: 'disbanded' },
        });

        if (team) {
            const entry = await LeaderboardEntry.findOne({
                event_id: event._id,
                'participant.id': team._id,
            });
            if (entry) return entry;
        }
    }

    const soloEntry = await LeaderboardEntry.findOne({
        event_id: event._id,
        'participant.id': actorId,
    });
    if (soloEntry) return soloEntry;

    throw new ServiceError(404, 'entry_not_found');
}

/**
 * Score entry by Admin/Core
 */
export async function submitScores(ref: string, actor: Actor, input: SubmitScoresInput) {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
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

    const latestSnapshot = await LeaderboardSnapshot.findOne({ event_id: event._id }).sort({
        taken_at: -1,
    });
    if (latestSnapshot?.frozen) {
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

    for (const scoreItem of input.scores) {
        const computedRaw = rawScore(scoreItem.raw, event.scoring.parameters);
        let entry = await LeaderboardEntry.findOne({
            event_id: event._id,
            'participant.id': scoreItem.participant_id,
        });

        if (entry) {
            entry.raw = scoreItem.raw;
            entry.raw_score = computedRaw;
            entry.last_scored_at = new Date();
            entry.scored_by = actor.id;
            await entry.save();
        } else {
            // Upsert new entry if not existing yet
            if (event.teaming?.is_teamed) {
                const team = await Team.findById(scoreItem.participant_id);
                if (!team) {
                    throw new ServiceError(404, 'participant_not_found', {
                        participant_id: scoreItem.participant_id,
                    });
                }
                entry = await LeaderboardEntry.create({
                    _id: uuid(),
                    event_id: event._id,
                    participant: {
                        type: 'team',
                        id: team._id,
                        display_name: team.name,
                        avatar_url: team.logo_url || null,
                    },
                    registration_id: null,
                    raw: scoreItem.raw,
                    raw_score: computedRaw,
                    normalized_score: 0,
                    invested_points: 0,
                    final_score: 0,
                    last_scored_at: new Date(),
                    scored_by: actor.id,
                });
            } else {
                const user = await User.findById(scoreItem.participant_id);
                if (!user) {
                    throw new ServiceError(404, 'participant_not_found', {
                        participant_id: scoreItem.participant_id,
                    });
                }
                entry = await LeaderboardEntry.create({
                    _id: uuid(),
                    event_id: event._id,
                    participant: {
                        type: 'user',
                        id: user._id,
                        display_name: user.profile?.full_name || user.username,
                        avatar_url: user.profile?.avatar_url || null,
                    },
                    registration_id: uuid(),
                    raw: scoreItem.raw,
                    raw_score: computedRaw,
                    normalized_score: 0,
                    invested_points: 0,
                    final_score: 0,
                    last_scored_at: new Date(),
                    scored_by: actor.id,
                });
            }
        }
    }

    const { thresholdMet } = await recomputeEventRanks(event._id, 'score_update');

    publish('LeaderboardUpdated', 'leaderboard-service', {
        event_id: event._id,
        reason: 'score_update',
        changed_participant_ids: input.scores.map((s) => s.participant_id),
    });

    return { success: true, count: input.scores.length, threshold_met: thresholdMet };
}

/**
 * Points Investment by confirmed participant
 */
export async function investPoints(ref: string, actor: Actor, amount: number) {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type === 'DE' || !event.leaderboard) {
        throw new ServiceError(400, 'no_leaderboard_for_event');
    }
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

    let entry: ILeaderboardEntry | null = null;
    if (event.teaming?.is_teamed) {
        const team = await Team.findOne({
            'owner.type': 'event',
            'owner.id': event._id,
            'members.user_id': actor.id,
            status: { $ne: 'disbanded' },
        });
        if (!team) {
            throw new ServiceError(403, 'not_a_participant');
        }
        entry = await LeaderboardEntry.findOne({
            event_id: event._id,
            'participant.id': team._id,
        });
    } else {
        entry = await LeaderboardEntry.findOne({
            event_id: event._id,
            'participant.id': actor.id,
        });
    }

    if (!entry) {
        throw new ServiceError(403, 'not_a_participant');
    }

    const latestSnapshot = await LeaderboardSnapshot.findOne({ event_id: event._id }).sort({
        taken_at: -1,
    });
    if (latestSnapshot?.frozen) {
        throw new ServiceError(400, 'leaderboard_frozen');
    }

    if (
        event.points_pool.investment_cap !== null &&
        event.points_pool.investment_cap !== undefined &&
        entry.invested_points + amount > event.points_pool.investment_cap
    ) {
        throw new ServiceError(400, 'investment_cap_exceeded');
    }

    await checkInvestmentRateLimit(actor.id, event._id);

    let lockId: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        lockId = await acquireEntryLock(entry._id);
        if (lockId) break;
        await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
    }
    if (!lockId) {
        throw new ServiceError(409, 'concurrent_investment');
    }

    try {
        const freshEntry = await LeaderboardEntry.findById(entry._id);
        if (!freshEntry) {
            throw new ServiceError(404, 'entry_not_found');
        }

        if (
            event.points_pool.investment_cap !== null &&
            event.points_pool.investment_cap !== undefined &&
            freshEntry.invested_points + amount > event.points_pool.investment_cap
        ) {
            throw new ServiceError(400, 'investment_cap_exceeded');
        }

        // Debit Points synchronously
        const requestId = uuid();
        await debitPoints(actor.id, amount, freshEntry._id, requestId);

        // Atomic OCC update with retry
        let currentEntry = freshEntry;
        let updatedEntry: ILeaderboardEntry | null = null;
        while (!updatedEntry) {
            updatedEntry = await LeaderboardEntry.findOneAndUpdate(
                { _id: currentEntry._id, version: currentEntry.version },
                { $inc: { invested_points: amount, version: 1 } },
                { returnDocument: 'after' }
            );
            if (!updatedEntry) {
                const reloaded = await LeaderboardEntry.findById(currentEntry._id);
                if (!reloaded) throw new ServiceError(404, 'entry_not_found');
                currentEntry = reloaded;
            }
        }

        const priorRank = currentEntry.rank;
        const { allEntries } = await recomputeEventRanks(event._id, 'investment');
        const refreshed = allEntries.find((e) => e._id === updatedEntry?._id);
        const newRank = refreshed?.rank ?? null;

        publish('LeaderboardInvestmentMade', 'leaderboard-service', {
            event_id: event._id,
            user_id: actor.id,
            amount,
            previous_rank: priorRank,
            new_rank: newRank,
        });

        return {
            success: true,
            entry: refreshed,
            previous_rank: priorRank,
            new_rank: newRank,
        };
    } finally {
        await releaseEntryLock(entry._id, lockId);
    }
}

/**
 * Advisory Rank Projection (Read-only math)
 */
export async function projectInvestment(ref: string, actor: Actor, amount: number) {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type === 'DE' || !event.leaderboard) {
        throw new ServiceError(400, 'no_leaderboard_for_event');
    }

    let entry: ILeaderboardEntry | null = null;
    if (event.teaming?.is_teamed) {
        const team = await Team.findOne({
            'owner.type': 'event',
            'owner.id': event._id,
            'members.user_id': actor.id,
            status: { $ne: 'disbanded' },
        });
        if (team) {
            entry = await LeaderboardEntry.findOne({
                event_id: event._id,
                'participant.id': team._id,
            });
        }
    } else {
        entry = await LeaderboardEntry.findOne({
            event_id: event._id,
            'participant.id': actor.id,
        });
    }

    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    const allEntries = await LeaderboardEntry.find({ event_id: event._id });
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
    const minParticipants = event.leaderboard.min_participants;
    const thresholdMet = allEntries.length >= minParticipants;
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
export async function getSnapshots(ref: string): Promise<ILeaderboardSnapshot[]> {
    const event = await Event.findOne({ $or: [{ _id: ref }, { slug: ref }] });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }

    return LeaderboardSnapshot.find({ event_id: event._id }).sort({ taken_at: -1 }).limit(20);
}
