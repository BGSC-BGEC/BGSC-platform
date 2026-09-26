import assert from 'assert';
import {
    DomainEvent,
    Event,
    FormSubmission,
    LeaderboardSnapshot,
    PointTransaction,
    ServiceError,
    User,
    idempotencyKey,
    publish,
    resetBus,
    subscribe,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { handlers, initializeConsumers } from '../events/consumers';
import { ledgerHooks, record, signed } from '../points/ledger';
import { awardPodium, eventLedger, refundForInvestment, spendForInvestment } from '../points/points.service';
import { replayTick } from '../scheduler/replay';
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
    seedRegistration,
    seedUser,
    section,
} from './seed';

/** What this service reacts to. */

/** Attendance on a confirmed registration — the only kind that pays (the fixture makes one). */
const attended = async (event_id: string, user_id: string, registration_id: string) => {
    if (!(await FormSubmission.exists({ _id: registration_id }))) {
        await seedRegistration(event_id, user_id, 'confirmed', registration_id);
    }
    return handlers.creditParticipation({ event_id, user_id, registration_id });
};

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

    section('registering earns nothing, attending does');
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
            registration_id: await seedRegistration(event_id, control._id),
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

    section('a reversal never drives the balance negative');
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
            idempotency_key: idempotencyKey.leaderboardInvestment(uuid(), uuid(), uuid()),
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
            idempotency_key: idempotencyKey.leaderboardInvestment(uuid(), uuid(), uuid()),
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
        // b is at zero here, and an unaffordable reversal is refused anyway — which would let
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

    section('attendance pays only a confirmed registration, and a revocation takes it back');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 10 });
        const cancelled = await seedRegistration(event_id, user._id, 'cancelled');
        await handlers.creditParticipation({ event_id, user_id: user._id, registration_id: cancelled });
        assert.strictEqual(await rowsFor(user._id), 0, 'a cancelled registration earns nothing');

        const registration_id = uuid();
        await attended(event_id, user._id, registration_id);
        assert.strictEqual(await balanceOf(user._id), 10);

        resetBus();
        initializeConsumers();
        publish('ParticipantAttendanceRevoked', 'selfcheck', {
            event_id,
            registration_id,
            user_id: user._id,
            marked_by: uuid(),
        });
        await waitFor('the revocation to reverse the credit', async () => (await balanceOf(user._id)) === 0);
        const reversal = await PointTransaction.findOne({ user_id: user._id, type: 'adjust' }).sort({ created_at: -1 });
        assert(reversal?.note?.includes('attendance_revoked'), `reversal note names the cause, got ${reversal?.note}`);
        resetBus();
        pass('unconfirmed attendance pays nothing; ParticipantAttendanceRevoked reverses');
    }

    section('one spend is refunded once, by compensation or by the cancel sweep');
    {
        const event_id = await seedEvent({ participation: 10 });
        const user = await seedUser(30);
        const entry = await seedLeaderboardEntry(event_id, user);
        const request_id = uuid();
        await record({
            user_id: user._id,
            amount: signed('spend', 30),
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: entry },
            idempotency_key: idempotencyKey.leaderboardInvestment(user._id, entry, request_id),
            actor: { type: 'user', user_id: user._id },
        });
        await refundForInvestment({ user_id: user._id, reference: { type: 'leaderboard_entry', id: entry }, request_id });
        assert.strictEqual(await balanceOf(user._id), 30, 'compensated');

        await handlers.onEventCancelled({ event_id });
        assert.strictEqual(await balanceOf(user._id), 30, 'the sweep did not pay the same spend again');
        assert.strictEqual(await PointTransaction.countDocuments({ user_id: user._id, type: 'refund' }), 1);
        pass('compensation and cancel sweep share one refund key');
    }

    section('the final podium pays through the admin key, once');
    {
        const event_id = await seedEvent({ status: 'past', participation: 10 });
        const admin = { id: uuid(), ip: null, role: 'coordinator' };
        const [a, b, c, outsider] = await Promise.all([seedUser(0), seedUser(0), seedUser(0), seedUser(0)]);
        await seedRegistration(event_id, a._id);
        await seedRegistration(event_id, b._id);
        await seedRegistration(event_id, c._id);

        await awardPodium({ user_id: a._id, event_id, place: 1 }, admin);
        await handlers.payFinalPodium({
            event_id,
            reason: 'final',
            podium: [
                { place: 1, participant: { type: 'user', id: a._id }, user_ids: [a._id] },
                { place: 2, participant: { type: 'user', id: b._id }, user_ids: [b._id] },
            ],
        });
        assert.strictEqual(await balanceOf(a._id), 30, 'the manual award and the consumer pay once');
        assert.strictEqual(await rowsFor(a._id), 1);
        assert.strictEqual(await balanceOf(b._id), 20, 'second place from LeaderboardFrozen');

        const code = (p: Promise<unknown>) =>
            p.then(
                () => 'resolved',
                (e: ServiceError) => e.code
            );
        assert.strictEqual(await code(awardPodium({ user_id: c._id, event_id, place: 1 }, admin)), 'place_taken');
        assert.strictEqual(
            await code(awardPodium({ user_id: outsider._id, event_id, place: 3 }, admin)),
            'not_a_participant'
        );
        const free = await seedEvent({ status: 'past', participation: 0 });
        await seedRegistration(free, c._id);
        assert.strictEqual(await code(awardPodium({ user_id: c._id, event_id: free, place: 1 }, admin)), 'event_pays_no_podium');
        pass('one participant per place, participants only, a zero pool says so');

        // Event scope: a core member who does not administer this event cannot pay out on it.
        const scoped = await seedEvent({ status: 'past', participation: 10 });
        const d = await seedUser(0);
        await seedRegistration(scoped, d._id);
        assert.strictEqual(
            await code(awardPodium({ user_id: d._id, event_id: scoped, place: 1 }, { id: uuid(), ip: null, role: 'core' })),
            'forbidden'
        );
        // The final standings decide the place: an admin award for someone else is refused.
        await LeaderboardSnapshot.create({
            event_id: scoped,
            taken_at: new Date(),
            reason: 'final',
            frozen: true,
            ranks: [{ participant_id: c._id, rank: 1, final_score: 10 }],
        });
        assert.strictEqual(await code(awardPodium({ user_id: d._id, event_id: scoped, place: 1 }, admin)), 'podium_mismatch');
        pass('podium awards are event-scoped and cannot pre-empt the final');

        // The standings name a winner whose place an admin already gave away: logged and surfaced.
        await handlers.payFinalPodium({
            event_id,
            reason: 'final',
            podium: [{ place: 1, participant: { type: 'user', id: c._id }, user_ids: [c._id] }],
        });
        await handlers.payFinalPodium({
            event_id,
            reason: 'final',
            podium: [{ place: 1, participant: { type: 'user', id: c._id }, user_ids: [c._id] }],
        });
        const ledgerView = await eventLedger(event_id, { limit: 10 });
        assert.strictEqual(ledgerView.podium_conflicts.length, 1, 'one conflict row, however often it is replayed');
        pass('an unpayable podium is surfaced to the admin, not lost');
    }

    section('a spend that lands after the cancel sweep is given back');
    {
        const event_id = await seedEvent({ status: 'ongoing', participation: 10 });
        const user = await seedUser(40);
        const entry = await seedLeaderboardEntry(event_id, user);
        ledgerHooks.afterMove = async () => {
            ledgerHooks.afterMove = async () => undefined;
            await Event.updateOne({ _id: event_id }, { $set: { status: 'cancelled' } });
        };
        const outcome = await spendForInvestment({
            user_id: user._id,
            amount: 25,
            reference: { type: 'leaderboard_entry', id: entry },
            request_id: uuid(),
        }).then(
            () => 'spent',
            (e: ServiceError) => e.code
        );
        ledgerHooks.afterMove = async () => undefined;
        assert.strictEqual(outcome, 'event_not_ongoing');
        assert.strictEqual(await balanceOf(user._id), 40, 'refunded on the spot');
        pass('spend after cancel is refunded');
    }

    section('attendance pays only an attended registration');
    {
        const user = await seedUser(0);
        const event_id = await seedEvent({ participation: 10 });
        const reg = await seedRegistration(event_id, user._id);
        await FormSubmission.updateOne({ _id: reg }, { $set: { 'context.event.attended': false } });
        await handlers.creditParticipation({ event_id, user_id: user._id, registration_id: reg });
        assert.strictEqual(await rowsFor(user._id), 0, 'a revoked attendance pays nothing');
        pass('attended:true is required');
    }

    section('the replay sweep re-derives missed messages');
    {
        // A ParticipantAttended that never arrived.
        const user = await seedUser(0);
        const ran = await seedEvent({ status: 'past', participation: 10 });
        await Event.updateOne({ _id: ran }, { $set: { completed_at: new Date() } });
        await seedRegistration(ran, user._id);
        // A registration whose user has since been deleted: its credit fails 404 every tick, and must
        // not stop the rest of the tick.
        const deleted = await seedUser(0);
        await User.updateOne({ _id: deleted._id }, { $set: { deleted_at: new Date() } });
        await seedRegistration(ran, deleted._id);
        // A RegistrationCancelled that never arrived, for a credit already paid.
        const quitter = await seedUser(0);
        const quit = await seedRegistration(ran, quitter._id);
        await handlers.creditParticipation({ event_id: ran, user_id: quitter._id, registration_id: quit });
        await FormSubmission.updateOne({ _id: quit }, { $set: { status: 'cancelled' } });
        // An EventCancelled that never arrived, with an investment on it.
        const gone = await seedEvent({ status: 'cancelled', participation: 10 });
        await Event.updateOne({ _id: gone }, { $set: { cancelled_at: new Date() } });
        const investor = await seedUser(15);
        const entry = await seedLeaderboardEntry(gone, investor);
        await record({
            user_id: investor._id,
            amount: signed('spend', 15),
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'leaderboard_entry', id: entry },
            idempotency_key: idempotencyKey.leaderboardInvestment(investor._id, entry, uuid()),
            actor: { type: 'user', user_id: investor._id },
        });

        await replayTick();
        assert.strictEqual(await balanceOf(user._id), 10, 'the missed attendance is credited');
        assert.strictEqual(await balanceOf(investor._id), 15, 'the missed cancel refunded the investment');
        assert.strictEqual(await balanceOf(quitter._id), 0, 'the missed cancellation reversed the credit');
        const rows = await PointTransaction.countDocuments({});
        await replayTick();
        assert.strictEqual(await PointTransaction.countDocuments({}), rows, 'and a second run writes nothing');
        pass('missed attendance and cancellation are replayed idempotently');
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
