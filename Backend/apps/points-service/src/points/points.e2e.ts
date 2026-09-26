/**
 * End-to-end check for the Points Service: real Express app, real Mongo, real JWTs.
 * Scratch database, dropped on exit, so it never touches dev data.
 *
 *   npx ts-node src/points/points.e2e.ts
 */
import assert from 'assert';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import {
    AuditLog,
    Event,
    EventStatus,
    FormSubmission,
    LeaderboardEntry,
    PointRule,
    PointTransaction,
    User,
    UserRole,
    UserStatus,
    config,
    idempotencyKey,
    resetBus,
} from '@bgsc/shared';
import { app } from '../index';
import { seedRules } from '../rules/rules.service';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_points$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole) =>
    jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res {
    status: number;
    body: any;
    headers: Headers;
}

async function call(
    method: string,
    path: string,
    opts: { as?: string; body?: unknown; service?: boolean; badToken?: boolean } = {}
): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    if (opts.service) headers['x-internal-token'] = config.internalToken;
    if (opts.badToken) headers['x-internal-token'] = 'not-the-token';
    let payload: string | undefined;
    if (opts.body !== undefined) {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(opts.body);
    }
    const r = await fetch(base + path, { method, headers, body: payload });
    const text = await r.text();
    const parsed = text ? JSON.parse(text) : null;
    // Unwrap the shared success envelope; failures keep their own { error } shape.
    const body =
        parsed && typeof parsed === 'object' && parsed.success === true && 'data' in parsed
            ? parsed.data
            : parsed;
    return { status: r.status, body, headers: r.headers };
}

const section = (name: string) => console.log(`\n-- ${name} --`);
const pass = (what: string) => console.log(`  ok  ${what}`);

async function seedUser(balance = 0, role: UserRole = UserRole.USER): Promise<string> {
    const id = uuid();
    await User.create({
        _id: id,
        email: `${id}@e2e.local`,
        username: `e2e_${id.slice(0, 8)}`,
        role,
        points_balance: balance,
        profile: { full_name: 'E2E User' },
    });
    return id;
}

async function seedEvent(status: EventStatus = 'past', core_admins: string[] = []): Promise<string> {
    const id = uuid();
    await Event.create({
        _id: id,
        slug: `e2e-${id.slice(0, 12)}`,
        title: 'E2E Event',
        category: 'bgec',
        type: 'DE',
        domain: 'sports',
        status,
        start_at: new Date(Date.now() - 172_800_000),
        end_at: new Date(Date.now() - 86_400_000),
        registration: { closes_at: new Date(Date.now() - 200_000_000) },
        created_by: uuid(),
        core_admins,
    });
    return id;
}

/** A confirmed registration: the podium pays only someone who was in the event. */
async function seedRegistration(event_id: string, user_id: string): Promise<void> {
    await FormSubmission.create({
        form_id: uuid(),
        form_version: 1,
        owner: { type: 'event', id: event_id },
        user: { user_id, display_name: 'E2E User' },
        context: { event: { role: 'solo' } },
        status: 'confirmed',
    });
}

/** BE-1's collection: the debit refuses a reference that names nothing. */
async function seedEntry(event_id: string, user_id: string): Promise<string> {
    const entry = await LeaderboardEntry.create({
        _id: uuid(),
        event_id,
        participant: { type: 'user', id: user_id, display_name: 'E2E User', avatar_url: null },
        registration_id: uuid(),
    });
    return entry._id;
}

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
    await seedRules();
    resetBus();

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const memberId = await seedUser(100);
    const member = token(memberId, UserRole.USER);
    const coreId = await seedUser(0, UserRole.CORE);
    const core = token(coreId, UserRole.CORE);
    const coordId = await seedUser(0, UserRole.COORDINATOR);
    const coord = token(coordId, UserRole.COORDINATOR);
    const founderId = await seedUser(0, UserRole.FOUNDER);
    const founder = token(founderId, UserRole.FOUNDER);

    section('health and envelope');
    {
        const r = await call('GET', '/health');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.body.status, 'ok');
        assert.strictEqual(r.body.db, 'connected');
        assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
        pass('/health is 200 with the db connected and the security header set');

        assert.strictEqual((await call('GET', '/nope', { as: member })).status, 404);
        pass('an unknown path is 404');
    }

    section('reads require a session (Spec §5.7: authenticated only)');
    {
        assert.strictEqual((await call('GET', '/points/me')).status, 401);
        assert.strictEqual((await call('GET', '/points/opportunities')).status, 401);

        const me = await call('GET', '/points/me', { as: member });
        assert.strictEqual(me.status, 200);
        assert.strictEqual(me.body.balance, 100);
        assert.strictEqual(me.body.lifetime_earned, 0, 'a seeded balance has no ledger behind it');

        const opp = await call('GET', '/points/opportunities', { as: member });
        assert.ok(Array.isArray(opp.body.opportunities) && opp.body.opportunities.length > 0);
        pass('401 anonymous, 200 signed in');
    }

    section('manual adjustment');
    {
        const body = { user_id: memberId, amount: 50, note: 'e2e grant', request_id: uuid() };
        assert.strictEqual((await call('POST', '/points/adjust', { body })).status, 401);
        assert.strictEqual((await call('POST', '/points/adjust', { as: member, body })).status, 403);
        assert.strictEqual((await call('POST', '/points/adjust', { as: core, body })).status, 403);
        pass('401 anonymous, 403 for user and core');

        const ok = await call('POST', '/points/adjust', { as: coord, body });
        assert.strictEqual(ok.status, 201);
        assert.strictEqual(ok.body.transaction.amount, 50);
        assert.strictEqual(ok.body.transaction.balance_after, 150);
        assert.strictEqual((await call('GET', '/points/me', { as: member })).body.balance, 150);

        const audit = await AuditLog.findOne({ action: 'points.adjusted', target_id: ok.body.transaction.id });
        assert.ok(audit, 'the adjustment left an audit row');
        assert.strictEqual(audit?.actor_id, coordId, 'naming the coordinator who made it');
        pass('coordinator+ can adjust, and it is audited');

        const replay = await call('POST', '/points/adjust', { as: coord, body });
        assert.strictEqual(replay.status, 200, 'a replay is not a new creation');
        assert.strictEqual(replay.body.replayed, true);
        assert.strictEqual(replay.body.transaction.id, ok.body.transaction.id);
        assert.strictEqual((await call('GET', '/points/me', { as: member })).body.balance, 150, 'and moves nothing');
        pass('the same request_id twice writes one row');

        const reused = await call('POST', '/points/adjust', { as: coord, body: { ...body, amount: 70 } });
        assert.strictEqual(reused.status, 409, 'a reused request_id with a different amount is not a replay');
        assert.strictEqual(reused.body.error, 'request_id_reused');
        pass('a request_id reused for a different adjustment is refused');
    }

    section('mass assignment and validation');
    {
        const r = await call('POST', '/points/adjust', {
            as: coord,
            body: {
                user_id: memberId,
                amount: 5,
                note: 'e2e strip',
                request_id: uuid(),
                // None of these are the client's to set.
                type: 'earn',
                source: 'event',
                balance_after: 999_999,
                idempotency_key: 'forged',
                actor: { type: 'system', user_id: null },
            },
        });
        assert.strictEqual(r.status, 201);
        assert.strictEqual(r.body.transaction.type, 'adjust', 'zod stripped the forged type');
        assert.strictEqual(r.body.transaction.balance_after, 155, 'and the forged balance');
        assert.ok(r.body.transaction.idempotency_key.startsWith('admin:'), 'and the forged key');
        assert.strictEqual(r.body.transaction.actor.type, 'admin');
        pass('a client cannot smuggle type, balance_after, actor or the key');

        const bad = await call('POST', '/points/adjust', {
            as: coord,
            body: { user_id: memberId, amount: 0, note: 'x', request_id: uuid() },
        });
        assert.strictEqual(bad.status, 422);
        assert.strictEqual(bad.body.error, 'validation_failed');
        assert.ok(Array.isArray(bad.body.fields));
        pass('a zero amount is 422 with fields, not a 500 from the model');

        const short = await call('POST', '/points/adjust', {
            as: coord,
            body: { user_id: memberId, amount: -1_000_000, note: 'clawback', request_id: uuid() },
        });
        assert.strictEqual(short.status, 422, 'beyond the adjust cap');

        const broke = await call('POST', '/points/adjust', {
            as: coord,
            body: { user_id: memberId, amount: -99_999, note: 'clawback', request_id: uuid() },
        });
        assert.strictEqual(broke.status, 409);
        assert.strictEqual(broke.body.error, 'insufficient_points');
        assert.strictEqual((await call('GET', '/points/me', { as: member })).body.balance, 155, 'unchanged');
        pass('a clawback below zero is refused and moves nothing');
    }

    section('the live-role gate');
    {
        const demotedId = await seedUser(0, UserRole.USER);
        // A token that still claims coordinator, for a user who is not one any more.
        const stale = token(demotedId, UserRole.COORDINATOR);
        const r = await call('POST', '/points/adjust', {
            as: stale,
            body: { user_id: memberId, amount: 10, note: 'stale token', request_id: uuid() },
        });
        assert.strictEqual(r.status, 403, 'requireRole alone would have allowed this');

        const suspendedId = await seedUser(0, UserRole.COORDINATOR);
        await User.updateOne({ _id: suspendedId }, { $set: { status: UserStatus.SUSPENDED } });
        const suspended = await call('POST', '/points/adjust', {
            as: token(suspendedId, UserRole.COORDINATOR),
            body: { user_id: memberId, amount: 10, note: 'suspended', request_id: uuid() },
        });
        assert.strictEqual(suspended.status, 401, 'a suspended coordinator is not a session');
        pass('writes rank the live user document, not the token claim');
    }

    section('podium award');
    {
        const winnerId = await seedUser(0);
        const upcoming = await seedEvent('upcoming', [coreId]);
        const early = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: upcoming, place: 1 },
        });
        assert.strictEqual(early.status, 409);
        assert.strictEqual(early.body.error, 'event_not_completed');

        const done = await seedEvent('past', [coreId]);
        await seedRegistration(done, winnerId);
        const notMine = await seedEvent('past');
        await seedRegistration(notMine, winnerId);
        const foreign = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: notMine, place: 1 },
        });
        assert.strictEqual(foreign.status, 403, 'core pays out only on events it administers');
        assert.strictEqual(
            (await call('POST', '/points/award', { as: member, body: { user_id: winnerId, event_id: done, place: 1 } }))
                .status,
            403,
            'a plain user cannot award'
        );

        const award = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: done, place: 1 },
        });
        assert.strictEqual(award.status, 201);
        assert.strictEqual(award.body.transaction.amount, 30, 'default pool x multiplier');
        assert.strictEqual(award.body.transaction.reason, 'event.podium.1');

        const again = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: done, place: 1 },
        });
        assert.strictEqual(again.status, 200);
        assert.strictEqual(again.body.replayed, true, 'a second click pays nothing more');

        const conflict = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: done, place: 2 },
        });
        assert.strictEqual(conflict.status, 409, 'one podium place per user per event');
        assert.strictEqual(conflict.body.error, 'already_awarded');
        assert.strictEqual(conflict.body.details.place, 'event.podium.1', 'and it names the one that stands');

        const place4 = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: done, place: 4 },
        });
        assert.strictEqual(place4.status, 422, 'only seeded places are awardable');

        const missing = await call('POST', '/points/award', {
            as: core,
            body: { user_id: winnerId, event_id: uuid(), place: 1 },
        });
        assert.strictEqual(missing.status, 404);
        pass('podium awards are bounded, idempotent and core+');
    }

    section('the internal debit');
    {
        const investorId = await seedUser(60);
        const entryId = await seedEntry(await seedEvent('ongoing'), investorId);
        const body = {
            user_id: investorId,
            amount: 40,
            reference: { type: 'leaderboard_entry', id: entryId },
            request_id: uuid(),
        };

        assert.strictEqual((await call('POST', '/internal/points/spend', { body })).status, 401);
        assert.strictEqual((await call('POST', '/internal/points/spend', { body, badToken: true })).status, 401);
        assert.strictEqual(
            (await call('POST', '/internal/points/spend', { body, as: founder })).status,
            401,
            'a founder session is not a service token'
        );

        const ok = await call('POST', '/internal/points/spend', { body, service: true });
        assert.strictEqual(ok.status, 200);
        assert.strictEqual(ok.body.balance_after, 20);

        const replay = await call('POST', '/internal/points/spend', { body, service: true });
        assert.strictEqual(replay.body.transaction_id, ok.body.transaction_id, 'same request_id, same row');
        assert.strictEqual(replay.body.replayed, true);

        const broke = await call('POST', '/internal/points/spend', {
            service: true,
            body: { ...body, amount: 1000, request_id: uuid() },
        });
        assert.strictEqual(broke.status, 409);
        assert.strictEqual(broke.body.error, 'insufficient_points');

        const signed = await call('POST', '/internal/points/spend', {
            service: true,
            body: { ...body, amount: -40, request_id: uuid() },
        });
        assert.strictEqual(signed.status, 422, 'the caller never sends a sign');

        const otherId = await seedUser(10);
        const otherEntry = await seedEntry(await seedEvent('ongoing'), otherId);
        const mismatch = await call('POST', '/internal/points/spend', {
            service: true,
            body: { ...body, reference: { type: 'leaderboard_entry', id: otherEntry }, request_id: uuid() },
        });
        assert.strictEqual(mismatch.status, 409, 'a debit against someone else\'s entry');
        assert.strictEqual(mismatch.body.error, 'entry_participant_mismatch');

        const ghost = await call('POST', '/internal/points/spend', {
            service: true,
            body: { ...body, reference: { type: 'leaderboard_entry', id: uuid() }, request_id: uuid() },
        });
        assert.strictEqual(ghost.status, 404, 'a debit against an entry that does not exist');
        assert.strictEqual(ghost.body.error, 'leaderboard_entry_not_found');

        const stored = await PointTransaction.findById(ok.body.transaction_id);
        assert.strictEqual(stored?.amount, -40, 'stored negative');
        assert.strictEqual(stored?.reason, 'leaderboard.investment', 'and the reason is not the caller’s to choose');
        assert.strictEqual(
            stored?.idempotency_key,
            idempotencyKey.leaderboardInvestment(investorId, entryId, body.request_id)
        );
        pass('the debit is token-gated, idempotent, signed server-side');

        const refundBody = { user_id: investorId, reference: body.reference, request_id: body.request_id };
        const refund = await call('POST', '/internal/points/refund', { service: true, body: refundBody });
        assert.strictEqual(refund.status, 200);
        assert.strictEqual(refund.body.balance_after, 60, 'exactly what the spend took');
        const again = await call('POST', '/internal/points/refund', { service: true, body: refundBody });
        assert.strictEqual(again.body.replayed, true, 'one spend, one refund');
        const respend = await call('POST', '/internal/points/spend', { service: true, body });
        assert.strictEqual(respend.status, 409, 'a refunded spend is not replayed as a live debit');
        assert.strictEqual(respend.body.error, 'request_voided');
        const minted = await call('POST', '/internal/points/refund', {
            service: true,
            body: { ...refundBody, request_id: uuid(), amount: 100_000 },
        });
        assert.strictEqual(minted.status, 404, 'no spend, no refund');
        assert.strictEqual(minted.body.error, 'spend_not_found');
        pass('the refund is bound to its spend');
    }

    section('history, breakdown and pagination');
    {
        const readerId = await seedUser(0);
        const reader = token(readerId, UserRole.USER);
        for (let i = 0; i < 5; i++) {
            await call('POST', '/points/adjust', {
                as: coord,
                body: { user_id: readerId, amount: 10, note: `row ${i}`, request_id: uuid() },
            });
        }

        const seen: string[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 5; page++) {
            const path: string = `/points/me/transactions?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
            const r = await call('GET', path, { as: reader });
            assert.strictEqual(r.status, 200);
            seen.push(...r.body.transactions.map((t: { id: string }) => t.id));
            cursor = r.body.next_cursor;
            if (!cursor) break;
        }
        assert.strictEqual(seen.length, 5, 'every row appears');
        assert.strictEqual(new Set(seen).size, 5, 'and none of them twice');
        pass('keyset pagination covers the ledger exactly once');

        const first = await call('GET', '/points/me/transactions?limit=2', { as: reader });
        assert.strictEqual(first.body.transactions[0].note, undefined, 'a member does not see the admin note');
        assert.strictEqual(first.body.transactions[0].actor, undefined);
        const asAdmin = await call('GET', `/points/users/${readerId}/transactions?limit=2`, { as: core });
        assert.strictEqual(asAdmin.body.transactions[0].note, 'row 4', 'core+ does');
        pass('the admin note is admin-only');

        assert.strictEqual((await call('GET', `/points/users/${readerId}`, { as: member })).status, 403);
        const summary = await call('GET', `/points/users/${readerId}`, { as: core });
        assert.strictEqual(summary.body.balance, 50);
        assert.strictEqual(summary.body.ledger_synced, true);

        const breakdown = await call('GET', '/points/me/breakdown', { as: reader });
        assert.strictEqual(breakdown.body.breakdown[0].source, 'admin');
        assert.strictEqual(breakdown.body.breakdown[0].total, 50);
        assert.strictEqual(breakdown.body.breakdown[0].count, 5);

        const bad = await call('GET', '/points/me/transactions?cursor=not-a-cursor', { as: reader });
        assert.strictEqual(bad.status, 422);
        assert.strictEqual(bad.body.error, 'invalid_cursor');
        const injected = await call('GET', `/points/me/transactions?limit=200`, { as: reader });
        assert.strictEqual(injected.status, 422, 'the limit is capped');
        pass('breakdown, admin summary and cursor validation');
    }

    section('rules');
    {
        assert.strictEqual((await call('GET', '/points/rules', { as: member })).status, 403);
        const list = await call('GET', '/points/rules', { as: core });
        assert.strictEqual(list.status, 200);
        assert.ok(list.body.rules.length >= 8);

        assert.strictEqual(
            (await call('PATCH', '/points/rules/event.participation', { as: core, body: { enabled: false } })).status,
            403,
            'core may read the table, not rewrite it'
        );

        const patched = await call('PATCH', '/points/rules/event.participation', {
            as: coord,
            body: { default_amount: 12 },
        });
        assert.strictEqual(patched.status, 200);
        assert.strictEqual(patched.body.rule.default_amount, 12);
        assert.strictEqual((await PointRule.findById('event.participation'))?.updated_by, coordId);

        const negative = await call('PATCH', '/points/rules/event.participation', {
            as: coord,
            body: { default_amount: -5 },
        });
        assert.strictEqual(negative.status, 422, 'a rule states a magnitude; the type carries the sign');
        assert.strictEqual((await PointRule.findById('event.participation'))?.default_amount, 12, 'unchanged');

        const structural = await call('PATCH', '/points/rules/event.participation', {
            as: coord,
            body: { source: 'admin', overridable_by: null },
        });
        assert.strictEqual(structural.status, 422, 'structural fields are not editable');
        assert.strictEqual((await PointRule.findById('event.participation'))?.source, 'event');

        assert.strictEqual(
            (await call('PATCH', '/points/rules/nope.nope', { as: coord, body: { enabled: false } })).status,
            404
        );
        pass('rules are readable by core, editable by coordinator, structurally frozen');
    }

    section('audit trail');
    {
        const tx = await PointTransaction.findOne({ type: 'adjust' });
        assert.strictEqual((await call('GET', `/points/transactions/${tx!._id}/audit`, { as: coord })).status, 403);
        const trail = await call('GET', `/points/transactions/${tx!._id}/audit`, { as: founder });
        assert.strictEqual(trail.status, 200);
        assert.ok(trail.body.audit.length >= 1, 'the write that made this row is in the trail');
        assert.strictEqual(
            (await call('GET', `/points/transactions/${uuid()}/audit`, { as: founder })).status,
            404
        );
        pass('the audit trail is founder-only');
    }

    section('recalculate');
    {
        const driftedId = await seedUser(0);
        await call('POST', '/points/adjust', {
            as: coord,
            body: { user_id: driftedId, amount: 20, note: 'seed', request_id: uuid() },
        });
        // Simulate the crash window: the cache moved, the row never landed.
        await User.updateOne({ _id: driftedId }, { $inc: { points_balance: 5 } });
        assert.strictEqual((await call('GET', `/points/users/${driftedId}`, { as: core })).body.ledger_synced, false);

        const repair = await call('POST', `/points/users/${driftedId}/recalculate`, { as: coord });
        assert.strictEqual(repair.status, 200);
        assert.strictEqual(repair.body.balance, 20);
        assert.strictEqual(repair.body.repaired, true);
        assert.strictEqual((await call('GET', `/points/users/${driftedId}`, { as: core })).body.ledger_synced, true);

        const audit = await AuditLog.findOne({ action: 'points.recalculated', target_id: driftedId });
        assert.ok(audit, 'the repair is audited');

        // A balance with no ledger behind it predates this service; zeroing it is not a repair.
        const legacyId = await seedUser(75);
        const refused = await call('POST', `/points/users/${legacyId}/recalculate`, { as: coord });
        assert.strictEqual(refused.status, 409);
        assert.strictEqual(refused.body.error, 'ledger_empty');
        assert.strictEqual((await call('GET', `/points/users/${legacyId}`, { as: core })).body.balance, 75);
        pass('drift is repairable; a ledger-less balance is not silently wiped');
    }

    console.log('\npoints.e2e: all assertions passed.');
}

main()
    .catch((err) => {
        console.error('\npoints.e2e FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.dropDatabase();
        server?.close();
        await mongoose.disconnect();
    });
