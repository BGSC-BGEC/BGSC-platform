import assert from 'assert';
import { POINT_RULE_SEED, PointRule, ServiceError } from '@bgsc/shared';
import { listRules, opportunities, resolve, seedRules, updateRule } from '../rules/rules.service';
import { closeScratchDb, openScratchDb, pass, resetLedger, section } from './seed';

/** The rules engine (be2-points-service-plan.md §12.2). */

async function main(): Promise<void> {
    await openScratchDb();

    section('seeding is insert-only');
    {
        const rules = await listRules();
        assert.strictEqual(rules.length, POINT_RULE_SEED.length, 'every seed row exists');

        await updateRule('event.participation', { default_amount: 99, enabled: false }, { id: 'admin', ip: null });
        // A restart must not revert an admin's toggle: $setOnInsert, never $set.
        await seedRules();
        const edited = await PointRule.findById('event.participation');
        assert.strictEqual(edited?.default_amount, 99, 'the edited amount survived re-seeding');
        assert.strictEqual(edited?.enabled, false, 'and so did the disabled flag');
        pass('re-seeding preserves an admin edit');

        assert.strictEqual(await resolve('event.participation'), null, 'a disabled rule resolves to nothing');
        assert.strictEqual(
            await resolve('event.participation', 25),
            null,
            'and an override does not revive it'
        );
        pass('a disabled rule means no transaction, not zero points');

        await updateRule('event.participation', { default_amount: 10, enabled: true }, { id: 'admin', ip: null });

        // Several instances booting at the same second all seed. A lost upsert comes back as a
        // duplicate-key error, and an unhandled one here would stop a service from listening.
        const boots = await Promise.allSettled([seedRules(), seedRules(), seedRules(), seedRules()]);
        assert.strictEqual(boots.filter((b) => b.status === 'rejected').length, 0, 'no boot rejected');
        assert.strictEqual((await listRules()).length, POINT_RULE_SEED.length, 'and no duplicates');
        pass('concurrent seeding is safe');
    }

    section('resolution order');
    {
        assert.deepStrictEqual(await resolve('event.participation'), { amount: 10, expires_at: null });
        assert.deepStrictEqual(await resolve('event.participation', 25), { amount: 25, expires_at: null });
        // An event that pays nothing for turning up is a configuration, not an error.
        assert.strictEqual(await resolve('event.participation', 0), null, 'an override of 0 writes nothing');
        pass('trigger override wins, then the rule default');

        const podium = await resolve('event.podium.1', 10 * 3);
        assert.strictEqual(podium?.amount, 30, 'default pool and multipliers reproduce the seeded 30');
        // Multipliers are floats and amounts are integers by invariant: without the rounding this
        // reaches the model and surfaces as a 500.
        const odd = await resolve('event.podium.3', 7 * 1.5);
        assert.strictEqual(odd?.amount, 11, '7 x 1.5 rounds to an integer');
        pass('podium amounts are integers whatever the multipliers do');
    }

    section('expiry comes from the rule');
    {
        await updateRule('engagement.profile_completed', { expires_after_days: 30 }, { id: 'admin', ip: null });
        const resolved = await resolve('engagement.profile_completed');
        assert.ok(resolved?.expires_at instanceof Date, 'a rule with a validity window stamps one');
        const days = (resolved!.expires_at!.getTime() - Date.now()) / 86_400_000;
        assert.ok(days > 29.9 && days < 30.1, `expiry is 30 days out, got ${days}`);
        await updateRule('engagement.profile_completed', { expires_after_days: null }, { id: 'admin', ip: null });
        assert.strictEqual((await resolve('engagement.profile_completed'))?.expires_at, null);
        pass('expires_after_days drives expires_at, and null means never');
    }

    section('refusals and audit');
    {
        await assert.rejects(resolve('event.podiun.1'), (err: ServiceError) => {
            assert.strictEqual(err.status, 422);
            assert.strictEqual(err.code, 'unknown_reason');
            return true;
        });
        pass('an unknown reason is refused 422, not written');

        await assert.rejects(
            updateRule('nope.nope', { enabled: false }, { id: 'admin', ip: null }),
            (err: ServiceError) => err.status === 404 && err.code === 'rule_not_found'
        );

        const { AuditLog } = await import('@bgsc/shared');
        const rows = await AuditLog.find({ action: 'points.rule_updated' });
        assert.ok(rows.length > 0, 'every rule edit left an audit row');
        assert.ok(
            rows.every((r) => r.previous_value !== null && r.new_value !== null),
            'each one records the diff, both sides'
        );
        pass('rule edits are audited with before and after');
    }

    section('earning opportunities');
    {
        const list = await opportunities();
        const sources = new Set(list.map((o) => o.source));
        assert.ok(!sources.has('leaderboard'), 'investing is not an earning opportunity');
        assert.ok(!sources.has('admin'), 'neither is a manual adjustment');
        const challenge = list.find((o) => o.reason === 'challenge.completed');
        assert.strictEqual(challenge?.amount, null, 'a rule whose trigger sets the amount shows null, not 0');
        pass('opportunities list what a user can go and do');
    }

    await resetLedger();
    console.log('\nrules.selfcheck: all assertions passed.');
}

main()
    .catch((err) => {
        console.error('\nrules.selfcheck FAILED:', err);
        process.exitCode = 1;
    })
    .finally(closeScratchDb);
