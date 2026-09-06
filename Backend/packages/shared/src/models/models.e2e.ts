/**
 * Database-level checks for the model layer: that the indexes are buildable, that the unique
 * constraints actually fire, and that the concurrency patterns the modeldocs promise hold under
 * real parallel writes.
 *
 * `models/selfcheck.ts` covers schema rules and invariant hooks in memory. Neither of those catches
 * an index that MongoDB refuses to create — which is how a duplicate-registration guard can be
 * documented, reviewed, merged, and never exist.
 *
 *   npx ts-node src/models/models.e2e.ts
 */
import assert from 'assert';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { FormSubmission, PointTransaction, Team, LeaderboardEntry, Event } from './index';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_models_e2e$2');

async function freshDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    for (const name of mongoose.modelNames()) {
        await mongoose.model(name).createIndexes();
    }
}

const submission = {
    form_id: 'f1',
    form_version: 1,
    owner: { type: 'event' as const, id: 'e1' },
    user: { user_id: 'u1', display_name: 'A' },
    context: { event: { role: 'solo' as const } },
};

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await freshDb();

    /* ---- every model's indexes must be creatable -------------------------- */
    // A partialFilterExpression written with $nin or $not is silently rejected by MongoDB, so the
    // index never exists and the guarantee it encodes disappears without any error at runtime.
    for (const name of mongoose.modelNames()) {
        await assert.doesNotReject(
            () => mongoose.model(name).createIndexes(),
            `${name}: indexes must be buildable`
        );
    }

    /* ---- unique constraints ----------------------------------------------- */

    await FormSubmission.create({ ...submission, status: 'confirmed' });
    await assert.rejects(
        () => FormSubmission.create({ ...submission, status: 'submitted' }),
        (e: { code?: number }) => e.code === 11000,
        'a second active registration for the same user and form is refused by the DB'
    );

    // The guard is scoped to *active* rows: cancelling frees the slot again.
    await FormSubmission.updateOne({ form_id: 'f1' }, { $set: { status: 'cancelled' } });
    await assert.doesNotReject(
        () => FormSubmission.create({ ...submission, status: 'submitted' }),
        'a cancelled registration does not block re-registering'
    );

    /* ---- concurrency ------------------------------------------------------ */

    await freshDb();
    const registrations = await Promise.allSettled(
        Array.from({ length: 10 }, () => FormSubmission.create({ ...submission, status: 'submitted' }))
    );
    assert.strictEqual(
        registrations.filter((r) => r.status === 'fulfilled').length,
        1,
        '10 simultaneous registrations produce exactly one row'
    );

    // Seat reservation, registration-model.md §3.2. The $expr comparison and the $inc are one
    // atomic operation, so capacity cannot be oversold no matter how many callers race.
    const event = await Event.create({
        slug: 'race', title: 'Race', category: 'general', type: 'DE', domain: 'general',
        start_at: new Date(Date.now() + 864e5 * 10), end_at: new Date(Date.now() + 864e5 * 11),
        registration: { closes_at: new Date(Date.now() + 864e5 * 5), form_id: null },
        created_by: 'admin', leaderboard: null,
    });
    await Event.updateOne({ _id: event._id }, { $set: { 'registration.max_participants': 5 } });

    const seats = await Promise.all(
        Array.from({ length: 20 }, () =>
            Event.findOneAndUpdate(
                {
                    _id: event._id,
                    $expr: { $lt: ['$counts.registrations_confirmed', '$registration.max_participants'] },
                },
                { $inc: { 'counts.registrations_confirmed': 1 } }
            )
        )
    );
    assert.strictEqual(seats.filter(Boolean).length, 5, '20 racing callers win exactly 5 seats');
    assert.strictEqual(
        (await Event.findById(event._id))!.counts.registrations_confirmed,
        5,
        'and the counter matches — no overbooking'
    );

    // Purse debit, team-model.md §3. Same shape: the affordability check is inside the update.
    const team = await Team.create({
        owner: { type: 'event', id: event._id }, name: 'T', captain_user_id: 'c1',
        members: [{ user_id: 'c1', display_name: 'C', registration_id: 'r1', acquired_via: 'created' }],
        invite_code: 'ABCD1234', size_min: 1, size_max: 5,
        auction: { purse_total: 1000, purse_spent: 0 },
    });
    const debits = await Promise.all(
        Array.from({ length: 15 }, () =>
            Team.findOneAndUpdate(
                {
                    _id: team._id,
                    $expr: { $lte: [{ $add: ['$auction.purse_spent', 100] }, '$auction.purse_total'] },
                },
                { $inc: { 'auction.purse_spent': 100, 'auction.version': 1 } }
            )
        )
    );
    assert.strictEqual(debits.filter(Boolean).length, 10, '15 bids of 100 against a 1000 purse: 10 clear');
    assert.strictEqual(
        (await Team.findById(team._id))!.auction!.purse_spent,
        1000,
        'a team can never spend past its purse'
    );

    const entries = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
            LeaderboardEntry.create({
                event_id: event._id,
                participant: { type: 'user' as const, id: 'u9', display_name: 'U' },
                registration_id: 'r9',
            })
        )
    );
    assert.strictEqual(
        entries.filter((r) => r.status === 'fulfilled').length,
        1,
        'one leaderboard entry per participant per event, even under a race'
    );

    // Idempotency is the whole dedupe story for the ledger: a replayed domain event must not pay twice.
    const credit = {
        user_id: 'u1', amount: 10, type: 'earn' as const, source: 'event' as const,
        reason: 'event.participation', reference: { type: 'registration' as const, id: 'r1' },
        idempotency_key: 'evt-1', balance_after: 10, actor: { type: 'system' as const },
    };
    const credits = await Promise.allSettled(
        Array.from({ length: 8 }, () => PointTransaction.create(credit))
    );
    assert.strictEqual(
        credits.filter((r) => r.status === 'fulfilled').length,
        1,
        '8 replays of one event credit the user once'
    );

    console.log('model layer e2e: all assertions passed');
}

main()
    .then(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error(err);
        try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch { /* already down */ }
        process.exit(1);
    });
