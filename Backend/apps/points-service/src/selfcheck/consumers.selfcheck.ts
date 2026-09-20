import assert from 'assert';
import { DomainEvent, PointTransaction, idempotencyKey, publish, resetBus, subscribe } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { handlers, initializeConsumers } from '../events/consumers';
import { record, signed } from '../points/ledger';
import { updateRule } from '../rules/rules.service';
import {
    balanceOf,
    closeScratchDb,
    openScratchDb,
    pass,
    resetLedger,
    rowsFor,
    seedEvent,
    seedLeaderboardEntry,
    seedUser,
    section,
} from './seed';

/** What this service reacts to (be2-points-service-plan.md §12.3). */

const attended = (event_id: string, user_id: string, registration_id: string) =>
    handlers.creditParticipation({ event_id, user_id, registration_id });

/**
 * Wait for something to actually become true, rather than sleeping a guessed interval. A fixed
 * sleep makes every negative assertion after it vacuous: "nothing was written" is also what a
 * broken subscription, a dead bus or a too-short wait look like.
 */
async function waitFor(what: string, predicate: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        if (await predicate()) return;
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise((r) => setTimeout(r, 10));
    }
}

async function main(): Promise<void> {
    await openScratchDb();

    section('participation is paid on attendance');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 15 });
        const registration_id = uuid();

        await attended(event_id, user._id, registration_id);
        assert.strictEqual(await balanceOf(user._id), 15, "the event's own pool wins over the rule default");

        await attended(event_id, user._id, registration_id);
        assert.strictEqual(await rowsFor(user._id), 1, 'a replayed event writes nothing more');

        const row = await PointTransaction.findOne({ user_id: user._id });
        assert.strictEqual(row?.reference.type, 'event', 'the row points at the event');
        assert.strictEqual(row?.reference.id, event_id);
        assert.strictEqual(
            row?.idempotency_key,
            idempotencyKey.eventParticipation(registration_id),
            'and the registration is the key'
        );
        pass('attendance credits once, whatever the bus does');
    }

    section('registering earns nothing, attending does (D10)');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 10 });
        resetBus();
        initializeConsumers();

        publish('RegistrationCreated', 'selfcheck', {
            registration_id: uuid(),
            owner: { type: 'event', id: event_id },
            user_id: user._id,
            role: 'solo',
        });
        publish('RegistrationConfirmed', 'selfcheck', {
            registration_id: uuid(),
            event_id,
            user_id: user._id,
            promoted_by: uuid(),
        });

        // The control: the same bus, the same subscriptions, an event that MUST pay. Without it
        // the two assertions below would also pass against a service that subscribes to nothing.
        const control = await seedUser(0);
        publish('ParticipantAttended', 'selfcheck', {
            event_id,
            registration_id: uuid(),
            user_id: control._id,
            marked_by: uuid(),
        });
        await waitFor('the control credit to land', async () => (await rowsFor(control._id)) === 1);
        assert.strictEqual(await balanceOf(control._id), 10, 'the bus and the subscription are live');

        assert.strictEqual(await rowsFor(user._id), 0, 'signing up is not earning');
        assert.strictEqual(await balanceOf(user._id), 0);
        resetBus();
        pass('attendance credits over the bus; the two registration events credit nothing');
    }

    section('cancellation reverses the credit that exists');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 20 });
        const registration_id = uuid();
        await attended(event_id, user._id, registration_id);

        // The amount must come from the original row, not from the rule as it stands now.
        await updateRule('event.participation', { default_amount: 999 }, { id: 'admin', ip: null });
        await handlers.reverseParticipation({ registration_id, reason: 'user_cancel' });
        await updateRule('event.participation', { default_amount: 10 }, { id: 'admin', ip: null });

        assert.strictEqual(await balanceOf(user._id), 0, 'balance is back to zero');
        assert.strictEqual(await rowsFor(user._id), 2, 'as a second row, never an edit');
        const reversal = await PointTransaction.findOne({ user_id: user._id, type: 'adjust' });
        assert.strictEqual(reversal?.amount, -20, 'the original amount, not the current rule');
        pass('a reversal is a new negative adjust of the original amount');

        // Cancelling something that never paid out is the common case now.
        const before = await rowsFor(user._id);
        await handlers.reverseParticipation({ registration_id: uuid() });
        assert.strictEqual(await rowsFor(user._id), before, 'nothing to reverse, nothing written');
        pass('a cancellation with no credit behind it is a no-op');
    }

    section('a reversal never drives the balance negative (D9)');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 10 });
        const registration_id = uuid();
        await attended(event_id, user._id, registration_id);
        // The user spent what they earned before cancelling.
        await record({
            user_id: user._id,
            amount: signed('spend', 10),
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: uuid() },
            idempotency_key: idempotencyKey.leaderboardInvestment(uuid()),
            actor: { type: 'user', user_id: user._id },
        });
        assert.strictEqual(await balanceOf(user._id), 0);

        // Must not throw out of the consumer, and must not write.
        await handlers.reverseParticipation({ registration_id, reason: 'user_cancel' });
        assert.strictEqual(await balanceOf(user._id), 0, 'balance stays at zero, not -10');
        assert.strictEqual(await rowsFor(user._id), 2, 'and the reversal was not written');
        pass('an unaffordable reversal is logged, not forced');
    }

    section('event cancellation: reverse participations, refund investments');
    {
        const event_id = await seedEvent({ participation: 10 });
        const a = await seedUser(0);
        const b = await seedUser(0);
        await attended(event_id, a._id, uuid());
        const bRegistration = uuid();
        await attended(event_id, b._id, bRegistration);

        const entry = await seedLeaderboardEntry(event_id, b);
        await record({
            user_id: b._id,
            amount: signed('spend', 10),
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: entry },
            idempotency_key: idempotencyKey.leaderboardInvestment(uuid()),
            actor: { type: 'user', user_id: b._id },
        });
        assert.strictEqual(await balanceOf(b._id), 0, 'b invested everything they earned');

        // points-model.md §6: a refund names why the money came back.
        const refunds: Record<string, unknown>[] = [];
        resetBus();
        subscribe('PointsRefunded', (e: DomainEvent) => void refunds.push(e.payload));

        await handlers.onEventCancelled({ event_id });
        resetBus();
        assert.strictEqual(refunds.length, 1, 'one refund event');
        assert.strictEqual(refunds[0].reason_text, 'refund: event_cancelled', 'carrying its reason');
        assert.strictEqual(await balanceOf(a._id), 0, "a's participation credit was reversed");
        // b: +10 attended, -10 invested, +10 refunded, -10 reversed.
        assert.strictEqual(await balanceOf(b._id), 0, 'b is square: refunded, then reversed');
        assert.strictEqual(await rowsFor(b._id), 4, 'four rows, no edits');

        const refund = await PointTransaction.findOne({ user_id: b._id, type: 'refund' });
        assert.strictEqual(refund?.amount, 10, 'a refund is positive');
        assert.strictEqual(refund?.reference.type, 'leaderboard_entry', 'and still names the entry');

        const rowsBefore = await PointTransaction.countDocuments({});
        await handlers.onEventCancelled({ event_id });
        assert.strictEqual(await PointTransaction.countDocuments({}), rowsBefore, 'the sweep is idempotent');
        pass('the cancel sweep is safe to deliver twice');

        // The cross-path case the unified reversal key exists for: a registration cancel arriving
        // after an event cancel must not reverse the same credit a second time.
        //
        // b is at zero here, and an unaffordable reversal is refused anyway (D9) — which would let
        // this pass without the key doing any work at all. Fund the account first, so the ONLY
        // thing that can stop the second reversal is the idempotency key.
        await record({
            user_id: b._id,
            amount: 100,
            type: 'adjust',
            source: 'admin',
            reason: 'admin.manual',
            reference: { type: null, id: null },
            idempotency_key: idempotencyKey.adminAdjust(uuid()),
            actor: { type: 'admin', user_id: uuid() },
            note: 'funding so insolvency cannot mask the key',
        });
        assert.strictEqual(await balanceOf(b._id), 100, 'b can now afford a second reversal');

        await handlers.reverseParticipation({ registration_id: bRegistration, reason: 'user_cancel' });
        assert.strictEqual(await rowsFor(b._id), 5, 'no second reversal of the same credit');
        assert.strictEqual(await balanceOf(b._id), 100, 'and the balance is untouched');
        pass('a registration cancel cannot double-reverse an event-cancelled credit');
    }

    section('a cancelled event pays nobody, whatever the message order');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 10, status: 'cancelled' });
        // Attendance marked after the cancel sweep has already reversed everyone: the Event
        // Service has no status guard on recordEventAttendance, so this really can arrive.
        await attended(event_id, user._id, uuid());
        assert.strictEqual(await rowsFor(user._id), 0, 'no credit for an event that did not happen');
        assert.strictEqual(await balanceOf(user._id), 0);
        pass('attendance on a cancelled event credits nothing');
    }

    section('challenge completion pays every member');
    {
        const members = await Promise.all([seedUser(0), seedUser(0), seedUser(0)]);
        const participation_id = uuid();
        const challenge_id = uuid();
        const payload = {
            participation_id,
            challenge_id,
            member_user_ids: members.map((m) => m._id),
            award_points: 25,
        };

        await handlers.creditChallenge(payload);
        for (const m of members) {
            assert.strictEqual(await balanceOf(m._id), 25, 'each member is paid the snapshot amount');
        }

        await handlers.creditChallenge(payload);
        for (const m of members) {
            assert.strictEqual(await rowsFor(m._id), 1, 'a replay pays nobody twice');
        }
        pass('one row per member, keyed on (participation, user)');
    }

    await resetLedger();
    console.log('\nconsumers.selfcheck: all assertions passed.');
}

main()
    .catch((err) => {
        console.error('\nconsumers.selfcheck FAILED:', err);
        process.exitCode = 1;
    })
    .finally(closeScratchDb);
