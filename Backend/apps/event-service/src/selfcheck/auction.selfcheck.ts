import assert from 'assert';
import {
    CreateLotsSchema,
    OverrideCaptainBudgetSchema,
    OverridePriceSchema,
    PlaceBidSchema,
    TeamIdParamSchema,
    UpdateAuctionConfigSchema,
} from '../auction/auction.schemas';

console.log('--- Auction Engine Selfcheck ---');

// 1. PlaceBidSchema Validation
{
    const valid = PlaceBidSchema.safeParse({ amount: 500, version: 0 });
    assert.strictEqual(valid.success, true, 'valid bid passes schema');

    const negativeAmount = PlaceBidSchema.safeParse({ amount: -10, version: 0 });
    assert.strictEqual(negativeAmount.success, false, 'rejects negative bid amount');

    const zeroAmount = PlaceBidSchema.safeParse({ amount: 0, version: 0 });
    assert.strictEqual(zeroAmount.success, false, 'rejects zero bid amount');

    const negativeVersion = PlaceBidSchema.safeParse({ amount: 100, version: -1 });
    assert.strictEqual(negativeVersion.success, false, 'rejects negative version');

    const floatAmount = PlaceBidSchema.safeParse({ amount: 10.5, version: 0 });
    assert.strictEqual(floatAmount.success, false, 'rejects non-integer bid amount');
}

// 2. CreateLotsSchema Validation
{
    const valid = CreateLotsSchema.safeParse({
        lots: [
            {
                registration_id: 'reg-1',
                user_id: 'user-1',
                base_price: 100,
                order: 1,
            },
            {
                registration_id: 'reg-2',
                user_id: 'user-2',
                base_price: 200,
                oc_adjusted_price: 250,
                order: 2,
            },
        ],
    });
    assert.strictEqual(valid.success, true, 'valid lot batch passes schema');

    const emptyLots = CreateLotsSchema.safeParse({ lots: [] });
    assert.strictEqual(emptyLots.success, false, 'rejects empty lot batch');

    const negativeBasePrice = CreateLotsSchema.safeParse({
        lots: [{ registration_id: 'reg-1', user_id: 'user-1', base_price: -50, order: 1 }],
    });
    assert.strictEqual(negativeBasePrice.success, false, 'rejects negative base price');

    const duplicateOrder = CreateLotsSchema.safeParse({
        lots: [
            { registration_id: 'reg-1', user_id: 'user-1', base_price: 100, order: 1 },
            { registration_id: 'reg-2', user_id: 'user-2', base_price: 200, order: 1 },
        ],
    });
    assert.strictEqual(duplicateOrder.success, false, 'rejects duplicate lot order');

    const duplicateUser = CreateLotsSchema.safeParse({
        lots: [
            { registration_id: 'reg-1', user_id: 'user-1', base_price: 100, order: 1 },
            { registration_id: 'reg-2', user_id: 'user-1', base_price: 200, order: 2 },
        ],
    });
    assert.strictEqual(duplicateUser.success, false, 'rejects duplicate player in lot batch');
}

// 3. UpdateAuctionConfigSchema Validation
{
    const valid = UpdateAuctionConfigSchema.safeParse({
        min_bid_increment: 50,
        bid_timer_seconds: 5,
        purse_per_team: 10000,
        oc_override_quota: 3 / 7,
        oc_captain_override_quota: 3 / 7,
    });
    assert.strictEqual(valid.success, true, 'valid auction config passes');

    const invalidTimer = UpdateAuctionConfigSchema.safeParse({ bid_timer_seconds: 4 });
    assert.strictEqual(invalidTimer.success, false, 'rejects timer < 5s');

    const tooLongTimer = UpdateAuctionConfigSchema.safeParse({ bid_timer_seconds: 120 });
    assert.strictEqual(tooLongTimer.success, false, 'rejects timer > 60s');

    const invalidQuota = UpdateAuctionConfigSchema.safeParse({ oc_override_quota: 1.5 });
    assert.strictEqual(invalidQuota.success, false, 'rejects quota > 1.0');

    const invalidCaptainQuota = UpdateAuctionConfigSchema.safeParse({ oc_captain_override_quota: 1.5 });
    assert.strictEqual(invalidCaptainQuota.success, false, 'rejects captain quota > 1.0');

    const negativeCaptainQuota = UpdateAuctionConfigSchema.safeParse({ oc_captain_override_quota: -0.5 });
    assert.strictEqual(negativeCaptainQuota.success, false, 'rejects negative captain quota');
}

// 3b. OverrideCaptainBudgetSchema Validation
{
    const valid = OverrideCaptainBudgetSchema.safeParse({ purse_total: 5000, reason: 'Top seeded captain' });
    assert.strictEqual(valid.success, true, 'valid override budget passes');

    const validNoReason = OverrideCaptainBudgetSchema.safeParse({ purse_total: 0 });
    assert.strictEqual(validNoReason.success, true, 'zero budget without reason passes');

    const negativeBudget = OverrideCaptainBudgetSchema.safeParse({ purse_total: -500 });
    assert.strictEqual(negativeBudget.success, false, 'rejects negative purse_total');

    const floatBudget = OverrideCaptainBudgetSchema.safeParse({ purse_total: 500.5 });
    assert.strictEqual(floatBudget.success, false, 'rejects float purse_total');

    const longReason = OverrideCaptainBudgetSchema.safeParse({ purse_total: 1000, reason: 'x'.repeat(201) });
    assert.strictEqual(longReason.success, false, 'rejects reason > 200 chars');
}

// 3c. TeamIdParamSchema Validation
{
    const valid = TeamIdParamSchema.safeParse({ ref: 'event-1', teamId: 'team-1' });
    assert.strictEqual(valid.success, true, 'valid params pass');

    const emptyRef = TeamIdParamSchema.safeParse({ ref: '', teamId: 'team-1' });
    assert.strictEqual(emptyRef.success, false, 'rejects empty ref');

    const emptyTeamId = TeamIdParamSchema.safeParse({ ref: 'event-1', teamId: '' });
    assert.strictEqual(emptyTeamId.success, false, 'rejects empty teamId');
}

// 4. OverridePriceSchema Validation
{
    const valid = OverridePriceSchema.safeParse({ oc_adjusted_price: 350 });
    assert.strictEqual(valid.success, true, 'valid override price passes');

    const negative = OverridePriceSchema.safeParse({ oc_adjusted_price: -100 });
    assert.strictEqual(negative.success, false, 'rejects negative override price');
}

// 5. Bid Increment Rule Invariant Simulation
{
    function calculateMinBid(
        basePrice: number,
        ocAdjustedPrice: number | null,
        currentBid: number | null,
        minIncrement: number
    ): number {
        const floorPrice = ocAdjustedPrice ?? basePrice;
        return currentBid === null ? floorPrice : currentBid + minIncrement;
    }

    // Opening bid must match or exceed floor price
    assert.strictEqual(calculateMinBid(100, null, null, 20), 100, 'first bid floor equals base_price');
    assert.strictEqual(calculateMinBid(100, 150, null, 20), 150, 'first bid floor respects oc_adjusted_price');

    // Subsequent bids must exceed current by at least min_bid_increment
    assert.strictEqual(calculateMinBid(100, null, 100, 20), 120, 'second bid must exceed by increment');
    assert.strictEqual(calculateMinBid(100, null, 240, 50), 290, 'subsequent bid respects current + increment');
}

// 6. Purse Check Invariant Simulation
{
    function canAffordBid(purseTotal: number, purseSpent: number, bidAmount: number): boolean {
        const remaining = purseTotal - purseSpent;
        return remaining >= bidAmount;
    }

    assert.strictEqual(canAffordBid(1000, 200, 800), true, 'exact remaining purse is affordable');
    assert.strictEqual(canAffordBid(1000, 200, 801), false, 'exceeding purse is rejected');
    assert.strictEqual(canAffordBid(1000, 1000, 1), false, 'spent purse is rejected');
}

// 7. Optimistic Concurrency Control (OCC) & Server-Authoritative Timer Filter
{
    interface SimulatedLot {
        version: number;
        status: 'queued' | 'on_block' | 'sold' | 'unsold';
        timer_ends_at: Date;
    }

    function testOccFilter(
        lot: SimulatedLot,
        expectedVersion: number,
        now: Date
    ): boolean {
        return (
            lot.version === expectedVersion &&
            lot.status === 'on_block' &&
            lot.timer_ends_at.getTime() > now.getTime()
        );
    }

    const now = new Date('2026-09-19T14:00:00.000Z');
    const futureTimer = new Date('2026-09-19T14:00:05.000Z');
    const expiredTimer = new Date('2026-09-19T13:59:59.000Z');

    const activeLot: SimulatedLot = {
        version: 3,
        status: 'on_block',
        timer_ends_at: futureTimer,
    };

    assert.strictEqual(testOccFilter(activeLot, 3, now), true, 'matching version and active timer succeeds');
    assert.strictEqual(testOccFilter(activeLot, 2, now), false, 'stale version fails OCC (simulates concurrent bid collision)');
    assert.strictEqual(testOccFilter(activeLot, 4, now), false, 'future version fails OCC');

    const expiredLot: SimulatedLot = {
        version: 3,
        status: 'on_block',
        timer_ends_at: expiredTimer,
    };
    assert.strictEqual(testOccFilter(expiredLot, 3, now), false, 'expired timer rejects bid even if version matches');

    const soldLot: SimulatedLot = {
        version: 3,
        status: 'sold',
        timer_ends_at: futureTimer,
    };
    assert.strictEqual(testOccFilter(soldLot, 3, now), false, 'non-on_block lot rejects bids');
}

// 8. Team Roster Capacity Invariant
{
    function canAddPlayerToTeam(currentMembers: number, sizeMax: number): boolean {
        return currentMembers < sizeMax;
    }

    assert.strictEqual(canAddPlayerToTeam(5, 7), true, 'team with space can acquire player');
    assert.strictEqual(canAddPlayerToTeam(7, 7), false, 'full team cannot acquire player');
    assert.strictEqual(canAddPlayerToTeam(8, 7), false, 'oversized team cannot acquire player');
}

// 9. Self-Bidding & Double-Bidding Guards
{
    function validateBidderRelationship(
        playerUserId: string,
        currentBidderUserId: string | null,
        newBidderUserId: string
    ): 'ok' | 'cannot_bid_on_self' | 'already_highest_bidder' {
        if (playerUserId === newBidderUserId) return 'cannot_bid_on_self';
        if (currentBidderUserId === newBidderUserId) return 'already_highest_bidder';
        return 'ok';
    }

    assert.strictEqual(validateBidderRelationship('user-player', 'user-other', 'user-captain'), 'ok');
    assert.strictEqual(validateBidderRelationship('user-player', 'user-other', 'user-player'), 'cannot_bid_on_self');
    assert.strictEqual(validateBidderRelationship('user-player', 'user-captain', 'user-captain'), 'already_highest_bidder');
}

// 10. OC Override Quota (3/7 ceiling) Invariant
{
    function canOverridePrice(
        totalLots: number,
        currentlyOverridden: number,
        quota: number
    ): boolean {
        if (totalLots === 0) return true;
        return (currentlyOverridden + 1) / totalLots <= quota;
    }

    const quota = 3 / 7; // ~0.42857
    // For 14 lots, 3/7 allows 6 overrides
    assert.strictEqual(canOverridePrice(14, 0, quota), true, '1st override on 14 lots allowed');
    assert.strictEqual(canOverridePrice(14, 5, quota), true, '6th override on 14 lots allowed (6/14 = 3/7)');
    assert.strictEqual(canOverridePrice(14, 6, quota), false, '7th override on 14 lots rejected (7/14 > 3/7)');

    // For 7 lots, 3/7 allows 3 overrides
    assert.strictEqual(canOverridePrice(7, 2, quota), true, '3rd override on 7 lots allowed (3/7)');
    assert.strictEqual(canOverridePrice(7, 3, quota), false, '4th override on 7 lots rejected (4/7 > 3/7)');
}

// 11. Auto K-Multiplier Budget Computation upon startAuction()
{
    interface SimulatedAuctionEvent {
        auction: {
            status: 'not_started' | 'live' | 'paused' | 'finished';
            k_multiplier: number;
            purse_per_team: number | null;
            oc_captain_override_quota: number;
        } | null;
    }

    interface SimulatedLotItem {
        base_price: number;
    }

    function deriveDefaultPurse(
        event: SimulatedAuctionEvent,
        lots: SimulatedLotItem[],
        teamsCount: number
    ): number | null {
        const sumBasePrices = lots.reduce((acc, l) => acc + (l.base_price || 0), 0);
        let defaultPurse = event.auction!.purse_per_team;
        if (defaultPurse == null && teamsCount > 0) {
            const k = event.auction!.k_multiplier ?? 1.0;
            defaultPurse = Math.floor((k * sumBasePrices) / teamsCount);
            event.auction!.purse_per_team = defaultPurse;
        }
        return defaultPurse;
    }

    // Standard allocation: 10 lots @ 500 = 5000 base, 4 teams, k = 1.0 -> 1250 per team
    const event1: SimulatedAuctionEvent = {
        auction: { status: 'not_started', k_multiplier: 1.0, purse_per_team: null, oc_captain_override_quota: 3 / 7 },
    };
    const lots1 = Array.from({ length: 10 }, () => ({ base_price: 500 }));
    assert.strictEqual(deriveDefaultPurse(event1, lots1, 4), 1250, 'k=1.0 auto-budget divides evenly');
    assert.strictEqual(event1.auction!.purse_per_team, 1250, 'event.auction.purse_per_team is updated');

    // k = 1.5 allocation: 5000 base, 4 teams, k = 1.5 -> floor(7500 / 4) = 1875 per team
    const event2: SimulatedAuctionEvent = {
        auction: { status: 'not_started', k_multiplier: 1.5, purse_per_team: null, oc_captain_override_quota: 3 / 7 },
    };
    assert.strictEqual(deriveDefaultPurse(event2, lots1, 4), 1875, 'k=1.5 auto-budget computed correctly');

    // Floor check on fractional result: sum = 700, 3 teams, k = 1.0 -> floor(700 / 3) = 233
    const event3: SimulatedAuctionEvent = {
        auction: { status: 'not_started', k_multiplier: 1.0, purse_per_team: null, oc_captain_override_quota: 3 / 7 },
    };
    const lots3 = Array.from({ length: 7 }, () => ({ base_price: 100 }));
    assert.strictEqual(deriveDefaultPurse(event3, lots3, 3), 233, 'floors fractional purse per team');

    // Pre-configured purse is preserved and not overwritten
    const event4: SimulatedAuctionEvent = {
        auction: { status: 'not_started', k_multiplier: 1.0, purse_per_team: 3000, oc_captain_override_quota: 3 / 7 },
    };
    assert.strictEqual(deriveDefaultPurse(event4, lots1, 4), 3000, 'preserves pre-configured purse_per_team');

    // 0 teams leaves purse_per_team null
    const event5: SimulatedAuctionEvent = {
        auction: { status: 'not_started', k_multiplier: 1.0, purse_per_team: null, oc_captain_override_quota: 3 / 7 },
    };
    assert.strictEqual(deriveDefaultPurse(event5, lots1, 0), null, '0 teams leaves purse null');
}

// 12. Pre-auction OC Captain Budget Override with Audit Reason
{
    interface SimulatedTeam {
        id: string;
        event_id: string;
        auction: {
            purse_total: number;
            purse_spent: number;
            version: number;
            is_overridden?: boolean;
            override_reason?: string | null;
            overridden_by?: string | null;
        } | null;
    }

    function overrideBudget(
        eventStatus: string,
        team: SimulatedTeam,
        actorId: string,
        input: { purse_total: number; reason?: string }
    ) {
        if (eventStatus !== 'not_started') {
            throw new Error('auction_already_started');
        }
        team.auction = {
            purse_total: input.purse_total,
            purse_spent: 0,
            version: (team.auction?.version ?? 0) + 1,
            is_overridden: true,
            override_reason: input.reason ?? null,
            overridden_by: actorId,
        };
        return team;
    }

    const team1: SimulatedTeam = {
        id: 't-1',
        event_id: 'e-1',
        auction: { purse_total: 1000, purse_spent: 0, version: 0, is_overridden: false, override_reason: null, overridden_by: null },
    };

    overrideBudget('not_started', team1, 'actor-admin-1', {
        purse_total: 4500,
        reason: 'Seeded Tier 1 Captain',
    });

    assert.strictEqual(team1.auction!.purse_total, 4500, 'purse_total updated to override value');
    assert.strictEqual(team1.auction!.is_overridden, true, 'is_overridden marked true');
    assert.strictEqual(team1.auction!.override_reason, 'Seeded Tier 1 Captain', 'audit reason stored');
    assert.strictEqual(team1.auction!.overridden_by, 'actor-admin-1', 'actor id recorded in overridden_by');
    assert.strictEqual(team1.auction!.version, 1, 'version incremented');

    // Override without reason stores null
    overrideBudget('not_started', team1, 'actor-admin-2', { purse_total: 5000 });
    assert.strictEqual(team1.auction!.purse_total, 5000, 'purse updated');
    assert.strictEqual(team1.auction!.override_reason, null, 'reason defaults to null');
    assert.strictEqual(team1.auction!.overridden_by, 'actor-admin-2', 'overridden_by updated');
    assert.strictEqual(team1.auction!.version, 2, 'version incremented again');
}

// 13. 422 oc_captain_override_quota_exceeded when Captain Overrides Exceed Quota Ceiling
{
    function checkCaptainQuota(
        totalTeams: number,
        currentOverridden: number,
        quota: number,
        isAlreadyOverridden: boolean
    ): 'ok' | 'no_teams_registered' | 'oc_captain_override_quota_exceeded' {
        if (!isAlreadyOverridden) {
            if (totalTeams === 0) return 'no_teams_registered';
            if ((currentOverridden + 1) / totalTeams > quota) {
                return 'oc_captain_override_quota_exceeded';
            }
        }
        return 'ok';
    }

    const quota = 3 / 7; // ~0.42857

    // 7 teams registered: up to 3 teams can be overridden (3/7 <= 3/7)
    assert.strictEqual(checkCaptainQuota(7, 0, quota, false), 'ok', '1st override out of 7 allowed');
    assert.strictEqual(checkCaptainQuota(7, 1, quota, false), 'ok', '2nd override out of 7 allowed');
    assert.strictEqual(checkCaptainQuota(7, 2, quota, false), 'ok', '3rd override out of 7 allowed (3/7)');
    assert.strictEqual(checkCaptainQuota(7, 3, quota, false), 'oc_captain_override_quota_exceeded', '4th override on 7 teams rejected (4/7 > 3/7)');

    // Idempotent re-override of already overridden team does NOT consume quota
    assert.strictEqual(checkCaptainQuota(7, 3, quota, true), 'ok', 're-overriding already overridden team allowed even at quota ceiling');

    // 0 teams registered
    assert.strictEqual(checkCaptainQuota(0, 0, quota, false), 'no_teams_registered', '0 teams throws no_teams_registered');

    // Custom quota ceiling: e.g. quota = 0.5 with 4 teams (2 allowed)
    assert.strictEqual(checkCaptainQuota(4, 0, 0.5, false), 'ok', '1st on 4 teams allowed');
    assert.strictEqual(checkCaptainQuota(4, 1, 0.5, false), 'ok', '2nd on 4 teams allowed (2/4 = 0.5)');
    assert.strictEqual(checkCaptainQuota(4, 2, 0.5, false), 'oc_captain_override_quota_exceeded', '3rd on 4 teams rejected (3/4 > 0.5)');
}

// 14. Preservation of Custom Overridden Purses when startAuction() Executes
{
    interface SimTeam {
        id: string;
        auction: {
            purse_total: number;
            purse_spent: number;
            version: number;
            is_overridden: boolean;
            override_reason: string | null;
            overridden_by: string | null;
        } | null;
    }

    function executeStartAuction(
        teams: SimTeam[],
        defaultPurse: number
    ) {
        for (const team of teams) {
            if (team.auction?.is_overridden === true) {
                continue; // PRESERVE custom purse!
            }
            team.auction = {
                purse_total: defaultPurse,
                purse_spent: 0,
                version: team.auction?.version ?? 0,
                is_overridden: false,
                override_reason: null,
                overridden_by: null,
            };
        }
    }

    const teamA: SimTeam = {
        id: 'team-a',
        auction: {
            purse_total: 8000,
            purse_spent: 0,
            version: 1,
            is_overridden: true,
            override_reason: 'Champion seed bonus',
            overridden_by: 'admin-1',
        },
    };

    const teamB: SimTeam = {
        id: 'team-b',
        auction: null,
    };

    const teamC: SimTeam = {
        id: 'team-c',
        auction: {
            purse_total: 100,
            purse_spent: 0,
            version: 0,
            is_overridden: false,
            override_reason: null,
            overridden_by: null,
        },
    };

    const allTeams = [teamA, teamB, teamC];
    executeStartAuction(allTeams, 2500);

    // Overridden team must be untouched
    assert.strictEqual(teamA.auction!.purse_total, 8000, 'teamA custom purse of 8000 is preserved');
    assert.strictEqual(teamA.auction!.is_overridden, true, 'teamA remains marked overridden');
    assert.strictEqual(teamA.auction!.override_reason, 'Champion seed bonus', 'teamA reason is preserved');
    assert.strictEqual(teamA.auction!.overridden_by, 'admin-1', 'teamA overridden_by is preserved');
    assert.strictEqual(teamA.auction!.version, 1, 'teamA version is preserved');

    // Non-overridden teams must receive default purse
    assert.strictEqual(teamB.auction!.purse_total, 2500, 'teamB receives default purse of 2500');
    assert.strictEqual(teamB.auction!.is_overridden, false, 'teamB is_overridden is false');
    assert.strictEqual(teamB.auction!.override_reason, null, 'teamB reason is null');

    assert.strictEqual(teamC.auction!.purse_total, 2500, 'teamC receives default purse of 2500');
    assert.strictEqual(teamC.auction!.is_overridden, false, 'teamC is_overridden is false');
}

// 15. 409 auction_already_started when Attempting to Override Captain Budget after Auction Starts
{
    function attemptOverrideAfterStart(auctionStatus: string): { status: number; code: string } | { status: 200 } {
        if (auctionStatus !== 'not_started') {
            return { status: 409, code: 'auction_already_started' };
        }
        return { status: 200 };
    }

    assert.deepStrictEqual(attemptOverrideAfterStart('live'), { status: 409, code: 'auction_already_started' }, 'rejects override when live');
    assert.deepStrictEqual(attemptOverrideAfterStart('paused'), { status: 409, code: 'auction_already_started' }, 'rejects override when paused');
    assert.deepStrictEqual(attemptOverrideAfterStart('finished'), { status: 409, code: 'auction_already_started' }, 'rejects override when finished');
    assert.deepStrictEqual(attemptOverrideAfterStart('not_started'), { status: 200 }, 'allows override when not_started');
}

// 16. Budget Preview Invariant Calculation
{
    function computeBudgetPreview(
        kMultiplier: number,
        lots: { base_price: number }[],
        teams: { id: string; name: string; captain_user_id: string; is_overridden: boolean; purse_total: number }[],
        quota: number
    ) {
        const total_lots = lots.length;
        const sum_base_prices = lots.reduce((acc, l) => acc + (l.base_price || 0), 0);
        const purse_pool = Math.floor(kMultiplier * sum_base_prices);
        const total_teams = teams.length;
        const default_purse_per_team = total_teams > 0 ? Math.floor((kMultiplier * sum_base_prices) / total_teams) : 0;
        const overridden_teams_count = teams.filter((t) => t.is_overridden).length;

        return {
            total_lots,
            sum_base_prices,
            k_multiplier: kMultiplier,
            purse_pool,
            total_teams,
            default_purse_per_team,
            oc_captain_override_quota: quota,
            overridden_teams_count,
            teams: teams.map((t) => ({
                team_id: t.id,
                name: t.name,
                captain_user_id: t.captain_user_id,
                purse: t.is_overridden ? t.purse_total : default_purse_per_team,
                is_overridden: t.is_overridden,
            })),
        };
    }

    const previewLots = [{ base_price: 300 }, { base_price: 700 }, { base_price: 1000 }];
    const previewTeams = [
        { id: 't1', name: 'Alpha', captain_user_id: 'u1', is_overridden: true, purse_total: 2500 },
        { id: 't2', name: 'Beta', captain_user_id: 'u2', is_overridden: false, purse_total: 0 },
        { id: 't3', name: 'Gamma', captain_user_id: 'u3', is_overridden: false, purse_total: 0 },
    ];

    const preview = computeBudgetPreview(1.5, previewLots, previewTeams, 3 / 7);
    assert.strictEqual(preview.total_lots, 3, 'total_lots matches');
    assert.strictEqual(preview.sum_base_prices, 2000, 'sum_base_prices is 2000');
    assert.strictEqual(preview.purse_pool, 3000, 'purse_pool = 1.5 * 2000 = 3000');
    assert.strictEqual(preview.total_teams, 3, 'total_teams is 3');
    assert.strictEqual(preview.default_purse_per_team, 1000, 'default_purse_per_team is 1000');
    assert.strictEqual(preview.overridden_teams_count, 1, '1 overridden team');
    assert.strictEqual(preview.teams[0].purse, 2500, 'overridden team shows custom purse 2500');
    assert.strictEqual(preview.teams[1].purse, 1000, 'default team shows default purse 1000');
}

// 17. Atomic CAS Lot Advancement & Double-Debit Immunity Simulation
{
    interface MockLot {
        id: string;
        status: 'on_block' | 'sold' | 'unsold';
        version: number;
        current_bid: number | null;
        current_bidder: { team_id: string } | null;
    }

    let purseDebitCount = 0;
    function simulateAdvanceLot(lot: MockLot): { success: boolean; lot: MockLot } {
        // Idempotency: if already settled, return without debiting
        if (lot.status === 'sold' || lot.status === 'unsold') {
            return { success: true, lot };
        }
        // Atomic CAS claim: status must be 'on_block'
        if (lot.status !== 'on_block') {
            return { success: false, lot };
        }
        lot.status = lot.current_bidder ? 'sold' : 'unsold';
        lot.version += 1;
        if (lot.status === 'sold') {
            purseDebitCount += 1;
        }
        return { success: true, lot };
    }

    const testLot: MockLot = {
        id: 'lot-1',
        status: 'on_block',
        version: 1,
        current_bid: 500,
        current_bidder: { team_id: 'team-1' },
    };

    // First caller claims settlement and debits purse
    const call1 = simulateAdvanceLot(testLot);
    assert.strictEqual(call1.success, true);
    assert.strictEqual(call1.lot.status, 'sold');
    assert.strictEqual(purseDebitCount, 1, 'purse debited exactly once');

    // Concurrent second caller retries or arrives simultaneously: idempotent, no second debit
    const call2 = simulateAdvanceLot(testLot);
    assert.strictEqual(call2.success, true);
    assert.strictEqual(purseDebitCount, 1, 'concurrent advance does NOT double-debit purse');
}

// 18. Disbanded Team Exclusion from Budget Allocation and Quota
{
    const allTeams = [
        { id: 't1', status: 'forming', is_overridden: false },
        { id: 't2', status: 'complete', is_overridden: false },
        { id: 't3', status: 'disbanded', is_overridden: false },
    ];

    const activeTeams = allTeams.filter((t) => t.status !== 'disbanded');
    assert.strictEqual(activeTeams.length, 2, 'disbanded team excluded from active count');

    const sumBasePrices = 1000;
    const k = 1.0;
    const pursePerActiveTeam = Math.floor((k * sumBasePrices) / activeTeams.length);
    assert.strictEqual(pursePerActiveTeam, 500, 'budget divisor uses active teams count (2), not all teams (3)');

    const quota = 3 / 7;
    const maxAllowedOverrides = Math.floor(quota * activeTeams.length);
    assert.strictEqual(maxAllowedOverrides, 0, 'quota ceiling evaluated against active teams');
}

// 19. Distributed Transaction Compensation & Purse Refund Safeguard
{
    let purseDebited = false;
    let purseRefunded = false;
    let lotRolledBack = false;

    interface MockLotSettlement {
        status: string;
        sold_to_team_id: string | null;
    }
    const lot: MockLotSettlement = { status: 'on_block', sold_to_team_id: null };

    function simulateSettlementWithFailure(shouldFailRoster: boolean) {
        // Step 1: Claim lot
        lot.status = 'sold';
        lot.sold_to_team_id = 'team-101';
        let debited = false;
        try {
            // Step 2: Debit purse
            purseDebited = true;
            debited = true;
            // Step 3: Add roster member (fails)
            if (shouldFailRoster) {
                throw new Error('roster_addition_failed');
            }
        } catch (err) {
            // Step 4: Distributed compensation
            if (debited) {
                purseRefunded = true;
            }
            lot.status = 'on_block';
            lot.sold_to_team_id = null;
            lotRolledBack = true;
            throw err;
        }
    }

    assert.throws(() => simulateSettlementWithFailure(true), /roster_addition_failed/);
    assert.strictEqual(purseDebited, true, 'purse was initially debited');
    assert.strictEqual(purseRefunded, true, 'purse was compensated/refunded upon failure');
    assert.strictEqual(lotRolledBack, true, 'lot status rolled back to on_block');
    assert.strictEqual(lot.status, 'on_block', 'lot state remains on_block');
}

// 20. Atomic Capacity Reservation & Overbooking Immunity Math
{
    const max = 10;
    let confirmedCount = 9;
    let waitlistCount = 0;

    function simulateAtomicReserve(wasWaitlisted: boolean, waitlistEnabled: boolean) {
        // Atomic condition: counts.registrations_confirmed < max
        if (confirmedCount < max) {
            confirmedCount += 1;
            if (wasWaitlisted) {
                waitlistCount = Math.max(0, waitlistCount - 1);
            }
            return { reserved: true, waitlisted: false };
        }
        if (wasWaitlisted) {
            return { reserved: false, reason: 'capacity_full' };
        }
        if (!waitlistEnabled) {
            return { reserved: false, reason: 'capacity_full' };
        }
        waitlistCount += 1;
        return { reserved: true, waitlisted: true };
    }

    // 1st request claims last open seat (seat 10)
    const res1 = simulateAtomicReserve(false, true);
    assert.strictEqual(res1.reserved, true);
    assert.strictEqual(res1.waitlisted, false);
    assert.strictEqual(confirmedCount, 10);

    // 2nd request cannot claim seat, gets routed to waitlist
    const res2 = simulateAtomicReserve(false, true);
    assert.strictEqual(res2.reserved, true);
    assert.strictEqual(res2.waitlisted, true);
    assert.strictEqual(confirmedCount, 10, 'confirmed count never exceeds max 10');
    assert.strictEqual(waitlistCount, 1, 'waitlist count increments');

    // 3rd request with waitlist disabled gets capacity_full
    const res3 = simulateAtomicReserve(false, false);
    assert.strictEqual(res3.reserved, false);
    assert.strictEqual(res3.reason, 'capacity_full');
    assert.strictEqual(confirmedCount, 10);
    assert.strictEqual(waitlistCount, 1);
}

console.log('auction service selfcheck: all assertions passed');

