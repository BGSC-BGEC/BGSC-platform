import {
    AuctionLot,
    Event,
    FormSubmission,
    IAuctionLot,
    IEvent,
    InternalCallError,
    LOT_STATUS,
    LotStatus,
    OC_OVERRIDE_QUOTA_MAX,
    ServiceError,
    Team,
    User,
    UserRole,
    publish,
    userSnapshotOf,
} from '@bgsc/shared';
import { randomUUID } from 'crypto';
import {
    addAuctionTeamMember,
    asServiceError,
    debitTeamPurse,
    refundTeamPurse,
    setAuctionPurses,
    setTeamAuctionBudget,
} from '../clients/registration-client';
import { Actor, assertAdminOf, assertEventAdmin, assertVisible, atLeast, isEventAdmin } from '../events/access';
import { CacheEntry, LIVE_STATE_CACHE, LIVE_STATE_TTL_MS, invalidateAuctionLiveCache } from './cache';
import {
    CreateLotsInput,
    OverrideCaptainBudgetInput,
    OverridePriceInput,
    UpdateAuctionConfigInput,
} from './auction.schemas';

const PRODUCER = 'event-service';
/** Bids and lot movements happen only while the event itself is live on the calendar. */
const ACTIVE_EVENT_STATUSES: IEvent['status'][] = ['upcoming', 'ongoing'];
/** A lot that occupies the block: open for bids, or hammered and being charged. */
const ACTIVE_LOT_STATUSES: LotStatus[] = ['on_block', 'settling'];

export async function getEventAndAuction(ref: string, viewer?: Actor | null): Promise<IEvent> {
    const event = await Event.findOne({ $or: [{ slug: ref.toLowerCase() }, { _id: ref }], deleted_at: null }, { seat_holders: 0 });
    if (!event) {
        throw new ServiceError(404, 'event_not_found');
    }
    // The public auction reads used to serve a draft league's lots and players to anyone.
    if (event.status === 'draft' && !isEventAdmin(event, viewer)) {
        throw new ServiceError(404, 'event_not_found');
    }
    if (event.type !== 'ALL' || !event.auction) {
        throw new ServiceError(400, 'event_is_not_an_auction_league');
    }
    return event;
}

/** Load an auction for an admin write: visible, an auction, and the actor administers this event. */
async function adminEvent(ref: string, actor: Actor): Promise<IEvent> {
    const event = await getEventAndAuction(ref, actor);
    assertEventAdmin(event, actor);
    return event;
}

/* ------------------------------------------------------------------ *
 * Live state (spectator polling)
 * ------------------------------------------------------------------ */

type LivePayload = Awaited<ReturnType<typeof buildLiveState>>['payload'];

async function buildLiveState(event: IEvent, now: number) {
    const activeLot = await AuctionLot.findOne({ event_id: event._id, status: { $in: ACTIVE_LOT_STATUSES } })
        .select({
            _id: 1,
            status: 1,
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

    const teams = await Team.find({ 'owner.type': 'event', 'owner.id': event._id, status: { $ne: 'disbanded' } })
        .select({ _id: 1, name: 1, captain_user_id: 1, logo_url: 1, 'auction.purse_total': 1, 'auction.purse_spent': 1, members: 1, size_max: 1 })
        .lean();

    const timerEndsAtMs = activeLot?.timer_ends_at ? new Date(activeLot.timer_ends_at).getTime() : null;

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
                  status: activeLot.status,
                  order: activeLot.order,
                  player: activeLot.player,
                  registration_id: activeLot.registration_id,
                  base_price: activeLot.base_price,
                  oc_adjusted_price: activeLot.oc_adjusted_price,
                  current_bid: activeLot.current_bid,
                  current_bidder: activeLot.current_bidder,
                  timer_ends_at: activeLot.timer_ends_at,
                  seconds_remaining: secondsLeft(timerEndsAtMs, now),
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
    return { payload, timerEndsAtMs };
}

function secondsLeft(timerEndsAtMs: number | null, now: number): number | null {
    if (!timerEndsAtMs) return null;
    const diff = Math.ceil((timerEndsAtMs - now) / 1000);
    return diff > 0 ? diff : 0;
}

export async function getAuctionLiveState(ref: string, viewer?: Actor | null) {
    const cacheKey = ref.toLowerCase();
    const now = Date.now();
    const cached = LIVE_STATE_CACHE.get(cacheKey) as CacheEntry<LivePayload> | undefined;

    if (cached && now - cached.cachedAt < LIVE_STATE_TTL_MS) {
        if (cached.access.status === 'draft' && !isEventAdmin(cached.access, viewer)) {
            throw new ServiceError(404, 'event_not_found');
        }
        const p = cached.payload;
        return {
            ...p,
            active_lot: p.active_lot ? { ...p.active_lot, seconds_remaining: secondsLeft(cached.timerEndsAtMs, now) } : null,
        };
    }

    const event = await getEventAndAuction(ref, viewer);
    const { payload, timerEndsAtMs } = await buildLiveState(event, now);

    const entry: CacheEntry<LivePayload> = {
        eventId: event._id,
        access: { status: event.status, created_by: event.created_by, core_admins: [...event.core_admins] },
        payload,
        cachedAt: now,
        timerEndsAtMs,
    };
    for (const key of new Set([cacheKey, event._id.toLowerCase(), event.slug.toLowerCase()])) {
        LIVE_STATE_CACHE.set(key, entry);
    }
    return payload;
}

/* ------------------------------------------------------------------ *
 * Lots
 * ------------------------------------------------------------------ */

export async function listLots(ref: string, status?: LotStatus, viewer?: Actor | null): Promise<IAuctionLot[]> {
    const event = await getEventAndAuction(ref, viewer);
    const filter: Record<string, unknown> = { event_id: event._id };
    if (status && LOT_STATUS.includes(status)) {
        filter.status = status;
    }
    return AuctionLot.find(filter).sort({ order: 1 });
}

export async function getLot(lotId: string, viewer?: Actor | null): Promise<IAuctionLot> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) throw new ServiceError(404, 'lot_not_found');
    const event = await Event.findById(lot.event_id, { status: 1, created_by: 1, core_admins: 1 });
    if (!event) throw new ServiceError(404, 'lot_not_found');
    try {
        assertVisible(event, viewer);
    } catch {
        throw new ServiceError(404, 'lot_not_found');
    }
    return lot;
}

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

export async function createLots(ref: string, actor: Actor, input: CreateLotsInput): Promise<IAuctionLot[]> {
    const event = await adminEvent(ref, actor);
    if (event.auction!.status === 'finished') throw new ServiceError(409, 'auction_finished');

    // A lot sells a registration: it must be a confirmed registration of THIS event, held by the
    // player named on the lot. Unchecked, settlement seated one user against another's registration.
    const regs = await FormSubmission.find(
        {
            _id: { $in: input.lots.map((l) => l.registration_id) },
            'owner.type': 'event',
            'owner.id': event._id,
            status: 'confirmed',
        },
        { 'user.user_id': 1 }
    ).lean();
    const holder = new Map(regs.map((r) => [r._id, r.user.user_id]));
    const invalid = input.lots.filter((l) => holder.get(l.registration_id) !== l.user_id).map((l) => l.registration_id);
    if (invalid.length > 0) throw new ServiceError(422, 'invalid_lot_registration', { registration_ids: invalid });

    // Orders and players are unique per event across batches, not just inside one (a repeat player
    // used to hit the unique index and 500).
    const userIds = input.lots.map((l) => l.user_id);
    const clash = await AuctionLot.find(
        { event_id: event._id, $or: [{ order: { $in: input.lots.map((l) => l.order) } }, { 'player.user_id': { $in: userIds } }] },
        { order: 1, 'player.user_id': 1 }
    ).lean();
    if (clash.length > 0) {
        throw new ServiceError(409, 'lot_conflict', {
            orders: clash.map((c) => c.order),
            user_ids: clash.map((c) => c.player.user_id),
        });
    }

    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u._id, userSnapshotOf(u)]));

    const docs = input.lots.map((lotInput) => ({
        _id: randomUUID(),
        event_id: event._id,
        player: userMap.get(lotInput.user_id) ?? { user_id: lotInput.user_id, display_name: 'Player', avatar_url: null },
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
    }));

    let created: IAuctionLot[];
    try {
        created = (await AuctionLot.insertMany(docs)) as unknown as IAuctionLot[];
    } catch (err) {
        if (isDuplicateKey(err)) {
            // insertMany is ordered: rows before the clash were written. Take the batch back so a
            // conflict leaves nothing behind (the unique (order, event_id) index catches the race the
            // pre-check above cannot).
            await AuctionLot.deleteMany({ _id: { $in: docs.map((d) => d._id) }, status: 'queued' });
            throw new ServiceError(409, 'lot_conflict');
        }
        throw err;
    }

    // A live auction with nothing on the block (started empty, or the queue ran dry) picks the new
    // lots up here; otherwise they sat queued forever (audit Sep 26, H30).
    if (event.auction!.status === 'live') await raiseNextLot(event._id);
    invalidateAuctionLiveCache(event._id);
    return created;
}

/**
 * Put the lowest-order queued lot on the block, if no lot is active (on the block or settling). The
 * partial unique index `one_active_lot_per_event` makes two concurrent callers safe: the loser gets
 * 11000 and backs off. A lot still settling holds the block, so no second team can be charged while
 * the first team's charge is in doubt.
 */
async function raiseNextLot(eventId: string): Promise<IAuctionLot | null> {
    if (await AuctionLot.exists({ event_id: eventId, status: { $in: ACTIVE_LOT_STATUSES } })) return null;
    const event = await Event.findById(eventId, { auction: 1 });
    if (!event?.auction || event.auction.status !== 'live') return null;

    const timerSec = event.auction.bid_timer_seconds || 5;
    try {
        const next = await AuctionLot.findOneAndUpdate(
            { event_id: eventId, status: 'queued' },
            { $set: { status: 'on_block', timer_ends_at: new Date(Date.now() + timerSec * 1000) } },
            { sort: { order: 1 }, returnDocument: 'after' }
        );
        if (!next) return null;
        // A close or cancel that stopped the auction between the check above and the raise would leave
        // this lot on the block of a dead auction, unsellable: put it back in the queue.
        if (!(await Event.exists({ _id: eventId, 'auction.status': 'live' }))) {
            await AuctionLot.updateOne(
                { _id: next._id, status: 'on_block', version: next.version },
                { $set: { status: 'queued', timer_ends_at: null } }
            );
            return null;
        }
        publish('AuctionStarted', PRODUCER, { event_id: eventId, lot_id: next._id, player_user_id: next.player.user_id });
        return next;
    } catch (err) {
        if (isDuplicateKey(err)) return null;
        throw err;
    }
}

/** CAS to `finished`; only the winner publishes, so AuctionClosed goes out exactly once. */
async function finishAuction(eventId: string): Promise<boolean> {
    const res = await Event.updateOne(
        { _id: eventId, 'auction.status': { $in: ['not_started', 'live', 'paused'] } },
        { $set: { 'auction.status': 'finished' } }
    );
    if (res.modifiedCount !== 1) return false;
    publish('AuctionClosed', PRODUCER, { event_id: eventId });
    return true;
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

export async function startAuction(ref: string, actor: Actor) {
    const event = await adminEvent(ref, actor);
    if (event.auction!.status !== 'not_started') {
        throw new ServiceError(409, 'auction_already_started');
    }
    if (!ACTIVE_EVENT_STATUSES.includes(event.status)) {
        throw new ServiceError(409, 'event_not_active');
    }

    const [teamsCount, sums] = await Promise.all([
        Team.countDocuments({ 'owner.type': 'event', 'owner.id': event._id, status: { $ne: 'disbanded' } }),
        AuctionLot.aggregate<{ sum: number }>([
            { $match: { event_id: event._id } },
            { $group: { _id: null, sum: { $sum: '$base_price' } } },
        ]),
    ]);
    const sumBasePrices = sums[0]?.sum ?? 0;

    let defaultPurse = event.auction!.purse_per_team;
    if (defaultPurse == null) {
        const k = event.auction!.k_multiplier ?? 1.0;
        defaultPurse = teamsCount > 0 ? Math.floor((k * sumBasePrices) / teamsCount) : 0;
    }

    // Registration Service owns `teams`: it sets the purse on every team lacking one (overridden
    // budgets keep theirs). Idempotent, so a start retried after a timeout is harmless.
    try {
        await setAuctionPurses(event._id, defaultPurse);
    } catch (err) {
        throw asServiceError(err);
    }

    const won = await Event.findOneAndUpdate(
        { _id: event._id, 'auction.status': 'not_started' },
        { $set: { 'auction.status': 'live', 'auction.purse_per_team': defaultPurse } }
    );
    if (!won) throw new ServiceError(409, 'auction_already_started');

    await raiseNextLot(event._id);
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref, actor);
}

export async function pauseAuction(ref: string, actor: Actor) {
    const event = await adminEvent(ref, actor);
    const res = await Event.updateOne({ _id: event._id, 'auction.status': 'live' }, { $set: { 'auction.status': 'paused' } });
    if (res.modifiedCount !== 1) throw new ServiceError(409, 'auction_not_live');
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref, actor);
}

export async function resumeAuction(ref: string, actor: Actor) {
    const event = await adminEvent(ref, actor);
    const res = await Event.updateOne({ _id: event._id, 'auction.status': 'paused' }, { $set: { 'auction.status': 'live' } });
    if (res.modifiedCount !== 1) throw new ServiceError(409, 'auction_not_paused');

    // The lot on the block gets a fresh timer; if a lot was settled while paused, the next one goes
    // up now — resume used to leave a live auction with nothing on the block, forever.
    const timerSec = event.auction!.bid_timer_seconds || 5;
    const reset = await AuctionLot.updateOne(
        { event_id: event._id, status: 'on_block' },
        { $set: { timer_ends_at: new Date(Date.now() + timerSec * 1000) } }
    );
    if (reset.matchedCount === 0) await raiseNextLot(event._id);

    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref, actor);
}

export async function closeAuction(ref: string, actor: Actor) {
    const event = await adminEvent(ref, actor);
    if (event.auction!.status === 'finished') {
        throw new ServiceError(409, 'auction_already_closed');
    }

    // Stop the auction first (no bids, no raises: an auto-settle racing this close could otherwise put
    // the next lot up after the scan below), settle the lot on the block WITHOUT raising the next one,
    // then finish. `finished` comes last: AuctionClosed locks the rosters, which the last sale still
    // needs open. A bid landing mid-settle bumps the version; the settle retries against the new high bid.
    await Event.updateOne({ _id: event._id, 'auction.status': 'live' }, { $set: { 'auction.status': 'paused' } });
    for (let attempt = 0; ; attempt++) {
        const active = await AuctionLot.findOne({ event_id: event._id, status: { $in: ACTIVE_LOT_STATUSES } }, { _id: 1 });
        if (!active) break;
        try {
            await settleLot(active._id, { raiseNext: false, ignoreTimer: true });
            break;
        } catch (err) {
            if (!(err instanceof ServiceError && err.code === 'lot_changed_retry') || attempt >= 2) throw err;
        }
    }

    await finishAuction(event._id);
    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref, actor);
}

/**
 * Macro variables are frozen once the auction leaves `not_started` (spec §5.15.4 matrix). K and the
 * two quotas are Admin-tier (coordinator+); the event's own admins may tune timer, increment and
 * purse before the start.
 */
export async function updateAuctionConfig(ref: string, actor: Actor, input: UpdateAuctionConfigInput) {
    const event = await adminEvent(ref, actor);
    if (event.auction!.status !== 'not_started') {
        throw new ServiceError(409, 'auction_config_frozen');
    }
    const adminTier = input.k_multiplier !== undefined || input.oc_override_quota !== undefined || input.oc_captain_override_quota !== undefined;
    if (adminTier && !atLeast(actor.role, UserRole.COORDINATOR)) {
        throw new ServiceError(403, 'coordinator_required');
    }

    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) set[`auction.${key}`] = value;
    }
    if (Object.keys(set).length > 0) {
        const res = await Event.updateOne({ _id: event._id, 'auction.status': 'not_started' }, { $set: set }, { runValidators: true });
        if (res.matchedCount !== 1) throw new ServiceError(409, 'auction_config_frozen');
    }

    invalidateAuctionLiveCache(event._id);
    return getAuctionLiveState(ref, actor);
}

/* ------------------------------------------------------------------ *
 * Bidding
 * ------------------------------------------------------------------ */

export async function placeBid(lotId: string, bidder: { id: string }, amount: number, version: number): Promise<IAuctionLot> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) {
        throw new ServiceError(404, 'lot_not_found');
    }
    if (lot.status !== 'on_block') {
        throw new ServiceError(400, 'lot_not_on_block');
    }

    const event = await Event.findById(lot.event_id, { seat_holders: 0 });
    if (!event || !event.auction || event.auction.status !== 'live' || !ACTIVE_EVENT_STATUSES.includes(event.status)) {
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
    // A locked roster cannot take a player: the sale would fail at add-member.
    if (team.status === 'locked') {
        throw new ServiceError(409, 'team_locked');
    }
    // The captain list can lag a cancellation or demotion; the bidder's own registration is the truth.
    const confirmed = await FormSubmission.exists({
        'owner.type': 'event',
        'owner.id': event._id,
        'user.user_id': bidder.id,
        status: 'confirmed',
    });
    if (!confirmed) {
        throw new ServiceError(403, 'captain_not_confirmed');
    }

    // Pre-check 5: Team roster cannot exceed maximum size
    if ((team.members?.length ?? 0) >= team.size_max) {
        throw new ServiceError(422, 'team_roster_full');
    }

    // Pre-check 6: Check purse remaining
    const purseRemaining = (team.auction?.purse_total ?? 0) - (team.auction?.purse_spent ?? 0);
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
    const newTimerEndsAt = new Date(now.getTime() + (event.auction.bid_timer_seconds || 5) * 1000);
    const bidId = randomUUID();

    const updatedLot = await AuctionLot.findOneAndUpdate(
        { _id: lotId, version, status: 'on_block', timer_ends_at: { $gt: now } },
        {
            $set: {
                current_bid: amount,
                current_bidder: { user_id: bidder.id, team_id: team._id },
                timer_ends_at: newTimerEndsAt,
            },
            $push: { bids: { bid_id: bidId, bidder_user_id: bidder.id, team_id: team._id, amount, placed_at: now } },
            $inc: { version: 1 },
        },
        { returnDocument: 'after' }
    );

    if (!updatedLot) {
        throw new ServiceError(409, 'conflict_concurrent_bid');
    }

    publish('BidPlaced', PRODUCER, {
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

/* ------------------------------------------------------------------ *
 * Settlement
 * ------------------------------------------------------------------ */

/**
 * A Registration answer we may act on as a refusal. 401/403 mean OUR credentials or its auth broke,
 * not "no" — treated as outcome unknown, like a timeout. A settlement used to mark
 * the lot permanently unsold on a mis-set internal token.
 */
const isRefusal = (err: unknown): err is InternalCallError =>
    err instanceof InternalCallError && !err.outcomeUnknown && err.status !== 401 && err.status !== 403;

/** Keys are per lot AND team: a different team is never charged under another's key. */
const keyOf = (lotId: string, teamId: string, op: 'debit' | 'refund' | 'add') => `${lotId}:${teamId}:${op}`;

/**
 * Charge the winner and seat the player. Returns the refusal code when the winner cannot take the
 * player (after refunding a debit that landed); throws when any outcome is unknown. Every call is
 * keyed, so replaying this after a crash or an unknown outcome can neither charge nor refund twice.
 */
async function chargeWinner(lot: IAuctionLot, teamId: string, amount: number): Promise<string | null> {
    try {
        await debitTeamPurse(teamId, amount, keyOf(lot._id, teamId, 'debit'));
    } catch (err) {
        if (isRefusal(err)) return err.code;
        throw err;
    }
    try {
        await addAuctionTeamMember(teamId, lot.player.user_id, lot.registration_id, keyOf(lot._id, teamId, 'add'));
    } catch (err) {
        if (!isRefusal(err)) throw err;
        // The debit landed and the player cannot join (team full, locked, ...): give the money back.
        await refundTeamPurse(teamId, amount, keyOf(lot._id, teamId, 'refund'));
        return err.code;
    }
    return null;
}

type SettleResult = { settled_lot: IAuctionLot; next_lot: IAuctionLot | null; settlement_refused?: string };

/**
 * on_block → settling → sold | unsold.
 *
 * The hammer is a CAS on the version the settlement was computed from (a bid landing after the read
 * makes it miss). A lot with a winner goes to `settling` — it holds the block, takes no bids, and the
 * winner's team and amount are frozen on it — and only reaches `sold`/`unsold` once Registration has
 * answered. Any unknown outcome leaves it `settling` (503); the next settle of that lot (an admin's
 * advance, the auto-settle tick, a close) replays the same keyed calls. The lot never goes back on the
 * block, so no second team can be charged while the first team's debit is in doubt (audit #2).
 */
async function settleLot(lotId: string, opts: { raiseNext: boolean; ignoreTimer: boolean }): Promise<SettleResult> {
    let lot = await AuctionLot.findById(lotId);
    if (!lot) throw new ServiceError(404, 'lot_not_found');

    const activeLot = () => AuctionLot.findOne({ event_id: lot!.event_id, status: { $in: ACTIVE_LOT_STATUSES } });
    if (lot.status === 'sold' || lot.status === 'unsold') {
        return { settled_lot: lot, next_lot: await activeLot() };
    }
    if (lot.status === 'queued') throw new ServiceError(400, 'lot_not_on_block');

    const event = await Event.findById(lot.event_id, { auction: 1, status: 1 });
    if (!event?.auction) throw new ServiceError(404, 'event_not_found');

    if (lot.status === 'on_block') {
        // A cancelled event sells nothing; its lot on the block was closed unsold by the cancel.
        if (event.status === 'cancelled') throw new ServiceError(409, 'event_cancelled');

        // The hammer falls when the server's timer says so, not when an admin clicks early.
        const now = new Date();
        if (!opts.ignoreTimer && event.auction.status === 'live' && lot.timer_ends_at && lot.timer_ends_at > now) {
            throw new ServiceError(409, 'timer_running');
        }

        const hasWinner = Boolean(lot.current_bidder && lot.current_bid != null);
        const hammered = await AuctionLot.findOneAndUpdate(
            { _id: lotId, status: 'on_block', version: lot.version },
            {
                $set: hasWinner ? { status: 'settling', closed_at: now } : { status: 'unsold', closed_at: now },
                $inc: { version: 1 },
            },
            { returnDocument: 'after' }
        );
        if (!hammered) {
            const again = await AuctionLot.findById(lotId);
            if (again && (again.status === 'sold' || again.status === 'unsold')) {
                return { settled_lot: again, next_lot: await activeLot() };
            }
            // A bid landed (version moved), or another settle took it to `settling` — retry.
            throw new ServiceError(409, 'lot_changed_retry');
        }
        lot = hammered;

        if (!hasWinner) {
            publish('BidClosed', PRODUCER, { event_id: lot.event_id, lot_id: lotId, winner_team_id: null, final_amount: null });
            publish('PlayerUnsold', PRODUCER, { event_id: lot.event_id, lot_id: lotId, player_user_id: lot.player.user_id });
            return finishSettlement(lot, opts);
        }
    }

    // `settling`: charge (or replay the charge of) the frozen winner.
    const teamId = lot.current_bidder!.team_id;
    const captainId = lot.current_bidder!.user_id;
    const amount = lot.current_bid!;
    let refused: string | null;
    try {
        refused = await chargeWinner(lot, teamId, amount);
    } catch (err) {
        invalidateAuctionLiveCache(lot.event_id);
        throw asServiceError(err);
    }

    const final = await AuctionLot.findOneAndUpdate(
        { _id: lotId, status: 'settling' },
        {
            $set: refused
                ? { status: 'unsold', sold_to_team_id: null, sold_amount: null }
                : { status: 'sold', sold_to_team_id: teamId, sold_amount: amount },
            $inc: { version: 1 },
        },
        { returnDocument: 'after' }
    );
    if (!final) {
        // A concurrent replay finalized it first; its publish stands.
        const settled = (await AuctionLot.findById(lotId))!;
        return { settled_lot: settled, next_lot: await activeLot() };
    }

    if (refused) {
        // The winner cannot pay or cannot take the player: unsold, rather than a sale that can never
        // complete wedging the auction.
        publish('BidClosed', PRODUCER, { event_id: final.event_id, lot_id: lotId, winner_team_id: null, final_amount: null });
        publish('PlayerUnsold', PRODUCER, { event_id: final.event_id, lot_id: lotId, player_user_id: final.player.user_id, reason: refused });
    } else {
        publish('BidClosed', PRODUCER, { event_id: final.event_id, lot_id: lotId, winner_team_id: teamId, final_amount: amount });
        publish('PlayerSold', PRODUCER, {
            event_id: final.event_id,
            lot_id: lotId,
            player_user_id: final.player.user_id,
            team_id: teamId,
            captain_user_id: captainId,
            amount,
        });
    }
    const result = await finishSettlement(final, opts);
    return refused ? { ...result, settlement_refused: refused } : result;
}

/** After a lot finalizes: raise the next one, or finish a live auction whose queue ran dry. */
async function finishSettlement(lot: IAuctionLot, opts: { raiseNext: boolean }): Promise<SettleResult> {
    let nextLot: IAuctionLot | null = null;
    if (opts.raiseNext) {
        nextLot = await raiseNextLot(lot.event_id);
        if (!nextLot && !(await AuctionLot.exists({ event_id: lot.event_id, status: { $in: ['queued', ...ACTIVE_LOT_STATUSES] } }))) {
            const fresh = await Event.findById(lot.event_id, { 'auction.status': 1 });
            if (fresh?.auction?.status === 'live') await finishAuction(lot.event_id);
        }
    }
    invalidateAuctionLiveCache(lot.event_id);
    return { settled_lot: lot, next_lot: nextLot };
}

export async function advanceLot(lotId: string, actor: Actor) {
    const lot = await AuctionLot.findById(lotId, { event_id: 1 });
    if (!lot) throw new ServiceError(404, 'lot_not_found');
    const event = await Event.findById(lot.event_id, { status: 1, created_by: 1, core_admins: 1 });
    if (!event) throw new ServiceError(404, 'lot_not_found');
    assertAdminOf(event, actor, 'lot_not_found');
    return settleLot(lotId, { raiseNext: true, ignoreTimer: false });
}

/**
 * "Auto-close on deadline": settle every lot whose server timer ran out in a live auction, and replay
 * any lot stuck `settling`. Run by the 2s tick on every instance — the version CAS and the keyed
 * Registration calls make concurrent runs harmless.
 * ponytail: 50 lots per tick across all auctions; there is one active lot per auction.
 */
export async function settleExpiredLots(now = new Date()): Promise<number> {
    const due = await AuctionLot.find(
        { $or: [{ status: 'on_block', timer_ends_at: { $lte: now } }, { status: 'settling' }] },
        { _id: 1, event_id: 1, status: 1 }
    )
        .limit(50)
        .lean();
    if (due.length === 0) return 0;

    const live = new Set(
        (
            await Event.find(
                { _id: { $in: [...new Set(due.map((l) => l.event_id))] }, 'auction.status': 'live' },
                { _id: 1 }
            ).lean()
        ).map((e) => e._id)
    );

    let settled = 0;
    for (const lot of due) {
        // A paused auction's expired timer is reset on resume; only a settling lot replays regardless.
        if (lot.status === 'on_block' && !live.has(lot.event_id)) continue;
        try {
            await settleLot(lot._id, { raiseNext: true, ignoreTimer: false });
            settled++;
        } catch (err) {
            const code = err instanceof ServiceError ? err.code : String(err);
            if (code !== 'lot_changed_retry' && code !== 'timer_running') {
                console.warn(`[event-service] auto-settle of lot ${lot._id} deferred: ${code}`);
            }
        }
    }
    return settled;
}

/* ------------------------------------------------------------------ *
 * OC overrides (spec §5.15.4)
 * ------------------------------------------------------------------ */

export async function overrideLotPrice(lotId: string, actor: Actor, input: OverridePriceInput): Promise<IAuctionLot> {
    const lot = await AuctionLot.findById(lotId);
    if (!lot) {
        throw new ServiceError(404, 'lot_not_found');
    }

    const event = await Event.findById(lot.event_id, { seat_holders: 0 });
    if (!event || !event.auction) {
        throw new ServiceError(404, 'lot_not_found');
    }
    assertAdminOf(event, actor, 'lot_not_found');

    // A base price is a pre-sale fact: re-pricing a lot on the block moves the floor mid-bidding,
    // and re-pricing a sold one rewrites history.
    if (lot.status !== 'queued') {
        throw new ServiceError(409, 'lot_not_queued');
    }

    const setPrice = () =>
        AuctionLot.findOneAndUpdate(
            { _id: lotId, status: 'queued' },
            { $set: { oc_adjusted_price: input.oc_adjusted_price } },
            { returnDocument: 'after' }
        );

    // Re-pricing an already overridden lot does not consume quota.
    if (lot.oc_adjusted_price !== null) {
        const updated = await setPrice();
        if (!updated) throw new ServiceError(409, 'lot_not_queued');
        invalidateAuctionLiveCache(event._id);
        return updated;
    }

    // `??`, not `||`: a quota of 0 means "no overrides", and `0 || 3/7` quietly allowed 3/7.
    const quota = event.auction.oc_override_quota ?? OC_OVERRIDE_QUOTA_MAX;
    const [totalLots, currentOverridden] = await Promise.all([
        AuctionLot.countDocuments({ event_id: event._id }),
        AuctionLot.countDocuments({ event_id: event._id, oc_adjusted_price: { $ne: null } }),
    ]);
    // ponytail: check-then-write — two concurrent overrides of different lots can both pass. A
    // per-event override counter CAS would close it if OCs ever race each other.
    if (!overrideQuotaAllows(totalLots, currentOverridden, quota)) {
        throw new ServiceError(422, 'oc_override_quota_exceeded');
    }

    const updated = await AuctionLot.findOneAndUpdate(
        { _id: lotId, status: 'queued', oc_adjusted_price: null },
        { $set: { oc_adjusted_price: input.oc_adjusted_price } },
        { returnDocument: 'after' }
    );
    invalidateAuctionLiveCache(event._id);
    if (updated) return updated;
    // Lost a race: overridden concurrently (fine, re-price it) or no longer queued.
    const retried = await setPrice();
    if (!retried) throw new ServiceError(409, 'lot_not_queued');
    return retried;
}

/** Spec §5.15.4: (overridden + 1) / total <= quota. Exported for the selfcheck. */
export function overrideQuotaAllows(total: number, overridden: number, quota: number): boolean {
    return total > 0 && (overridden + 1) / total <= quota;
}

export async function overrideCaptainBudget(ref: string, teamId: string, actor: Actor, input: OverrideCaptainBudgetInput) {
    const event = await adminEvent(ref, actor);
    if (event.auction!.status !== 'not_started') {
        throw new ServiceError(409, 'auction_already_started');
    }

    const team = await Team.findById(teamId, { owner: 1, status: 1, auction: 1 });
    if (!team || team.owner.type !== 'event' || team.owner.id !== event._id) {
        throw new ServiceError(404, 'team_not_found');
    }
    if (team.status === 'disbanded') {
        throw new ServiceError(400, 'team_is_disbanded');
    }
    if (team.auction?.is_overridden) {
        // A retry of the same override is a success, not a conflict (audit #2).
        if (team.auction.purse_total === input.purse_total) return team;
        throw new ServiceError(409, 'team_already_overridden');
    }

    const activeTeams: Record<string, unknown> = { 'owner.type': 'event', 'owner.id': event._id, status: { $ne: 'disbanded' } };
    const [totalTeams, currentOverridden] = await Promise.all([
        Team.countDocuments(activeTeams),
        Team.countDocuments({ ...activeTeams, 'auction.is_overridden': true }),
    ]);
    if (totalTeams === 0) {
        throw new ServiceError(400, 'no_teams_registered');
    }
    const quota = event.auction!.oc_captain_override_quota ?? OC_OVERRIDE_QUOTA_MAX;
    // ponytail: same check-then-write ceiling as the lot quota.
    if (!overrideQuotaAllows(totalTeams, currentOverridden, quota)) {
        throw new ServiceError(422, 'oc_captain_override_quota_exceeded');
    }

    // `teams` is Registration Service's collection; the write happens there.
    try {
        const updated = await setTeamAuctionBudget(teamId, {
            purse_total: input.purse_total,
            reason: input.reason ?? null,
            overridden_by: actor.id,
        });
        invalidateAuctionLiveCache(event._id);
        return updated;
    } catch (err) {
        throw asServiceError(err);
    }
}

export async function getBudgetPreview(ref: string, viewer: Actor) {
    const event = await adminEvent(ref, viewer);
    const [teams, sums] = await Promise.all([
        Team.find(
            { 'owner.type': 'event', 'owner.id': event._id, status: { $ne: 'disbanded' } },
            { name: 1, captain_user_id: 1, auction: 1 }
        ).lean(),
        AuctionLot.aggregate<{ n: number; sum: number }>([
            { $match: { event_id: event._id } },
            { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: '$base_price' } } },
        ]),
    ]);

    const total_lots = sums[0]?.n ?? 0;
    const sum_base_prices = sums[0]?.sum ?? 0;
    const k_multiplier = event.auction!.k_multiplier ?? 1.0;
    const purse_pool = Math.floor(k_multiplier * sum_base_prices);
    const total_teams = teams.length;

    let defaultPurse = event.auction!.purse_per_team;
    if (defaultPurse == null && total_teams > 0) {
        defaultPurse = Math.floor((k_multiplier * sum_base_prices) / total_teams);
    }
    const default_purse_per_team = defaultPurse ?? 0;

    return {
        total_lots,
        sum_base_prices,
        k_multiplier,
        purse_pool,
        total_teams,
        default_purse_per_team,
        oc_captain_override_quota: event.auction!.oc_captain_override_quota ?? OC_OVERRIDE_QUOTA_MAX,
        overridden_teams_count: teams.filter((t) => t.auction?.is_overridden === true).length,
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
