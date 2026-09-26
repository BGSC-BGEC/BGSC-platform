import assert from 'assert';
import {
    CreateLotsSchema,
    OverrideCaptainBudgetSchema,
    OverridePriceSchema,
    PlaceBidSchema,
    TeamIdParamSchema,
    UpdateAuctionConfigSchema,
} from '../auction/auction.schemas';
import { overrideQuotaAllows } from '../auction/auction.service';

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

    // K is positive on update as on create; purse_per_team may go back to null (the computed default).
    assert.strictEqual(UpdateAuctionConfigSchema.safeParse({ k_multiplier: 0 }).success, false, 'rejects K = 0');
    assert.strictEqual(UpdateAuctionConfigSchema.safeParse({ purse_per_team: null }).success, true, 'purse_per_team resets to null');

    const invalidQuota = UpdateAuctionConfigSchema.safeParse({ oc_override_quota: 1.5 });
    assert.strictEqual(invalidQuota.success, false, 'rejects quota > 1.0');

    // The model caps the lot quota at 3/7; the schema used to allow 1 and the save 500'd.
    const overCeiling = UpdateAuctionConfigSchema.safeParse({ oc_override_quota: 0.5 });
    assert.strictEqual(overCeiling.success, false, 'rejects lot quota above the 3/7 ceiling');

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

// 5. The real quota predicate: a quota of 0 allows nothing (it used to fall back to 3/7 via `||`).
{
    assert.strictEqual(overrideQuotaAllows(7, 0, 0), false, 'quota 0 allows no overrides');
    assert.strictEqual(overrideQuotaAllows(7, 2, 3 / 7), true, '3rd of 7 allowed');
    assert.strictEqual(overrideQuotaAllows(7, 3, 3 / 7), false, '4th of 7 refused');
    assert.strictEqual(overrideQuotaAllows(0, 0, 1), false, 'no lots, nothing to override');
}

// Seat reservation, settlement and the rest run against MongoDB in event.db.selfcheck.ts.

console.log('auction service selfcheck: all assertions passed');

