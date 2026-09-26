/**
 * Runnable check for validate(), publish() and the AuditLog invariants. No DB, no server.
 *
 *   npx ts-node src/middleware/shared.selfcheck.ts
 */
import assert from 'assert';
import { z } from 'zod';
import { Request, Response } from 'express';
import { validate, issuesOf } from './validate';
import { publish, subscribe, resetBus, DomainEvent, encodeWire, decodeWire, INSTANCE_ID } from '../events/publish';
import { AuditLog } from '../models/AuditLog';
import { errorHandler } from '../service';
import { config } from '../config/env';
import { redisOptions } from '../config/redis';
import { ServiceError } from '../errors';

/* -------------------------------- validate ------------------------------- */

interface Ran {
    status: number | null;
    body: any;
    passed: boolean;
    req: Request;
}

function run(mw: (r: Request, s: Response, n: () => void) => void, req: Partial<Request>): Ran {
    const out: Ran = { status: null, body: null, passed: false, req: req as Request };
    const res = {
        status(c: number) { out.status = c; return this; },
        json(b: unknown) { out.body = b; return this; },
    } as unknown as Response;
    mw(req as Request, res, () => { out.passed = true; });
    return out;
}

const Body = z.object({
    full_name: z.string().min(1),
    bio: z.string().max(250).optional(),
});

const good = run(validate({ body: Body }), { body: { full_name: 'Ana' } } as Partial<Request>);
assert.ok(good.passed, 'a valid body passes');

const bad = run(validate({ body: Body }), { body: { bio: 'x' } } as Partial<Request>);
assert.ok(!bad.passed, 'a missing required field does not pass');
assert.strictEqual(bad.status, 422, 'validation failure is 422');
assert.strictEqual(bad.body.error, 'validation_failed', 'matches the agreed envelope');
assert.ok(Array.isArray(bad.body.fields) && bad.body.fields[0].key === 'full_name', 'names the offending field');

// Sanitization: unknown keys are stripped, so a client cannot smuggle privileged fields in.
const smuggle = run(
    validate({ body: Body }),
    { body: { full_name: 'Ana', role: 'founder', points_balance: 999999 } } as Partial<Request>
);
assert.ok(smuggle.passed, 'extra keys do not fail the request');
assert.deepStrictEqual(smuggle.req.body, { full_name: 'Ana' }, 'extra keys are stripped, not passed through');

// Multiple parts report together rather than one error at a time.
const both = run(
    validate({ body: Body, params: z.object({ ref: z.string().min(1) }) }),
    { body: {}, params: {} } as Partial<Request>
);
assert.strictEqual(both.body.fields.length, 2, 'body and params failures are reported in one response');

const parsed = z.object({ n: z.coerce.number() }).safeParse({ n: '42' });
assert.ok(parsed.success && parsed.data.n === 42, 'zod coercion works, so handlers get typed values');

assert.ok(issuesOf(Body.safeParse({}).error!).length > 0, 'issuesOf flattens a ZodError');

/* --------------------------------- publish -------------------------------- */

resetBus();

const seen: DomainEvent[] = [];
const off = subscribe('UserProfileUpdated', (e) => { seen.push(e); });

const emitted = publish('UserProfileUpdated', 'user-service', { user_id: 'u-1', changed_fields: ['bio'] });

assert.strictEqual(seen.length, 1, 'a subscriber receives the event');
assert.strictEqual(seen[0].message_id, emitted.message_id, 'the subscriber sees the same envelope');
assert.strictEqual(seen[0].type, 'UserProfileUpdated', 'type is on the envelope');
assert.strictEqual(seen[0].producer, 'user-service', 'producer is recorded');
assert.strictEqual(seen[0].schema_version, 1, 'schema_version defaults to 1');
assert.ok(seen[0].occurred_at instanceof Date, 'occurred_at is a Date');
assert.ok(!('event_id' in seen[0]), 'envelope id is message_id, never event_id (relationships.md §6)');

const a = publish('X', 'p', {});
const b = publish('X', 'p', {});
assert.notStrictEqual(a.message_id, b.message_id, 'each publish gets a fresh message_id for dedupe');

off();
publish('UserProfileUpdated', 'user-service', { user_id: 'u-2' });
assert.strictEqual(seen.length, 1, 'unsubscribe stops delivery');

// A throwing consumer must not fail the request that produced the event: the write already committed.
resetBus();
subscribe('Boom', () => { throw new Error('consumer exploded'); });
const realError = console.error;
let logged = 0;
console.error = () => { logged++; };            // the throw is expected here; keep the output clean
assert.doesNotThrow(() => publish('Boom', 'p', {}), 'a throwing consumer does not propagate to the producer');
console.error = realError;
assert.strictEqual(logged, 1, 'the swallowed consumer error is still logged, not silently dropped');

resetBus();
let starred = 0;
subscribe('*', () => { starred++; });
publish('AnythingAtAll', 'p', {});
assert.strictEqual(starred, 1, "'*' receives every event (audit / analytics consumers)");
resetBus();

// Listener isolation (audit Sep 26): EventEmitter.emit stopped at the first throwing listener, so a
// broken consumer silently starved every other consumer of the type and every '*' listener.
{
    let after = 0;
    let star = 0;
    subscribe('Iso', () => { throw new Error('first consumer exploded'); });
    subscribe('Iso', async () => { throw new Error('async consumer rejected'); });
    subscribe('Iso', () => { after++; });
    subscribe('*', () => { star++; });
    const quiet = console.error;
    let reported = 0;
    console.error = (msg?: unknown) => { if (String(msg).includes('for Iso')) reported++; };
    publish('Iso', 'p', {});
    assert.strictEqual(after, 1, 'a listener after a throwing one still runs');
    assert.strictEqual(star, 1, "'*' still runs after a throwing typed listener");
    // The async rejection is reported on a later tick.
    setImmediate(() => {
        console.error = quiet;
        assert.strictEqual(reported, 2, 'both the sync throw and the async rejection are logged');
    });
    resetBus();
}

// Wire signing + own-message suppression (audit Sep 26): anything that could reach Redis could
// publish a forged ChallengeCompleted, and own-echo suppression was a bounded id set.
{
    const quiet = console.error;
    console.error = (msg?: unknown) => { if (String(msg).includes('for Iso')) quiet(msg); };
    const event = { message_id: 'm-1', type: 'ChallengeCompleted', occurred_at: new Date(), producer: 'x', schema_version: 1, payload: { award_points: 5 } };
    const fromPeer = decodeWire(encodeWire(event, 'another-process'));
    assert.ok(fromPeer && fromPeer.message_id === 'm-1', 'a signed message from another process is delivered');
    assert.ok(fromPeer!.occurred_at instanceof Date, 'occurred_at is revived as a Date');
    assert.ok(!('instance' in fromPeer!), 'the transport field does not leak into the envelope');
    assert.strictEqual(decodeWire(encodeWire(event, INSTANCE_ID)), null, "this process's own echo is suppressed");
    assert.strictEqual(decodeWire(JSON.stringify(event)), null, 'an unsigned (legacy/forged) message is dropped');
    const wire = JSON.parse(encodeWire(event, 'another-process'));
    wire.body = wire.body.replace('"award_points":5', '"award_points":100000');
    assert.strictEqual(decodeWire(JSON.stringify(wire)), null, 'a tampered payload fails the signature');
    assert.strictEqual(decodeWire('not json'), null, 'garbage is dropped, not thrown');

    // Audit #2: rotating INTERNAL_API_TOKEN dropped every in-flight message. The previous key is
    // accepted for verification only; anything else is still refused.
    const signedWithOld = (() => {
        const current = config.internalToken;
        config.internalToken = 'old-token';
        try { return encodeWire(event, 'another-process'); } finally { config.internalToken = current; }
    })();
    const envPrevious = config.internalTokenPrevious;
    config.internalTokenPrevious = '';
    assert.strictEqual(decodeWire(signedWithOld), null, 'an old-key message is refused without a previous key');
    config.internalTokenPrevious = 'old-token';
    assert.ok(decodeWire(signedWithOld), 'and accepted while INTERNAL_API_TOKEN_PREVIOUS names it');
    config.internalTokenPrevious = envPrevious;
    console.error = quiet;
}

/* ---------------------------- Redis connection ---------------------------- */

// Audit #2: a raw password in REDIS_URL with `/ # ? %` crashed every service at boot, and ioredis
// lets a URL password beat an options password. The password now travels on its own.
{
    const pw = 'p/w#x?y%z@q';
    const o = redisOptions('redis://redis:6379/2', pw);
    assert.deepStrictEqual(o, { host: 'redis', port: 6379, db: 2, password: pw }, 'a special-character password is passed verbatim');
    assert.strictEqual(redisOptions('redis://:inurl@h:1', 'separate').password, 'separate', 'REDIS_PASSWORD overrides the URL');
    assert.strictEqual(redisOptions('redis://:a%40b@h:1', '').password, 'a@b', 'a URL-encoded password is decoded');
    assert.strictEqual(redisOptions('redis://h', '').password, undefined, 'no password, no password option');
    assert.ok(redisOptions('rediss://h:1', '').tls, 'rediss:// turns TLS on');
    assert.throws(() => redisOptions('redis://:p/w#x@h:1', ''), 'an unparseable URL throws for the caller to handle');
}

/* -------------------------------- AuditLog -------------------------------- */

async function auditChecks(): Promise<void> {
    const errorOf = async (doc: { validate(): Promise<void> }) => {
        try { await doc.validate(); return ''; } catch (e) { return (e as Error).message; }
    };

    const row = new AuditLog({
        actor_id: 'admin-1',
        action: 'user.role_changed',
        target_type: 'user',
        target_id: 'u-1',
        previous_value: { role: 'user' },
        new_value: { role: 'core' },
        reason: 'promoted after onboarding',
    });
    assert.strictEqual(await errorOf(row), '', 'a role-change row validates');

    const noDiff = new AuditLog({ actor_id: 'a', action: 'user.viewed', target_type: 'user', target_id: 'u-1' });
    assert.ok(
        (await errorOf(noDiff)).includes('at least one of previous_value'),
        'a row recording no change is rejected'
    );

    const badAction = new AuditLog({
        actor_id: 'a', action: 'RoleChanged', target_type: 'user', target_id: 'u-1', new_value: { role: 'core' },
    });
    assert.ok((await errorOf(badAction)).length > 0, "action must be a dotted machine key, not 'RoleChanged'");

    const badTarget = new AuditLog({
        actor_id: 'a', action: 'user.role_changed', target_type: 'sponsor', target_id: 'x', new_value: {},
    });
    assert.ok((await errorOf(badTarget)).length > 0, 'unknown target_type is rejected');

    // System actions have no actor; that is legal and must stay legal.
    const system = new AuditLog({
        actor_id: null, action: 'user.suspended', target_type: 'user', target_id: 'u-1',
        previous_value: { status: 'active' }, new_value: { status: 'suspended' },
    });
    assert.strictEqual(await errorOf(system), '', 'a system-initiated row needs no actor');

    // Spec §7.3: immutable.
    await assert.rejects(
        () => AuditLog.updateOne({ _id: 'x' }, { $set: { action: 'nope' } }).exec(),
        /append-only/,
        'updating an audit row'
    );
    await assert.rejects(
        () => AuditLog.deleteMany({}).exec(),
        /append-only/,
        'deleting audit rows'
    );
    // Audit Sep 26: re-saving a loaded row and bulkWrite bypassed the query hooks.
    const loaded = AuditLog.hydrate({ _id: 'a-1', actor_id: null, action: 'user.suspended', target_type: 'user', target_id: 'u-1', new_value: { status: 'suspended' } });
    loaded.reason = 'rewritten';
    await assert.rejects(() => loaded.save(), /append-only/, 're-saving a loaded audit row');
    await assert.rejects(
        () => AuditLog.bulkWrite([{ deleteMany: { filter: {} } }]),
        /append-only/,
        'bulkWrite on audit rows'
    );
    await assert.rejects(() => loaded.deleteOne(), /append-only/, 'deleting a loaded audit row');
}

auditChecks()
    .then(() => console.log('shared infra selfcheck: all assertions passed'))
    .catch((e) => { console.error(e); process.exit(1); });


/* ------------------------------ error handler ---------------------------- */

/** Same fake-res shape as run() above; the handler takes four args, so it needs its own caller. */
function runErr(err: Error): { status: number | null; body: any } {
    const out: { status: number | null; body: any } = { status: null, body: null };
    const res = {
        status(c: number) { out.status = c; return this; },
        json(b: unknown) { out.body = b; return this; },
    } as unknown as Response;
    errorHandler('selfcheck')(err, {} as Request, res, () => {});
    return out;
}

const refusal = runErr(new ServiceError(409, 'already_published'));
assert.strictEqual(refusal.status, 409, 'a ServiceError keeps its status');
assert.strictEqual(refusal.body.error, 'already_published', 'and its code');

// body-parser's own errors. A malformed body is the client's mistake, not the server's: answering
// 500 tells the caller to retry something that can never succeed.
const malformed = Object.assign(new SyntaxError('Unexpected token'), {
    status: 400, expose: true, type: 'entity.parse.failed',
});
const badBody = runErr(malformed);
assert.strictEqual(badBody.status, 400, 'a malformed JSON body is 400, not 500');
assert.strictEqual(badBody.body.error, 'malformed_body', 'with a code the client can branch on');

const tooLarge = Object.assign(new Error('request entity too large'), {
    status: 413, expose: true, type: 'entity.too.large',
});
assert.strictEqual(runErr(tooLarge).status, 413, 'an oversized body is 413');
assert.strictEqual(runErr(tooLarge).body.error, 'payload_too_large', 'and says so');

// Anything not explicitly marked safe to show stays a 500 with no detail, however it is tagged.
const internal = Object.assign(new Error('connect ECONNREFUSED 10.0.0.4:5432'), { status: 400 });
const hidden = runErr(internal);
assert.strictEqual(hidden.status, 500, 'an untagged error is 500 even with a 4xx status on it');
assert.strictEqual(hidden.body.error, 'internal_error', 'and leaks nothing');

// Audit Sep 26: a ZodError that escapes validate() is the client's input, and a malformed
// percent-escape in a path param (the router's URIError) is a bad request — neither is a 500.
{
    const zerr = z.object({ n: z.number() }).safeParse({ n: 'x' }).error!;
    const zr = runErr(zerr);
    assert.strictEqual(zr.status, 422, 'an escaped ZodError is 422');
    assert.strictEqual(zr.body.error, 'validation_failed', 'with the validation code');
    const ur = runErr(Object.assign(new URIError('Failed to decode param'), { status: 400 }));
    assert.strictEqual(ur.status, 400, 'a URIError from the router is 400');
}

// The envelope test: only a real envelope is left alone.
{
    const { isEnveloped } = require('../service') as typeof import('../service');
    assert.strictEqual(isEnveloped({ success: true, data: 1 }), true, 'a success envelope is kept');
    assert.strictEqual(isEnveloped({ error: 'not_found' }), true, 'an error body is kept');
    assert.strictEqual(isEnveloped({ success: true, count: 3 }), false, 'a payload with success but no data is wrapped');
    assert.strictEqual(isEnveloped({ error: null, value: 1 }), false, 'a payload with a null error is wrapped');
    assert.strictEqual(isEnveloped([1]), false, 'arrays are wrapped');
}

// callInternal unwraps the envelope and types failures (audit C1).
const callInternalChecks = (async () => {
    const { callInternal, InternalCallError, unwrapEnvelope } = require('../http/internal') as typeof import('../http/internal');
    assert.deepStrictEqual(unwrapEnvelope({ success: true, data: { reserved: true } }), { reserved: true }, 'unwrap takes data');
    const realFetch = globalThis.fetch;
    try {
        globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, data: { reserved: true } }), { status: 200 })) as typeof fetch;
        assert.deepStrictEqual(await callInternal('http://x', '/y', { body: {} }), { reserved: true }, 'callInternal unwraps');
        globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'team_full' }), { status: 409 })) as typeof fetch;
        await assert.rejects(callInternal('http://x', '/y'), (e: unknown) => e instanceof InternalCallError && e.status === 409 && e.code === 'team_full' && !e.outcomeUnknown, 'a refusal carries its code');
        globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
        await assert.rejects(callInternal('http://x', '/y'), (e: unknown) => e instanceof InternalCallError && e.status === 0 && e.outcomeUnknown, 'unreachable is status 0, outcome unknown');
    } finally {
        globalThis.fetch = realFetch;
    }
    console.log('shared selfcheck: envelope, error mapping and callInternal passed');
})().catch((err) => { console.error(err); process.exit(1); });

// Audit #2: an unreadable 2xx body is outcome-unknown, not a null success; and event-admin scope.
// Chained after the check above: both stub the global `fetch`, and running them concurrently let
// one test's stub answer the other's call.
void callInternalChecks.then(async () => {
    const { callInternal, InternalCallError } = require('../http/internal') as typeof import('../http/internal');
    const { isEventAdmin } = require('../access/eventAdmin') as typeof import('../access/eventAdmin');
    const realFetch = globalThis.fetch;
    try {
        globalThis.fetch = (async () => new Response('<html>proxy</html>', { status: 200 })) as typeof fetch;
        await assert.rejects(callInternal('http://x', '/y'), (e: unknown) => e instanceof InternalCallError && e.status === 0 && e.code === 'bad_response', 'unreadable 2xx is outcome-unknown');
        globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'validation_failed', fields: [{ key: 'a', code: 'x' }] }), { status: 422 })) as typeof fetch;
        await assert.rejects(callInternal('http://x', '/y'), (e: unknown) => e instanceof InternalCallError && Array.isArray(e.details), '422 fields are carried');
    } finally {
        globalThis.fetch = realFetch;
    }
    const ev = { created_by: 'c', core_admins: ['a'] };
    assert.strictEqual(isEventAdmin(ev, { id: 'c', role: 'core' }), true, 'creator administers');
    assert.strictEqual(isEventAdmin(ev, { id: 'a', role: 'core' }), true, 'listed core admin administers');
    assert.strictEqual(isEventAdmin(ev, { id: 'x', role: 'core' }), false, 'an unrelated core does not');
    assert.strictEqual(isEventAdmin(ev, { id: 'x', role: 'coordinator' }), true, 'coordinator+ administers all');
    console.log('shared selfcheck: bad_response + event-admin scope passed');
}).catch((err) => { console.error(err); process.exit(1); });
