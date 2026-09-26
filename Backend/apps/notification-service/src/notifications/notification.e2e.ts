/**
 * End-to-end check for the Notification Service: real Express app, real Mongo, real JWTs.
 * Scratch database, dropped on exit, so it never touches dev data.
 *
 *   npx ts-node src/notifications/notification.e2e.ts
 *
 * Selfchecks cover the logic; this covers the wiring — routing order, auth, validation, the
 * success envelope, and the mass-assignment guard zod provides by stripping unknown keys.
 */
import assert from 'assert';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import {
    Notification,
    NotificationCategory,
    NotificationPreference,
    User,
    UserRole,
    config,
    notificationExpiry,
} from '@bgsc/shared';
import { app } from '../index';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_notification$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole = UserRole.USER) =>
    jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res {
    status: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    headers: Headers;
}

async function call(
    method: string,
    path: string,
    opts: { as?: string; body?: unknown } = {}
): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
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
        parsed && typeof parsed === 'object' && parsed.success === true && 'data' in parsed ? parsed.data : parsed;
    return { status: r.status, body, headers: r.headers };
}

const section = (name: string) => console.log(`\n-- ${name} --`);
const pass = (what: string) => console.log(`  ok  ${what}`);

async function seedUser(): Promise<string> {
    const id = uuid();
    await User.create({
        _id: id,
        email: `${id}@e2e.local`,
        username: `e2e_${id.slice(0, 8)}`,
        role: UserRole.USER,
        profile: { full_name: 'E2E User' },
    });
    return id;
}

async function seedNotification(
    userId: string,
    key: string,
    category: NotificationCategory = 'announcement'
): Promise<string> {
    const id = uuid();
    await Notification.create({
        _id: id,
        user_id: userId,
        category,
        type: 'announcement.published',
        title: `Card ${key}`,
        body: 'body',
        data: { announcement_id: uuid() },
        channel: 'in_app',
        dedupe_key: key,
        read_at: null,
        expires_at: notificationExpiry(),
    });
    return id;
}

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const me = await seedUser();
    const other = await seedUser();
    const meT = token(me);
    const otherT = token(other);

    /* ---- health --------------------------------------------------------- */
    section('health and headers');
    const health = await call('GET', '/health');
    assert.strictEqual(health.status, 200, '/health is 200 with Mongo up');
    assert.strictEqual(health.body.db, 'connected', 'and reports the database it needs');
    assert.strictEqual(health.body.service, 'notification-service', 'naming itself');
    assert.strictEqual(
        health.headers.get('x-content-type-options'),
        'nosniff',
        'security headers are mounted'
    );
    pass('/health is fail-closed and the security headers are on');

    /* ---- auth ------------------------------------------------------------ */
    section('every route requires a session');
    for (const [method, path] of [
        ['GET', '/notifications'],
        ['GET', '/notifications/unread-count'],
        ['GET', '/notifications/preferences'],
        ['PATCH', '/notifications/preferences'],
        ['POST', '/notifications/read-all'],
        ['POST', `/notifications/${uuid()}/read`],
        ['DELETE', `/notifications/${uuid()}`],
    ] as const) {
        const r = await call(method, path);
        assert.strictEqual(r.status, 401, `${method} ${path} is 401 anonymous`);
        assert.strictEqual(r.body.error, 'unauthorized', 'with the bare error shape');
    }
    pass('anonymous callers get 401 on all seven routes, never a 404 or a 500');

    /* ---- routing order ---------------------------------------------------- */
    section('literal paths are not swallowed by /:id');
    const prefs = await call('GET', '/notifications/preferences', { as: meT });
    assert.strictEqual(prefs.status, 200, '/preferences resolves as itself, not as an id lookup');
    assert.deepStrictEqual(
        prefs.body.in_app,
        { announcement: true, event: true, challenge: true, system: true },
        'and returns defaults for a user with no document'
    );
    const count = await call('GET', '/notifications/unread-count', { as: meT });
    assert.strictEqual(count.status, 200, '/unread-count too');
    assert.deepStrictEqual(count.body, { count: 0 }, 'zero for an empty inbox, as { count } like the announcement badge');
    pass('/preferences and /unread-count are declared before /:id and resolve correctly');

    /* ---- the inbox --------------------------------------------------------- */
    section('inbox');
    const mine = await seedNotification(me, 'announcement:one');
    await seedNotification(me, 'event.cancelled:two', 'event');
    const theirs = await seedNotification(other, 'announcement:three');

    const list = await call('GET', '/notifications', { as: meT });
    assert.strictEqual(list.status, 200);
    assert.strictEqual(list.body.notifications.length, 2, 'my two rows');
    assert.ok(
        !list.body.notifications.some((n: { _id: string }) => n._id === theirs),
        "and never another user's"
    );
    assert.strictEqual(list.body.next_cursor, null, 'a short page ends the pagination');
    assert.ok(!('__v' in list.body.notifications[0]), '__v never leaves the service');
    pass('the inbox is the caller\'s own, enveloped and clean');

    const filtered = await call('GET', '/notifications?category=event', { as: meT });
    assert.strictEqual(filtered.body.notifications.length, 1, 'category filters');

    const badFilter = await call('GET', '/notifications?category=sponsors', { as: meT });
    assert.strictEqual(badFilter.status, 422, 'an unknown category is refused at the boundary');
    assert.strictEqual(badFilter.body.error, 'validation_failed', 'with the shared validation shape');

    const badCursor = await call('GET', '/notifications?cursor=%7B%7D', { as: meT });
    assert.strictEqual(badCursor.status, 422, 'a malformed cursor is a 422');
    assert.strictEqual(badCursor.body.error, 'invalid_cursor', 'with its own code');

    // ?unread=false must mean "read only". z.coerce.boolean() would make it true.
    const unreadFalse = await call('GET', '/notifications?unread=false', { as: meT });
    assert.strictEqual(unreadFalse.body.notifications.length, 0, '?unread=false means read, not unread');
    pass('query validation refuses unknown values and does not invert "false"');

    /* ---- read state ---------------------------------------------------------- */
    section('read state');
    const read = await call('POST', `/notifications/${mine}/read`, { as: meT });
    assert.strictEqual(read.status, 200, 'marking read answers 200');
    assert.ok(read.body.read_at, 'with the timestamp');

    const foreign = await call('POST', `/notifications/${theirs}/read`, { as: meT });
    assert.strictEqual(foreign.status, 404, "another user's row is 404, not 403");
    assert.ok(await Notification.exists({ _id: theirs, read_at: null }), 'and is untouched');

    const badId = await call('POST', '/notifications/not-a-uuid/read', { as: meT });
    assert.strictEqual(badId.status, 422, 'a non-uuid id never reaches the service');

    const all = await call('POST', '/notifications/read-all', { as: meT });
    assert.strictEqual(all.body.marked, 1, 'read-all marks what was still unread');
    assert.strictEqual((await call('GET', '/notifications/unread-count', { as: meT })).body.count, 0, 'badge zeroed');

    const gone = await call('DELETE', `/notifications/${mine}`, { as: meT });
    assert.strictEqual(gone.status, 204, 'dismiss is 204 with no body');
    assert.ok(
        await Notification.exists({ _id: mine, dismissed_at: { $ne: null } }),
        'and the row is hidden, kept as the dedupe record'
    );
    const listed = await call('GET', '/notifications', { as: meT });
    assert.ok(
        !listed.body.notifications.some((n: { _id: string }) => n._id === mine),
        'a dismissed card is not in the inbox'
    );

    const goneAgain = await call('DELETE', `/notifications/${mine}`, { as: meT });
    assert.strictEqual(goneAgain.status, 404, 'dismissing it twice is a 404');
    pass('read, read-all and dismiss behave over HTTP, with 404 for anything not mine');

    /* ---- preferences and mass assignment -------------------------------------- */
    section('preferences');
    const patched = await call('PATCH', '/notifications/preferences', {
        as: meT,
        // `_id`, `channels` and `user_id` are the fields an attacker would want; zod strips every
        // one of them, so the only thing this body can change is the caller's own in_app map.
        body: { in_app: { announcement: false }, _id: other, user_id: other, channels: { in_app: { event: false } } },
    });
    assert.strictEqual(patched.status, 200, 'the patch applies');
    assert.strictEqual(patched.body.in_app.announcement, false, 'to the named leaf');
    assert.strictEqual(patched.body.in_app.event, true, 'leaving the others alone');

    assert.strictEqual(
        await NotificationPreference.countDocuments({ _id: other }),
        0,
        "and a body carrying another user's id does not write their preferences"
    );

    const theirPrefs = await call('GET', '/notifications/preferences', { as: otherT });
    assert.strictEqual(theirPrefs.body.in_app.announcement, true, 'their preferences are still the defaults');

    const emptyPatch = await call('PATCH', '/notifications/preferences', { as: meT, body: {} });
    assert.strictEqual(emptyPatch.status, 422, 'a patch with nothing to change is refused');
    const badLeaf = await call('PATCH', '/notifications/preferences', {
        as: meT,
        body: { in_app: { announcement: 'no' } },
    });
    assert.strictEqual(badLeaf.status, 422, 'and a non-boolean leaf never reaches Mongo');
    pass('preferences are the caller\'s own; unknown keys are stripped, bad values refused');

    /* ---- not found ------------------------------------------------------------- */
    section('unknown routes');
    const missing = await call('GET', '/nope', { as: meT });
    assert.strictEqual(missing.status, 404, 'an unknown path is a 404');
    const noCreate = await call('POST', '/notifications', { as: meT, body: { user_id: other, title: 'x' } });
    assert.strictEqual(noCreate.status, 404, 'there is no way to write into anyone\'s inbox over HTTP');
    pass('no client-facing write path into the inbox exists');

    console.log('\nnotification e2e: all checks passed');
}

main()
    .catch((err) => {
        console.error('\nnotification e2e failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.dropDatabase().catch(() => undefined);
        server?.close();
        await mongoose.disconnect().catch(() => undefined);
    });
