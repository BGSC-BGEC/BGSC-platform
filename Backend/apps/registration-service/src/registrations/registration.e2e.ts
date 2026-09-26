/**
 * End-to-end check for the Registration Service: real Express app, real Mongo, real JWTs, a stub
 * Event Service for seats. Scratch database, dropped on exit.
 *
 *   npx ts-node apps/registration-service/src/registrations/registration.e2e.ts
 *
 * The selfchecks cover the rules; this covers the wiring — who each route lets through, what the
 * upload route refuses before touching disk, the `/internal` contract, and the 422 shape.
 */
import '../selfcheck/scratch-env';
import assert from 'assert';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { promises as fs } from 'fs';
import { FormUpload, Team, User, config } from '@bgsc/shared';
import { app } from '../index';
import * as formService from '../forms/form.service';
import { seedEvent, seedUser, startEventStub } from '../selfcheck/seed';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_registration$2');

let base: string;

interface Res { status: number; body: any }

async function call(
    method: string,
    path: string,
    opts: { as?: string; body?: unknown; raw?: Buffer; type?: string; internal?: boolean } = {}
): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    if (opts.internal) headers['x-internal-token'] = config.internalToken;
    let payload: Uint8Array | string | undefined;
    if (opts.raw) {
        headers['content-type'] = opts.type ?? 'application/octet-stream';
        payload = new Uint8Array(opts.raw);
    } else if (opts.body !== undefined) {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(opts.body);
    }
    const r = await fetch(base + path, { method, headers, body: payload });
    const text = await r.text();
    const parsed = text ? JSON.parse(text) : null;
    const body = parsed && typeof parsed === 'object' && parsed.success === true && 'data' in parsed ? parsed.data : parsed;
    return { status: r.status, body };
}

const pass = (what: string) => console.log(`  ok  ${what}`);
const expect = (res: Res, status: number, error?: string) => {
    assert.strictEqual(res.status, status, `expected ${status}${error ? ` ${error}` : ''}, got ${res.status} ${JSON.stringify(res.body)}`);
    if (error) assert.strictEqual(res.body?.error, error);
};

async function userWithToken(name: string, role = 'user'): Promise<{ id: string; t: string }> {
    const u = await seedUser(name);
    if (role !== 'user') await User.updateOne({ _id: u._id }, { $set: { role } });
    return { id: u._id, t: jwt.sign({ sub: u._id, role }, config.jwt.accessSecret, { expiresIn: '5m' }) };
}

const field = (over: Record<string, unknown>) =>
    ({
        key: 'name', label: 'Name', help_text: null, type: 'short_text', required: true, placeholder: null, options: null,
        validation: { min: null, max: null, pattern: null, accept: null, max_size_bytes: null },
        visible_if: null, admin_only: false, order: 0, ...over,
    }) as any;

const PDF = (n: number) => Buffer.concat([Buffer.from('%PDF-1.4 e2e '), Buffer.alloc(Math.max(0, n - 13))]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
    const stub = await startEventStub();
    const server: Server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const host = await userWithToken('Host'); // creates the events below: their admin
    const stranger = await userWithToken('Stranger');
    const core = await userWithToken('Core', 'core');
    const cap = await userWithToken('Captain');
    const mem = await userWithToken('Member');

    console.log('\n-- forms: drafts and admin_only fields are the owner admins\' --');
    const eventId = uuid();
    const form = await formService.createForm({
        owner: { type: 'event', id: eventId }, title: 'Reg', created_by: host.id,
        fields: [field({}), field({ key: 'seed', type: 'number', required: false, admin_only: true, order: 1 })],
    });
    await seedEvent({ id: eventId, formId: form._id, createdBy: host.id, maxParticipants: 50 });
    expect(await call('GET', `/forms/${form._id}`, { as: stranger.t }), 404, 'form_not_found');
    pass('a draft form is a 404 to a non-admin');
    expect(await call('POST', `/forms/${form._id}/publish`, { as: stranger.t }), 403);
    expect(await call('POST', `/forms/${form._id}/publish`, { as: host.t }), 200);
    const seen = await call('GET', `/forms/${form._id}`, { as: stranger.t });
    expect(seen, 200);
    assert.deepStrictEqual(seen.body.fields.map((f: any) => f.key), ['name'], 'admin_only fields are stripped for a non-admin');
    assert.deepStrictEqual((await call('GET', `/forms/${form._id}`, { as: host.t })).body.fields.map((f: any) => f.key), ['name', 'seed']);
    pass('admin_only fields are stripped for a non-admin, shown to the event admin');
    const draft = await formService.createForm({ owner: { type: 'event', id: eventId }, title: 'Draft', fields: [field({})], created_by: host.id });
    const listed = (r: Res) => r.body.map((f: any) => f._id);
    assert(!listed(await call('GET', `/forms?owner_id=${eventId}&status=draft`, { as: stranger.t })).includes(draft._id));
    assert(listed(await call('GET', `/forms?owner_id=${eventId}&status=draft`, { as: host.t })).includes(draft._id));
    pass('drafts are listed only in a list scoped to an owner the caller administers');
    const badCond = await call('PATCH', `/forms/${draft._id}`, {
        as: host.t,
        body: { fields: [field({ key: 'age', type: 'number' }), field({ key: 'x', order: 1, visible_if: { field_key: 'age', op: 'eq', value: 'old' } })] },
    });
    expect(badCond, 422, 'validation_failed');
    pass('a visible_if value no answer can meet is a 422 at save');

    console.log('\n-- registrations: the 422 shape --');
    const bad = await call('POST', '/registrations', {
        as: stranger.t,
        body: { form_id: form._id, owner: { type: 'event', id: eventId }, answers: {}, context: { event: { role: 'solo' } } },
    });
    expect(bad, 422, 'validation_failed');
    assert.deepStrictEqual(bad.body.fields.map((f: any) => [f.key, f.code]), [['name', 'required']], 'per-field reasons under `fields`, keyed `key`');
    pass('validation_failed carries fields[{ key, code, message }]');
    expect(
        await call('POST', '/registrations', {
            as: stranger.t,
            body: { form_id: form._id, owner: { type: 'event', id: eventId }, answers: { name: 'x' }, context: { event: { role: 'captain' } } },
        }),
        422,
        'role_mismatch'
    );
    pass('a captain role on an event that is not teamed is refused');

    console.log('\n-- uploads: sniffed, bounded by the field, admin_only refused, quota --');
    const files = await formService.createForm({
        owner: { type: 'generic', id: null }, title: 'Files', created_by: host.id,
        fields: [
            field({ key: 'proof', type: 'file', validation: { min: null, max: null, pattern: null, accept: ['application/pdf'], max_size_bytes: 200 } }),
            field({ key: 'secret', type: 'file', required: false, admin_only: true, order: 1 }),
        ],
    });
    await formService.publishForm(files._id);
    const upload = (key: string, raw: Buffer, type: string, as = stranger.t) =>
        call('POST', `/registrations/upload-file?form_id=${files._id}&field_key=${key}`, { as, raw, type });
    expect(await upload('proof', Buffer.from('<html>definitely not a pdf</html>'), 'application/pdf'), 415, 'unsupported_media_type');
    pass('the declared Content-Type is not evidence: magic bytes decide (415)');
    expect(await upload('proof', PNG, 'image/png'), 415, 'mime_not_accepted');
    expect(await upload('proof', PDF(300), 'application/pdf'), 413, 'payload_too_large');
    pass('the field\'s accept and max_size_bytes are enforced before disk');
    expect(await upload('secret', PDF(50), 'application/pdf'), 403, 'admin_only');
    pass('an admin_only file field takes no self-upload');
    const ok = await upload('proof', PDF(100), 'application/pdf');
    expect(ok, 201);
    assert(ok.body.url.startsWith('private://') && ok.body.mime === 'application/pdf' && ok.body.size === 100);
    pass('a good upload answers a private reference');
    const hour = Array.from({ length: 20 }, () => ({
        user_id: mem.id, form_id: files._id, field_key: 'proof', url: `private://registrations/q/${uuid()}.pdf`, name: 'q.pdf', size: 1, mime: 'application/pdf',
    }));
    await FormUpload.insertMany(hour);
    expect(await upload('proof', PDF(100), 'application/pdf', mem.t), 429, 'upload_quota_exceeded');
    pass('the hourly quota is refused before the body is read');

    console.log('\n-- teams: who may remove, disband and lock --');
    const teamedId = uuid();
    const teamForm = await formService.createForm({ owner: { type: 'event', id: teamedId }, title: 'T', fields: [field({})], created_by: host.id });
    await formService.publishForm(teamForm._id);
    await seedEvent({ id: teamedId, formId: teamForm._id, createdBy: host.id, teamSize: [1, 3], captainApplication: false });
    const register = (who: { t: string }, role: string) =>
        call('POST', '/registrations', {
            as: who.t,
            body: { form_id: teamForm._id, owner: { type: 'event', id: teamedId }, answers: { name: 'x' }, context: { event: { role } } },
        });
    expect(await register(cap, 'captain'), 201);
    expect(await register(mem, 'member'), 201);
    const created = await call('POST', '/teams', { as: cap.t, body: { owner: { type: 'event', id: teamedId }, name: 'Wired', join_policy: 'open' } });
    expect(created, 201);
    const teamId = created.body._id;
    expect(await call('POST', `/teams/${teamId}/join`, { as: mem.t }), 200);
    expect(await call('DELETE', `/teams/${teamId}/members/${mem.id}`, { as: stranger.t }), 403, 'forbidden');
    expect(await call('DELETE', `/teams/${teamId}/members/${mem.id}`, { as: core.t }), 403, 'forbidden');
    pass('a stranger — even a core member who does not run the event — cannot remove a member');
    expect(await call('DELETE', `/teams/${teamId}/members/${mem.id}`, { as: mem.t }), 200);
    pass('a member removes themselves');

    // The invite code is the captain's to share: hidden from everyone else, and it opens a closed door.
    const code = created.body.invite_code as string;
    assert.match(code, /^[0-9A-F]{8}$/, 'the captain gets the code at creation');
    assert.strictEqual((await call('GET', `/teams/${teamId}`, { as: cap.t })).body.invite_code, code, 'captain reads it');
    assert.strictEqual((await call('GET', `/teams/${teamId}`, { as: host.t })).body.invite_code, code, 'the event admin reads it');
    const asMember = await call('GET', `/teams/${teamId}`, { as: mem.t });
    expect(asMember, 200);
    assert.ok(!('invite_code' in asMember.body), 'anyone else does not');
    const teamList = await call('GET', `/teams?owner_id=${teamedId}`, { as: mem.t });
    assert.ok(teamList.body.length > 0 && teamList.body.every((t: Record<string, unknown>) => !('invite_code' in t)), 'nor in lists');
    await Team.updateOne({ _id: teamId }, { $set: { join_policy: 'invite_only' } });
    expect(await call('POST', `/teams/${teamId}/join`, { as: mem.t }), 403, 'team_not_open');
    expect(await call('POST', '/teams/join-by-code', { as: mem.t, body: { code: 'ABCDEF12' } }), 404, 'invite_code_not_found');
    expect(await call('POST', '/teams/join-by-code', { as: mem.t, body: { code: 'nope' } }), 422, 'validation_failed');
    const byCode = await call('POST', '/teams/join-by-code', { as: mem.t, body: { code: code.toLowerCase() } });
    expect(byCode, 200);
    assert.ok(byCode.body.members.some((m: { user_id: string }) => m.user_id === mem.id), 'joined through the code');
    pass('invite codes: captain/admin-only, join-by-code works on an invite-only team, any case');
    expect(await call('DELETE', `/teams/${teamId}`, { as: stranger.t }), 403, 'forbidden');
    expect(await call('PATCH', `/teams/${teamId}/lock`, { as: cap.t }), 403);
    const locked = await call('PATCH', `/teams/${teamId}/lock`, { as: host.t });
    expect(locked, 200);
    assert.strictEqual(locked.body.status, 'locked');
    pass('disband and lock are refused to outsiders; the event admin locks');

    const leagueId = await seedEvent({ formId: uuid(), createdBy: host.id, teamSize: [1, 3], type: 'ALL', auctionStatus: 'live' });
    const bought = uuid();
    const league = await Team.create({
        _id: uuid(), owner: { type: 'event', id: leagueId }, name: 'Bidders', captain_user_id: cap.id, size_min: 1, size_max: 3,
        invite_code: uuid().replace(/-/g, '').slice(0, 8), status: 'forming',
        members: [
            { user_id: cap.id, display_name: 'C', avatar_url: null, registration_id: uuid(), joined_at: new Date(), acquired_via: 'created' },
            { user_id: bought, display_name: 'B', avatar_url: null, registration_id: uuid(), joined_at: new Date(), acquired_via: 'auction' },
        ],
    });
    expect(await call('DELETE', `/teams/${league._id}`, { as: cap.t }), 409, 'auction_in_progress');
    expect(await call('DELETE', `/teams/${league._id}/members/${bought}`, { as: cap.t }), 409, 'auction_in_progress');
    expect(await call('DELETE', `/teams/${league._id}/members/${bought}`, { as: host.t }), 200);
    pass('mid-auction, only the event admin changes an auction league roster');

    console.log('\n-- /internal: token, promote, lock, attendance --');
    expect(await call('POST', `/internal/teams/${teamId}/lock`, { body: {} }), 401, 'unauthorized');
    const relock = await call('POST', `/internal/teams/${teamId}/lock`, { internal: true, body: { locked_by: 'challenge-service' } });
    expect(relock, 200);
    assert.strictEqual(relock.body.status, 'locked');
    pass('lock is idempotent: an already-locked roster answers 200');
    expect(await call('POST', '/internal/registrations/attendance', { internal: true, body: { event_id: eventId, attendances: [] } }), 422, 'validation_failed');
    expect(
        await call('POST', '/internal/registrations/attendance', {
            internal: true, body: { event_id: eventId, marked_by: 'x', attendances: [{ registration_id: 'nope', attended: 'yes' }] },
        }),
        422,
        'validation_failed'
    );
    pass('attendance bodies are validated');

    stub.capacity.set(eventId, 0);
    const waiter = await userWithToken('Waiter');
    const waiting = await call('POST', '/registrations', {
        as: waiter.t,
        body: { form_id: form._id, owner: { type: 'event', id: eventId }, answers: { name: 'w' }, context: { event: { role: 'solo' } } },
    });
    expect(waiting, 201);
    assert.strictEqual(waiting.body.status, 'waitlisted');
    const promote = (id: string) => call('POST', `/internal/registrations/${id}/promote`, { internal: true, body: { by: host.id } });
    expect(await promote(waiting.body._id), 409, 'capacity_full');
    pass('promote refused by the event (no seat) → 409 with its reason');
    stub.down = true;
    expect(await promote(waiting.body._id), 503, 'event_service_unavailable');
    stub.down = false;
    pass('promote with no answer from the event → 503, retryable');
    await User.updateOne({ _id: waiter.id }, { $set: { deleted_at: new Date() } });
    expect(await promote(waiting.body._id), 409, 'user_deleted');
    pass('promote of a deleted account → 409 (skipped, row cancelled)');
    expect(await promote(waiting.body._id), 409, 'not_waitlisted');
    pass('promote of a row no longer waitlisted → 409');

    server.close();
    await stub.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await fs.rm(config.uploadDir, { recursive: true, force: true });
    console.log('\n✅ Registration e2e passed');
}

main().catch(async (err) => {
    console.error('❌ Registration e2e failed:', err);
    await mongoose.connection.dropDatabase().catch(() => undefined);
    process.exit(1);
});
