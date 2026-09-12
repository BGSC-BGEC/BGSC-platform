/**
 * Runnable check for validate(), publish() and the AuditLog invariants. No DB, no server.
 *
 *   npx ts-node src/middleware/shared.selfcheck.ts
 */
import assert from 'assert';
import { z } from 'zod';
import { Request, Response } from 'express';
import { validate, issuesOf } from './validate';
import { publish, subscribe, resetBus, DomainEvent } from '../events/publish';
import { AuditLog } from '../models/AuditLog';

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
assert.strictEqual(bad.body.error, 'validation_failed', 'matches the agreed envelope (D8)');
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
}

auditChecks()
    .then(() => console.log('shared infra selfcheck: all assertions passed'))
    .catch((e) => { console.error(e); process.exit(1); });
