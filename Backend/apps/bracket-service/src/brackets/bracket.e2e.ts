/**
 * End-to-end check for the Bracket Service: real Express app, real Mongo, real JWTs.
 * Scratch database, dropped on exit.
 *
 *   npx ts-node apps/bracket-service/src/brackets/bracket.e2e.ts
 *
 * The selfchecks cover the draw and the rules; this covers the wiring — the public spectator view,
 * the role ladder on writes, and what a client may not put in a body.
 */
import assert from 'assert';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Event, FormSubmission, Match, User, UserRole, config } from '@bgsc/shared';
import { app } from '../index';

const uuid = (): string => randomUUID();
const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_bracket$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole) => jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res { status: number; body: any; headers: Headers }

async function call(method: string, path: string, opts: { as?: string; body?: unknown } = {}): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(base + path, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await r.text();
    const parsed = text ? JSON.parse(text) : null;
    const body = parsed && typeof parsed === 'object' && parsed.success === true && 'data' in parsed ? parsed.data : parsed;
    return { status: r.status, body, headers: r.headers };
}

const pass = (what: string) => console.log(`  ok  ${what}`);

async function seedUser(role: UserRole = UserRole.USER): Promise<string> {
    const id = uuid();
    await User.create({
        _id: id,
        email: `${id}@e2e.local`,
        username: `e2e_${id.slice(0, 8)}`,
        role,
        profile: { full_name: 'E2E User' },
    });
    return id;
}

async function seedEvent(organiser: string): Promise<string> {
    const id = uuid();
    await Event.create({
        _id: id,
        slug: `e2e-${id.slice(0, 12)}`,
        title: 'E2E Cup',
        category: 'bgec',
        type: 'LE',
        domain: 'sports',
        status: 'ongoing',
        start_at: new Date(Date.now() + 86_400_000),
        end_at: new Date(Date.now() + 172_800_000),
        registration: { closes_at: new Date(Date.now() + 43_200_000), form_id: uuid() },
        leaderboard: { format: 'single_elim' },
        created_by: organiser,
    });
    return id;
}

async function seedField(eventId: string, n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
        const user = await seedUser();
        await FormSubmission.create({
            _id: uuid(),
            form_id: uuid(),
            form_version: 1,
            owner: { type: 'event', id: eventId },
            user: { user_id: user, display_name: `Player ${i + 1}`, avatar_url: null },
            context: { event: { role: 'solo' } },
            status: 'confirmed',
            confirmed_at: new Date(),
            submitted_at: new Date(Date.now() + i * 1000),
        });
    }
}

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const organiser = await seedUser(UserRole.CORE);
    const otherCore = await seedUser(UserRole.CORE);
    const member = await seedUser();
    const boss = await seedUser(UserRole.COORDINATOR);
    const organiserT = token(organiser, UserRole.CORE);
    const otherCoreT = token(otherCore, UserRole.CORE);
    const memberT = token(member, UserRole.USER);
    const bossT = token(boss, UserRole.COORDINATOR);

    const eventId = await seedEvent(organiser);
    await seedField(eventId, 4);

    console.log('\n-- health --');
    const health = await call('GET', '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.service, 'bracket-service');
    assert.strictEqual(health.headers.get('x-content-type-options'), 'nosniff');
    pass('/health is fail-closed and the security headers are on');

    console.log('\n-- drawing --');
    assert.strictEqual((await call('POST', '/brackets', { body: { event_id: eventId } })).status, 401, 'anon');
    assert.strictEqual(
        (await call('POST', '/brackets', { as: memberT, body: { event_id: eventId } })).status,
        403,
        'a member cannot draw a tournament'
    );
    assert.strictEqual(
        (await call('POST', '/brackets', { as: otherCoreT, body: { event_id: eventId } })).status,
        403,
        "nor a core member who does not run this event"
    );

    const drawn = await call('POST', '/brackets', {
        as: organiserT,
        // `format`, `rounds` and `status` are not inputs: the event decides the first and the
        // generator the other two.
        body: { event_id: eventId, format: 'round_robin', rounds: 99, status: 'completed' },
    });
    assert.strictEqual(drawn.status, 201);
    assert.strictEqual(drawn.body.bracket.format, 'single_elim', 'the format comes from the event');
    assert.strictEqual(drawn.body.bracket.rounds, 2, 'and the round count from the draw');
    assert.strictEqual(drawn.body.bracket.status, 'active', 'a fresh draw is active whatever the body says');
    assert.strictEqual(drawn.body.matches.length, 3, 'four players: two semis and a final');
    assert.ok(!('__v' in drawn.body.bracket), '__v never leaves');
    pass('a draw is core-admin-only, and its shape is the server\'s to decide');

    console.log('\n-- the spectator view is public (Spec §5.5) --');
    const spectator = await call('GET', `/brackets/${eventId}`);
    assert.strictEqual(spectator.status, 200, 'no token needed');
    assert.strictEqual(spectator.body.matches.length, 3);
    assert.deepStrictEqual(
        spectator.body.matches.map((m: { round: number }) => m.round),
        [1, 1, 2],
        'and the fixtures come back in bracket order'
    );

    const standings = await call('GET', `/brackets/${eventId}/standings`);
    assert.strictEqual(standings.status, 200, '/standings resolves as itself, not as an event id');
    assert.strictEqual(standings.body.rows.length, 4, 'a row per participant');
    assert.strictEqual(standings.body.champion, null, 'nobody has won anything yet');

    const list = await call('GET', `/matches?event_id=${eventId}`);
    assert.strictEqual(list.body.matches.length, 3, 'the fixture list is public too');
    assert.strictEqual((await call('GET', '/matches')).status, 422, 'but never unscoped');
    assert.strictEqual((await call('GET', `/matches?event_id=${eventId}&round=255`)).status, 200, 'round 255 exists in a round robin of 256');
    assert.strictEqual((await call('GET', `/matches?event_id=${eventId}&round=256`)).status, 422, 'no draw has a round past that');
    assert.strictEqual((await call('GET', `/brackets/${uuid()}`)).status, 404, 'an undrawn event is a 404');
    pass('spectator reads need no session; an unscoped fixture list is refused');

    console.log('\n-- a draft event is not a public tournament --');
    const draftId = uuid();
    await Event.create({
        _id: draftId,
        slug: `e2e-draft-${draftId.slice(0, 8)}`,
        title: 'Unannounced Cup',
        category: 'bgec',
        type: 'LE',
        domain: 'sports',
        status: 'draft',
        start_at: new Date(Date.now() + 86_400_000),
        end_at: new Date(Date.now() + 172_800_000),
        registration: { closes_at: new Date(Date.now() + 43_200_000), form_id: uuid() },
        leaderboard: { format: 'single_elim' },
        created_by: organiser,
    });
    await seedField(draftId, 4);
    assert.strictEqual(
        (await call('POST', '/brackets', { as: organiserT, body: { event_id: draftId } })).status,
        201,
        'an organiser can draw a draft event'
    );
    assert.strictEqual((await call('GET', `/brackets/${draftId}`)).status, 404, 'a guest cannot see it');
    assert.strictEqual(
        (await call('GET', `/brackets/${draftId}`, { as: memberT })).status,
        404,
        'nor can a signed-in member'
    );
    assert.strictEqual((await call('GET', `/matches?event_id=${draftId}`)).status, 404, 'nor its fixture list');
    assert.strictEqual(
        (await call('GET', `/brackets/${draftId}`, { as: organiserT })).status,
        200,
        'its organiser can'
    );
    assert.strictEqual((await call('GET', `/brackets/${draftId}`, { as: bossT })).status, 200, 'and a coordinator');
    pass('a draft event hides its draw exactly as the Event Service hides the event');

    console.log('\n-- reporting --');
    const semi = spectator.body.matches[0];
    assert.strictEqual((await call('PATCH', `/matches/${semi._id}`, { body: { score_a: 1, score_b: 0 } })).status, 401);
    assert.strictEqual(
        (await call('PATCH', `/matches/${semi._id}`, { as: memberT, body: { score_a: 1, score_b: 0 } })).status,
        403,
        'a member cannot score a match'
    );

    const reported = await call('PATCH', `/matches/${semi._id}`, {
        as: organiserT,
        body: { score_a: 2, score_b: 1, winner: 'b', status: 'cancelled', reported_by: member },
    });
    assert.strictEqual(reported.status, 200);
    assert.strictEqual(reported.body.winner, 'a', 'the winner comes from the scores, not from the body');
    assert.strictEqual(reported.body.status, 'completed', 'and the status from the act of reporting');
    assert.strictEqual(reported.body.reported_by, organiser, 'the reporter is the caller');

    const advanced = await Match.findById(semi.advances_to.match_id).lean();
    assert.strictEqual(advanced![semi.advances_to.slot as 'a' | 'b']?.id, semi.a.id, 'the winner is through');

    const again = await call('PATCH', `/matches/${semi._id}`, { as: organiserT, body: { score_a: 0, score_b: 5 } });
    assert.strictEqual(again.status, 409, 'core cannot rewrite a reported result');
    const corrected = await call('PATCH', `/matches/${semi._id}`, { as: bossT, body: { score_a: 0, score_b: 5 } });
    assert.strictEqual(corrected.status, 200, 'a coordinator can');
    assert.strictEqual(corrected.body.winner, 'b');

    const negative = await call('PATCH', `/matches/${semi._id}`, { as: bossT, body: { score_a: -1, score_b: 0 } });
    assert.strictEqual(negative.status, 422, 'a negative score never reaches the service');
    pass('scores decide the winner, core reports, coordinator corrects');

    console.log('\n-- scheduling --');
    const scheduled = await call('PATCH', `/matches/${spectator.body.matches[1]._id}/schedule`, {
        as: organiserT,
        body: { venue: 'Court 2', scheduled_at: '2026-10-01T10:00:00.000Z' },
    });
    assert.strictEqual(scheduled.status, 200, '/:id/schedule is not swallowed by /:id');
    assert.strictEqual(scheduled.body.venue, 'Court 2');
    assert.strictEqual(scheduled.body.score_a, null, 'and a reschedule carries no score');
    pass('scheduling is its own route and cannot report a result');

    console.log('\n-- clearing --');
    assert.strictEqual((await call('DELETE', `/brackets/${eventId}`, { as: organiserT })).status, 403, 'core cannot');
    assert.strictEqual(
        (await call('DELETE', `/brackets/${eventId}`, { as: bossT })).status,
        409,
        'and a played draw cannot be cleared at all'
    );
    pass('clearing a draw is coordinator+, and refused once it has been played');

    console.log('\nbracket e2e: all checks passed');
}

main()
    .catch((err) => {
        console.error('\nbracket e2e failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.dropDatabase().catch(() => undefined);
        server?.close();
        await mongoose.disconnect().catch(() => undefined);
    });
