import {
    AuctionLot,
    Event,
    IAuctionLot,
    IEvent,
    LOT_STATUS,
    LotStatus,
    ServiceError,
    Team,
    User,
    publish,
    userSnapshotOf,
} from '@bgsc/shared';
import { randomUUID } from 'crypto';
import { addAuctionTeamMember, debitTeamPurse, refundTeamPurse } from '../clients/registration-client';
import {
    CreateLotsInput,
    OverrideCaptainBudgetInput,
    OverridePriceInput,
    UpdateAuctionConfigInput,
} from './auction.schemas';

export async function getEventAndAuction(ref: string): Promise<IEvent> {
    const event = await Event.findOne({
        $or: [{ slug: ref.toLowerCase() }, { _id: ref }],
        deleted_at: null,
    });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type !== 'ALL' || !event.auction) {
        throw new ServiceError(400, 'event_is_not_an_auction_league');
    }
    return event;
}

interface CachedLiveState {
    eventId: string;
    payload: {
        event_id: string;
        slug: string;
        title: string;
        status: string;
        config: {
            k_multiplier?: number;
            min_bid_increment?: number;
            bid_timer_seconds?: number;
            purse_per_team?: number | null;
            oc_override_quota?: number;
            oc_captain_override_quota?: number;
            captains_count: number;
        };
        active_lot: {
            lot_id: string;
            order: number;
            player: { user_id: string; display_name: string; avatar_url: string | null };
            registration_id: string;
            base_price: number;
            oc_adjusted_price: number | null;
            current_bid: number | null;
            current_bidder: { user_id: string; team_id: string } | null;
            timer_ends_at: Date | null;
            seconds_remaining: number | null;
            version: number;
            recent_bids: unknown[];
        } | null;
        teams: {
            team_id: string;
            name: string;
            captain_user_id: string;
            logo_url: string | null;
            purse_total: number;
            purse_spent: number;
            purse_remaining: number;
            members_count: number;
            size_max: number;
        }[];
    };
    cachedAt: number;
    timerEndsAtMs: number | null;
}

// Ponytail / 2vCPU optimization: in-memory 750ms micro-cache for live state.
// High-velocity polling (50-1000 users) collapses from 3000 DB queries/sec to ~1.3 queries/sec.
const LIVE_STATE_CACHE = new Map<string, CachedLiveState>();
const LIVE_STATE_TTL_MS = 750;

export function invalidateAuctionLiveCache(refOrId?: string): void {
    if (refOrId) {
        LIVE_STATE_CACHE.delete(refOrId.toLowerCase());
    } else {
        LIVE_STATE_CACHE.clear();
    }
}

export async function getAuctionLiveState(ref: string) {
    const cacheKey = ref.toLowerCase();
    const cached = LIVE_STATE_CACHE.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < LIVE_STATE_TTL_MS) {
        let secondsRemaining: number | null = null;
        if (cached.timerEndsAtMs) {
            const diff = Math.ceil((cached.timerEndsAtMs - now) / 1000);
            secondsRemaining = diff > 0 ? diff : 0;
        }
        return {
            ...cached.payload,
            active_lot: cached.payload.active_lot
                ? {
                      ...cached.payload.active_lot,
                      seconds_remaining: secondsRemaining,
                  }
                : null,
        };
    }

    const event = await getEventAndAuction(ref);
    const activeLot = await AuctionLot.findOne({ event_id: event._id, status: 'on_block' })
        .select({
            _id: 1,
            order: 1,
            player: 1,
            registration_id: 1,
            base_price: 1,
            oc_adjusted_price: 1,
            current_bid: 1,
            current_bidder: 1,
            timer_ends_at: 1,
            version: 1,
            bids: { $slice: -10 },
        })
        .lean();

    const teams = await Team.find({
        'owner.type': 'event',
        'owner.id': event._id,
        status: { $ne: 'disbanded' },
    })
        .select({
            _id: 1,
            name: 1,
            captain_user_id: 1,
            logo_url: 1,
            'auction.purse_total': 1,
            'auction.purse_spent': 1,
            members: 1,
            size_max: 1,
        })
        .lean();

    let secondsRemaining: number | null = null;
    let timerEndsAtMs: number | null = null;
    if (activeLot && activeLot.timer_ends_at) {
        timerEndsAtMs = new Date(activeLot.timer_ends_at).getTime();
        const diff = Math.ceil((timerEndsAtMs - now) / 1000);
        secondsRemaining = diff > 0 ? diff : 0;
    }

    const payload = {
        event_id: event._id,
        slug: event.slug,
        title: event.title,
        status: event.auction!.status,
        config: {
            k_multiplier: event.auction!.k_multiplier,
            min_bid_increment: event.auction!.min_bid_increment,
            bid_timer_seconds: event.auction!.bid_timer_seconds,
            purse_per_team: event.auction!.purse_per_team,
            oc_override_quota: event.auction!.oc_override_quota,
            oc_captain_override_quota: event.auction!.oc_captain_override_quota,
            captains_count: event.auction!.captain_user_ids.length,
        },
        active_lot: activeLot
            ? {
                  lot_id: activeLot._id,
                  order: activeLot.order,
                  player: activeLot.player,
                  registration_id: activeLot.registration_id,
                  base_price: activeLot.base_price,
                  oc_adjusted_price: activeLot.oc_adjusted_price,
                  current_bid: activeLot.current_bid,
                  current_bidder: activeLot.current_bidder,
                  timer_ends_at: activeLot.timer_ends_at,
                  seconds_remaining: secondsRemaining,
                  version: activeLot.version,
                  recent_bids: activeLot.bids.slice(-10),
              }
            : null,
        teams: teams.map((t) => {
            const total = t.auction?.purse_total ?? 0;
            const spent = t.auction?.purse_spent ?? 0;
            return {
                team_id: t._id,
                name: t.name,
                captain_user_id: t.captain_user_id,
                logo_url: t.logo_url,
                purse_total: total,
                purse_spent: spent,
                purse_remaining: Math.max(0, total - spent),
                members_count: t.members?.length ?? 0,
                size_max: t.size_max,
            };
        }),
    };

    LIVE_STATE_CACHE.set(cacheKey, {
        eventId: event._id,
        payload,
        cachedAt: now,
        timerEndsAtMs,
    });
    if (event._id.toLowerCase() !== cacheKey) {
        LIVE_STATE_CACHE.set(event._id.toLowerCase(), {
            eventId: event._id,
            payload,
            cachedAt: now,
            timerEndsAtMs,
        });
    }
    if (event.slug.toLowerCase() !== cacheKey) {
        LIVE_STATE_CACHE.set(event.slug.toLowerCase(), {
            eventId: event._id,
            payload,
            cachedAt: now,
            timerEndsAtMs,
        });
    }

    return payload;
}

export async function listLots(ref: string, status?: LotStatus): Promise<IAuctionLot[]> {
    const event = await getEventAndAuction(ref);
    const filter: Record<string, unknown> = { event_id: event._id };
    if (status && LOT_STATUS.includes(status)) {
        filter.status = status;
    }
    return AuctionLot.find(filter).sort({ order: 1 });
}

export async function getLot(lotId: string): Promise<IAuctionLot> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) {
        throw new ServiceError(404, 'lot_not_found');
    }
    return lot;
}

export async function createLots(
    ref: string,
    actor: { id: string; role: string },
    input: CreateLotsInput
): Promise<IAuctionLot[]> {
    const event = await getEventAndAuction(ref);

    const userIds = Array.from(new Set(input.lots.map((l) => l.user_id)));
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u._id, userSnapshotOf(u)]));

    const docsToInsert = input.lots.map((lotInput) => {
        const playerSnapshot = userMap.get(lotInput.user_id) || {
            user_id: lotInput.user_id,
            display_name: 'Player',
            avatar_url: null,
        };

        return {
            _id: randomUUID(),
            event_id: event._id,
            player: playerSnapshot,
            registration_id: lotInput.registration_id,
            base_price: lotInput.base_price,
            oc_adjusted_price: lotInput.oc_adjusted_price ?? null,
            order: lotInput.order,
            status: 'queued' as LotStatus,
            current_bid: null,
            current_bidder: null,
            timer_ends_at: null,
            bids: [],
            sold_to_team_id: null,
            sold_amount: null,
            closed_at: null,
            version: 0,
        };
    });

    const created = await AuctionLot.insertMany(docsToInsert);
    return created as unknown as IAuctionLot[];
}

export async function startAuction(ref: string, _actor: { id: string; role: string }) {
    const event = await getEventAndAuction(ref);
    if (event.auction!.status !== 'not_started') {
        throw new ServiceError(409, 'auction_already_started');
    }

    const teams = await Team.find({
        'owner.type': 'event',
        'owner.id': event._id,
        status: { $ne: 'disbanded' },
    }).select({ _id: 1, auction: 1 });

    const lots = await AuctionLot.find({ event_id: event._id }).select({ base_price: 1 });
    const sumBasePrices = lots.reduce((acc, l) => acc + (l.base_price || 0), 0);

    let defaultPurse = event.auction!.purse_per_team;
    if (defaultPurse == null && teams.length > 0) {
        const k = event.auction!.k_multiplier ?? 1.0;
        defaultPurse = Math.floor((k * sumBasePrices) / teams.length);
        event.auction!.purse_per_team = defaultPurse;
    }

    // Ponytail / 2vCPU optimization: single bulk write instead of N individual saves
    await Team.updateMany(
        {
            'owner.type': 'event',
            'owner.id': event._id,
            status: { $ne: 'disbanded' },
            'auction.is_overridden': { $ne: true },
        },
        {
            $set: {
                auction: {
                    purse_total: defaultPurse ?? 0,
                    purse_spent: 0,
                    version: 0,
                    is_overridden: false,
                    override_reason: null,
                    overridden_by: null,
                },
            },
        }
    );

    event.auction!.status = 'live';

    // Put first queued lot on block if no lot is currently on block
    let activeLot = await AuctionLot.findOne({ event_id: event._id, status: 'on_block' });
    if (!activeLot) {
        const nextLot = await AuctionLot.findOne({ event_id: event._id, status: 'queued' }).sort({ order: 1 });
        if (nextLot) {
            const timerSec = event.auction!.bid_timer_seconds || 5;
            nextLot.status = 'on_block';
            nextLot.timer_ends_at = new Date(Date.now() + timerSec * 1000);
            await nextLot.save();
            activeLot = nextLot;

            publish('AuctionStarted', 'event-service', {
                event_id: event._id,
                lot_id: nextLot._id,
                player_user_id: nextLot.player.user_id,
            });
        }
    }

    await event.save();
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref);
}

export async function pauseAuction(ref: string, _actor: { id: string; role: string }) {
    const event = await getEventAndAuction(ref);
    if (event.auction!.status !== 'live') {
        throw new ServiceError(409, 'auction_not_live');
    }
    event.auction!.status = 'paused';
    await event.save();
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref);
}

export async function resumeAuction(ref: string, _actor: { id: string; role: string }) {
    const event = await getEventAndAuction(ref);
    if (event.auction!.status !== 'paused') {
        throw new ServiceError(409, 'auction_not_paused');
    }
    event.auction!.status = 'live';

    const activeLot = await AuctionLot.findOne({ event_id: event._id, status: 'on_block' });
    if (activeLot) {
        const timerSec = event.auction!.bid_timer_seconds || 5;
        activeLot.timer_ends_at = new Date(Date.now() + timerSec * 1000);
        await activeLot.save();
    }

    await event.save();
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref);
}

export async function closeAuction(ref: string, _actor: { id: string; role: string }) {
    const event = await getEventAndAuction(ref);
    if (event.auction!.status === 'finished') {
        throw new ServiceError(409, 'auction_already_closed');
    }

    // Settle active lot on block if one exists
    const activeLot = await AuctionLot.findOne({ event_id: event._id, status: 'on_block' });
    if (activeLot) {
        await advanceLot(activeLot._id);
    }

    event.auction!.status = 'finished';
    await event.save();

    publish('AuctionClosed', 'event-service', { event_id: event._id });
    invalidateAuctionLiveCache(event._id);

    return getAuctionLiveState(ref);
}

export async function updateAuctionConfig(
    ref: string,
    _actor: { id: string; role: string },
    input: UpdateAuctionConfigInput
) {
    const event = await getEventAndAuction(ref);
    if (event.auction!.status === 'live') {
        const activeLot = await AuctionLot.findOne({ event_id: event._id, status: 'on_block' });
        if (activeLot && input.bid_timer_seconds !== undefined) {
            throw new ServiceError(409, 'cannot_change_timer_while_lot_is_on_block');
        }
    }

    if (input.k_multiplier !== undefined) event.auction!.k_multiplier = input.k_multiplier;
    if (input.min_bid_increment !== undefined) event.auction!.min_bid_increment = input.min_bid_increment;
    if (input.bid_timer_seconds !== undefined) event.auction!.bid_timer_seconds = input.bid_timer_seconds;
    if (input.oc_override_quota !== undefined) event.auction!.oc_override_quota = input.oc_override_quota;
    if (input.oc_captain_override_quota !== undefined) event.auction!.oc_captain_override_quota = input.oc_captain_override_quota;
    if (input.purse_per_team !== undefined) event.auction!.purse_per_team = input.purse_per_team;

    await event.save();
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref);
}

export async function placeBid(
    lotId: string,
    bidder: { id: string },
    amount: number,
    version: number
): Promise<IAuctionLot> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) {
        throw new ServiceError(404, 'lot_not_found');
    }
    if (lot.status !== 'on_block') {
        throw new ServiceError(400, 'lot_not_on_block');
    }

    const event = await Event.findById(lot.event_id);
    if (!event || !event.auction || event.auction.status !== 'live') {
        throw new ServiceError(400, 'auction_not_live');
    }

    // Pre-check 1: Bidder must be an approved captain
    if (!event.auction.captain_user_ids.includes(bidder.id)) {
        throw new ServiceError(403, 'not_auction_captain');
    }

    // Pre-check 2: Cannot bid on oneself if captain is also a registered player
    if (lot.player.user_id === bidder.id) {
        throw new ServiceError(422, 'cannot_bid_on_self');
    }

    // Pre-check 3: Cannot bid against oneself if already the highest bidder
    if (lot.current_bidder && lot.current_bidder.user_id === bidder.id) {
        throw new ServiceError(422, 'already_highest_bidder');
    }

    // Pre-check 4: Bidder must own an active team in this event
    const team = await Team.findOne({
        'owner.type': 'event',
        'owner.id': event._id,
        captain_user_id: bidder.id,
        status: { $ne: 'disbanded' },
    });
    if (!team) {
        throw new ServiceError(403, 'captain_has_no_team');
    }

    // Pre-check 5: Team roster cannot exceed maximum size
    if ((team.members?.length ?? 0) >= team.size_max) {
        throw new ServiceError(422, 'team_roster_full');
    }

    // Pre-check 6: Check purse remaining
    const totalPurse = team.auction?.purse_total ?? 0;
    const spentPurse = team.auction?.purse_spent ?? 0;
    const purseRemaining = totalPurse - spentPurse;
    if (amount > purseRemaining) {
        throw new ServiceError(422, 'insufficient_purse');
    }

    // Pre-check 7: Minimum bid increment
    const floorPrice = lot.oc_adjusted_price ?? lot.base_price;
    const minIncrement = event.auction.min_bid_increment || 1;
    const requiredMin = lot.current_bid == null ? floorPrice : lot.current_bid + minIncrement;

    if (amount < requiredMin) {
        throw new ServiceError(422, 'bid_below_minimum');
    }

    // Atomic CAS Update with OCC version verification and server-authoritative timer check
    const now = new Date();
    const bidTimerSeconds = event.auction.bid_timer_seconds || 5;
    const newTimerEndsAt = new Date(now.getTime() + bidTimerSeconds * 1000);
    const bidId = randomUUID();

    const updatedLot = await AuctionLot.findOneAndUpdate(
        {
            _id: lotId,
            version: version,
            status: 'on_block',
            timer_ends_at: { $gt: now },
        },
        {
            $set: {
                current_bid: amount,
                current_bidder: { user_id: bidder.id, team_id: team._id },
                timer_ends_at: newTimerEndsAt,
            },
            $push: {
                bids: {
                    bid_id: bidId,
                    bidder_user_id: bidder.id,
                    team_id: team._id,
                    amount: amount,
                    placed_at: now,
                },
            },
            $inc: { version: 1 },
        },
        { returnDocument: 'after' }
    );

    if (!updatedLot) {
        throw new ServiceError(409, 'conflict_concurrent_bid');
    }

    publish('BidPlaced', 'event-service', {
        bid_id: bidId,
        lot_id: lotId,
        event_id: event._id,
        bidder_user_id: bidder.id,
        team_id: team._id,
        amount,
    });

    invalidateAuctionLiveCache(event._id);

    return updatedLot;
}

export async function advanceLot(
    lotId: string,
    _actor?: { id: string; role: string }
): Promise<{ settled_lot: IAuctionLot; next_lot: IAuctionLot | null }> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) {
        throw new ServiceError(404, 'lot_not_found');
    }
    if (lot.status !== 'on_block') {
        throw new ServiceError(400, 'lot_not_on_block');
    }

    const event = await Event.findById(lot.event_id);
    if (!event || !event.auction) {
        throw new ServiceError(404, 'event_not_found');
    }

    // Guard: only the active lot for this event can be advanced
    const activeLot = await AuctionLot.findOne({ event_id: event._id, status: 'on_block' });
    if (!activeLot || activeLot._id.toString() !== lot._id.toString()) {
        throw new ServiceError(409, 'lot_not_active');
    }

    const now = new Date();
    const isSold = Boolean(lot.current_bidder && lot.current_bid != null);
    const targetStatus = isSold ? 'sold' : 'unsold';

    // Atomic CAS transition: mark status first to claim lot settlement
    const claimedLot = await AuctionLot.findOneAndUpdate(
        { _id: lotId, status: 'on_block' },
        {
            $set: {
                status: targetStatus,
                sold_to_team_id: isSold ? lot.current_bidder!.team_id : null,
                sold_amount: isSold ? lot.current_bid : null,
                closed_at: now,
            },
        },
        { returnDocument: 'after' }
    );

    if (!claimedLot) {
        // Already settled concurrently
        const settled = await AuctionLot.findById(lotId);
        if (settled && (settled.status === 'sold' || settled.status === 'unsold')) {
            const nextLot = event.auction.status === 'live'
                ? await AuctionLot.findOne({ event_id: event._id, status: 'on_block' })
                : null;
            return { settled_lot: settled as IAuctionLot, next_lot: nextLot };
        }
        throw new ServiceError(409, 'lot_settlement_conflict');
    }

    if (isSold) {
        const teamId = claimedLot.current_bidder!.team_id;
        const amount = claimedLot.current_bid!;
        let debited = false;
        try {
            debited = await debitTeamPurse(teamId, amount);
            if (!debited) {
                throw new ServiceError(422, 'insufficient_purse_at_settlement');
            }
            await addAuctionTeamMember(
                teamId,
                claimedLot.player.user_id,
                claimedLot.registration_id,
                claimedLot.player
            );
        } catch (err) {
            if (debited) {
                try {
                    await refundTeamPurse(teamId, amount);
                } catch (refundErr) {
                    console.error(`[auction] compensation refund failed for team ${teamId}:`, refundErr);
                }
            }
            // Rollback lot status if debit/membership failed
            await AuctionLot.updateOne(
                { _id: lotId },
                { $set: { status: 'on_block', sold_to_team_id: null, sold_amount: null, closed_at: null } }
            );
            throw err;
        }

        publish('BidClosed', 'event-service', {
            lot_id: claimedLot._id,
            winner_team_id: claimedLot.sold_to_team_id,
            final_amount: claimedLot.sold_amount,
        });

        publish('PlayerSold', 'event-service', {
            lot_id: claimedLot._id,
            player_user_id: claimedLot.player.user_id,
            team_id: claimedLot.sold_to_team_id,
            amount: claimedLot.sold_amount,
        });
    } else {
        publish('BidClosed', 'event-service', {
            lot_id: claimedLot._id,
            winner_team_id: null,
            final_amount: null,
        });

        publish('PlayerUnsold', 'event-service', {
            lot_id: claimedLot._id,
            player_user_id: claimedLot.player.user_id,
        });
    }

    // Advance to next queued lot if event is live
    let nextLot: IAuctionLot | null = null;
    if (event.auction.status === 'live') {
        nextLot = await AuctionLot.findOne({ event_id: event._id, status: 'queued' }).sort({ order: 1 });
        if (nextLot) {
            const timerSec = event.auction.bid_timer_seconds || 5;
            nextLot.status = 'on_block';
            nextLot.timer_ends_at = new Date(Date.now() + timerSec * 1000);
            await nextLot.save();

            publish('AuctionStarted', 'event-service', {
                event_id: event._id,
                lot_id: nextLot._id,
                player_user_id: nextLot.player.user_id,
            });
        } else {
            // No more lots queued; auction is finished
            event.auction.status = 'finished';
            await event.save();

            publish('AuctionClosed', 'event-service', { event_id: event._id });
        }
    }

    invalidateAuctionLiveCache(event._id);

    return { settled_lot: claimedLot, next_lot: nextLot };
}

export async function overrideLotPrice(
    lotId: string,
    _actor: { id: string; role: string },
    input: OverridePriceInput
): Promise<IAuctionLot> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) {
        throw new ServiceError(404, 'lot_not_found');
    }

    const event = await Event.findById(lot.event_id);
    if (!event || !event.auction) {
        throw new ServiceError(404, 'event_not_found');
    }

    // Idempotent re-entry: already overridden
    if (lot.oc_adjusted_price !== null) {
        lot.oc_adjusted_price = input.oc_adjusted_price;
        await lot.save();
        invalidateAuctionLiveCache(event._id);
        return lot;
    }

    const totalLots = await AuctionLot.countDocuments({ event_id: event._id });
    if (totalLots > 0) {
        const quota = event.auction.oc_override_quota || (3 / 7);
        const currentOverridden = await AuctionLot.countDocuments({
            event_id: event._id,
            oc_adjusted_price: { $ne: null },
        });
        if ((currentOverridden + 1) / totalLots > quota) {
            throw new ServiceError(422, 'oc_override_quota_exceeded');
        }
        // Atomic update: only succeeds if still not overridden
        const updated = await AuctionLot.findOneAndUpdate(
            { _id: lotId, oc_adjusted_price: null },
            { $set: { oc_adjusted_price: input.oc_adjusted_price } },
            { returnDocument: 'after' }
        );
        invalidateAuctionLiveCache(event._id);
        if (updated) return updated;
        return (await AuctionLot.findById(lotId)) as IAuctionLot;
    }

    lot.oc_adjusted_price = input.oc_adjusted_price;
    await lot.save();
    invalidateAuctionLiveCache(event._id);
    return lot;
}

export async function overrideCaptainBudget(
    ref: string,
    teamId: string,
    actor: { id: string; role: string },
    input: OverrideCaptainBudgetInput
) {
    const event = await getEventAndAuction(ref);
    if (event.auction!.status !== 'not_started') {
        throw new ServiceError(409, 'auction_already_started');
    }

    const team = await Team.findById(teamId);
    if (!team || team.owner.id !== event._id) {
        throw new ServiceError(404, 'team_not_found');
    }

    if (team.status === 'disbanded') {
        throw new ServiceError(400, 'team_is_disbanded');
    }

    if (team.auction?.is_overridden) {
        throw new ServiceError(409, 'team_already_overridden');
    }

    const totalTeams = await Team.countDocuments({
        'owner.type': 'event',
        'owner.id': event._id,
        status: { $ne: 'disbanded' },
    });
    if (totalTeams === 0) {
        throw new ServiceError(400, 'no_teams_registered');
    }

    const quota = event.auction!.oc_captain_override_quota ?? (3 / 7);
    const currentOverridden = await Team.countDocuments({
        'owner.type': 'event',
        'owner.id': event._id,
        status: { $ne: 'disbanded' },
        'auction.is_overridden': true,
    });
    if ((currentOverridden + 1) / totalTeams > quota) {
        throw new ServiceError(422, 'oc_captain_override_quota_exceeded');
    }

    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            'auction.is_overridden': { $ne: true },
        },
        {
            $set: {
                auction: {
                    purse_total: input.purse_total,
                    purse_spent: 0,
                    version: (team.auction?.version ?? 0) + 1,
                    is_overridden: true,
                    override_reason: input.reason ?? null,
                    overridden_by: actor.id,
                },
            },
        },
        { returnDocument: 'after' }
    );
    if (!updated) {
        throw new ServiceError(409, 'concurrent_override_conflict');
    }
    invalidateAuctionLiveCache(event._id);
    return updated;
}

export async function getBudgetPreview(ref: string) {
    const event = await getEventAndAuction(ref);
    const teams = await Team.find({
        'owner.type': 'event',
        'owner.id': event._id,
        status: { $ne: 'disbanded' },
    }).lean();
    const lots = await AuctionLot.find({ event_id: event._id }).lean();

    const total_lots = lots.length;
    const sum_base_prices = lots.reduce((acc, l) => acc + (l.base_price || 0), 0);
    const k_multiplier = event.auction!.k_multiplier ?? 1.0;
    const purse_pool = Math.floor(k_multiplier * sum_base_prices);
    const total_teams = teams.length;

    let defaultPurse = event.auction!.purse_per_team;
    if (defaultPurse == null && total_teams > 0) {
        defaultPurse = Math.floor((k_multiplier * sum_base_prices) / total_teams);
    }
    const default_purse_per_team = defaultPurse ?? 0;
    const oc_captain_override_quota = event.auction!.oc_captain_override_quota ?? (3 / 7);
    const overridden_teams_count = teams.filter((t) => t.auction?.is_overridden === true).length;

    return {
        total_lots,
        sum_base_prices,
        k_multiplier,
        purse_pool,
        total_teams,
        default_purse_per_team,
        oc_captain_override_quota,
        overridden_teams_count,
        teams: teams.map((t) => ({
            team_id: t._id,
            name: t.name,
            captain_user_id: t.captain_user_id,
            purse: t.auction?.is_overridden ? t.auction.purse_total : default_purse_per_team,
            is_overridden: t.auction?.is_overridden ?? false,
            override_reason: t.auction?.override_reason ?? null,
            overridden_by: t.auction?.overridden_by ?? null,
        })),
    };
}
