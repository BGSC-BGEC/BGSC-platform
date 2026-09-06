/**
 * Runnable check for the auth + role middleware. No DB, no server, no test framework.
 *
 *   npx ts-node src/middleware/auth.selfcheck.ts
 */
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { config } from '../config/env';
import { UserRole } from '../models/User';
import { requireAuth, optionalAuth, bearerToken, AuthUser } from './requireAuth';
import { requireRole, requireSelfOr, rankOf } from './requireRole';

type Handler = (req: Request, res: Response, next: () => void) => void;

interface Result {
    status: number | null;
    body: unknown;
    passed: boolean;
    user?: AuthUser;
}

/** Drives one middleware with a fake req/res and reports what it did. */
function run(mw: Handler, headers: Record<string, string> = {}, req: Partial<Request> = {}): Result {
    const out: Result = { status: null, body: null, passed: false };
    const fakeReq = { headers, ...req } as unknown as Request;
    const fakeRes = {
        status(code: number) {
            out.status = code;
            return this;
        },
        json(payload: unknown) {
            out.body = payload;
            return this;
        },
    } as unknown as Response;

    mw(fakeReq, fakeRes, () => {
        out.passed = true;
    });
    out.user = fakeReq.user;
    return out;
}

const sign = (payload: object, opts: jwt.SignOptions = { expiresIn: '15m' }) =>
    jwt.sign(payload, config.jwt.accessSecret, opts);

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/* ------------------------------ bearerToken ----------------------------- */

assert.strictEqual(bearerToken('Bearer abc'), 'abc', 'plain bearer header');
assert.strictEqual(bearerToken('bearer abc'), 'abc', 'scheme is case-insensitive (RFC 6750)');
assert.strictEqual(bearerToken('  Bearer   abc  '), 'abc', 'surrounding and inner whitespace tolerated');
assert.strictEqual(bearerToken(undefined), null, 'missing header');
assert.strictEqual(bearerToken('abc'), null, 'no scheme');
assert.strictEqual(bearerToken('Basic abc'), null, 'wrong scheme');
assert.strictEqual(bearerToken('Bearer'), null, 'scheme with no token');
assert.strictEqual(bearerToken('Bearer a b'), null, 'extra segments rejected');

/* ------------------------------ requireAuth ----------------------------- */

const good = sign({ sub: 'u-1', role: UserRole.CORE });

const ok = run(requireAuth, bearer(good));
assert.ok(ok.passed, 'a valid token passes');
assert.deepStrictEqual(ok.user, { id: 'u-1', role: UserRole.CORE }, 'req.user is populated from the token');

for (const [label, headers] of [
    ['no header', {}],
    ['malformed header', { authorization: 'Bearer' }],
    ['garbage token', bearer('not.a.jwt')],
    ['wrong secret', bearer(jwt.sign({ sub: 'u-1', role: UserRole.USER }, 'some-other-secret'))],
    ['expired token', bearer(sign({ sub: 'u-1', role: UserRole.USER }, { expiresIn: '-1s' }))],
    ['no sub claim', bearer(sign({ role: UserRole.USER }))],
    ['empty sub', bearer(sign({ sub: '', role: UserRole.USER }))],
    ['no role claim', bearer(sign({ sub: 'u-1' }))],
    ['unknown role', bearer(sign({ sub: 'u-1', role: 'superadmin' }))],
] as [string, Record<string, string>][]) {
    const r = run(requireAuth, headers);
    assert.ok(!r.passed, `${label}: must not pass`);
    assert.strictEqual(r.status, 401, `${label}: must be 401`);
    assert.deepStrictEqual(r.body, { error: 'unauthorized' }, `${label}: must not say why`);
}

// The algorithm is pinned, so a token signed with anything else is rejected even if the secret
// leaks into a different algorithm's key slot (the classic RS256 -> HS256 downgrade).
const wrongAlg = jwt.sign({ sub: 'u-1', role: UserRole.USER }, config.jwt.accessSecret, {
    algorithm: 'HS512',
    expiresIn: '5m',
});
const algResult = run(requireAuth, bearer(wrongAlg));
assert.ok(!algResult.passed, 'a token signed with an unpinned algorithm is rejected');
assert.strictEqual(algResult.status, 401, 'and it is a 401');

// alg:none forgery, hand-rolled because jsonwebtoken will not sign one.
const noneToken =
    Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
    '.' +
    Buffer.from(JSON.stringify({ sub: 'u-1', role: UserRole.FOUNDER })).toString('base64url') +
    '.';
assert.strictEqual(run(requireAuth, bearer(noneToken)).status, 401, 'alg:none is rejected');

/* ----------------------------- optionalAuth ----------------------------- */

const anon = run(optionalAuth, {});
assert.ok(anon.passed, 'optionalAuth passes an anonymous request');
assert.strictEqual(anon.user, undefined, 'anonymous request gets no req.user');

const bad = run(optionalAuth, bearer('not.a.jwt'));
assert.ok(bad.passed, 'optionalAuth treats a bad token as no token');
assert.strictEqual(bad.user, undefined, 'a bad token must not populate req.user');

const signed = run(optionalAuth, bearer(good));
assert.ok(signed.passed && signed.user?.id === 'u-1', 'optionalAuth populates a valid token');

/* ------------------------------ requireRole ----------------------------- */

assert.ok(rankOf(UserRole.FOUNDER) > rankOf(UserRole.COORDINATOR), 'founder outranks coordinator');
assert.ok(rankOf(UserRole.COORDINATOR) > rankOf(UserRole.CORE), 'coordinator outranks core');
assert.ok(rankOf(UserRole.USER) > rankOf(UserRole.GUEST), 'user outranks guest');
assert.throws(() => requireRole('nope' as UserRole), /unknown role/, 'an unknown role is a wiring bug, not a 403');

const asRole = (role: UserRole) => ({ user: { id: 'u-1', role } } as Partial<Request>);
const coordinatorOnly = requireRole(UserRole.COORDINATOR);

assert.ok(run(coordinatorOnly, {}, asRole(UserRole.COORDINATOR)).passed, 'coordinator passes a coordinator gate');
assert.ok(run(coordinatorOnly, {}, asRole(UserRole.FOUNDER)).passed, 'founder passes a coordinator gate');

const tooLow = run(coordinatorOnly, {}, asRole(UserRole.CORE));
assert.ok(!tooLow.passed && tooLow.status === 403, 'core is forbidden, not unauthorized');

const noUser = run(coordinatorOnly, {});
assert.strictEqual(noUser.status, 401, 'an anonymous caller gets 401, not 403 — 403 would confirm the route exists');

/* ----------------------------- requireSelfOr ---------------------------- */

const selfOrCoordinator = requireSelfOr(UserRole.COORDINATOR, (req) => (req.params as Record<string, string>)?.ref);
const withRef = (ref: string, role: UserRole) =>
    ({ user: { id: 'u-1', role }, params: { ref } } as unknown as Partial<Request>);

assert.ok(run(selfOrCoordinator, {}, withRef('u-1', UserRole.USER)).passed, 'a user may act on their own record');
assert.ok(run(selfOrCoordinator, {}, withRef('u-2', UserRole.COORDINATOR)).passed, 'a coordinator may act on anyone');

const other = run(selfOrCoordinator, {}, withRef('u-2', UserRole.USER));
assert.ok(!other.passed && other.status === 403, 'a user may not act on someone else');

assert.strictEqual(run(selfOrCoordinator, {}).status, 401, 'requireSelfOr needs requireAuth to have run');

console.log('auth middleware selfcheck: all assertions passed');
