/**
 * End-to-end check for the Challenge Service: real Express app, real Mongo, real JWTs.
 * Scratch database, dropped on exit, so it never touches dev data.
 *
 *   npx ts-node src/challenges/challenge.e2e.ts
 */
import assert from 'assert';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { AuditLog, Challenge, ChallengeParticipation, StravaActivity, User, UserRole, UserStatus, config, resetBus } from '@bgsc/shared';
import { app } from '../index';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_challenge$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole) =>
    jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res {
    status: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    headers: Headers;
}

async function call(method: string, path: string, opts: { as?: string; body?: unknown } = {}): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    let payload: string | undefined;
    if (opts.body !== undefined) {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(opts.body);
    }
    const r = await fetch(base + path, { method, headers, body: payload, redirect: 'manual' });
    const text = await r.text();
    let parsed: unknown = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = text;
    }
    // Unwrap the shared success envelope; failures keep their own { error } shape.
    const body =
        parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).success === true && 'data' in (parsed as object)
            ? (parsed as Record<string, unknown>).data
            : parsed;
    return { status: r.status, body, headers: r.headers };
}

const section = (name: string) => console.log(`\n-- ${name} --`);
const pass = (what: string) => console.log(`  ok  ${what}`);

async function seedUser(role: UserRole = UserRole.USER, status: UserStatus = UserStatus.ACTIVE): Promise<string> {
    const id = uuid();
    await User.create({
        _id: id,
        email: `${id}@e2e.local`,
        username: `e2e_${id.slice(0, 8)}`,
        role,
        status,
        profile: { full_name: 'E2E User' },
    });
    return id;
}

const draftBody = (over: Record<string, unknown> = {}) => ({
    title: `E2E ${uuid().slice(0, 8)}`,
    description: 'Do the thing.',
    domain: 'sports',
    kind: 'digital',
    difficulty: 'easy',
    award_points: 30,
    submission: { requires_proof: true, proof_types: ['url'], max_files: 3, auto_approve: false },
    ...over,
});

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
    resetBus();

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const memberId = await seedUser();
    const member = token(memberId, UserRole.USER);
    const otherId = await seedUser();
    const other = token(otherId, UserRole.USER);
    const coreId = await seedUser(UserRole.CORE);
    const core = token(coreId, UserRole.CORE);
    const coordId = await seedUser(UserRole.COORDINATOR);
    const coord = token(coordId, UserRole.COORDINATOR);

    section('health and envelope');
    {
        const r = await call('GET', '/health');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.body.status, 'ok');
        assert.strictEqual(r.body.db, 'connected');
        assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
        pass('/health is 200 with the db connected and the security header set');
    }

    section('the prefix is authenticated-only (Spec §5.7)');
    {
        assert.strictEqual((await call('GET', '/challenges')).status, 401);
        assert.strictEqual((await call('GET', '/challenges/anything')).status, 401);
        assert.strictEqual((await call('POST', '/challenges', { body: draftBody() })).status, 401);
        assert.strictEqual((await call('GET', '/strava/activities')).status, 401);
        assert.strictEqual((await call('POST', '/strava/sync')).status, 401);
        pass('every route but the OAuth callback refuses an anonymous caller');
    }

    section('create: rank, validation and mass assignment');
    let challengeId = '';
    {
        assert.strictEqual((await call('POST', '/challenges', { as: member, body: draftBody() })).status, 403);

        const bad = await call('POST', '/challenges', { as: core, body: { title: 'x' } });
        assert.strictEqual(bad.status, 422);
        assert.strictEqual(bad.body.error, 'validation_failed');
        assert.ok(Array.isArray(bad.body.fields) && bad.body.fields.length > 0);

        const created = await call('POST', '/challenges', {
            as: core,
            // Everything after `award_points` is a field the server owns. Zod strips it.
            body: draftBody({ status: 'active', counts: { accepted: 99, submitted: 9, approved: 9 }, slug: 'stolen', created_by: memberId }),
        });
        assert.strictEqual(created.status, 201);
        assert.strictEqual(created.body.status, 'draft', 'status is not client-settable');
        assert.strictEqual(created.body.counts.accepted, 0, 'counts are not client-settable');
        assert.notStrictEqual(created.body.slug, 'stolen', 'the slug is derived, not supplied');
        assert.strictEqual(created.body.created_by, coreId, 'created_by is the caller, not the body');
        challengeId = created.body._id;
        pass('a create lands as a draft with server-owned fields intact');

        const physical = await call('POST', '/challenges', { as: core, body: draftBody({ kind: 'physical' }) });
        assert.strictEqual(physical.status, 422, 'a model invariant must be a 422, never a 500');
        assert.strictEqual(physical.body.error, 'location_required_for_physical_challenge');
        pass('a physical challenge with no location is 422 with a named code');

        const audits = await AuditLog.countDocuments({ action: 'challenge.created', target_id: challengeId });
        assert.strictEqual(audits, 1, 'Spec §7.3: the write is audited');
        pass('the create wrote exactly one audit row');
    }

    section('a suspended coordinator cannot write, whatever their token says');
    {
        const ghostId = await seedUser(UserRole.COORDINATOR, UserStatus.SUSPENDED);
        const ghost = token(ghostId, UserRole.COORDINATOR);
        assert.strictEqual((await call('POST', '/challenges', { as: ghost, body: draftBody() })).status, 401);
        // Reads use the token; only writes pay for the extra lookup.
        assert.strictEqual((await call('GET', '/challenges', { as: ghost })).status, 200);
        pass('requireActiveUser ranks the live document, so a suspension lands before the token expires');
    }

    section('transitions');
    {
        assert.strictEqual((await call('POST', `/challenges/${challengeId}/complete`, { as: core })).status, 409);
        assert.strictEqual((await call('POST', `/challenges/${uuid()}/activate`, { as: core })).status, 404);
        assert.strictEqual((await call('POST', `/challenges/${challengeId}/activate`, { as: core })).status, 200);
        assert.strictEqual((await call('POST', `/challenges/${challengeId}/activate`, { as: core })).status, 409);
        pass('wrong state 409, missing id 404, and a repeat activate 409');
    }

    section('browse and detail');
    {
        const list = await call('GET', '/challenges', { as: member });
        assert.strictEqual(list.status, 200);
        assert.ok(list.body.challenges.some((c: { _id: string }) => c._id === challengeId));
        assert.ok('next_cursor' in list.body);

        const bySlug = (await call('GET', `/challenges/${(await Challenge.findById(challengeId))!.slug}`, { as: member })).body;
        assert.strictEqual(bySlug.challenge._id, challengeId);
        assert.strictEqual(bySlug.my_participation, null);

        const badCursor = await call('GET', '/challenges?cursor=not-base64', { as: member });
        assert.strictEqual(badCursor.status, 422);
        assert.strictEqual(badCursor.body.error, 'invalid_cursor');
        pass('detail resolves by slug, and a forged cursor is a 422 rather than a filter injection');
    }

    section('hidden briefs');
    {
        const hidden = await call('POST', '/challenges', {
            as: core,
            body: draftBody({ brief_hidden_until_accept: true, description: 'The secret brief.' }),
        });
        const hiddenId = hidden.body._id;
        await call('POST', `/challenges/${hiddenId}/activate`, { as: core });

        const before = await call('GET', `/challenges/${hiddenId}`, { as: member });
        assert.strictEqual(before.body.challenge.description, null, 'the brief is withheld before acceptance');

        assert.strictEqual((await call('POST', `/challenges/${hiddenId}/accept`, { as: member, body: {} })).status, 201);
        const after = await call('GET', `/challenges/${hiddenId}`, { as: member });
        assert.strictEqual(after.body.challenge.description, 'The secret brief.');
        assert.ok(after.body.my_participation, 'the detail carries my state once I have one');

        const outsider = await call('GET', `/challenges/${hiddenId}`, { as: other });
        assert.strictEqual(outsider.body.challenge.description, null, 'and stays hidden from everyone else');
        pass('Spec §5.7: details are revealed upon acceptance, per viewer');
    }

    section('accept, submit, review');
    let participationId = '';
    {
        const first = await call('POST', `/challenges/${challengeId}/accept`, { as: member, body: {} });
        assert.strictEqual(first.status, 201);
        participationId = first.body._id;

        // Double-click: exactly one participation, and the seat count is not left inflated.
        const [a, b] = await Promise.all([
            call('POST', `/challenges/${challengeId}/accept`, { as: other, body: {} }),
            call('POST', `/challenges/${challengeId}/accept`, { as: other, body: {} }),
        ]);
        const statuses = [a.status, b.status].sort();
        assert.deepStrictEqual(statuses, [201, 409], `expected one 201 and one 409, got ${statuses}`);
        assert.strictEqual(await ChallengeParticipation.countDocuments({ challenge_id: challengeId, 'participant.id': otherId }), 1);
        assert.strictEqual((await Challenge.findById(challengeId))!.counts.accepted, 2);
        pass('a double-clicked accept produces one row and one seat');

        assert.strictEqual(
            (await call('PATCH', `/challenges/participations/${participationId}/progress`, { as: other, body: { percent: 100 } })).status,
            404,
            'a non-member gets 404, not 403'
        );

        const badProof = await call('POST', `/challenges/participations/${participationId}/submit`, {
            as: member,
            body: { proofs: [{ type: 'image', value: 'https://example.com/x.png' }] },
        });
        assert.strictEqual(badProof.status, 422, 'image proofs need Media Service (Week 4)');

        const submitted = await call('POST', `/challenges/participations/${participationId}/submit`, {
            as: member,
            body: { proofs: [{ type: 'url', value: 'https://example.com/proof' }], notes: 'done' },
        });
        assert.strictEqual(submitted.status, 200);
        assert.strictEqual(submitted.body.status, 'under_review');

        assert.strictEqual(
            (await call('POST', `/challenges/participations/${participationId}/review`, { as: member, body: { decision: 'approved' } })).status,
            403,
            'a participant cannot approve themselves'
        );

        const queueDenied = await call('GET', `/challenges/${challengeId}/participations`, { as: member });
        assert.strictEqual(queueDenied.status, 404, 'a non-reviewer must not learn the queue exists');

        const queue = await call('GET', `/challenges/${challengeId}/participations`, { as: core });
        assert.strictEqual(queue.status, 200);
        assert.strictEqual(queue.body.participations.length, 1);

        const approved = await call('POST', `/challenges/participations/${participationId}/review`, {
            as: core,
            body: { decision: 'approved' },
        });
        assert.strictEqual(approved.status, 200);
        assert.strictEqual(approved.body.reward.points_awarded, 30);

        const again = await call('POST', `/challenges/participations/${participationId}/review`, {
            as: core,
            body: { decision: 'approved' },
        });
        assert.strictEqual(again.status, 409, 'approving twice pays once');
        assert.strictEqual((await Challenge.findById(challengeId))!.counts.approved, 1);
        pass('the full accept -> submit -> approve path, with both refusals in the middle');
    }

    section('my challenges');
    {
        const mine = await call('GET', '/challenges/me/participations?status=approved', { as: member });
        assert.strictEqual(mine.status, 200);
        assert.ok(mine.body.participations.some((p: { _id: string }) => p._id === participationId));
        // The literal path must not be swallowed by /:key.
        assert.notStrictEqual(mine.body.participations, undefined);
        pass('/challenges/me/participations routes to the tab list, not to the detail route');
    }

    section('deletion');
    {
        assert.strictEqual((await call('DELETE', `/challenges/${challengeId}`, { as: core })).status, 403, 'delete is coordinator+');
        const refused = await call('DELETE', `/challenges/${challengeId}`, { as: coord });
        assert.strictEqual(refused.status, 409);
        assert.strictEqual(refused.body.error, 'challenge_has_approved_participations');

        const spare = await call('POST', '/challenges', { as: core, body: draftBody() });
        assert.strictEqual((await call('DELETE', `/challenges/${spare.body._id}`, { as: coord })).status, 204);
        assert.strictEqual((await call('GET', `/challenges/${spare.body._id}`, { as: member })).status, 404);
        pass('a paid-against challenge cannot be deleted; a spare one can, and then 404s');
    }

    section('strava answers, rather than crashing, with no application registered');
    {
        const wasId = config.strava.clientId;
        const wasSecret = config.strava.clientSecret;
        config.strava.clientId = '';
        const connect = await call('GET', '/strava/connect', { as: member });
        assert.strictEqual(connect.status, 503);
        assert.strictEqual(connect.body.error, 'strava_not_configured');
        config.strava.clientId = wasId;
        config.strava.clientSecret = wasSecret;

        const statusRes = await call('GET', '/strava/status', { as: member });
        assert.strictEqual(statusRes.status, 200);
        assert.strictEqual(statusRes.body.connected, false);

        // Unconfigured is checked before "is this user connected": there is nothing to sync WITH.
        assert.strictEqual((await call('POST', '/strava/sync', { as: member })).status, 503);
        config.strava.clientId = 'e2e-client';
        config.strava.clientSecret = 'e2e-secret';
        assert.strictEqual((await call('POST', '/strava/sync', { as: member })).status, 404);
        config.strava.clientId = wasId;
        config.strava.clientSecret = wasSecret;
        // Disconnect needs no Strava application to tell you that you are not connected.
        assert.strictEqual((await call('DELETE', '/strava/disconnect', { as: member })).status, 404);

        // The callback is the one public path, and a callback that did not start here is refused
        // before anything is written (RFC 6749 §10.12). Its outcomes are asserted in the next
        // section, because they are all redirects rather than status codes.

        // Pressing Cancel on Strava's consent screen is a choice, not a failure.
        const denied = await call('GET', '/strava/callback?error=access_denied');
        assert.strictEqual(denied.status, 302);
        assert.ok(denied.headers.get('location')?.includes('strava=denied'));
        pass('unconfigured is 503, an unconnected user is 404, Cancel is a redirect');
    }

    section('every OAuth callback outcome is a redirect, never JSON in the address bar');
    {
        // Strava sends the user here as a top-level navigation. A JSON body would strand them
        // outside the app with no way back, which is what every failure path used to do.
        const forged = await call('GET', '/strava/callback?code=abc&state=forged');
        assert.strictEqual(forged.status, 302, 'a forged state must redirect, not answer 400 JSON');
        assert.ok(forged.headers.get('location')?.includes('strava=invalid_oauth_state'));

        const noCode = await call('GET', '/strava/callback?state=whatever');
        assert.strictEqual(noCode.status, 302);
        assert.ok(noCode.headers.get('location')?.includes('strava=denied'));

        // Unconfigured client: the token exchange cannot even be attempted.
        const wasId = config.strava.clientId;
        config.strava.clientId = '';
        const valid = jwt.sign({ nonce: uuid(), sub: memberId }, config.jwt.accessSecret, { expiresIn: '5m' });
        const unconfigured = await call('GET', `/strava/callback?code=abc&state=${valid}`);
        assert.strictEqual(unconfigured.status, 302, 'an unconfigured client must still return the user');
        assert.ok(unconfigured.headers.get('location')?.includes('strava=strava_not_configured'));
        config.strava.clientId = wasId;

        // A malformed query used to hit `validate()` and answer 422 JSON before the handler ran.
        const junk = await call('GET', `/strava/callback?code=${'x'.repeat(900)}&state=${'y'.repeat(3000)}`);
        assert.strictEqual(junk.status, 302, 'even a malformed callback must return the user, not 422 JSON');
        assert.ok(junk.headers.get('location')?.includes('strava='));

        for (const r of [forged, noCode, unconfigured, junk]) {
            assert.ok(r.headers.get('location')?.startsWith(config.frontendUrl), 'always back to the frontend');
        }
        pass('forged state, missing code and unconfigured client all redirect home with a reason');
    }

    section('another user cannot read your private Strava activities');
    {
        const mine = { user_id: memberId, athlete_id: '1', type: 'Run', name: 'Mine', distance_meters: 1, moving_time_seconds: 1, elapsed_time_seconds: 1, start_date: new Date() };
        await StravaActivity.create([
            { ...mine, _id: 'e2e-public', is_private: false },
            { ...mine, _id: 'e2e-private', is_private: true },
        ]);

        const own = await call('GET', '/strava/activities', { as: member });
        assert.strictEqual(own.body.activities.length, 2, 'you see all of your own');

        const visitor = await call('GET', `/strava/users/${memberId}/activities`, { as: other });
        const ids = visitor.body.activities.map((a: { _id: string }) => a._id);
        assert.deepStrictEqual(ids, ['e2e-public'], 'a visitor sees only the public one');

        const self = await call('GET', `/strava/users/${memberId}/activities`, { as: member });
        assert.strictEqual(self.body.activities.length, 2, 'reading your own id by path is not a visitor');
        pass('activity:read_all pulls private activities; the profile route does not republish them');
    }

    section('audit failures do not become silent successes');
    {
        const original = AuditLog.create.bind(AuditLog);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (AuditLog as any).create = async () => {
            throw new Error('audit storage is down');
        };
        try {
            // This service audits AFTER the document is written, so a broken audit surfaces as a
            // 500 rather than silently succeeding — the caller must not be told the write was
            // clean when the trail Spec §7.3 requires is missing.
            const r = await call('POST', '/challenges', { as: core, body: draftBody({ title: 'Auditless' }) });
            assert.strictEqual(r.status, 500);
            assert.strictEqual(r.body.error, 'internal_error');
            assert.ok(!('message' in r.body), 'no internal detail in the body');
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (AuditLog as any).create = original;
        }
        pass('a failed audit is a 500 with no leaked detail, not a quiet 201');
    }

    console.log('\nchallenge.e2e: all assertions passed.');
}

main()
    .catch((err) => {
        console.error('\nchallenge.e2e FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.dropDatabase();
        server?.close();
        await mongoose.disconnect();
    });
