import assert from 'assert';
import { PointTransaction, PointTxClaim, ServiceError, User, idempotencyKey } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { drift, ledgerHooks, ledgerSum, record, voidKey } from '../points/ledger';
import { recalculate } from '../points/points.service';
import { balanceOf, closeScratchDb, openScratchDb, pass, resetLedger, rowsFor, seedUser, section } from './seed';

/**
 * The write path. What the model's own selfcheck
 * (models.selfcheck.ts:294-345) does not cover: everything that only shows up when two callers
 * arrive at once, or when the second half of a write fails.
 */

const credit = (user_id: string, amount: number, key: string) =>
    record({
        user_id,
        amount,
        type: 'earn',
        source: 'event',
        reason: 'event.participation',
        reference: { type: 'event', id: uuid() },
        idempotency_key: key,
        actor: { type: 'system', user_id: null },
    });

const spend = (user_id: string, amount: number, key: string, entry_id: string = uuid()) =>
    record({
        user_id,
        amount: -amount,
        type: 'spend',
        source: 'leaderboard',
        reason: 'leaderboard.investment',
        reference: { type: 'leaderboard_entry', id: entry_id },
        idempotency_key: key,
        actor: { type: 'user', user_id },
    });

/** A ServiceError with the expected status/code, not a model Error surfacing as a 500. */
async function refuses(promise: Promise<unknown>, status: number, code: string, what: string): Promise<void> {
    try {
        await promise;
        assert.fail(`expected ${what} to be refused ${status} ${code}`);
    } catch (err) {
        assert.ok(err instanceof ServiceError, `${what}: expected ServiceError, got ${String(err)}`);
        assert.strictEqual(err.status, status, `${what}: status`);
        assert.strictEqual(err.code, code, `${what}: code`);
    }
    pass(`${what} -> ${status} ${code}`);
}

async function main(): Promise<void> {
    await openScratchDb();

    section('a credit moves the cache and stamps the running balance');
    {
        const user = await seedUser(0);
        const { tx, replayed } = await credit(user._id, 40, uuid());
        assert.strictEqual(replayed, false);
        assert.strictEqual(tx.balance_after, 40, 'balance_after is the balance the $inc produced');
        assert.strictEqual(await balanceOf(user._id), 40, 'cache moved');
        pass('credit of 40 leaves balance 40 and balance_after 40');
    }

    section('idempotency');
    {
        const user = await seedUser(0);
        const key = idempotencyKey.eventParticipation(uuid());
        const first = await credit(user._id, 10, key);
        const second = await credit(user._id, 10, key);
        assert.strictEqual(second.replayed, true, 'second call is a replay');
        assert.strictEqual(second.tx._id, first.tx._id, 'and returns the same row');
        assert.strictEqual(await rowsFor(user._id), 1, 'one row');
        assert.strictEqual(await balanceOf(user._id), 10, 'balance moved once');
        pass('the same key twice writes one row and moves the balance once');
    }

    section('solvency under concurrency');
    {
        const user = await seedUser(10);
        // Ten callers, distinct keys, each spending the whole balance. The guard lives inside the
        // findOneAndUpdate filter, so exactly one can match.
        const results = await Promise.allSettled(
            Array.from({ length: 10 }, () => spend(user._id, 10, uuid()))
        );
        const ok = results.filter((r) => r.status === 'fulfilled');
        const refused = results.filter(
            (r) => r.status === 'rejected' && (r.reason as ServiceError).code === 'insufficient_points'
        );
        assert.strictEqual(ok.length, 1, 'exactly one spend succeeds');
        assert.strictEqual(refused.length, 9, 'the other nine are refused, not crashed');
        assert.strictEqual(await balanceOf(user._id), 0, 'balance lands at zero, never below');
        assert.strictEqual(await rowsFor(user._id), 1, 'and the ledger has exactly one row');
        pass('ten concurrent spends of the last 10 points: one wins, nine get 409');
    }

    section('refusals');
    {
        const user = await seedUser(5);
        await refuses(spend(user._id, 50, uuid()), 409, 'insufficient_points', 'a spend larger than the balance');
        assert.strictEqual(await balanceOf(user._id), 5, 'and it moved nothing');
        assert.strictEqual(await rowsFor(user._id), 0, 'and wrote nothing');

        await refuses(credit(uuid(), 10, uuid()), 404, 'user_not_found', 'a credit to a missing user');

        const deleted = await seedUser(0);
        await User.updateOne({ _id: deleted._id }, { $set: { deleted_at: new Date() } });
        await refuses(credit(deleted._id, 10, uuid()), 404, 'user_not_found', 'a credit to a deleted user');

        await refuses(credit(user._id, 0, uuid()), 422, 'invalid_amount', 'a zero-value row');
        await refuses(credit(user._id, 1.5, uuid()), 422, 'invalid_amount', 'a fractional row');
        await refuses(credit(user._id, -10, uuid()), 422, 'amount_sign_mismatch', "a negative 'earn'");
        await refuses(
            record({
                user_id: user._id,
                amount: 10,
                type: 'earn',
                source: 'event',
                reason: 'event.podiun.1',
                reference: { type: null, id: null },
                idempotency_key: uuid(),
                actor: { type: 'system', user_id: null },
            }),
            422,
            'unknown_reason',
            'a reason that is not a rule'
        );
        await refuses(
            record({
                user_id: user._id,
                amount: 10,
                type: 'earn',
                source: 'event',
                reason: 'event.participation',
                reference: { type: 'event', id: null },
                idempotency_key: uuid(),
                actor: { type: 'system', user_id: null },
            }),
            422,
            'invalid_reference',
            'a half-null reference'
        );
        await refuses(
            record({
                user_id: user._id,
                amount: 10,
                type: 'earn',
                source: 'admin',
                reason: 'admin.manual',
                reference: { type: null, id: null },
                idempotency_key: uuid(),
                actor: { type: 'admin', user_id: null },
            }),
            422,
            'invalid_actor',
            'an admin actor with no user_id'
        );
    }

    section('two callers, one key, at the same moment');
    {
        const user = await seedUser(0);
        const key = idempotencyKey.eventParticipation(uuid());
        // Both get past the dedupe read before either row lands, so one of them hits the unique
        // index and takes the compensation path. Neither may fail, and the balance must move once.
        const [a, b] = await Promise.all([credit(user._id, 10, key), credit(user._id, 10, key)]);
        assert.strictEqual(a.tx._id, b.tx._id, 'both callers end up with the same row');
        assert.strictEqual([a.replayed, b.replayed].filter(Boolean).length >= 1, true, 'one is a replay');
        assert.strictEqual(await rowsFor(user._id), 1, 'one row');
        assert.strictEqual(await balanceOf(user._id), 10, 'and the balance moved exactly once');
        pass('a duplicate-key race compensates and returns the winner');
    }

    section('one key, two callers, and a spend landing in the window');
    {
        const user = await seedUser(10);
        const key = idempotencyKey.eventParticipation(uuid());
        // Hold the winner between its $inc and its row, and land a spend of everything there. Before
        // the claim, the loser also $inc'd and then compensated after the spend: balance -5.
        let spent = false;
        ledgerHooks.afterMove = async () => {
            if (spent) return;
            spent = true;
            await spend(user._id, 20, uuid());
        };
        try {
            const [a, b] = await Promise.all([credit(user._id, 10, key), credit(user._id, 10, key)]);
            assert.strictEqual(a.tx._id, b.tx._id, 'one row, both callers');
            assert.strictEqual(a.tx.balance_after, 20, 'balance_after is what this credit produced');
        } finally {
            ledgerHooks.afterMove = async () => undefined;
        }
        assert.strictEqual(await PointTransaction.countDocuments({ idempotency_key: key }), 1, 'exactly one row');
        assert.strictEqual(await balanceOf(user._id), 0, 'moved once: 10 + 10 - 20, never negative');
        pass('the key is claimed before the balance moves');
    }

    section('compensation when the row does not land');
    {
        const user = await seedUser(100);
        const create = PointTransaction.create.bind(PointTransaction);
        // Exactly the failure window the write order was chosen for: the cache has already moved.
        (PointTransaction as unknown as { create: unknown }).create = () => {
            throw new Error('simulated insert failure');
        };
        try {
            await assert.rejects(credit(user._id, 25, uuid()), /simulated insert failure/);
        } finally {
            (PointTransaction as unknown as { create: unknown }).create = create;
        }
        assert.strictEqual(await balanceOf(user._id), 100, 'the $inc was undone');
        assert.strictEqual(await rowsFor(user._id), 0, 'and no row exists');
        pass('a failed insert leaves the balance exactly where it was');
    }

    section('drift detection and repair');
    {
        const user = await seedUser(0);
        await credit(user._id, 30, uuid());
        assert.strictEqual(await drift(user._id), 0, 'a healthy user has no drift');

        // Simulate the crash window: the cache moved, the row never landed.
        await User.updateOne({ _id: user._id }, { $inc: { points_balance: 7 } });
        assert.strictEqual(await drift(user._id), 7, 'drift is the gap to the newest balance_after');

        const repair = await recalculate(user._id, { id: 'selfcheck-admin', ip: null });
        assert.strictEqual(repair.repaired, true);
        assert.strictEqual(repair.balance, 30, 'the ledger wins');
        assert.strictEqual(await balanceOf(user._id), 30, 'and the cache is rewritten');
        assert.strictEqual(await drift(user._id), 0);

        const again = await recalculate(user._id, { id: 'selfcheck-admin', ip: null });
        assert.strictEqual(again.repaired, false, 'a second repair is a no-op');
        pass('drift is detected and repaired from the ledger');
    }

    section('a repair cannot clobber a transaction that lands while it is summing');
    {
        const user = await seedUser(0);
        await credit(user._id, 30, uuid());
        // Real drift, so the repair gets past its "nothing to fix" early return: cache 37, ledger 30.
        await User.updateOne({ _id: user._id }, { $inc: { points_balance: 7 } });

        // Now squeeze a real transaction into the window between the sum and the write. Without the
        // compare-and-swap the repair would $set the balance it computed BEFORE that credit,
        // silently destroying it - drift repaired by creating drift.
        // `require`, not `await import`: a dynamic import of a CommonJS module hands back a copied
        // namespace, and patching the copy leaves the real call site untouched - the test then
        // passes for no reason at all.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ledgerModule = require('../points/ledger') as { ledgerSum: typeof ledgerSum };
        const realSum = ledgerModule.ledgerSum;
        ledgerModule.ledgerSum = async (id: string) => {
            const total = await realSum(id);
            await credit(user._id, 5, uuid()); // lands mid-repair
            return total;
        };

        try {
            await assert.rejects(
                recalculate(user._id, { id: 'selfcheck-admin', ip: null }),
                (err: ServiceError) => err.status === 409 && err.code === 'balance_moved'
            );
        } finally {
            ledgerModule.ledgerSum = realSum;
        }

        assert.strictEqual(await balanceOf(user._id), 42, 'the concurrent credit survived untouched');
        pass('a lost compare-and-swap refuses rather than overwriting');
    }

    section('a claim its holder abandoned does not hold the key forever');
    {
        const user = await seedUser(0);
        const stale = new Date(Date.now() - 60_000);
        // A holder that died mid-move (claim `moving`, no row) and one that died before moving.
        const stuck = idempotencyKey.eventParticipation(uuid());
        const early = idempotencyKey.leaderboardInvestment(user._id, uuid(), uuid());
        await PointTxClaim.create({ _id: stuck, state: 'moving', owner: 'dead', user_id: user._id, lease_until: stale });
        await PointTxClaim.create({ _id: early, state: 'pending', owner: 'dead', user_id: user._id, lease_until: stale });
        assert.strictEqual(await voidKey(early), true, 'an expired pending claim is voided, not left in place');
        await refuses(credit(user._id, 10, stuck), 409, 'request_in_flight', 'a key held by a dead mover');

        await recalculate(user._id, { id: 'selfcheck-admin', ip: null });
        assert.strictEqual(
            (await credit(user._id, 10, stuck)).tx.amount,
            10,
            'after recalculate the key is free again'
        );
        pass('recalculate clears a dead mover; voidKey takes over an expired pending claim');
    }

    section('refundForInvestment restores spent points and dedupes on idempotency key');
    {
        const user = await seedUser(50);
        const entryId = uuid();
        const { LeaderboardEntry } = await import('@bgsc/shared');
        await LeaderboardEntry.create({
            _id: entryId,
            event_id: uuid(),
            participant: { type: 'user', id: user._id, display_name: 'Test' },
            registration_id: uuid(),
            raw: {},
            raw_score: 0,
            normalized_score: 0,
            invested_points: 20,
            final_score: 20,
            stats: { played: 0, won: 0, lost: 0, drawn: 0, round_reached: null, fails: null, eliminated: false },
            rank: null,
            previous_rank: null,
            last_scored_at: null,
            scored_by: null,
            version: 0,
        });

        const reqId = uuid();
        await spend(user._id, 20, idempotencyKey.leaderboardInvestment(user._id, entryId, reqId), entryId);
        assert.strictEqual(await balanceOf(user._id), 30);

        const { refundForInvestment } = await import('../points/points.service');
        const { tx: refundTx, replayed: r1 } = await refundForInvestment({
            user_id: user._id,
            amount: 20,
            reference: { type: 'leaderboard_entry', id: entryId },
            request_id: reqId,
        });
        assert.strictEqual(r1, false);
        assert.strictEqual(refundTx.type, 'refund');
        assert.strictEqual(refundTx.amount, 20);
        assert.strictEqual(await balanceOf(user._id), 50);

        const { tx: refundTx2, replayed: r2 } = await refundForInvestment({
            user_id: user._id,
            amount: 20,
            reference: { type: 'leaderboard_entry', id: entryId },
            request_id: reqId,
        });
        assert.strictEqual(r2, true);
        assert.strictEqual(refundTx2._id, refundTx._id);
        assert.strictEqual(await balanceOf(user._id), 50);
        pass('refundForInvestment compensates debited points and dedupes idempotently');

        // Bound to a real spend: no spend, someone else's, or a different amount mints nothing.
        const ref = { type: 'leaderboard_entry' as const, id: entryId };
        await refuses(refundForInvestment({ user_id: user._id, reference: ref, request_id: uuid() }), 404, 'spend_not_found', 'a refund with no spend behind it');
        const other = await seedUser(0);
        await refuses(refundForInvestment({ user_id: other._id, reference: ref, request_id: reqId }), 404, 'spend_not_found', "a refund of someone else's spend");
        const req2 = uuid();
        await spend(user._id, 10, idempotencyKey.leaderboardInvestment(user._id, entryId, req2), entryId);
        await refuses(
            refundForInvestment({ user_id: user._id, reference: ref, request_id: req2, amount: 99_999 }),
            409,
            'refund_amount_mismatch',
            'a refund larger than the spend'
        );
        assert.strictEqual(await balanceOf(other._id), 0);

        // "No spend" is final: the key was voided, so a late spend with it cannot land afterwards.
        const lateReq = uuid();
        await refuses(refundForInvestment({ user_id: user._id, reference: ref, request_id: lateReq }), 404, 'spend_not_found', 'a refund that arrives before its spend');
        await refuses(
            spend(user._id, 5, idempotencyKey.leaderboardInvestment(user._id, entryId, lateReq), entryId),
            409,
            'request_voided',
            'the spend that arrives after its refund'
        );

        // Refunds written under the retired keys count as refunds.
        const oldReq = uuid();
        const { tx: oldSpend } = await spend(user._id, 5, idempotencyKey.legacy.leaderboardInvestment(oldReq), entryId);
        await record({
            user_id: user._id,
            amount: 5,
            type: 'refund',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: entryId },
            idempotency_key: idempotencyKey.legacy.investmentRefund(oldReq),
            actor: { type: 'system', user_id: null },
        });
        const before = await balanceOf(user._id);
        const legacy = await refundForInvestment({ user_id: user._id, reference: ref, request_id: oldReq });
        assert.strictEqual(legacy.replayed, true, 'the legacy refund is the refund');
        assert.strictEqual(await balanceOf(user._id), before, 'nothing paid twice');
        assert.ok(oldSpend);
        pass('refunds are final, voiding late spends; legacy refund keys are honoured');
    }

    section('the ledger refuses save() of an existing row and bulkWrite');
    {
        const user = await seedUser(0);
        const { tx } = await credit(user._id, 5, uuid());
        const loaded = await PointTransaction.findById(tx._id);
        loaded!.amount = 500;
        await assert.rejects(loaded!.save(), /append-only/);
        await assert.rejects(
            PointTransaction.bulkWrite([{ deleteOne: { filter: { _id: tx._id } } }]),
            /append-only/
        );
        assert.strictEqual((await PointTransaction.findById(tx._id))?.amount, 5, 'the row is unchanged');
        pass('re-save and bulkWrite are refused');
    }

    await resetLedger();
    console.log('\nledger.selfcheck: all assertions passed.');
}

main()
    .catch((err) => {
        console.error('\nledger.selfcheck FAILED:', err);
        process.exitCode = 1;
    })
    .finally(closeScratchDb);
