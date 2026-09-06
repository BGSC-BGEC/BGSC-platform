/**
 * End-to-end check for the User Service: real Express app, real Mongo, real JWTs.
 * Uses a scratch database that is dropped on exit, so it never touches dev data.
 *
 *   npx ts-node src/users/user.e2e.ts
 */
import assert from 'assert';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'http';
import { config } from '../config/env';
import { app } from '../index';
import { User, UserRole, UserStatus } from '../models/User';
import { Event } from '../models/Event';
import { FormSubmission } from '../models/Registration';
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '../storage/storage';
import { AuditLog } from '../models/AuditLog';
import { subscribe, resetBus, DomainEvent } from '../events/publish';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole) =>
    jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res { status: number; body: any }

async function call(
    method: string,
    path: string,
    opts: { as?: string; body?: unknown; raw?: Buffer; contentType?: string; service?: boolean } = {}
): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    if (opts.service) headers['x-internal-token'] = config.internalToken;
    let payload: string | Uint8Array | undefined;
    if (opts.raw) {
        headers['content-type'] = opts.contentType ?? 'image/png';
        payload = new Uint8Array(opts.raw);
    } else if (opts.body !== undefined) {
        headers['content-type'] = 'application/json';
        payload = JSON.stringify(opts.body);
    }
    const r = await fetch(base + path, { method, headers, body: payload });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
}

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await User.syncIndexes();

    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    resetBus();
    const events: DomainEvent[] = [];
    subscribe('*', (e) => { events.push(e); });

    // ---- fixtures ---------------------------------------------------------
    const ana = await User.create({
        email: 'ana@bgsc.test', username: 'ana', password_hash: 'x',
        profile: { full_name: 'Ana Rao', phone_number: '+919876543210', bio: 'chess' },
        points_balance: 260,
    });
    const bo = await User.create({
        email: 'bo@bgsc.test', username: 'bo', password_hash: 'x', profile: { full_name: 'Bo Sen' },
    });
    const coord = await User.create({
        email: 'c@bgsc.test', username: 'coord', password_hash: 'x',
        profile: { full_name: 'Cee Admin' }, role: UserRole.COORDINATOR,
    });

    const anaT = token(ana._id, UserRole.USER);
    const boT = token(bo._id, UserRole.USER);
    const coordT = token(coord._id, UserRole.COORDINATOR);

    assert.ok(/^[0-9a-f-]{36}$/.test(ana._id), '_id is a uuid string, not an ObjectId');

    // ---- auth gate --------------------------------------------------------
    assert.strictEqual((await call('GET', '/users/me')).status, 401, 'anonymous cannot read /users/me');
    assert.strictEqual(
        (await call('GET', '/users/me', { as: 'garbage' })).status, 401, 'a junk token is 401');

    // ---- self reads -------------------------------------------------------
    const me = await call('GET', '/users/me', { as: anaT });
    assert.strictEqual(me.status, 200, 'GET /users/me');
    assert.strictEqual(me.body.email, 'ana@bgsc.test', 'self sees the real email');
    assert.ok(me.body.settings, 'self sees settings');
    assert.ok(!JSON.stringify(me.body).includes('password_hash'), 'no hash in the response');

    // ---- masking ----------------------------------------------------------
    const asStranger = await call('GET', `/users/${ana._id}`, { as: boT });
    assert.strictEqual(asStranger.body.email, 'a***@bgsc.test', 'a stranger sees a masked email');
    assert.strictEqual(asStranger.body.profile.phone_number, '+91******3210', 'phone masked');
    assert.strictEqual(asStranger.body.settings, undefined, 'settings withheld');

    const anon = await call('GET', `/users/${ana._id}`);
    assert.strictEqual(anon.status, 200, 'public profile readable anonymously');
    assert.strictEqual(anon.body.email, 'a***@bgsc.test', 'anonymous also gets the masked email');

    const asCoord = await call('GET', `/users/${ana._id}`, { as: coordT });
    assert.strictEqual(asCoord.body.email, 'ana@bgsc.test', 'coordinator sees full PII');

    // ---- :ref resolves username as well as uuid ---------------------------
    const byName = await call('GET', '/users/ana', { as: boT });
    assert.strictEqual(byName.body.id, ana._id, 'lookup by username resolves the same user');
    assert.strictEqual((await call('GET', '/users/nobody', { as: boT })).status, 404, 'unknown ref is 404');

    // ---- literal routes are not shadowed by /:ref -------------------------
    const search = await call('GET', '/users/search?q=an', { as: boT });
    assert.strictEqual(search.status, 200, '/users/search is not captured by /:ref');
    assert.ok(search.body.users.some((u: any) => u.username === 'ana'), 'prefix search finds ana');

    // ---- profile update + event ------------------------------------------
    const patched = await call('PATCH', '/users/me', { as: anaT, body: { bio: 'updated bio' } });
    assert.strictEqual(patched.body.profile.bio, 'updated bio', 'bio updated');
    assert.strictEqual(patched.body.profile.full_name, 'Ana Rao', 'a partial PATCH keeps siblings');

    const updatedEvt = events.find((e) => e.type === 'UserProfileUpdated');
    assert.ok(updatedEvt, 'UserProfileUpdated emitted');
    assert.deepStrictEqual((updatedEvt!.payload as any).changed_fields, ['bio'], 'changed_fields is precise');

    // ---- privilege escalation via mass assignment -------------------------
    await call('PATCH', '/users/me', { as: anaT, body: { role: 'founder', points_balance: 999999 } });
    const afterEscalation = await call('GET', '/users/me', { as: anaT });
    assert.strictEqual(afterEscalation.body.role, UserRole.USER, 'role cannot be set through a profile PATCH');
    assert.strictEqual(afterEscalation.body.points_balance, 260, 'points cannot be set through a profile PATCH');

    assert.strictEqual(
        (await call('PATCH', '/users/me', { as: anaT, body: { bio: 'x'.repeat(300) } })).status,
        422, 'an over-long bio is 422');

    // ---- settings + privacy ----------------------------------------------
    await call('PATCH', '/users/me/settings', { as: anaT, body: { privacy: { is_profile_public: false } } });
    const hidden = await call('GET', `/users/${ana._id}`, { as: boT });
    assert.strictEqual(hidden.status, 200, 'a private profile still answers 200 (D9)');
    assert.strictEqual(hidden.body.private, true, 'flagged private');
    assert.strictEqual(hidden.body.email, undefined, 'a private profile exposes no email at all');
    assert.ok(hidden.body.username, 'username survives so deep links work');
    await call('PATCH', '/users/me/settings', { as: anaT, body: { privacy: { is_profile_public: true } } });

    // ---- player card + rating --------------------------------------------
    const card = await call('GET', `/users/ana/player-card`);
    assert.strictEqual(card.status, 200, 'player card is public');
    assert.strictEqual(card.body.rating, Math.floor(260 / 50), 'rating = points/50 with no events yet');
    assert.strictEqual(card.body.formula_version, 1, 'card carries the formula version');

    // ---- avatar upload ----------------------------------------------------
    const up = await call('POST', '/users/me/avatar', { as: anaT, raw: png });
    assert.strictEqual(up.status, 201, 'png upload accepted');
    assert.ok(up.body.avatar_url.startsWith('/uploads/avatars/'), 'avatar_url returned');
    const served = await fetch(base + up.body.avatar_url);
    assert.strictEqual(served.status, 200, 'uploaded avatar is served back');

    const evil = await call('POST', '/users/me/avatar', {
        as: anaT, raw: Buffer.from('<?php system($_GET[1]); ?>'), contentType: 'image/png',
    });
    assert.strictEqual(evil.status, 415, 'a php payload declared as image/png is rejected on magic bytes');

    // ---- Core PII is scoped to events they administer ---------------------
    const core = await User.create({
        email: 'core@bgsc.test', username: 'coreadmin', password_hash: 'x',
        profile: { full_name: 'Core Admin' }, role: UserRole.CORE,
    });
    const coreT = token(core._id, UserRole.CORE);

    // Before any event: a Core admin is just another viewer.
    const coreBefore = await call('GET', `/users/${ana._id}`, { as: coreT });
    assert.strictEqual(coreBefore.body.email, 'a***@bgsc.test', 'core sees masked PII with no event in common');

    const ev = await Event.create({
        slug: 'e2e-league', title: 'E2E League', category: 'leagues', type: 'LE', domain: 'sports',
        start_at: new Date(Date.now() + 864e5 * 10), end_at: new Date(Date.now() + 864e5 * 20),
        registration: { closes_at: new Date(Date.now() + 864e5 * 5), form_id: 'f-1' },
        created_by: coord._id, core_admins: [core._id],
        leaderboard: { format: 'points_table', min_participants: 2 },
    });
    await FormSubmission.create({
        form_id: 'f-1', form_version: 1, owner: { type: 'event', id: ev._id },
        user: { user_id: ana._id, display_name: 'Ana Rao' },
        context: { event: { role: 'solo' } }, status: 'confirmed',
    });

    const coreAfter = await call('GET', `/users/${ana._id}`, { as: coreT });
    assert.strictEqual(coreAfter.body.email, 'ana@bgsc.test', 'core sees full PII for a participant it administers');
    assert.strictEqual(coreAfter.body.profile.phone_number, '+919876543210', 'phone too');

    // bo is registered for nothing, so the same Core admin still sees them masked.
    const coreOther = await call('GET', `/users/${bo._id}`, { as: coreT });
    assert.strictEqual(coreOther.body.email, 'b***@bgsc.test', 'the scope is per-user, not a blanket Core unlock');

    // A Core admin of a different event gets nothing.
    const otherCore = await User.create({
        email: 'oc@bgsc.test', username: 'othercore', password_hash: 'x',
        profile: { full_name: 'Other Core' }, role: UserRole.CORE,
    });
    assert.strictEqual(
        (await call('GET', `/users/${ana._id}`, { as: token(otherCore._id, UserRole.CORE) })).body.email,
        'a***@bgsc.test', 'a Core admin of some other event sees masked PII');

    // ---- admin gating -----------------------------------------------------
    assert.strictEqual((await call('GET', '/users', { as: boT })).status, 403, 'a plain user cannot list users');
    assert.strictEqual((await call('GET', '/users')).status, 401, 'anonymous listing is 401, not 403');
    const list = await call('GET', '/users?limit=2', { as: coordT });
    assert.strictEqual(list.status, 200, 'coordinator can list');
    assert.strictEqual(list.body.users.length, 2, 'limit respected');
    assert.ok(list.body.next_cursor, 'cursor returned when more remain');

    // ---- role change + audit ----------------------------------------------
    const promote = await call('PATCH', `/users/${bo._id}/role`, {
        as: coordT, body: { role: 'core', reason: 'event ops' },
    });
    assert.strictEqual(promote.status, 200, 'coordinator promotes to core');
    assert.strictEqual(promote.body.role, 'core', 'role applied');

    const rows = await AuditLog.find({ target_id: bo._id, action: 'user.role_changed' });
    assert.strictEqual(rows.length, 1, 'exactly one audit row written');
    assert.deepStrictEqual(rows[0].previous_value, { role: 'user' }, 'audit records the previous value');
    assert.strictEqual(rows[0].reason, 'event ops', 'audit records the justification (§5.15.5)');
    assert.ok(events.some((e) => e.type === 'UserRoleChanged'), 'UserRoleChanged emitted');

    assert.strictEqual(
        (await call('PATCH', `/users/${bo._id}/role`, { as: coordT, body: { role: 'coordinator', reason: 'x' } })).status,
        422, 'coordinator promotion is refused — needs 2FA (§5.15.5), not built');
    assert.strictEqual(
        (await call('PATCH', `/users/${coord._id}/role`, { as: coordT, body: { role: 'core', reason: 'x' } })).status,
        409, 'an admin cannot change their own role');
    assert.strictEqual(
        (await call('PATCH', `/users/${bo._id}/role`, { as: coordT, body: { role: 'core' } })).status,
        422, 'a role change without a reason is refused');

    // ---- suspend ----------------------------------------------------------
    const susp = await call('PATCH', `/users/${bo._id}/status`, {
        as: coordT, body: { status: 'suspended', reason: 'abuse' },
    });
    assert.strictEqual(susp.status, 200, 'coordinator suspends');
    assert.ok(events.some((e) => e.type === 'UserDisabled'), 'UserDisabled emitted');
    const suspended = await User.findById(bo._id).select('+refresh_token_hash');
    assert.strictEqual(suspended!.refresh_token_hash, null, 'suspension clears the refresh token');
    assert.ok(
        !(await call('GET', '/users/search?q=bo', { as: anaT })).body.users.some((u: any) => u.username === 'bo'),
        'a suspended user drops out of search');

    // ---- replacing an avatar removes the old file -------------------------
    const first = await call('POST', '/users/me/avatar', { as: anaT, raw: png });
    const firstPath = path.join(UPLOAD_DIR, first.body.avatar_url.replace('/uploads/', ''));
    await fs.access(firstPath);                                    // throws if absent
    const second = await call('POST', '/users/me/avatar', { as: anaT, raw: png });
    assert.notStrictEqual(second.body.avatar_url, first.body.avatar_url, 'a replacement gets a new key');
    await new Promise((r) => setTimeout(r, 50));                   // cleanup is best-effort/async
    await assert.rejects(() => fs.access(firstPath), 'the replaced avatar file is deleted, not orphaned');
    assert.strictEqual((await fetch(base + second.body.avatar_url)).status, 200, 'the new avatar still serves');

    // ---- a suspended account loses write access immediately ---------------
    const doomed = await User.create({
        email: 'd@bgsc.test', username: 'doomed', password_hash: 'x', profile: { full_name: 'Doomed' },
    });
    const doomedT = token(doomed._id, UserRole.USER);
    assert.strictEqual((await call('PATCH', '/users/me', { as: doomedT, body: { bio: 'ok' } })).status, 200,
        'an active user can write');

    await call('PATCH', `/users/${doomed._id}/status`, { as: coordT, body: { status: 'suspended', reason: 'abuse' } });

    // The access token is still cryptographically valid for another 15 minutes (Spec §11.1).
    assert.strictEqual((await call('GET', '/users/me', { as: doomedT })).status, 200,
        'a suspended user may still read their own record');
    assert.strictEqual((await call('PATCH', '/users/me', { as: doomedT, body: { bio: 'still here' } })).status, 403,
        'a suspended user cannot write, even with a valid unexpired token');
    assert.strictEqual((await call('POST', '/users/me/avatar', { as: doomedT, raw: png })).status, 403,
        'a suspended user cannot upload');
    assert.strictEqual((await call('DELETE', '/users/me', { as: doomedT })).status, 202,
        'a suspended user may still delete their account');

    // ---- snapshots --------------------------------------------------------
    assert.strictEqual(
        (await call('GET', `/internal/users/snapshot?ids=${ana._id}`)).status,
        401, '/internal is not an unauthenticated user directory');
    assert.strictEqual(
        (await call('GET', `/internal/users/snapshot?ids=${ana._id}`, { as: coordT })).status,
        401, 'a user JWT is not a service token');

    const snaps = await call('GET', `/internal/users/snapshot?ids=${ana._id},${bo._id}`, { service: true });
    assert.strictEqual(snaps.body.snapshots.length, 2, 'bulk snapshot returns both');
    assert.deepStrictEqual(
        Object.keys(snaps.body.snapshots[0]).sort(),
        ['avatar_url', 'display_name', 'user_id'],
        'snapshot shape matches what six collections embed');

    // ---- pagination: ties and nulls ---------------------------------------
    const walk = async (sort: string, limit: number): Promise<string[]> => {
        const seen: string[] = [];
        let cursor: string | null = null;
        for (let i = 0; i < 20; i++) {
            const url = `/users?limit=${limit}&sort=${sort}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
            const r = await call('GET', url, { as: coordT });
            assert.strictEqual(r.status, 200, `page ${i} of ${sort}`);
            seen.push(...r.body.users.map((u: any) => u.username));
            cursor = r.body.next_cursor;
            if (!cursor) break;
        }
        return seen;
    };

    // Every user shares points_balance 0 and a null last_active_at by default — exactly the two
    // cases a naive `$lt` cursor drops.
    for (let i = 0; i < 6; i++) {
        await User.create({
            email: `p${i}@bgsc.test`, username: `pag${i}`, password_hash: 'x',
            profile: { full_name: `Pager ${i}` }, points_balance: 0,
        });
    }
    const total = await User.countDocuments({ deleted_at: null });

    const byPoints = await walk('points_balance', 2);
    assert.strictEqual(new Set(byPoints).size, byPoints.length, 'no duplicates when every row ties');
    assert.strictEqual(byPoints.length, total, 'ties at a page boundary are not skipped');

    const byActive = await walk('last_active_at', 2);
    assert.strictEqual(byActive.length, total, 'a null sort value does not truncate the walk');

    const byCreated = await walk('created_at', 3);
    assert.strictEqual(byCreated.length, total, 'date sort still walks the whole table');

    assert.strictEqual(
        (await call('GET', '/users?cursor=not-a-cursor', { as: coordT })).status,
        422, 'a corrupt cursor is rejected, not silently ignored');

    // The cursor is client-supplied JSON that lands inside a query filter. A Mongo operator
    // smuggled in as the sort value must be refused at decode, not left to schema casting.
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    for (const [label, payload] of [
        ['operator object', { v: { $ne: null }, id: 'x' }],
        ['operator in $gt', { v: { $gt: '' }, id: 'x' }],
        ['array value', { v: [1, 2], id: 'x' }],
        ['missing id', { v: 1 }],
    ] as [string, unknown][]) {
        const r = await call('GET', `/users?sort=points_balance&cursor=${encodeURIComponent(b64(payload))}`, { as: coordT });
        assert.strictEqual(r.status, 422, `cursor with ${label} is rejected at decode`);
    }
    // A legitimate primitive cursor still works.
    assert.strictEqual(
        (await call('GET', `/users?sort=points_balance&cursor=${encodeURIComponent(b64({ v: 0, id: 'zzz' }))}`, { as: coordT })).status,
        200, 'a well-formed cursor is still accepted');

    // Uploaded bytes are served from our own origin; sniffing must be off.
    const hdrs = await fetch(base + '/health');
    assert.strictEqual(hdrs.headers.get('x-content-type-options'), 'nosniff', 'nosniff is set');
    assert.strictEqual(hdrs.headers.get('x-frame-options'), 'DENY', 'framing is denied');

    // ---- no-op writes emit no event ---------------------------------------
    const before = events.length;
    const noop = await call('PATCH', '/users/me', { as: anaT, body: { social_links: {} } });
    assert.strictEqual(noop.status, 200, 'an empty social_links patch is accepted');
    assert.strictEqual(events.length, before, 'a write that changes nothing emits no UserProfileUpdated');

    // ---- soft delete ------------------------------------------------------
    const del = await call('DELETE', '/users/me', { as: anaT });
    assert.strictEqual(del.status, 202, 'deletion is accepted, not immediate');
    assert.strictEqual(del.body.grace_days, 30, '30-day grace (§11.2)');

    const still = await User.findById(ana._id);
    assert.ok(still, 'the row survives so ledger rows and snapshots still resolve');
    assert.strictEqual(still!.status, UserStatus.DELETED, 'status flipped to deleted');
    assert.ok(still!.deleted_at, 'deleted_at stamped');
    assert.strictEqual((await call('GET', `/users/${ana._id}`, { as: boT })).status, 404, 'gone from public reads');
    assert.strictEqual((await call('GET', '/users/me', { as: anaT })).status, 404, 'own record gone too');
    assert.ok(events.some((e) => e.type === 'UserDeleted'), 'UserDeleted emitted');

    const snapAfter = await call('GET', `/internal/users/snapshot?ids=${ana._id}`, { service: true });
    assert.strictEqual(snapAfter.body.snapshots.length, 1, 'snapshots still resolve a deleted user');

    // ---- reliability regressions ------------------------------------------

    // health must fail closed, or a load balancer keeps routing to a DB-less instance
    const okHealth = await fetch(base + '/health');
    assert.strictEqual(okHealth.status, 200, 'healthy instance reports 200');
    assert.strictEqual(((await okHealth.json()) as { status: string }).status, 'ok', 'and says ok');

    // a privilege change must never outrun its audit row
    const victim = await User.create({
        email: 'v@bgsc.test', username: 'victim', password_hash: 'x', profile: { full_name: 'V' },
    });
    const realCreate = AuditLog.create.bind(AuditLog);
    (AuditLog as unknown as { create: unknown }).create = async () => {
        throw new Error('audit store unavailable');
    };
    const blocked = await call('PATCH', `/users/${victim._id}/role`, {
        as: coordT, body: { role: 'core', reason: 'should not land' },
    });
    (AuditLog as unknown as { create: unknown }).create = realCreate;

    assert.strictEqual(blocked.status, 500, 'an audit failure fails the request');
    assert.strictEqual(
        (await User.findById(victim._id))!.role,
        UserRole.USER,
        'the role change did NOT land when the audit row could not be written'
    );

    // search degrades instead of 500ing when the text index is absent
    await User.collection.dropIndexes().catch(() => undefined);
    const degraded = await call('GET', '/users/search?q=coord', { as: coordT });
    assert.strictEqual(degraded.status, 200, 'search still answers with no text index');
    await User.createIndexes();

    console.log(`user service e2e: all assertions passed (${events.length} domain events emitted)`);
}

main()
    .then(async () => {
        await mongoose.connection.dropDatabase();
        server?.close();
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (err) => {
        console.error(err);
        try { await mongoose.connection.dropDatabase(); server?.close(); await mongoose.disconnect(); } catch {}
        process.exit(1);
    });
