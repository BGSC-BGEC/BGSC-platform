import assert from 'assert';
import { PointTransaction, idempotencyKey } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { record, signed } from '../points/ledger';
import { tick } from '../scheduler/expiry';
import { balanceOf, closeScratchDb, openScratchDb, pass, resetLedger, rowsFor, seedUser, section } from './seed';

/** The expiry sweep (be2-points-service-plan.md §12.4). */

const creditExpiring = (user_id: string, amount: number, expires_at: Date | null) =>
    record({
        user_id,
        amount: signed('earn', amount),
        type: 'earn',
        source: 'engagement',
        reason: 'engagement.profile_completed',
        reference: { type: null, id: null },
        idempotency_key: uuid(),
        actor: { type: 'system', user_id: null },
        expires_at,
    });

const past = () => new Date(Date.now() - 60_000);

async function main(): Promise<void> {
    await openScratchDb();

    section('a due credit expires exactly once');
    {
        const user = await seedUser(0);
        const { tx } = await creditExpiring(user._id, 30, past());

        assert.strictEqual(await tick(), 1, 'one credit swept');
        assert.strictEqual(await balanceOf(user._id), 0, 'the points are gone');

        const expiry = await PointTransaction.findOne({ type: 'expire', user_id: user._id });
        assert.strictEqual(expiry?.amount, -30, 'as a negative row');
        assert.strictEqual(expiry?.reference.type, 'transaction', 'referencing the credit it expires');
        assert.strictEqual(expiry?.reference.id, tx._id);
        assert.strictEqual(expiry?.idempotency_key, idempotencyKey.expire(tx._id));

        assert.strictEqual(await tick(), 0, 'a second tick finds nothing');
        assert.strictEqual(await rowsFor(user._id), 2, 'and writes nothing');
        // The credit itself is untouched: the ledger is append-only.
        const credit = await PointTransaction.findById(tx._id);
        assert.strictEqual(credit?.amount, 30, 'the credit row is unchanged');
        pass('expiry is a new negative row, and the marker is its existence');
    }

    section('expiry never pushes a balance negative');
    {
        const user = await seedUser(0);
        await creditExpiring(user._id, 40, past());
        await record({
            user_id: user._id,
            amount: signed('spend', 25),
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: uuid() },
            idempotency_key: uuid(),
            actor: { type: 'user', user_id: user._id },
        });
        assert.strictEqual(await balanceOf(user._id), 15);

        assert.strictEqual(await tick(), 1);
        assert.strictEqual(await balanceOf(user._id), 0, 'only what was left could expire');
        const expiry = await PointTransaction.findOne({ type: 'expire', user_id: user._id });
        assert.strictEqual(expiry?.amount, -15, 'min(credit, balance), not the full credit');
        pass('a partly spent credit expires down to zero and no further');
    }

    section('what must not be touched');
    {
        const user = await seedUser(0);
        await creditExpiring(user._id, 20, null);
        await creditExpiring(user._id, 20, new Date(Date.now() + 86_400_000));

        assert.strictEqual(await tick(), 0, 'nothing is due');
        assert.strictEqual(await balanceOf(user._id), 40, 'balance untouched');
        assert.strictEqual(await rowsFor(user._id), 2, 'no rows written');
        pass('a credit with no expiry, or a future one, is left alone');
    }

    await resetLedger();
    console.log('\nexpiry.selfcheck: all assertions passed.');
}

main()
    .catch((err) => {
        console.error('\nexpiry.selfcheck FAILED:', err);
        process.exitCode = 1;
    })
    .finally(closeScratchDb);
