/**
 * Gateway checks that need no stack: the routing rules and the strict auth limiter, driven through a
 * throwaway downstream on an ephemeral port. `gateway.smoke.ts` covers the same edge against a
 * running stack; this one runs anywhere.
 *
 *   npx ts-node src/gateway/gateway.selfcheck.ts
 */
import assert from 'assert';
import express from 'express';
import { AddressInfo } from 'net';
import { gzipSync } from 'zlib';
import { drainUnreadBody } from '@bgsc/shared';
import { createServiceProxy } from './proxy';
import { isAuthAttempt, isCredentialAttempt, isInternalPath } from './routing';
import { attemptIdentity, authAttemptIpCeiling, authAttemptLimiter, ceilingSkips, parseAttemptBody } from './rateLimit';

/* ------------------------------- routing -------------------------------- */

// Express routes case-insensitively and ignores a trailing slash, so an exact compare
// let these reach the login handler through the general bucket.
for (const p of ['/auth/login', '/auth/Login', '/AUTH/LOGIN', '/auth/login/', '/account/reactivate/']) {
    assert.ok(isAuthAttempt(p), `${p} is a strict-bucket path`);
}
// The routes that exist, not the two that never did.
for (const p of ['/auth/resend-verification', '/auth/phone/send-otp', '/auth/phone/verify-otp']) {
    assert.ok(isAuthAttempt(p), `${p} is a strict-bucket path`);
}
assert.ok(!isAuthAttempt('/auth/resend-otp') && !isAuthAttempt('/auth/totp/verify'), 'dead paths are gone');
assert.ok(!isAuthAttempt('/auth/me') && !isAuthAttempt('/auth/refresh'), 'ordinary auth routes stay general');
assert.ok(isCredentialAttempt('/auth/login') && !isCredentialAttempt('/auth/forgot-password'), 'send paths count every call');
assert.ok(isInternalPath('/INTERNAL/users') && isInternalPath('/internal/'), '/internal is blocked in any case');
// The per-IP ceiling frees successful logins and signups, never the always-200 mail/OTP sends.
const res200 = { statusCode: 200 } as never;
assert.ok(ceilingSkips({ path: '/auth/login' } as never, res200) && ceilingSkips({ path: '/auth/register' } as never, res200), 'successful login/signup are free');
assert.ok(!ceilingSkips({ path: '/auth/forgot-password' } as never, res200) && !ceilingSkips({ path: '/auth/resend-verification' } as never, res200), 'every reset/resend send counts toward the IP ceiling');

// Phone OTP has no identifier in the body: the signed-in caller is the account being attempted.
assert.strictEqual(attemptIdentity({ path: '/auth/phone/send-otp', user: { id: 'u-7' } } as never), 'u-7', 'phone OTP keys on the caller');
assert.strictEqual(attemptIdentity({ path: '/auth/phone/send-otp' } as never), null, 'and has no key without a session');
assert.strictEqual(attemptIdentity({ path: '/auth/login', body: { login: ' Ana@X.io ' } } as never), 'ana@x.io', 'login keys on the normalised identifier');

/* ------------------------------ the limiter ------------------------------ */

async function limiterChecks(): Promise<void> {
    const down = express();
    down.use(express.json());
    down.post('/auth/login', (req, res) => {
        res.status(req.body?.password === 'ok' ? 200 : 401).json({ got: req.body });
    });
    down.post('/auth/forgot-password', (_req, res) => { res.json({ ok: true }); });
    down.post('/auth/register', (req, res) => { res.status(201).json({ email: req.body?.email }); });
    const ds = down.listen(0);
    await new Promise((r) => ds.once('listening', r));

    const app = express();
    app.use(parseAttemptBody, authAttemptIpCeiling, authAttemptLimiter);
    // The real gateway proxy (proxy.ts), so its body re-streaming is what gets exercised.
    app.use(createServiceProxy('auth', `http://127.0.0.1:${(ds.address() as AddressInfo).port}`, ['/auth', '/account']));
    const gs = app.listen(0);
    await new Promise((r) => gs.once('listening', r));
    const base = `http://127.0.0.1:${(gs.address() as AddressInfo).port}`;
    const post = (path: string, body: unknown) =>
        fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

    try {
        const first = await post('/auth/login', { login: 'ana', password: 'ok' });
        assert.strictEqual(first.status, 200, 'a parsed body still reaches the service');
        assert.deepStrictEqual(((await first.json()) as { got: unknown }).got, { login: 'ana', password: 'ok' }, 'intact');

        // Successful logins do not count: a campus NAT must not lock out the sixth student.
        for (let i = 0; i < 8; i++) await post('/auth/login', { login: 'ana', password: 'ok' });
        assert.strictEqual((await post('/auth/login', { login: 'ana', password: 'ok' })).status, 200, 'successes are free');

        // Failures do count, whatever the case or trailing slash.
        const codes: number[] = [];
        for (const p of ['/auth/login', '/auth/Login', '/auth/login/', '/AUTH/LOGIN/', '/auth/login', '/auth/login']) {
            codes.push((await post(p, { login: 'victim', password: 'bad' })).status);
        }
        // `/AUTH/LOGIN/` does not match a gateway prefix (those are case-sensitive), so it 404s — but it
        // still counts, and the downstream would have matched it.
        assert.deepStrictEqual(codes, [401, 401, 401, 404, 401, 429], 'the sixth failed attempt is throttled');
        assert.strictEqual((await post('/auth/login', { login: 'other', password: 'bad' })).status, 401,
            'another account from the same IP has its own bucket');

        // A SEND path answers 200 regardless, so every call counts.
        const sends: number[] = [];
        for (let i = 0; i < 6; i++) sends.push((await post('/auth/forgot-password', { email: 'v@x.io' })).status);
        assert.strictEqual(sends[5], 429, 'forgot-password is limited even though it always answers 200');

        // The key is the field the route reads. A junk `login` on an email route used to
        // rotate the bucket; the victim's address stays throttled whatever else is in the body.
        const junk = await post('/auth/forgot-password', { email: 'v@x.io', login: `junk-${Date.now()}` });
        assert.strictEqual(junk.status, 429, 'a junk login field does not open a fresh bucket on an email route');

        // Successful sends do not count toward the per-IP ceiling (30), so a NAT can onboard.
        for (let i = 0; i < 35; i++) {
            const r = await post('/auth/register', { email: `s${i}@campus.edu` });
            assert.strictEqual(r.status, 201, `registration ${i + 1} from one IP is not throttled by the ceiling`);
        }

        // A chunked or gzip body is parsed here, so those headers must not be forwarded.
        const raw = JSON.stringify({ login: 'chunky', password: 'ok' });
        const chunked = await fetch(base + '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(raw)); c.close(); } }),
            duplex: 'half',
        } as RequestInit);
        assert.strictEqual(chunked.status, 200, 'a chunked login body reaches the service intact');
        const gz = await fetch(base + '/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
            body: gzipSync(raw),
        });
        assert.strictEqual(gz.status, 200, 'a gzip login body reaches the service intact');
    } finally {
        gs.close();
        ds.close();
    }
}

/* ------------------- an early refusal of a big upload ------------------- */

async function earlyRefusalChecks(): Promise<void> {
    // A service that refuses before reading the body (expired token). Without drainUnreadBody the
    // service closed the socket mid-upload and the proxy's next write failed: a 502, not the 401.
    const down = express();
    down.use(drainUnreadBody);
    down.post('/users/me/avatar', (_req, res) => { res.status(401).json({ error: 'unauthorized' }); });
    const ds = down.listen(0);
    await new Promise((r) => ds.once('listening', r));
    const app = express();
    app.use(createServiceProxy('user', `http://127.0.0.1:${(ds.address() as AddressInfo).port}`, ['/users']));
    const gs = app.listen(0);
    await new Promise((r) => gs.once('listening', r));
    const url = `http://127.0.0.1:${(gs.address() as AddressInfo).port}/users/me/avatar`;
    const big = Buffer.alloc(8 * 1024 * 1024, 7);
    try {
        const codes: number[] = [];
        for (let i = 0; i < 5; i++) {
            const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'image/png' }, body: big });
            codes.push(r.status);
        }
        assert.deepStrictEqual(codes, [401, 401, 401, 401, 401], 'an early 401 on a big upload reaches the client, never a 502');
    } finally {
        gs.close();
        ds.close();
    }
}

limiterChecks()
    .then(earlyRefusalChecks)
    .then(() => console.log('gateway selfcheck: all assertions passed'))
    .catch((err) => { console.error(err); process.exit(1); });
