#!/usr/bin/env node
/**
 * Live full-stack harness. Talks ONLY to the gateway (http://localhost:3000), except for reading
 * dev-mail tokens / OTPs from logs/auth-service.log, the founder seed script, and one direct DB
 * write that mints the coordinator (the role API cannot: ASSIGNABLE_ROLES stops at core).
 *
 *   npm run live-check          (from Backend/: stack.sh, run.js, stop.sh; exit code = run.js's)
 *
 * Plain Node (node:http rather than fetch so anonymous calls can rotate the loopback source address
 * past the gateway's 100/min per-IP bucket; the one rate-limit test pins its own address).
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

// Runtime output (logs, pids, uploads, report) lives in .run/, which git ignores.
const LIVE = path.join(__dirname, '.run');
const BACKEND = path.resolve(__dirname, '../..');
const LOGS = path.join(LIVE, 'logs');
const LIVE_URI = fs.readFileSync(path.join(LIVE, 'mongo_uri'), 'utf8').trim();
const HARNESS_INTERNAL_TOKEN = 'bgsc_live_harness_internal_token';
const ENV = parseEnv(fs.readFileSync(path.join(BACKEND, '.env'), 'utf8'));
const ROLES = ['guest', 'user', 'member', 'core', 'coordinator', 'founder'];
const rank = (r) => ROLES.indexOf(r);
const H = 3600e3;
const iso = (ms) => new Date(ms).toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
);
const UNCONFIGURED = new Set(['strava_not_configured', 'google_oauth_not_configured']);

function parseEnv(text) {
    const out = {};
    for (const line of text.split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (m) out[m[1]] = m[2].replace(/\s+#.*$/, '').trim();
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Route table, parsed from the source so coverage tracks the code
 * ------------------------------------------------------------------ */

const MOUNTS = [
    ['apps/auth-service/src/auth/auth.routes.ts', { authRoutes: '/auth', accountRoutes: '/account' }],
    ['apps/user-service/src/users/user.routes.ts', { userRoutes: '/users' }],
    ['apps/event-service/src/auction/auction.routes.ts', { auctionRoutes: '/auction', eventAuctionRoutes: '/events/:ref/auction' }],
    ['apps/event-service/src/events/event.routes.ts', { eventRoutes: '/events' }],
    ['apps/registration-service/src/forms/form.routes.ts', { formRoutes: '/forms' }],
    ['apps/registration-service/src/registrations/registration.routes.ts', { registrationRoutes: '/registrations' }],
    ['apps/registration-service/src/teams/team.routes.ts', { teamRoutes: '/teams' }],
    ['apps/announcement-service/src/announcements/announcement.routes.ts', { announcementRoutes: '/announcements' }],
    ['apps/points-service/src/points/points.routes.ts', { pointsRoutes: '/points' }],
    ['apps/leaderboard-service/src/leaderboard/leaderboard.routes.ts', { leaderboardRoutes: '/leaderboards' }],
    ['apps/leaderboard-service/src/hall-of-fame/hallOfFame.routes.ts', { hallOfFameRouter: '/hall-of-fame' }],
    ['apps/challenge-service/src/challenges/challenge.routes.ts', { challengeRoutes: '/challenges' }],
    ['apps/challenge-service/src/strava/strava.routes.ts', { stravaRoutes: '/strava' }],
    ['apps/media-service/src/media/media.routes.ts', { mediaRoutes: '/media' }],
    ['apps/notification-service/src/notifications/notification.routes.ts', { notificationRoutes: '/notifications' }],
    ['apps/feedback-service/src/feedback/feedback.routes.ts', { feedbackRoutes: '/feedback', contactRoutes: '/contact' }],
    ['apps/bracket-service/src/brackets/bracket.routes.ts', { bracketRoutes: '/brackets' }],
    ['apps/bracket-service/src/matches/match.routes.ts', { matchRoutes: '/matches' }],
];

function parseRoutes() {
    const routes = [];
    for (const [rel, routers] of MOUNTS) {
        const text = fs.readFileSync(path.join(BACKEND, rel), 'utf8');
        const svc = rel.split('/')[1];
        const authFrom = {};
        for (const m of text.matchAll(/(\w+)\.use\(\s*requireAuth\s*\)/g)) authFrom[m[1]] = m.index;
        const re = /(\w+)\.(get|post|patch|put|delete)\(\s*'([^']*)'([\s\S]*?)\);\s*\n/g;
        for (const m of text.matchAll(re)) {
            const [, router, method, sub, args] = m;
            if (!(router in routers)) continue;
            const full = (routers[router] + (sub === '/' ? '' : sub)).replace(/\/$/, '') || '/';
            const floorM = /require(ActiveUser|Role)\(\s*UserRole\.(\w+)\s*\)/.exec(args);
            const auth = /requireAuth/.test(args) || (authFrom[router] !== undefined && m.index > authFrom[router])
                ? 'required'
                : /optionalAuth/.test(args) ? 'optional' : 'none';
            routes.push({
                svc, method: method.toUpperCase(), pattern: full, auth,
                floor: floorM ? floorM[2].toLowerCase() : null,
                floorKind: floorM ? (floorM[1] === 'Role' ? 'token' : 'live') : null,
                body: /validate\(\{[^}]*\bbody:/.test(args),
                raw: /\braw\(/.test(args),
                regex: new RegExp('^' + full.replace(/:[A-Za-z_]+/g, '[^/]+') + '/?$'),
                hits: {}, ok2xx: false, refusals: new Set(),
            });
        }
    }
    return routes;
}
const ROUTES = parseRoutes();
const STATIC_UPLOADS = { svc: 'media-service', method: 'GET', pattern: '/uploads/*', auth: 'none', regex: /^\/uploads\/.+$/, hits: {}, ok2xx: false, refusals: new Set(), extra: true };

function routeOf(method, url) {
    const p = url.split('?')[0];
    if (method === 'GET' && STATIC_UPLOADS.regex.test(p)) return STATIC_UPLOADS;
    return ROUTES.find((r) => r.method === method && r.regex.test(p)) || null;
}

const PREFIX_SVC = [
    ['/auth', 'auth-service'], ['/account', 'auth-service'], ['/users', 'user-service'], ['/events', 'event-service'],
    ['/auction', 'event-service'], ['/forms', 'registration-service'], ['/registrations', 'registration-service'],
    ['/teams', 'registration-service'], ['/announcements', 'announcement-service'], ['/points', 'points-service'],
    ['/leaderboards', 'leaderboard-service'], ['/hall-of-fame', 'leaderboard-service'], ['/challenges', 'challenge-service'],
    ['/strava', 'challenge-service'], ['/media', 'media-service'], ['/uploads', 'media-service'],
    ['/notifications', 'notification-service'], ['/feedback', 'feedback-service'], ['/contact', 'feedback-service'],
    ['/brackets', 'bracket-service'], ['/matches', 'bracket-service'],
];
const svcOf = (url) => (PREFIX_SVC.find(([p]) => url === p || url.startsWith(p + '/') || url.startsWith(p + '?')) || [0, 'gateway'])[1];

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

const R = {
    calls: 0, callPass: 0, callFail: 0, asserts: 0, assertPass: 0, assertFail: 0,
    failures: [], fivexx: [], configured503: [], skipped: [], notes: [], journeys: [],
};
let J = null;

function fail(line) {
    R.failures.push(`[${J ? J.name : 'global'}] ${line}`);
    if (J) J.fails++;
}
function check(cond, label, detail) {
    R.asserts++;
    if (cond) { R.assertPass++; return true; }
    R.assertFail++;
    fail(`ASSERT ${label}${detail === undefined ? '' : ' — ' + excerpt(detail)}`);
    return false;
}
function skip(what, why) { R.skipped.push(`${what}: ${why}`); }
function note(s) { R.notes.push(s); }
function excerpt(v, n = 260) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s === undefined ? 'undefined' : s.length > n ? s.slice(0, n) + '…' : s;
}
class Abort extends Error {}
function need(v, what) { if (!v) throw new Abort(`prerequisite missing: ${what}`); return v; }

async function journey(name, fn) {
    const j = { name, fails: 0, error: null };
    R.journeys.push(j);
    J = j;
    const t0 = Date.now();
    try { await fn(); } catch (e) {
        j.error = e instanceof Abort ? e.message : (e.stack || String(e)).split('\n').slice(0, 3).join(' | ');
        fail(`[journey aborted] ${j.error}`);
    }
    j.ms = Date.now() - t0;
    console.log(`  ${j.fails ? 'FAIL' : 'ok  '} ${name} (${(j.ms / 1000).toFixed(1)}s${j.fails ? `, ${j.fails} failure(s)` : ''})`);
    J = null;
}

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

let anonSeq = 0;
const nextAnonIp = () => `127.0.0.${10 + (anonSeq++ % 200)}`;
const windows = new Map();
async function throttle(key) {
    // The gateway allows 100/min per user; stay under it rather than measure the limiter by accident.
    const w = windows.get(key) || [];
    const now = Date.now();
    while (w.length && now - w[0] > 60_000) w.shift();
    if (w.length >= 92) {
        const wait = 60_000 - (now - w[0]) + 50;
        await sleep(wait);
        return throttle(key);
    }
    w.push(Date.now());
    windows.set(key, w);
}

function rawRequest({ method, path: p, headers, body, localAddress }) {
    return new Promise((resolve) => {
        const req = http.request({ host: '127.0.0.1', port: 3000, method, path: p, headers, localAddress, agent: false }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
            res.on('error', (e) => resolve({ status: 0, headers: {}, buf: Buffer.from(String(e.message)) }));
        });
        req.on('error', (e) => resolve({ status: 0, headers: {}, buf: Buffer.from('transport error: ' + e.message) }));
        req.setTimeout(40_000, () => req.destroy(new Error('timeout')));
        if (body) req.write(body);
        req.end();
    });
}

function logText(svc) {
    try { return fs.readFileSync(path.join(LOGS, svc + '.log'), 'utf8'); } catch { return ''; }
}
function logExcerpt(svc) {
    const lines = logText(svc).split('\n');
    let i = lines.length - 1;
    for (; i >= 0 && i > lines.length - 200; i--) if (/error|Error|UNHANDLED|failed/.test(lines[i])) break;
    const from = Math.max(0, i - 3);
    return lines.slice(from, from + 18).join('\n');
}

/**
 * One gateway call. `as`: a user key, null (anonymous), or { token, label }. `expect`: a status or
 * list of statuses. Every call is checked for the envelope, and any 5xx is a failure regardless.
 */
async function api(method, url, o = {}) {
    let token = null; let who = 'anon'; let key = null;
    if (typeof o.as === 'string') {
        const u = need(S.u[o.as], `user ${o.as}`);
        token = u.token; who = o.as; key = u.id;
    } else if (o.as && o.as.token !== undefined) {
        token = o.as.token; who = o.as.label || 'custom-token';
    }
    const headers = { accept: 'application/json', ...(o.headers || {}) };
    if (token) headers.authorization = `Bearer ${token}`;
    let payload = null;
    if (o.raw) { payload = o.raw; headers['content-type'] = o.ctype || 'application/octet-stream'; }
    else if (o.body !== undefined) { payload = Buffer.from(JSON.stringify(o.body)); headers['content-type'] = 'application/json'; }
    if (payload) headers['content-length'] = String(payload.length);
    const localAddress = o.ip || (key ? undefined : nextAnonIp());
    if (key && !o.ip) await throttle(key);

    const res = await rawRequest({ method, path: url, headers, body: payload, localAddress });
    const ct = String(res.headers['content-type'] || '');
    let body = null;
    const isJson = ct.includes('application/json');
    if (isJson) { try { body = JSON.parse(res.buf.toString('utf8')); } catch { body = null; } }
    const text = isJson ? JSON.stringify(body) : res.buf.toString('utf8', 0, 200);
    const out = { status: res.status, body, data: body && body.data, headers: res.headers, buf: res.buf, text };

    const exp = o.expect === undefined ? [200] : o.expect === 'any' ? null : [].concat(o.expect);
    let ok = !exp || exp.includes(res.status);
    const problems = [];
    let is5xx = false;
    if (res.status >= 500 || res.status === 0) {
        if (res.status === 503 && body && UNCONFIGURED.has(body.error)) {
            R.configured503.push(`${method} ${url.split('?')[0]} → 503 ${body.error}`);
        } else {
            is5xx = true; ok = false;
            R.fivexx.push({ line: `${method} ${url} as ${who} → ${res.status} ${excerpt(text, 200)}`, log: logExcerpt(svcOf(url)) });
        }
    }
    if (!o.noEnvelope && res.status !== 204 && res.status !== 0) {
        if (!isJson) {
            if (res.status < 300 || res.status >= 400) problems.push(`non-JSON ${res.status} body`);
        } else if (res.status >= 200 && res.status < 300) {
            if (!(body && body.success === true && 'data' in body)) problems.push('2xx without {success:true,data}');
        } else if (res.status >= 400) {
            if (!(body && typeof body.error === 'string')) problems.push('4xx without {error:string}');
            else if (body.error === 'validation_failed' && !(Array.isArray(body.fields) && body.fields.length > 0 &&
                body.fields.every((f) => f && typeof f.key === 'string' && typeof f.code === 'string'))) {
                problems.push('422 validation_failed without fields[{key,code}]');
            }
            if (res.status === 422 && o.want422Shape && body.error !== 'validation_failed') problems.push(`422 error is '${body.error}', not validation_failed`);
        }
    }
    if (problems.length) ok = false;

    const r = routeOf(method, url);
    if (r) {
        r.hits[res.status] = (r.hits[res.status] || 0) + 1;
        if (ok && res.status >= 200 && res.status < 300) r.ok2xx = true;
        if (ok && [401, 403, 404, 422].includes(res.status)) r.refusals.add(res.status);
    }

    if (!o.quiet || is5xx || problems.length) {
        R.calls++;
        if (ok) R.callPass++;
        else {
            R.callFail++;
            fail(`${method} ${url} as ${who} → got ${res.status} ${excerpt(text, 220)}, expected ${exp ? exp.join('|') : 'any'}${problems.length ? ' [' + problems.join('; ') + ']' : ''}${o.why ? ' (' + o.why + ')' : ''}`);
        }
    }
    out.ok = ok;
    return out;
}

async function poll(fn, timeout = 10_000, every = 400) {
    const end = Date.now() + timeout;
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() > end) return null;
        await sleep(every);
    }
}

/* ------------------------------------------------------------------ *
 * State and helpers
 * ------------------------------------------------------------------ */

const RUN = Date.now().toString(36).slice(-5);
const PW = 'LivePass#2026x';
const S = { u: {}, e: {} };
const USER_KEYS = ['founder', 'coord', 'coreA', 'coreB', 'member', 'userA', 'userB', 'userC'];

function forgeJwt(payload, secret) {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = b64({ alg: 'HS256', typ: 'JWT' });
    const body = b64(payload);
    const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
}

async function mailToken(email, word, since = 0) {
    return poll(() => {
        const lines = logText('auth-service').split('\n');
        for (let i = lines.length - 1; i >= since; i--) {
            if (lines[i].includes(`To: ${email}`) && (lines[i + 1] || '').includes(word)) {
                for (let k = i; k < i + 6 && k < lines.length; k++) {
                    const m = /Token: ([0-9a-f]{16,})/.exec(lines[k]);
                    if (m) return m[1];
                }
            }
        }
        return null;
    }, 8000, 300);
}
const logLineCount = (svc) => logText(svc).split('\n').length;

async function otpFor(phone, since) {
    return poll(() => {
        const lines = logText('auth-service').split('\n');
        for (let i = lines.length - 1; i >= since; i--) {
            if (lines[i].includes('OTP') && lines[i].includes(phone)) {
                const m = /OTP is: (\d{6})/.exec(lines[i + 1] || '');
                if (m) return m[1];
            }
        }
        return null;
    }, 8000, 300);
}

async function login(key, password = S.u[key].password) {
    const u = S.u[key];
    const r = await api('POST', '/auth/login', { body: { login: u.email, password }, expect: 200 });
    if (r.data && r.data.tokens) { u.token = r.data.tokens.access_token; u.refresh = r.data.tokens.refresh_token; }
    return r;
}

async function notifications(key, type) {
    const r = await api('GET', '/notifications?limit=50', { as: key, quiet: true });
    const list = (r.data && r.data.notifications) || [];
    return type ? list.filter((n) => n.type === type) : list;
}
async function pointsTx(key) {
    const r = await api('GET', '/points/me/transactions?limit=50', { as: key, quiet: true });
    return (r.data && r.data.transactions) || [];
}
async function balance(key) {
    const r = await api('GET', '/points/me', { as: key, quiet: true });
    return r.data ? r.data.balance : null;
}

const formFields = (extra = []) => [{ key: 'nickname', label: 'Nickname', type: 'short_text', required: true, order: 0 }, ...extra];

/** draft → form → publish → upcoming. Returns { id, slug, formId }. */
async function setupEvent(title, over = {}, extraFields = [], as = 'coreA') {
    const now = Date.now();
    const body = {
        title, category: 'general', description: 'created by the live harness',
        start_at: iso(now + 2 * H), end_at: iso(now + 6 * H),
        ...over,
        registration: { closes_at: iso(now + 1 * H), ...(over.registration || {}) },
    };
    const ev = await api('POST', '/events', { as, body, expect: 201 });
    const id = need(ev.data && ev.data._id, `event ${title} created`);
    const form = await api('POST', '/forms', { as, body: { owner: { type: 'event', id }, title: `${title} form`, fields: formFields(extraFields) }, expect: 201 });
    const formId = need(form.data && form.data._id, `form for ${title}`);
    await api('POST', `/forms/${formId}/publish`, { as, expect: 200 });
    const up = await api('PATCH', `/events/${id}`, { as, body: { registration: { form_id: formId }, status: 'upcoming' }, expect: 200 });
    need(up.data && up.data.status === 'upcoming', `${title} upcoming`);
    return { id, slug: ev.data.slug, formId };
}

async function register(key, ev, ctx, expect = 201, extra = {}) {
    const body = { form_id: ev.formId, owner: { type: 'event', id: ev.id }, answers: { nickname: `${key}-nick` }, ...extra };
    if (ctx) body.context = { event: ctx };
    return api('POST', '/registrations', { as: key, body, expect });
}

/* ------------------------------------------------------------------ *
 * Journeys
 * ------------------------------------------------------------------ */

async function bootstrap() {
    for (const key of USER_KEYS) {
        const u = { key, email: `${key.toLowerCase()}.${RUN}@example.com`, username: `${key.toLowerCase()}_${RUN}`, password: PW, full_name: `Live ${key}` };
        const r = await api('POST', '/auth/register', { body: { email: u.email, username: u.username, password: u.password, full_name: u.full_name }, expect: 201 });
        need(r.data && r.data.user, `register ${key}`);
        u.id = r.data.user.id;
        u.token = r.data.tokens.access_token;
        u.refresh = r.data.tokens.refresh_token;
        check(r.data.user.role === 'user', `new account ${key} starts as 'user'`, r.data.user.role);
        S.u[key] = u;
        const tok = await mailToken(u.email, 'Verify');
        need(tok, `verification token for ${key} in auth-service log`);
        const v = await api('POST', '/auth/verify-email', { body: { token: tok }, expect: 200 });
        check(v.data && v.data.is_email_verified === true, `verify-email ${key}`, v.data);
    }
    // duplicate registration
    await api('POST', '/auth/register', { body: { email: S.u.userA.email, username: `dup_${RUN}`, password: PW, full_name: 'Dup' }, expect: 409 });
    // verifying twice: token consumed
    await api('POST', '/auth/verify-email', { body: { token: 'f'.repeat(64) }, expect: 400 });

    // founder bootstrap, the documented way
    try {
        const out = execFileSync(path.join(BACKEND, 'node_modules/.bin/ts-node'), ['apps/user-service/src/scripts/seed-founder.ts'], {
            cwd: BACKEND,
            env: { ...process.env, FOUNDER_EMAIL: S.u.founder.email, MONGO_URI: LIVE_URI, INTERNAL_API_TOKEN: HARNESS_INTERNAL_TOKEN, TS_NODE_TRANSPILE_ONLY: '1', NODE_ENV: 'development' },
            encoding: 'utf8', timeout: 90_000,
        });
        check(/promoted|already_founder/.test(out), 'seed-founder output', out.slice(-200));
    } catch (e) {
        fail(`seed-founder failed: ${excerpt(String(e.stdout || '') + String(e.stderr || e.message), 400)}`);
    }
    await login('founder');
    const me = await api('GET', '/users/me', { as: 'founder' });
    need(me.data && me.data.role === 'founder', 'founder role after seed');

    // role API: core and member can be minted; coordinator is refused by the schema
    for (const [k, role] of [['coreA', 'core'], ['coreB', 'core'], ['member', 'member']]) {
        const r = await api('PATCH', `/users/${S.u[k].id}/role`, { as: 'founder', body: { role, reason: 'live harness bootstrap' }, expect: 200 });
        check(r.data && r.data.role === role, `role ${k} → ${role}`, r.data && r.data.role);
    }
    await api('PATCH', `/users/${S.u.coord.id}/role`, { as: 'founder', body: { role: 'coordinator', reason: 'try' }, expect: 422, why: 'coordinator not assignable via API' });
    await api('PATCH', `/users/${S.u.founder.id}/role`, { as: 'founder', body: { role: 'core', reason: 'self' }, expect: 409, why: 'cannot_change_own_role' });
    await api('PATCH', `/users/${S.u.userB.id}/role`, { as: 'coreA', body: { role: 'member', reason: 'x' }, expect: 403 });

    // coordinator: direct DB write (no API path — requires Founder 2FA that does not exist)
    const mongoose = require(path.join(BACKEND, 'node_modules/mongoose'));
    const conn = await mongoose.createConnection(LIVE_URI).asPromise();
    if (conn.db.databaseName !== 'bgsc_live') throw new Abort('not bgsc_live');
    await conn.collection('users').updateOne({ _id: S.u.coord.id }, { $set: { role: 'coordinator' } });
    await conn.close();
    note('coordinator minted by a direct DB write to users.role (PATCH /users/:ref/role cannot assign coordinator: ASSIGNABLE_ROLES = user|member|core, by design pending Founder 2FA).');
    skip('guest role checks', 'no API path mints a guest (register always creates role=user); guest-floor behaviour is exercised only as anonymous');

    for (const k of USER_KEYS) if (k !== 'founder') await login(k);
    for (const k of USER_KEYS) {
        const r = await api('GET', '/users/me', { as: k, quiet: true });
        S.u[k].role = r.data && r.data.role;
    }
    check(S.u.coord.role === 'coordinator' && S.u.coreA.role === 'core' && S.u.member.role === 'member', 'roles after bootstrap', Object.fromEntries(USER_KEYS.map((k) => [k, S.u[k].role])));
}

async function gatewayContract() {
    // no bearer vs garbage vs expired on a public GET (the Sep-26 contract: a bad header is 401 everywhere)
    // Contract (lead, Sep 26 revert): optionalAuth is lenient — a garbage/expired bearer on a public
    // GET is served the guest view (200), while requireAuth routes still 401.
    const guest = await api('GET', '/events', { expect: 200 });
    const g1 = await api('GET', '/events', { as: { token: 'garbage.not.a.jwt', label: 'garbage-bearer' }, expect: 200, why: 'lenient optionalAuth: guest view' });
    const expired = forgeJwt({ sub: S.u.userA.id, role: 'user', iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 60 }, ENV.JWT_ACCESS_SECRET);
    await api('GET', '/events', { as: { token: expired, label: 'expired-bearer' }, expect: 200, why: 'lenient optionalAuth: guest view' });
    await api('GET', '/events', { headers: { authorization: 'Basic abc' }, expect: 200, why: 'non-bearer Authorization header → guest' });
    check(JSON.stringify(g1.data) === JSON.stringify(guest.data), 'garbage bearer gets exactly the guest view of /events');
    await api('GET', '/users/me', { as: { token: 'garbage.not.a.jwt', label: 'garbage-bearer' }, expect: 401, why: 'requireAuth still refuses' });
    await api('GET', '/users/me', { as: { token: expired, label: 'expired-bearer' }, expect: 401 });
    // /internal is sealed at the edge, token or not
    for (const p of ['/internal', '/internal/users/x', '/INTERNAL/events/x/reserve-seat', '/internal/registrations/attendance/', '/Internal/points/spend']) {
        await api('POST', p, { headers: { 'x-internal-token': HARNESS_INTERNAL_TOKEN }, body: {}, expect: 404 });
        await api('GET', p, { expect: 404 });
    }
    // unknown routes
    await api('GET', '/nope', { expect: 404 });
    await api('GET', '/usersfoo', { expect: 404, why: 'prefix must match on a segment boundary' });
    await api('GET', '/events/a/b/c/d/e', { expect: 404 });
    await api('DELETE', '/hall-of-fame', { as: 'coreA', expect: 404 });
    // gateway's own route
    const gs = await api('GET', '/gateway/services', { as: 'coord', expect: 200, noEnvelope: true });
    check(gs.body && Array.isArray(gs.body.services) && gs.body.services.every((s) => s.live), 'gateway/services lists every service live', gs.body);
    await api('GET', '/gateway/services', { as: 'userA', expect: 403, noEnvelope: true });
    await api('GET', '/gateway/services', { expect: 401, noEnvelope: true });
    // forged identity headers are ignored
    const f = await api('GET', '/users/me', { headers: { 'x-gateway-user': S.u.founder.id, 'x-gateway-role': 'founder' }, expect: 401 });
    void f;
}

async function eventLifecycle() {
    const e = await setupEvent('Live Main Cup', {
        registration: { max_participants: 2, waitlist_enabled: true },
        scoring: { parameters: [{ key: 'points', label: 'Points', kind: 'int' }] },
        points_pool: { participation: 10, podium_multipliers: [3, 2, 1.5], investment_enabled: true },
        leaderboard: { format: 'points_table', min_participants: 2 },
    });
    S.e.E1 = e;
    await api('GET', `/events/${e.slug}`, { expect: 200 });
    await api('GET', `/events/${e.id}`, { as: 'userA', expect: 200 });
    const el = await api('GET', `/events/${e.id}/eligibility`, { as: 'userA' });
    check(el.data && el.data.eligible === true, 'E1 eligible for userA', el.data);
    await api('GET', `/events/${e.id}/eligibility`, { expect: 401 });

    const rA = await register('userA', e);
    const rB = await register('userB', e);
    const rM = await register('member', e);
    check(rA.data && rA.data.status === 'confirmed', 'userA confirmed', rA.data && rA.data.status);
    check(rB.data && rB.data.status === 'confirmed', 'userB confirmed', rB.data && rB.data.status);
    check(rM.data && rM.data.status === 'waitlisted', 'member waitlisted at capacity', rM.data && rM.data.status);
    const idA = need(rA.data && rA.data._id, 'rA'); const idB = need(rB.data && rB.data._id, 'rB'); const idM = need(rM.data && rM.data._id, 'rM');
    S.e.E1.regA = idA; S.e.E1.regM = idM;
    await register('userA', e, null, 409); // already registered

    const ev = await api('GET', `/events/${e.id}`, { as: 'coreA' });
    check(ev.data && ev.data.counts && ev.data.counts.registrations_confirmed === 2, 'seat count 2 on event', ev.data && ev.data.counts);
    const st = await api('GET', `/events/${e.id}/participants/stats`);
    check(st.data && st.data.counts.confirmed === 2 && st.data.counts.waitlisted === 1 && st.data.capacity.is_full === true, 'participant stats confirmed=2 waitlisted=1 full', st.data);
    const ps = await api('GET', `/events/${e.id}/participants`);
    check(ps.data && ps.data.participants.length === 2, 'public participants = confirmed only', ps.data && ps.data.total);
    const wl = await api('GET', `/events/${e.id}/waitlist`, { as: 'coreA' });
    check(wl.data && wl.data.waitlist.some((w) => w.registration_id === idM), 'member on waitlist', wl.data);
    await api('GET', `/events/${e.id}/waitlist`, { as: 'userA', expect: 403 });
    await api('GET', `/events/${e.id}/waitlist`, { as: 'coreB', expect: 403, why: 'core but not admin of this event' });
    const mine = await api('GET', `/events/${e.id}/my-registration`, { as: 'userA' });
    check(mine.data && mine.data._id === idA, 'my-registration returns own row', mine.data && mine.data._id);

    const confA = await poll(async () => (await notifications('userA', 'registration.confirmed')).find((n) => n.data && n.data.registration_id === idA));
    check(!!confA, 'registration.confirmed notification for userA');
    const wlM = await poll(async () => (await notifications('member', 'registration.waitlisted')).find((n) => n.data && n.data.registration_id === idM));
    check(!!wlM, 'registration.waitlisted notification for member');

    // cancel → waitlist promotion
    await api('DELETE', `/registrations/${idB}`, { as: 'userA', expect: 404, why: 'not owner' });
    const cB = await api('DELETE', `/registrations/${idB}`, { as: 'userB', body: { reason: 'cannot make it' }, expect: 200 });
    check(cB.data && cB.data.status === 'cancelled', 'userB cancelled', cB.data && cB.data.status);
    const promoted = await poll(async () => {
        const r = await api('GET', `/registrations/${idM}`, { as: 'member', quiet: true });
        return r.data && r.data.status === 'confirmed' ? r.data : null;
    });
    check(!!promoted, 'waitlisted member promoted after cancel');
    const confM = await poll(async () => (await notifications('member', 'registration.confirmed')).find((n) => n.data && n.data.registration_id === idM));
    check(!!confM, 'registration.confirmed notification for promoted member');
    const ev2 = await api('GET', `/events/${e.id}`, { as: 'coreA' });
    check(ev2.data && ev2.data.counts.registrations_confirmed === 2, 'seat count still 2 after cancel+promote', ev2.data && ev2.data.counts);

    // leaderboard entries created from RegistrationCreated
    const lbEntries = await poll(async () => {
        const r = await api('GET', `/leaderboards/events/${e.id}`, { quiet: true });
        const ids = ((r.data && r.data.standings) || []).filter((s) => !(s.stats && s.stats.eliminated)).map((s) => s.participant.id);
        return ids.includes(S.u.userA.id) && ids.includes(S.u.member.id) ? ids : null;
    });
    check(!!lbEntries, 'leaderboard entries for userA and member exist');

    // attendance: refused before ongoing
    await api('POST', `/events/${e.id}/attendance`, { as: 'coreA', body: { attendances: [{ registration_id: idA, attended: true }] }, expect: 409, why: 'attendance_window_closed before ongoing' });
    const og = await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'ongoing' }, expect: 200 });
    check(og.data && og.data.status === 'ongoing', 'E1 ongoing', og.data && og.data.status);
    await api('POST', `/events/${e.id}/attendance`, { as: 'coreA', body: { attendances: [{ registration_id: 'not-a-uuid', attended: true }] }, expect: 422 });
    const at = await api('POST', `/events/${e.id}/attendance`, { as: 'coreA', body: { attendances: [{ registration_id: idA, attended: true }, { registration_id: idM, attended: true }, { registration_id: idB, attended: true }] } });
    check(at.data && at.data.updated_count === 2 && (at.data.skipped || []).includes(idB), 'attendance: 2 updated, cancelled row skipped', at.data);
    const ga = await api('GET', `/events/${e.id}/attendance`, { as: 'coreA' });
    check(ga.data && ga.data.summary.attended === 2, 'attendance summary attended=2', ga.data && ga.data.summary);
    await api('GET', `/events/${e.id}/participants?attended=true&status=confirmed`, { as: 'coreA' });

    const balA = await poll(async () => ((await balance('userA')) >= 10 ? true : null));
    check(!!balA, 'participation points credited to userA (>=10)');
    const ptsCard = await poll(async () => (await notifications('userA', 'points.earned')).length > 0);
    check(!!ptsCard, 'points.earned notification for userA');

    // scores (both verbs) and investment
    await api('PUT', `/leaderboards/events/${e.id}/scores`, { as: 'coreA', body: { scores: [{ participant_id: S.u.userA.id, raw: { points: 50 } }] } });
    await api('POST', `/leaderboards/events/${e.id}/scores`, { as: 'coreA', body: { scores: [{ participant_id: S.u.member.id, raw: { points: 30 } }] } });
    await api('POST', `/leaderboards/events/${e.id}/scores`, { as: 'coreB', body: { scores: [{ participant_id: S.u.member.id, raw: { points: 99 } }] }, expect: 403, why: 'core, not admin of event' });
    await api('POST', `/leaderboards/events/${e.id}/scores`, { as: 'coreA', body: { scores: [{ participant_id: S.u.member.id, raw: { nope: 1 } }] }, expect: 400 });
    await api('GET', `/leaderboards/events/${e.id}/me`, { as: 'userA' });
    await api('GET', `/leaderboards/events/${e.id}/me`, { as: 'userB', expect: 404 });
    await api('GET', `/leaderboards/events/${e.id}/project?amount=10`, { as: 'member' });
    const before = await balance('userA');
    await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'userA', body: { amount: 5 }, expect: 422, why: 'min 10' });
    await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'userB', body: { amount: 10 }, expect: 403, why: 'not a participant' });
    const inv = await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'userA', body: { amount: 10, request_id: uuid() } });
    check(inv.data && inv.data.entry && inv.data.entry.invested_points === 10, 'investment credited on entry', inv.data);
    const after = await balance('userA');
    check(before - after === 10, 'investment debited 10 points', { before, after });
    await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'userA', body: { amount: 10 }, expect: [400, 402, 409, 422], why: 'insufficient balance' });
    await api('GET', `/leaderboards/events/${e.id}/podium`);
    await api('GET', `/leaderboards/global?period=all`);
    await api('GET', `/leaderboards/global?source=event&domain=general`, { as: 'userA' });

    // media upload for the event cover
    const cover = await api('POST', `/events/${e.id}/media?type=cover`, { as: 'coreA', raw: PNG, ctype: 'image/png', expect: 201 });
    if (cover.data && cover.data.url) await api('GET', cover.data.url, { expect: 200, noEnvelope: true });
    await api('POST', `/events/${e.id}/media?type=cover`, { as: 'coreA', raw: Buffer.from('not an image at all!'), ctype: 'image/png', expect: 415 });
    await api('POST', `/events/${e.id}/media?type=banner`, { as: 'coreA', raw: PNG, ctype: 'image/png', expect: 422 });

    // completion
    const past = await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'past' }, expect: 200 });
    check(past.data && past.data.status === 'past', 'E1 past', past.data && past.data.status);
    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { title: 'renamed' }, expect: 409, why: 'event_is_terminal' });
    const frozen = await poll(async () => {
        const r = await api('GET', `/leaderboards/events/${e.id}/snapshots`, { quiet: true });
        const arr = Array.isArray(r.data) ? r.data : (r.data && r.data.snapshots) || [];
        return arr.find((s) => s.reason === 'final' && s.frozen) || null;
    });
    check(!!frozen, 'final frozen leaderboard snapshot after EventCompleted');
    const pod = await api('GET', `/leaderboards/events/${e.id}/podium`);
    check(pod.data && pod.data.podium[0] && pod.data.podium[0].participant.id === S.u.userA.id, 'podium #1 is userA', pod.data);
    const p1 = await poll(async () => (await pointsTx('userA')).find((t) => t.reason === 'event.podium.1') || null);
    check(!!p1 && p1.amount === 30, 'podium place 1 paid 30 to userA', p1);
    const p2 = await poll(async () => (await pointsTx('member')).find((t) => t.reason === 'event.podium.2') || null);
    check(!!p2 && p2.amount === 20, 'podium place 2 paid 20 to member', p2);
    const aw = await api('POST', '/points/award', { as: 'coreA', body: { user_id: S.u.userA.id, event_id: e.id, place: 1 }, expect: [200, 201] });
    check(aw.data && aw.data.replayed === true, 'admin award of an already-paid place replays', aw.data);
    await api('POST', '/points/award', { as: 'coreA', body: { user_id: S.u.member.id, event_id: e.id, place: 1 }, expect: 409, why: 'already_awarded a different place' });
    await api('POST', '/points/award', { as: 'coreB', body: { user_id: S.u.member.id, event_id: e.id, place: 3 }, expect: 403 });
    await api('GET', `/points/events/${e.id}`, { as: 'coreA' });
    await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'member', body: { amount: 10 }, expect: 400, why: 'event_not_ongoing' });
    await api('POST', `/leaderboards/events/${e.id}/scores`, { as: 'coreA', body: { scores: [{ participant_id: S.u.member.id, raw: { points: 1 } }] }, expect: 409, why: 'leaderboard_final' });
}

async function approvalEvent() {
    const e = await setupEvent('Live Approval Meetup', { registration: { requires_approval: true } }, [
        { key: 'doc', label: 'Document', type: 'file', required: false, order: 1, validation: { accept: ['image/png'] } },
        { key: 'staff_note', label: 'Staff note', type: 'short_text', admin_only: true, order: 2 },
    ]);
    S.e.E2 = e;
    const up = await api('POST', `/registrations/upload-file?form_id=${e.formId}&field_key=doc&name=doc.png`, { as: 'userA', raw: PNG, ctype: 'image/png', expect: 201 });
    await api('POST', `/registrations/upload-file?form_id=${e.formId}&field_key=staff_note`, { as: 'userA', raw: PNG, ctype: 'image/png', expect: 400, why: 'not_a_file_field' });
    const files = up.data ? [{ field_key: 'doc', url: up.data.url }] : [];
    const r = await register('userA', e, null, 201, { files });
    const id = need(r.data && r.data._id, 'E2 registration');
    check(r.data.status === 'submitted', 'requires_approval: registration stays submitted', r.data.status);
    await sleep(1500);
    const still = await api('GET', `/registrations/${id}`, { as: 'userA' });
    check(still.data && still.data.status === 'submitted', 'still submitted after 1.5s (no seat taken)', still.data && still.data.status);
    const ev = await api('GET', `/events/${e.id}`, { as: 'coreA' });
    check(ev.data && ev.data.counts.registrations_confirmed === 0, 'no seat counted while awaiting approval', ev.data && ev.data.counts);
    if (up.data) await api('GET', `/registrations/${id}/files/doc`, { as: 'userA', expect: 200, noEnvelope: true });
    await api('GET', `/registrations/${id}/files/doc`, { as: 'userB', expect: 404 });
    await api('GET', `/registrations/${id}/files/doc`, { as: 'coreA', expect: 200, noEnvelope: true, why: 'event admin reads file' });
    await api('GET', `/registrations/${id}`, { as: 'userB', expect: 404 });
    await api('PATCH', `/registrations/${id}`, { as: 'userA', body: { answers: { nickname: 'A-edited' } } });
    await api('PATCH', `/registrations/${id}/admin-answers`, { as: 'coreA', body: { answers: { staff_note: 'looks fine' } } });
    await api('PATCH', `/registrations/${id}/admin-answers`, { as: 'userA', body: { answers: { staff_note: 'self' } }, expect: [403, 404] });
    await api('PATCH', `/registrations/${id}/status`, { as: 'userA', body: { status: 'confirmed' }, expect: [403, 404] });
    const conf = await api('PATCH', `/registrations/${id}/status`, { as: 'coreA', body: { status: 'confirmed', reason: 'approved' } });
    check(conf.data && conf.data.status === 'confirmed', 'admin confirms → confirmed', conf.data && conf.data.status);
    const ev2 = await api('GET', `/events/${e.id}`, { as: 'coreA' });
    check(ev2.data && ev2.data.counts.registrations_confirmed === 1, 'seat counted after approval', ev2.data && ev2.data.counts);
    const lst = await api('GET', `/registrations?owner_id=${e.id}`, { as: 'coreA' });
    check(Array.isArray(lst.data) && lst.data.some((x) => x._id === id), 'admin lists event registrations', lst.data && lst.data.length);
    const own = await api('GET', `/registrations?owner_id=${e.id}`, { as: 'userB' });
    check(Array.isArray(own.data) && own.data.length === 0, 'non-admin list is scoped to own rows', own.data && own.data.length);
    const me = await api('GET', `/registrations/me?owner_id=${e.id}`, { as: 'userA' });
    check(me.data && me.data._id === id, 'registrations/me', me.data && me.data._id);
    await api('GET', '/registrations', { as: 'userA' });
    // manual waitlist promotion through the event route
    await api('PATCH', `/registrations/${id}/status`, { as: 'coreA', body: { status: 'waitlisted', reason: 'demote for test' } });
    await api('POST', `/events/${e.id}/waitlist/${id}/promote`, { as: 'userA', expect: 403 });
    await api('POST', `/events/${e.id}/waitlist/${id}/promote`, { as: 'coreA', expect: 200 });
    const back = await api('GET', `/registrations/${id}`, { as: 'userA' });
    check(back.data && back.data.status === 'confirmed', 'manual promote → confirmed', back.data && back.data.status);
    // second user: reject
    const rB = await register('userB', e);
    const rej = await api('PATCH', `/registrations/${rB.data._id}/status`, { as: 'coreA', body: { status: 'rejected', reason: 'no' } });
    check(rej.data && rej.data.status === 'rejected', 'admin rejects', rej.data && rej.data.status);
    await register('userB', e, null, 409); // registration_rejected stands
    await api('GET', `/forms?owner_id=${e.id}`, { as: 'userA' });
    await api('GET', `/forms/${e.formId}`, { as: 'userA' });
    await api('GET', `/forms/${e.formId}/versions/1`, { as: 'coreA' });
    await api('PATCH', `/forms/${e.formId}`, { as: 'userA', body: { title: 'hijack' }, expect: 403 });
    // event misc: captains on a non-auction event, delete of a published event
    await api('POST', `/events/${e.id}/captains`, { as: 'coreA', body: { user_id: S.u.userA.id }, expect: 422, why: 'event_is_not_an_auction_league' });
    await api('DELETE', `/events/${e.id}`, { as: 'coreA', expect: 409, why: 'cannot_delete_published_event' });
    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'cancelled' }, expect: 403, why: 'cancel is coordinator+' });
    await api('PATCH', `/events/${e.id}`, { as: 'coreB', body: { title: 'x' }, expect: 403 });
    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { description: 'updated by harness' } });
}

async function eventCrud() {
    const now = Date.now();
    const d = await api('POST', '/events', { as: 'coreB', body: { title: 'Live Draft', category: 'general', start_at: iso(now + 3 * H), end_at: iso(now + 4 * H), registration: { closes_at: iso(now + H) } }, expect: 201 });
    const id = need(d.data && d.data._id, 'draft');
    await api('GET', `/events/${id}`, { expect: 404, why: 'draft hidden from public' });
    await api('GET', `/events/${id}`, { as: 'coreB' });
    await api('PATCH', `/events/${id}`, { as: 'coreB', body: { status: 'upcoming' }, expect: 422, why: 'no form' });
    await api('PATCH', `/events/${id}`, { as: 'coreB', body: { status: 'past' }, expect: 409 });
    await api('POST', '/events', { as: 'coreB', body: { title: 'Bad', category: 'general', start_at: iso(now + 3 * H), end_at: iso(now + 2 * H), registration: { closes_at: iso(now + H) } }, expect: 422 });
    await api('POST', '/events', { as: 'userA', body: { title: 'Nope', category: 'general', start_at: iso(now + 3 * H), end_at: iso(now + 4 * H), registration: { closes_at: iso(now + H) } }, expect: 403 });
    await api('DELETE', `/events/${id}`, { as: 'coreA', expect: [403, 404] });
    const del = await api('DELETE', `/events/${id}`, { as: 'coreB' });
    check(del.data && del.data.deleted === true, 'draft deleted', del.data);
    await api('GET', '/events?status=upcoming,ongoing&sort=date_desc&limit=5');
    await api('GET', '/events?page=1&limit=2', { as: 'coord' });
    await api('GET', '/events?sort=bogus', { expect: 422 });
    await api('GET', '/events?from=notadate', { expect: 422 });
}

async function teamedEvent() {
    const e = await setupEvent('Live Team Clash', {
        teaming: { is_teamed: true, team_size_min: 2, team_size_max: 3, max_teams: 2, captain_application_required: true },
    });
    S.e.E3 = e;
    await register('userA', e, null, 422, {}); // solo role on a teamed event: role_mismatch
    const cA = await register('userA', e, { role: 'captain' });
    check(cA.data && cA.data.status === 'submitted' && cA.data.context.event.captain_application.status === 'pending', 'captain application pending', cA.data && cA.data.status);
    await api('POST', '/teams', { as: 'userA', body: { owner: { type: 'event', id: e.id }, name: 'Alpha' }, expect: 403, why: 'captain_not_approved' });
    await api('PATCH', `/registrations/${cA.data._id}/captain-application`, { as: 'userB', body: { status: 'approved' }, expect: [403, 404] });
    const ap = await api('PATCH', `/registrations/${cA.data._id}/captain-application`, { as: 'coreA', body: { status: 'approved', note: 'ok' } });
    check(ap.data && ap.data.status === 'confirmed', 'approved captain confirmed', ap.data && ap.data.status);
    const cM = await register('member', e, { role: 'captain' });
    await api('PATCH', `/registrations/${cM.data._id}/captain-application`, { as: 'coreA', body: { status: 'approved' } });
    const cX = await register('coreB', e, { role: 'captain' });
    await api('PATCH', `/registrations/${cX.data._id}/captain-application`, { as: 'coreA', body: { status: 'approved' } });
    const cC2 = await register('coord', e, { role: 'captain' });
    const dec = await api('PATCH', `/registrations/${cC2.data._id}/captain-application`, { as: 'coreA', body: { status: 'declined', note: 'no' } });
    check(dec.data && dec.data.status === 'rejected', 'declined captain → rejected', dec.data && dec.data.status);
    const mB = await register('userB', e, { role: 'member', team_visibility: 'open' });
    const mC = await register('userC', e, { role: 'member' });
    check(mB.data && mB.data.status === 'confirmed' && mC.data && mC.data.status === 'confirmed', 'members confirmed');

    const tA = await api('POST', '/teams', { as: 'userA', body: { owner: { type: 'event', id: e.id }, name: 'Alpha' }, expect: 201 });
    const alpha = need(tA.data && tA.data._id, 'team Alpha');
    S.e.E3.alpha = alpha;
    await api('POST', '/teams', { as: 'userA', body: { owner: { type: 'event', id: e.id }, name: 'Alpha2' }, expect: 409, why: 'captain_already_has_team' });
    const tB = await api('POST', '/teams', { as: 'member', body: { owner: { type: 'event', id: e.id }, name: 'Beta' }, expect: 201 });
    const beta = need(tB.data && tB.data._id, 'team Beta');
    await api('POST', '/teams', { as: 'coreB', body: { owner: { type: 'event', id: e.id }, name: 'Gamma' }, expect: 409, why: 'max_teams_reached (2)' });

    await api('POST', `/teams/${alpha}/invite`, { as: 'userB', body: { user_id: S.u.userC.id }, expect: 403, why: 'not captain' });
    await api('POST', `/teams/${alpha}/invite`, { as: 'userA', body: { user_id: S.u.userB.id } });
    await api('POST', `/teams/${alpha}/invite`, { as: 'userA', body: { user_id: S.u.userC.id } });
    await api('POST', `/teams/${alpha}/invite`, { as: 'userA', body: { user_id: S.u.coreA.id }, expect: 404, why: 'member_not_registered' });
    const inv = await api('GET', '/teams?invited=me', { as: 'userB' });
    check(Array.isArray(inv.data) && inv.data.some((t) => t._id === alpha), 'invite visible to invitee', inv.data && inv.data.length);
    const invCard = await poll(async () => (await notifications('userB', 'team.invited')).length > 0);
    check(!!invCard, 'team.invited notification for userB');
    await api('POST', `/teams/${beta}/join`, { as: 'userB', expect: 403, why: 'team_not_open, no invite' });
    const jB = await api('POST', `/teams/${alpha}/join`, { as: 'userB' });
    check(jB.data && jB.data.members.some((m) => m.user_id === S.u.userB.id), 'userB joined Alpha');
    await api('POST', `/teams/${alpha}/join`, { as: 'userC' });
    await api('DELETE', `/teams/${alpha}/members/${S.u.userC.id}`, { as: 'userB', expect: 403 });
    const rm = await api('DELETE', `/teams/${alpha}/members/${S.u.userC.id}`, { as: 'userA', body: { reason: 'roster' } });
    check(rm.data && !rm.data.members.some((m) => m.user_id === S.u.userC.id), 'userC removed from Alpha');
    await api('DELETE', `/teams/${beta}`, { as: 'userA', expect: 403 });
    const db = await api('DELETE', `/teams/${beta}`, { as: 'member', body: { reason: 'merge' } });
    check(db.data && db.data.status === 'disbanded', 'Beta disbanded', db.data && db.data.status);
    const tG = await api('POST', '/teams', { as: 'coreB', body: { owner: { type: 'event', id: e.id }, name: 'Gamma' }, expect: 201, why: 'disbanded team frees a max_teams slot' });
    await api('PATCH', `/teams/${alpha}/lock`, { as: 'userA', expect: 403, why: 'captain is not event admin' });
    const lk = await api('PATCH', `/teams/${alpha}/lock`, { as: 'coreA' });
    check(lk.data && lk.data.status === 'locked', 'Alpha locked', lk.data && lk.data.status);
    if (tG.data) await api('PATCH', `/teams/${tG.data._id}/lock`, { as: 'coreA', expect: 409, why: 'team_below_minimum_size' });
    await api('POST', `/teams/${alpha}/invite`, { as: 'userA', body: { user_id: S.u.userC.id }, expect: 400, why: 'locked' });
    await api('GET', `/teams?owner_id=${e.id}`, { as: 'userC' });
    await api('GET', `/teams/${alpha}`, { as: 'userC' });
    await api('GET', `/teams/${alpha}`, { expect: 401 });
    // captain cannot leave a seat that has a team
    // Documented (team-model.md §4.1): a locked roster never blocks a captain leaving; they stay on it.
    // An open team with other members does: Gamma (coreB, alone) is fine, so probe with a fresh open team.
    // Gamma is invite-only; its captain shares the code instead of inviting.
    const gCap = await api('GET', `/teams/${tG.data._id}`, { as: 'coreB' });
    const gOut = await api('GET', `/teams/${tG.data._id}`, { as: 'userC' });
    check(gCap.data && /^[0-9A-F]{8}$/.test(gCap.data.invite_code) && gOut.data && !('invite_code' in gOut.data), 'invite code visible to the captain only');
    await api('POST', `/teams/${tG.data._id}/join`, { as: 'userC', expect: 403, why: 'team_not_open' });
    const byCode = await api('POST', '/teams/join-by-code', { as: 'userC', body: { code: gCap.data.invite_code } });
    check(byCode.data && byCode.data.members.some((m) => m.user_id === S.u.userC.id), 'userC joined Gamma by code');
    await api('DELETE', `/registrations/${cX.data._id}`, { as: 'coreB', expect: 409, why: 'captain_has_team: open team with members' });
    const cc = await api('DELETE', `/registrations/${cA.data._id}`, { as: 'userA', expect: 200, why: 'locked roster does not block (documented)' });
    const t = await api('GET', `/teams/${alpha}`, { as: 'userB' });
    check(cc.status === 200 && t.data && t.data.status === 'locked' && t.data.captain_user_id === S.u.userA.id, 'locked team keeps its captain after the captain cancels', t.data && t.data.status);
}

async function auctionLeague() {
    const e = await setupEvent('Live Auction League', {
        type: 'ALL',
        teaming: { is_teamed: true, team_size_min: 1, team_size_max: 3, max_teams: null, captain_application_required: false },
        auction: { bid_timer_seconds: 5, min_bid_increment: 10 },
    });
    S.e.E4 = e;
    const cap = await register('userA', e, { role: 'captain' });
    check(cap.data && cap.data.status === 'confirmed', 'auction captain confirmed on register', cap.data && cap.data.status);
    const pool = await poll(async () => {
        const r = await api('GET', `/events/${e.id}/captains`, { quiet: true });
        return r.data && r.data.captain_user_ids.includes(S.u.userA.id) ? r.data : null;
    });
    check(!!pool, 'CaptainApproved put userA in auction.captain_user_ids');
    const team = await api('POST', '/teams', { as: 'userA', body: { owner: { type: 'event', id: e.id }, name: 'Bidders' }, expect: 201 });
    const teamId = need(team.data && team.data._id, 'auction team');
    const regs = {};
    for (const k of ['userB', 'userC', 'coreB']) {
        const r = await register(k, e, { role: 'member', base_price: 100 });
        regs[k] = need(r.data && r.data.status === 'confirmed' && r.data._id, `${k} member registration`);
    }
    await api('POST', `/events/${e.id}/captains`, { as: 'coreA', body: { user_id: S.u.member.id } });
    await api('POST', `/events/${e.id}/captains`, { as: 'userA', body: { user_id: S.u.member.id }, expect: 403 });
    const rmc = await api('DELETE', `/events/${e.id}/captains/${S.u.member.id}`, { as: 'coreA' });
    check(rmc.data && !rmc.data.auction.captain_user_ids.includes(S.u.member.id), 'captain removed');
    await api('GET', `/events/${e.id}/captains`);

    const l1 = await api('POST', `/auction/events/${e.id}/lots`, { as: 'coreA', expect: 201, body: { lots: [
        { registration_id: regs.userB, user_id: S.u.userB.id, base_price: 100, order: 1 },
        { registration_id: regs.userC, user_id: S.u.userC.id, base_price: 100, order: 2 },
    ] } });
    const l2 = await api('POST', `/events/${e.id}/auction/lots`, { as: 'coreA', expect: 201, body: { lots: [
        { registration_id: regs.coreB, user_id: S.u.coreB.id, base_price: 100, order: 3 },
    ] } });
    await api('POST', `/auction/events/${e.id}/lots`, { as: 'coreA', expect: 409, body: { lots: [{ registration_id: regs.userB, user_id: S.u.userB.id, base_price: 100, order: 9 }] }, why: 'lot_conflict' });
    await api('POST', `/auction/events/${e.id}/lots`, { as: 'coreA', expect: 422, body: { lots: [{ registration_id: regs.userB, user_id: S.u.userC.id, base_price: 100, order: 8 }] }, why: 'invalid_lot_registration' });
    const lot1 = need(l1.data && l1.data[0] && l1.data[0]._id, 'lot1'); const lot2 = l1.data[1]._id; const lot3 = need(l2.data && l2.data[0] && l2.data[0]._id, 'lot3');

    await api('PATCH', `/auction/events/${e.id}/config`, { as: 'coreA', body: { purse_per_team: 1000 } });
    await api('PATCH', `/auction/events/${e.id}/config`, { as: 'coreA', body: { k_multiplier: 2 }, expect: 403, why: 'coordinator_required' });
    await api('PATCH', `/events/${e.id}/auction/config`, { as: 'founder', body: { oc_captain_override_quota: 1 } });
    await api('GET', `/auction/events/${e.id}/budget-preview`, { as: 'coreA' });
    await api('GET', `/events/${e.id}/auction/budget-preview`, { as: 'coreA' });
    await api('GET', `/auction/events/${e.id}/budget-preview`, { as: 'userA', expect: 403 });
    const bo = await api('PATCH', `/auction/events/${e.id}/teams/${teamId}/budget`, { as: 'coreA', body: { purse_total: 1200, reason: 'test' } });
    await api('PATCH', `/events/${e.id}/auction/teams/${teamId}/budget`, { as: 'coreA', body: { purse_total: 1200 }, why: 'idempotent retry' });
    void bo;
    await api('POST', `/auction/lots/${lot3}/override-price`, { as: 'coreA', body: { oc_adjusted_price: 150 } });
    await api('POST', `/auction/lots/${lot3}/override-price`, { as: 'userA', body: { oc_adjusted_price: 1 }, expect: 403 });

    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'ongoing' } });
    const st = await api('POST', `/auction/events/${e.id}/start`, { as: 'coreA' });
    check(st.data && st.data.status === 'live' && st.data.active_lot && st.data.active_lot.lot_id === lot1, 'auction live with lot1 on block', st.data && { status: st.data.status, lot: st.data.active_lot && st.data.active_lot.lot_id });
    await api('POST', `/events/${e.id}/auction/start`, { as: 'coreA', expect: 409, why: 'auction_already_started' });
    const refuse = await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'past' }, expect: 409 });
    check(refuse.body && refuse.body.error === 'auction_not_finished', 'complete refused while auction live', refuse.body);

    const live = await api('GET', `/auction/events/${e.id}/live`);
    const v = live.data && live.data.active_lot ? live.data.active_lot.version : 0;
    await api('POST', `/auction/lots/${lot1}/bid`, { as: 'userB', body: { amount: 100, version: v }, expect: 403, why: 'not_auction_captain' });
    await api('POST', `/auction/lots/${lot1}/bid`, { as: 'userA', body: { amount: 50, version: v }, expect: 422, why: 'bid_below_minimum' });
    const bid = await api('POST', `/auction/lots/${lot1}/bid`, { as: 'userA', body: { amount: 100, version: v } });
    check(bid.data && bid.data.current_bid === 100, 'bid recorded', bid.data && bid.data.current_bid);
    await api('POST', `/auction/lots/${lot1}/advance`, { as: 'coreA', expect: 409, why: 'timer_running' });
    await api('POST', `/auction/events/${e.id}/pause`, { as: 'coreA' });
    const adv = await api('POST', `/auction/lots/${lot1}/advance`, { as: 'coreA' });
    check(adv.data && adv.data.settled_lot && adv.data.settled_lot.status === 'sold', 'lot1 sold on advance', adv.data && adv.data.settled_lot && adv.data.settled_lot.status);
    const t1 = await api('GET', `/teams/${teamId}`, { as: 'userA' });
    check(t1.data && t1.data.members.some((m) => m.user_id === S.u.userB.id), 'sold player added to team', t1.data && t1.data.members.map((m) => m.user_id));
    check(t1.data && t1.data.auction && t1.data.auction.purse_spent === 100 && t1.data.auction.purse_total === 1200, 'purse debited 100 of 1200', t1.data && t1.data.auction);
    const soldCard = await poll(async () => (await notifications('userB', 'auction.sold.player')).length > 0);
    check(!!soldCard, 'auction.sold.player notification for userB');

    await api('POST', `/events/${e.id}/auction/resume`, { as: 'coreA' });
    await api('POST', `/events/${e.id}/auction/pause`, { as: 'coreA' });
    await api('POST', `/auction/events/${e.id}/resume`, { as: 'coreA' });
    // lot2 expires with no bid → unsold by the 2s settle tick
    const unsold = await poll(async () => {
        const r = await api('GET', `/auction/lots/${lot2}`, { quiet: true });
        return r.data && r.data.status === 'unsold' ? r.data : null;
    }, 15_000, 700);
    check(!!unsold, 'lot2 auto-settled unsold after timer');
    const onBlock = await poll(async () => {
        const r = await api('GET', `/events/${e.id}/auction/live`, { quiet: true });
        return r.data && r.data.active_lot && r.data.active_lot.lot_id === lot3 ? r.data.active_lot : null;
    }, 8000, 500);
    check(!!onBlock, 'lot3 raised after lot2');
    if (onBlock) {
        await api('POST', `/auction/lots/${lot3}/bid`, { as: 'userA', body: { amount: 140, version: onBlock.version }, expect: 422, why: 'below OC floor 150' });
        await api('POST', `/auction/lots/${lot3}/bid`, { as: 'userA', body: { amount: 150, version: onBlock.version } });
    }
    const cl = await api('POST', `/auction/events/${e.id}/close`, { as: 'coreA' });
    check(cl.data && cl.data.status === 'finished', 'auction closed', cl.data && cl.data.status);
    await api('POST', `/events/${e.id}/auction/close`, { as: 'coreA', expect: 409, why: 'auction_already_closed' });
    const lots = await api('GET', `/auction/events/${e.id}/lots`);
    const byId = Object.fromEntries(((lots.data) || []).map((l) => [l._id, l.status]));
    check(byId[lot1] === 'sold' && byId[lot2] === 'unsold' && byId[lot3] === 'sold', 'final lot states sold/unsold/sold', byId);
    await api('GET', `/events/${e.id}/auction/lots?status=sold`);
    await api('GET', `/auction/events/${e.id}/lots?status=bogus`, { expect: 422 });
    await api('GET', `/auction/lots/${lot1}`);
    const t2 = await api('GET', `/teams/${teamId}`, { as: 'userA' });
    check(t2.data && t2.data.auction && t2.data.auction.purse_spent === 250, 'purse spent 250 after two sales', t2.data && t2.data.auction);
    const locked = await poll(async () => {
        const r = await api('GET', `/teams/${teamId}`, { as: 'userA', quiet: true });
        return r.data && r.data.status === 'locked';
    });
    check(!!locked, 'AuctionClosed locked the ready roster');
    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'past' } });

    // second, empty league: the /events/:ref/auction/* lifecycle aliases
    const e2 = await setupEvent('Live Empty Auction', {
        type: 'ALL', teaming: { is_teamed: true, team_size_min: 1, team_size_max: 2, max_teams: null, captain_application_required: false },
    });
    const s2 = await api('POST', `/events/${e2.id}/auction/start`, { as: 'coreA' });
    check(s2.data && s2.data.status === 'live' && s2.data.active_lot === null, 'empty auction starts live with nothing on the block', s2.data && s2.data.status);
    const c2 = await api('POST', `/events/${e2.id}/auction/close`, { as: 'coreA' });
    check(c2.data && c2.data.status === 'finished', 'empty auction closes', c2.data && c2.data.status);
    await api('POST', `/auction/events/${e2.id}/start`, { as: 'coreA', expect: 409 });
    await api('POST', `/auction/events/${S.e.E1.id}/start`, { as: 'coreA', expect: 422, why: 'event_is_not_an_auction_league' });
}

async function challenges() {
    const base = { description: 'Do the thing and prove it.', domain: 'general', kind: 'digital', difficulty: 'easy', award_points: 25 };
    const c1 = await api('POST', '/challenges', { as: 'coreA', body: { ...base, title: 'Live Review Challenge', submission: { requires_proof: true, proof_types: ['text', 'url'], auto_approve: false } }, expect: 201 });
    const id1 = need(c1.data && c1.data._id, 'challenge 1');
    await api('POST', '/challenges', { as: 'userA', body: { ...base, title: 'x' }, expect: 403 });
    await api('POST', '/challenges', { as: 'coreA', body: { ...base, title: 'Phys', kind: 'physical' }, expect: 422, why: 'location_required' });
    await api('GET', `/challenges/${id1}`, { as: 'userA', expect: 404, why: 'draft hidden' });
    await api('POST', `/challenges/${id1}/accept`, { as: 'userA', body: {}, expect: 409, why: 'not active' });
    await api('PATCH', `/challenges/${id1}`, { as: 'coreA', body: { tags: ['live', 'harness'] } });
    await api('POST', `/challenges/${id1}/activate`, { as: 'coreA' });
    await api('POST', `/challenges/${id1}/activate`, { as: 'coreA', expect: 409 });
    const det = await api('GET', `/challenges/${c1.data.slug}`, { as: 'userA' });
    check(det.data && det.data.challenge && det.data.challenge._id === id1, 'challenge detail by slug');
    await api('GET', '/challenges', { as: 'userA' });
    await api('GET', '/challenges?status=draft', { as: 'userA', expect: 403 });
    await api('GET', '/challenges?status=draft', { as: 'coreA' });

    const pA = await api('POST', `/challenges/${id1}/accept`, { as: 'userA', body: {}, expect: 201 });
    const pidA = need(pA.data && pA.data._id, 'participation A');
    await api('POST', `/challenges/${id1}/accept`, { as: 'userA', body: {}, expect: 409 });
    await api('PATCH', `/challenges/participations/${pidA}/progress`, { as: 'userA', body: { percent: 50, notes: 'halfway' } });
    await api('PATCH', `/challenges/participations/${pidA}/progress`, { as: 'userB', body: { percent: 50 }, expect: 404 });
    await api('POST', `/challenges/participations/${pidA}/submit`, { as: 'userA', body: { proofs: [{ type: 'url', value: 'javascript:alert(1)' }] }, expect: 422 });
    const sub = await api('POST', `/challenges/participations/${pidA}/submit`, { as: 'userA', body: { proofs: [{ type: 'text', value: 'I did it' }] } });
    check(sub.data && sub.data.status === 'under_review', 'submission under_review', sub.data && sub.data.status);
    await api('GET', `/challenges/participations/${pidA}`, { as: 'userA' });
    await api('GET', `/challenges/participations/${pidA}`, { as: 'userB', expect: 404 });
    const q = await api('GET', `/challenges/${id1}/participations`, { as: 'coreB' });
    check(q.data && (q.data.participations || q.data.rows || []).some((p) => p._id === pidA), 'review queue has the submission', q.data && Object.keys(q.data));
    await api('GET', `/challenges/${id1}/participations`, { as: 'userB', expect: 404 });
    await api('POST', `/challenges/participations/${pidA}/review`, { as: 'userA', body: { decision: 'approved' }, expect: [403, 404] });
    const before = await balance('userA');
    const rv = await api('POST', `/challenges/participations/${pidA}/review`, { as: 'coreB', body: { decision: 'approved', reason: 'nice' } });
    check(rv.data && rv.data.status === 'approved', 'approved by another core', rv.data && rv.data.status);
    await api('POST', `/challenges/participations/${pidA}/review`, { as: 'coreA', body: { decision: 'approved' }, expect: 409, why: 'double approve' });
    const tx = await poll(async () => (await pointsTx('userA')).find((t) => t.source === 'challenge') || null);
    check(!!tx && tx.amount === 25, 'ChallengeCompleted credited 25 points', tx);
    const after = await balance('userA');
    check(after - before === 25, 'balance +25 exactly once', { before, after });
    await sleep(1500);
    const cards = await notifications('userA');
    const approvedCards = cards.filter((n) => n.type === 'challenge.approved' && n.data && n.data.participation_id === pidA);
    const pointsCards = cards.filter((n) => n.type === 'points.earned' && n.data && n.data.source === 'challenge');
    check(approvedCards.length === 1, 'exactly one challenge.approved card', approvedCards.length);
    check(pointsCards.length === 0, 'no duplicate points.earned card for a challenge credit', pointsCards.length);
    const mine = await api('GET', '/challenges/me/participations', { as: 'userA' });
    check(mine.data && JSON.stringify(mine.data).includes(pidA), 'my participations lists it');

    // rejection path
    const pB = await api('POST', `/challenges/${id1}/accept`, { as: 'userB', body: {}, expect: 201 });
    await api('POST', `/challenges/participations/${pB.data._id}/submit`, { as: 'userB', body: { proofs: [{ type: 'url', value: 'https://example.com/proof' }] } });
    const rj = await api('POST', `/challenges/participations/${pB.data._id}/review`, { as: 'coreA', body: { decision: 'rejected', reason: 'blurry' } });
    check(rj.data && rj.data.status === 'rejected', 'rejected', rj.data && rj.data.status);
    const rjCard = await poll(async () => (await notifications('userB', 'challenge.rejected')).length > 0);
    check(!!rjCard, 'challenge.rejected notification for userB');

    // auto-approve: core self-submit must go to review; a user's submit auto-approves
    const c2 = await api('POST', '/challenges', { as: 'coreA', body: { ...base, title: 'Live Auto Challenge', award_points: 5, submission: { requires_proof: true, proof_types: ['text'], auto_approve: true } }, expect: 201 });
    const id2 = need(c2.data && c2.data._id, 'challenge 2');
    await api('POST', `/challenges/${id2}/activate`, { as: 'coreA' });
    const pc = await api('POST', `/challenges/${id2}/accept`, { as: 'coreB', body: {}, expect: 201 });
    const sc = await api('POST', `/challenges/participations/${pc.data._id}/submit`, { as: 'coreB', body: { proofs: [{ type: 'text', value: 'self' }] } });
    check(sc.data && sc.data.status === 'under_review', 'core self-submit on auto_approve → under_review, not approved', sc.data && sc.data.status);
    const pu = await api('POST', `/challenges/${id2}/accept`, { as: 'userC', body: {}, expect: 201 });
    const su = await api('POST', `/challenges/participations/${pu.data._id}/submit`, { as: 'userC', body: { proofs: [{ type: 'text', value: 'done' }] } });
    check(su.data && su.data.status === 'approved', 'user submit on auto_approve → approved', su.data && su.data.status);
    const txC = await poll(async () => (await pointsTx('userC')).find((t) => t.source === 'challenge') || null);
    check(!!txC && txC.amount === 5, 'auto-approve credited 5 points', txC);
    await api('POST', `/challenges/participations/${pc.data._id}/withdraw`, { as: 'userA', body: { reason: 'x' }, expect: 403 });
    const wd = await api('POST', `/challenges/participations/${pc.data._id}/withdraw`, { as: 'coreA', body: { reason: 'conflict of interest' } });
    check(wd.data && wd.data.status === 'withdrawn', 'withdrawn by core', wd.data && wd.data.status);
    await api('POST', `/challenges/${id2}/complete`, { as: 'coreA' });
    await api('POST', `/challenges/${id2}/archive`, { as: 'coreA' });
    await api('DELETE', `/challenges/${id2}`, { as: 'coord', expect: 409, why: 'challenge_has_approved_participations' });
    const c3 = await api('POST', '/challenges', { as: 'coreA', body: { ...base, title: 'Live Doomed Challenge' }, expect: 201 });
    await api('DELETE', `/challenges/${c3.data._id}`, { as: 'coreA', expect: 403 });
    await api('DELETE', `/challenges/${c3.data._id}`, { as: 'coord', expect: 204 });
    await api('GET', `/challenges/${c3.data._id}`, { as: 'coord', expect: 404 });
    S.challenge1 = id1;
}

async function announcements() {
    const a = await api('POST', '/announcements', { as: 'coreA', body: { title: 'Live Announcement', body: 'Hello everyone', categories: ['bgec'] }, expect: 201 });
    const id = need(a.data && a.data._id, 'announcement');
    await api('POST', '/announcements', { as: 'userA', body: { title: 'x', body: 'y', categories: ['bgec'] }, expect: 403 });
    await api('POST', '/announcements', { as: 'coreA', body: { title: 'x', body: 'y', categories: ['bgec'], media_url: 'javascript:alert(1)' }, expect: 422 });
    await api('GET', `/announcements/${id}`, { expect: 404, why: 'draft hidden from public' });
    await api('PATCH', `/announcements/${id}`, { as: 'coreA', body: { title: 'Live Announcement (edited)' } });
    const before = await api('GET', '/announcements/unread-count', { as: 'userA' });
    check(before.data && typeof before.data.count === 'number', 'unread-count returns {count}', before.data);
    const pub = await api('POST', `/announcements/${id}/publish`, { as: 'coreA', body: {} });
    check(pub.data && pub.data.status === 'published', 'announcement published', pub.data && pub.data.status);
    const card = await poll(async () => (await notifications('userB', 'announcement.published')).find((n) => JSON.stringify(n.data || {}).includes(id)));
    check(!!card, 'announcement.published notification for audience (userB)');
    const cnt = await api('GET', '/announcements/unread-count', { as: 'userA' });
    check(cnt.data && cnt.data.count >= 1, 'unread-count >= 1 after publish', cnt.data);
    await api('GET', '/announcements');
    await api('GET', '/announcements?category=bgec&limit=5', { as: 'userA' });
    await api('GET', '/announcements/heads');
    await api('GET', `/announcements/${id}`);
    const dot = await api('GET', `/announcements/${id}`, { as: 'userA' });
    check(dot.data && dot.data.unread === true, 'card unread before read', dot.data && dot.data.unread);
    const badge1 = await api('GET', '/announcements/unread-count', { as: 'userA' });
    await api('POST', `/announcements/${id}/read`, { as: 'userA', expect: 204 });
    const badge2 = await api('GET', '/announcements/unread-count', { as: 'userA' });
    check(badge2.data && badge1.data && badge2.data.count === badge1.data.count - 1, 'per-card read lowers the badge by one', [badge1.data, badge2.data]);
    const dot2 = await api('GET', `/announcements/${id}`, { as: 'userA' });
    check(dot2.data && dot2.data.unread === false, 'per-card read clears the card dot', dot2.data && dot2.data.unread);
    await api('POST', '/announcements/read-all', { as: 'userB' });
    const cnt3 = await api('GET', '/announcements/unread-count', { as: 'userB' });
    check(cnt3.data && cnt3.data.count === 0, 'read-all → 0', cnt3.data);
    // schedule / unschedule
    const s = await api('POST', '/announcements', { as: 'coreB', body: { title: 'Later', body: 'Scheduled post', categories: ['fitsoc'] }, expect: 201 });
    const sch = await api('POST', `/announcements/${s.data._id}/publish`, { as: 'coreB', body: { scheduled_for: iso(Date.now() + 3 * H) } });
    check(sch.data && sch.data.status === 'scheduled', 'scheduled', sch.data && sch.data.status);
    const un = await api('POST', `/announcements/${s.data._id}/unschedule`, { as: 'coreB' });
    check(un.data && un.data.status === 'draft', 'unscheduled back to draft', un.data && un.data.status);
    await api('GET', `/announcements/${id}/audit`, { as: 'coord', expect: 403 });
    await api('GET', `/announcements/${id}/audit`, { as: 'founder' });
    await api('DELETE', `/announcements/${s.data._id}`, { as: 'coreA', expect: 403 });
    await api('DELETE', `/announcements/${s.data._id}`, { as: 'coord', expect: 204 });
}

async function feedback() {
    const t = await api('POST', '/feedback', { as: 'userA', body: { subject: 'Live bug', description: 'Something broke', category: 'bug' }, expect: 201 });
    const no = need(t.data && t.data.ticket_no, 'ticket');
    await api('GET', '/feedback/me', { as: 'userA' });
    await api('GET', `/feedback/${no}`, { as: 'userA' });
    await api('GET', `/feedback/${no}`, { as: 'userB', expect: 404 });
    await api('GET', `/feedback/${no}`, { expect: 404, why: 'an attributed ticket is not readable by number alone' });
    await api('GET', `/feedback/NOT-A-TICKET`, { as: 'userA', expect: 422 });
    const inbox = await api('GET', '/feedback?status=submitted', { as: 'coreA' });
    check(inbox.data && JSON.stringify(inbox.data).includes(no), 'staff inbox lists the ticket');
    await api('GET', '/feedback', { as: 'userA', expect: 403 });
    const staffCard = await poll(async () => (await notifications('coreA', 'feedback.submitted')).length > 0);
    check(!!staffCard, 'feedback.submitted notification to staff');
    await api('PATCH', `/feedback/${no}/status`, { as: 'userA', body: { status: 'closed' }, expect: 403 });
    const up = await api('PATCH', `/feedback/${no}/status`, { as: 'coreA', body: { status: 'under_review', response: 'Looking into it' } });
    check(up.data && up.data.status === 'under_review', 'ticket under_review', up.data && up.data.status);
    await api('PATCH', `/feedback/${no}/status`, { as: 'coreA', body: { status: 'submitted' }, expect: 422, why: 'illegal_transition' });
    await api('PATCH', `/feedback/${no}/severity`, { as: 'coreA', body: { severity: 'high' } });
    const rep = await poll(async () => (await notifications('userA', 'feedback.responded')).find((n) => n.data && n.data.ticket_no === no));
    check(!!rep, 'feedback.responded notification to reporter');
    // anonymous
    await api('POST', '/contact', { body: { subject: 'Hello', description: 'Just saying hi' }, expect: 422, why: 'contact_email_required when anonymous' });
    const c = await api('POST', '/contact', { body: { subject: 'Hello', description: 'Just saying hi', contact_email: 'anon@example.com' }, expect: 201 });
    if (c.data) await api('GET', `/feedback/${c.data.ticket_no}`, { expect: 200, why: 'ticket number is the credential for an anonymous ticket' });
    await api('POST', '/feedback', { body: { subject: 'anon', description: 'anon bug', category: 'bug', is_anonymous: true }, expect: 422 });
    await api('POST', '/feedback', { body: { subject: 'anon', description: 'anon bug', category: 'bug', contact_email: 'a2@example.com' }, expect: 201 });
    await api('POST', '/contact', { as: 'userB', body: { subject: 'Signed in', description: 'contact while signed in' }, expect: 201 });
}

async function media() {
    const up = await api('POST', '/media/upload?category=general&caption=live', { as: 'userA', raw: PNG, ctype: 'image/png', expect: 201 });
    const id = need(up.data && up.data._id, 'media upload');
    check(up.data.status === 'pending', 'user upload is pending', up.data.status);
    const url = up.data.url;
    await api('GET', url, { expect: 404, noEnvelope: true, why: 'pending file not public' });
    await api('GET', url.replace('/uploads/', '/uploads/.pending/'), { expect: 404, noEnvelope: true, why: '.pending never served' });
    await api('POST', '/media/upload?category=general', { as: 'userA', raw: Buffer.from('hello world, text'), ctype: 'text/plain', expect: 415 });
    await api('POST', '/media/upload?category=general', { as: 'userA', raw: Buffer.from('definitely not a png file'), ctype: 'image/png', expect: 415 });
    await api('POST', '/media/upload?category=bogus', { as: 'userA', raw: PNG, ctype: 'image/png', expect: 422 });
    const f = await api('GET', `/media/${id}/file`, { as: 'coreA', expect: 200, noEnvelope: true });
    check(f.buf && f.buf.subarray(0, 8).equals(PNG.subarray(0, 8)), 'moderator preview returns the PNG bytes');
    await api('GET', `/media/${id}/file`, { as: 'userB', expect: 404 });
    await api('GET', `/media/${id}`, { expect: 404, why: 'pending hidden from public' });
    const pend = await api('GET', '/media/moderation/pending', { as: 'coreA' });
    check(pend.data && JSON.stringify(pend.data).includes(id), 'moderation queue lists it');
    await api('GET', '/media/moderation/pending', { as: 'userA', expect: 403 });
    await api('PATCH', `/media/${id}/moderate`, { as: 'userA', body: { status: 'approved' }, expect: 403 });
    const mod = await api('PATCH', `/media/${id}/moderate`, { as: 'coreA', body: { status: 'approved' } });
    check(mod.data && mod.data.status === 'approved', 'approved', mod.data && mod.data.status);
    const list = await api('GET', '/media?category=general');
    check(list.data && JSON.stringify(list.data).includes(id), 'approved media in public listing');
    const served = await api('GET', url, { expect: 200, noEnvelope: true });
    check(String(served.headers['content-type']).startsWith('image/png'), 'gateway serves approved file from /uploads', served.headers['content-type']);
    await api('GET', url.replace('/uploads/', '/uploads/.pending/'), { expect: 404, noEnvelope: true });
    await api('GET', `/media/${id}`);
    await api('POST', `/media/${id}/like`, { as: 'userB' });
    await api('POST', `/media/${id}/like`, { expect: 401 });
    await api('PATCH', `/media/${id}`, { as: 'userB', body: { caption: 'hijack' }, expect: 403 });
    await api('PATCH', `/media/${id}`, { as: 'userA', body: { caption: 'edited', tags: ['live'] } });
    // albums
    const al = await api('POST', '/media/albums', { as: 'coreA', body: { title: 'Live Album', slug: `live-album-${RUN}` }, expect: 201 });
    await api('POST', '/media/albums', { as: 'userA', body: { title: 'x' }, expect: 403 });
    await api('GET', '/media/albums');
    if (al.data) await api('GET', `/media/albums/${al.data.slug || al.data._id}`);
    // core upload auto-approves; then delete
    const cu = await api('POST', `/media/upload?category=community${al.data ? `&album_id=${al.data._id}` : ''}`, { as: 'coreA', raw: PNG, ctype: 'image/png', expect: 201 });
    check(cu.data && cu.data.status === 'approved', 'core upload auto-approved', cu.data && cu.data.status);
    await api('DELETE', `/media/${id}`, { as: 'userB', expect: [403, 404], why: 'edited → re-moderated → pending is invisible to others' });
    await api('DELETE', `/media/${id}`, { as: 'userA' });
    await api('GET', `/media/${id}`, { expect: 404 });
    // a rejected upload stays unserved
    const u2 = await api('POST', '/media/upload?category=memories', { as: 'userB', raw: PNG, ctype: 'image/png', expect: 201 });
    if (u2.data) {
        await api('PATCH', `/media/${u2.data._id}/moderate`, { as: 'coreB', body: { status: 'rejected', rejection_reason: 'off-topic' } });
        await api('GET', u2.data.url, { expect: 404, noEnvelope: true });
    }
}

async function brackets() {
    const e = await setupEvent('Live Bracket Cup', { leaderboard: { format: 'single_elim', min_participants: 2 } });
    S.e.E5 = e;
    for (const k of ['userA', 'userB', 'userC', 'member']) {
        const r = await register(k, e);
        check(r.data && r.data.status === 'confirmed', `${k} confirmed in bracket event`, r.data && r.data.status);
    }
    await api('POST', '/brackets', { as: 'userA', body: { event_id: e.id }, expect: 403 });
    await api('POST', '/brackets', { as: 'coreB', body: { event_id: e.id }, expect: [403, 404], why: 'core but not admin' });
    const g1 = await api('POST', '/brackets', { as: 'coreA', body: { event_id: e.id }, expect: 201 });
    check(g1.data && g1.data.matches && g1.data.matches.length === 3, '4-player single elim has 3 matches', g1.data && g1.data.matches && g1.data.matches.length);
    await api('POST', '/brackets', { as: 'coreA', body: { event_id: e.id }, expect: 409, why: 'bracket_exists' });
    await api('DELETE', `/brackets/${e.id}`, { as: 'coreA', expect: 403 });
    await api('DELETE', `/brackets/${e.id}`, { as: 'coord', expect: 204 });
    const g = await api('POST', '/brackets', { as: 'coreA', body: { event_id: e.id, seeding: 'random' }, expect: 201 });
    need(g.data && g.data.matches, 'bracket regenerated');
    await api('GET', `/brackets/${e.id}`);
    await api('GET', `/brackets/not-a-uuid`, { expect: 422 });
    const ms = await api('GET', `/matches?event_id=${e.id}`);
    await api('GET', '/matches', { expect: 422, why: 'event_id required' });
    const first = (ms.data && (ms.data.matches || ms.data)) || [];
    const anyMatch = Array.isArray(first) ? first[0] : null;
    if (anyMatch) {
        await api('GET', `/matches/${anyMatch._id}`);
        await api('PATCH', `/matches/${anyMatch._id}/schedule`, { as: 'coreA', body: { venue: 'Court 1', scheduled_at: iso(Date.now() + H) } });
        await api('PATCH', `/matches/${anyMatch._id}/schedule`, { as: 'userA', body: { venue: 'x' }, expect: 403 });
    }
    const champ = S.u.userA.id;
    for (let round = 0; round < 4; round++) {
        const r = await api('GET', `/matches?event_id=${e.id}`, { quiet: true });
        const all = (r.data && (r.data.matches || r.data)) || [];
        const open = all.filter((m) => m.status !== 'completed' && m.status !== 'bye' && m.a && m.b);
        if (!open.length) break;
        for (const m of open) {
            const aWins = m.a.id === champ || (m.b.id !== champ);
            await api('PATCH', `/matches/${m._id}`, { as: 'coreA', body: aWins ? { score_a: 3, score_b: 1 } : { score_a: 0, score_b: 2 } });
        }
    }
    const any = await api('GET', `/matches?event_id=${e.id}`, { quiet: true });
    const done = ((any.data && (any.data.matches || any.data)) || []).find((m) => m.status === 'completed');
    if (done) {
        await api('PATCH', `/matches/${done._id}`, { as: 'coreA', body: { score_a: done.score_a, score_b: done.score_b }, why: 'same score is an idempotent retry' });
        await api('PATCH', `/matches/${done._id}`, { as: 'coreA', body: { score_a: 1, score_b: 1 }, expect: [409, 422] });
    }
    const st = await api('GET', `/brackets/${e.id}/standings`);
    check(st.data && st.data.champion && st.data.champion.id === champ, 'champion is userA', st.data && st.data.champion);
    await api('DELETE', `/brackets/${e.id}`, { as: 'coord', expect: 409, why: 'bracket_already_played' });
}

async function hallOfFame() {
    const body = {
        category: 'custom', title: `Live Legend ${RUN}`,
        honoree: { type: 'user', id: S.u.userA.id, display_name: 'Live userA' },
        source: { type: 'manual' }, achievement: { year: 2026, domain: 'general' }, tags: ['live'],
    };
    await api('POST', '/hall-of-fame', { as: 'userA', body, expect: 403 });
    await api('POST', '/hall-of-fame', { as: 'coreA', body: { ...body, media_url: 'javascript:alert(1)' }, expect: 422 });
    const c = await api('POST', '/hall-of-fame', { as: 'coreA', body, expect: 201 });
    const id = need(c.data && c.data._id, 'hof entry');
    await api('GET', '/hall-of-fame?category=custom&year=2026');
    await api('GET', `/hall-of-fame/${c.data.slug || id}`);
    await api('GET', `/hall-of-fame/${id}`);
    await api('PATCH', `/hall-of-fame/${id}`, { as: 'coreA', body: { featured: true, featured_order: 1, achievement: { season: 'fall' } } });
    const feat = await api('GET', '/hall-of-fame/featured');
    check(feat.data && JSON.stringify(feat.data).includes(id), 'featured list includes entry');
    await api('DELETE', `/hall-of-fame/${id}`, { as: 'coreA', expect: 403 });
    await api('DELETE', `/hall-of-fame/${id}`, { as: 'coord', expect: [200, 204] });
    await api('GET', `/hall-of-fame/${id}`, { expect: 404 });
}

async function pointsAdmin() {
    await api('GET', '/points/me', { as: 'userB' });
    await api('GET', '/points/me/transactions?limit=5', { as: 'userA' });
    await api('GET', '/points/me/breakdown', { as: 'userA' });
    await api('GET', '/points/opportunities', { as: 'userA' });
    await api('GET', '/points/me', { expect: 401 });
    const rules = await api('GET', '/points/rules', { as: 'coreA' });
    check(rules.data && rules.data.rules && rules.data.rules.some((r) => r._id === 'event.participation'), 'rules seeded');
    await api('PATCH', '/points/rules/event.participation', { as: 'coreA', body: { enabled: true }, expect: 403 });
    await api('PATCH', '/points/rules/event.participation', { as: 'coord', body: { expires_after_days: 365 } });
    await api('PATCH', '/points/rules/event.participation', { as: 'coord', body: { expires_after_days: null } });
    await api('PATCH', '/points/rules/Bad%20Key', { as: 'coord', body: { enabled: true }, expect: 422 });
    const rid = uuid();
    const before = await balance('userB');
    const adj = await api('POST', '/points/adjust', { as: 'coord', body: { user_id: S.u.userB.id, amount: 50, note: 'live harness grant', request_id: rid }, expect: 201 });
    const rep = await api('POST', '/points/adjust', { as: 'coord', body: { user_id: S.u.userB.id, amount: 50, note: 'live harness grant', request_id: rid }, expect: 200 });
    check(rep.data && rep.data.replayed === true, 'adjust replay is idempotent', rep.data);
    const after = await balance('userB');
    check(after - before === 50, 'adjust credited once', { before, after });
    await api('POST', '/points/adjust', { as: 'coreA', body: { user_id: S.u.userB.id, amount: 5, note: 'nope', request_id: uuid() }, expect: 403 });
    await api('GET', `/points/users/${S.u.userB.id}`, { as: 'coreA' });
    await api('GET', `/points/users/${S.u.userB.id}/transactions`, { as: 'coreA' });
    await api('GET', `/points/users/${S.u.userB.id}`, { as: 'userA', expect: 403 });
    await api('POST', `/points/users/${S.u.userB.id}/recalculate`, { as: 'coord' });
    if (adj.data && adj.data.transaction) {
        await api('GET', `/points/transactions/${adj.data.transaction.id}/audit`, { as: 'founder' });
        await api('GET', `/points/transactions/${adj.data.transaction.id}/audit`, { as: 'coord', expect: 403 });
    }
}

async function usersJourney() {
    await api('PATCH', '/users/me', { as: 'userA', body: { bio: 'Live harness bio', interests: ['chess'], social_links: { instagram: 'live_a' } } });
    await api('PATCH', '/users/me', { as: 'userA', body: {}, expect: 422 });
    await api('PATCH', '/users/me/settings', { as: 'userA', body: { theme: 'dark' } });
    await api('GET', '/users/me/deletion-preview', { as: 'userA' });
    const av = await api('POST', '/users/me/avatar', { as: 'userA', raw: PNG, ctype: 'image/png', expect: 201 });
    if (av.data && av.data.avatar_url) {
        await api('GET', av.data.avatar_url, { expect: 200, noEnvelope: true });
        const me = await api('GET', '/users/me', { as: 'userA' });
        check(me.data && me.data.profile && me.data.profile.avatar_url === av.data.avatar_url, 'avatar_url saved on profile');
    }
    await api('POST', '/users/me/avatar', { as: 'userA', raw: Buffer.from('this is not an image'), ctype: 'image/png', expect: 415 });
    const s = await api('GET', `/users/search?q=${encodeURIComponent('Live')}`, { as: 'userB' });
    check(s.data && s.data.users && s.data.users.length > 0, 'search finds users');
    await api('GET', '/users/search', { as: 'userB', expect: 422 });
    await api('GET', `/users/${S.u.userA.username}`, { as: 'userB' });
    await api('GET', `/users/${S.u.userA.id}/player-card`, { as: 'userB' });
    await api('GET', `/users/${S.u.userA.id}/player-card`, { expect: 401 });
    await api('GET', `/users/does_not_exist_${RUN}`, { as: 'userB', expect: 404 });
    await api('GET', '/users?limit=5&sort=points_balance', { as: 'coord' });
    await api('GET', '/users', { as: 'coreA', expect: 403 });
    await api('GET', `/users/${S.u.userA.id}/audit`, { as: 'coord' });
    await api('GET', `/users/${S.u.userA.id}/audit`, { as: 'coreA', expect: 403 });

    // suspend / reinstate (coordinator); a suspended token stops at requireActiveUser
    await api('PATCH', `/users/${S.u.userC.id}/status`, { as: 'coreA', body: { status: 'suspended', reason: 'x' }, expect: 403 });
    const su = await api('PATCH', `/users/${S.u.userC.id}/status`, { as: 'coord', body: { status: 'suspended', reason: 'live test' } });
    check(su.data && su.data.status === 'suspended', 'suspended', su.data && su.data.status);
    await api('GET', `/users/${S.u.userA.id}`, { as: 'userC', expect: 401, why: 'suspended live user' });
    await api('POST', '/auth/login', { body: { login: S.u.userC.email, password: PW }, expect: 403 });
    await api('PATCH', `/users/${S.u.userC.id}/status`, { as: 'coord', body: { status: 'active', reason: 'back' } });
    await login('userC');

    // deletion → anonymised elsewhere → reactivate restores
    const E5 = S.e.E5;
    await api('DELETE', '/users/me', { as: 'userC', body: { confirm: 'delete' }, expect: 422 });
    const del = await api('DELETE', '/users/me', { as: 'userC', body: { confirm: 'DELETE', reason: 'testing' }, expect: 202 });
    check(del.data && del.data.status === 'account_hidden', 'account hidden', del.data);
    if (E5) {
        const anon = await poll(async () => {
            const r = await api('GET', `/events/${E5.id}/participants?limit=50`, { quiet: true });
            const p = ((r.data && r.data.participants) || []).find((x) => x.user && x.user.user_id === S.u.userC.id);
            return p && p.user.display_name === 'Deleted user' ? p : null;
        });
        check(!!anon, 'UserDeleted anonymised the participant snapshot (event participants)');
        const br = await poll(async () => {
            const r = await api('GET', `/brackets/${E5.id}`, { quiet: true });
            return JSON.stringify(r.data || {}).includes(S.u.userC.id) && JSON.stringify(r.data).includes('Deleted user') ? true : null;
        });
        check(!!br, 'UserDeleted anonymised the bracket seed');
    }
    const lg = await api('POST', '/auth/login', { body: { login: S.u.userC.username, password: PW }, expect: 403 });
    check(lg.body && lg.body.error === 'account_deactivated' && lg.body.account_status === 'scheduled_for_deletion' && lg.body.days_remaining > 0, 'login of a deleted account → 403 with the countdown', lg.body);
    await api('GET', `/users/${S.u.userC.id}`, { as: 'userB', expect: 404 });
    await api('POST', '/account/reactivate', { body: { login: S.u.userC.email, password: 'wrong-password' }, expect: 401 });
    const re = await api('POST', '/account/reactivate', { body: { login: S.u.userC.email, password: PW } });
    if (re.data && re.data.tokens) { S.u.userC.token = re.data.tokens.access_token; S.u.userC.refresh = re.data.tokens.refresh_token; }
    check(re.data && re.data.user && re.data.user.status === 'active', 'reactivated', re.data && re.data.user);
    if (E5) {
        const back = await poll(async () => {
            const r = await api('GET', `/events/${E5.id}/participants?limit=50`, { quiet: true });
            const p = ((r.data && r.data.participants) || []).find((x) => x.user && x.user.user_id === S.u.userC.id);
            return p && p.user.display_name === 'Live userC' ? p : null;
        });
        check(!!back, 'UserRestored restored the participant name');
    }
}

async function notificationsJourney() {
    const l = await api('GET', '/notifications', { as: 'userA' });
    const list = (l.data && l.data.notifications) || [];
    check(list.length > 0, 'userA has notifications');
    const c = await api('GET', '/notifications/unread-count', { as: 'userA' });
    check(c.data && typeof c.data.count === 'number', 'notifications unread-count {count}', c.data);
    await api('GET', '/notifications?unread=true&category=event', { as: 'userA' });
    await api('GET', '/notifications?unread=maybe', { as: 'userA', expect: 422 });
    await api('GET', '/notifications/preferences', { as: 'userA' });
    await api('PATCH', '/notifications/preferences', { as: 'userA', body: { in_app: { system: true } } });
    if (list[0]) {
        await api('POST', `/notifications/${list[0]._id}/read`, { as: 'userA' });
        await api('POST', `/notifications/${list[0]._id}/read`, { as: 'userB', expect: 404 });
        await api('DELETE', `/notifications/${list[0]._id}`, { as: 'userA', expect: 204 });
    }
    await api('POST', '/notifications/read-all', { as: 'userA' });
    const c2 = await api('GET', '/notifications/unread-count', { as: 'userA' });
    check(c2.data && c2.data.count === 0, 'read-all → 0 unread', c2.data);
    await api('GET', '/notifications', { expect: 401 });
}

async function formsMisc() {
    const g = await api('POST', '/forms', { as: 'coreA', body: { owner: { type: 'generic', id: null }, title: 'Live Generic Form', fields: formFields() }, expect: 201 });
    await api('POST', '/forms', { as: 'userA', body: { owner: { type: 'generic', id: null }, title: 'x', fields: formFields() }, expect: 403 });
    await api('POST', '/forms', { as: 'coreA', body: { owner: { type: 'event', id: null }, title: 'x' }, expect: 422 });
    const id = need(g.data && g.data._id, 'generic form');
    await api('PATCH', `/forms/${id}`, { as: 'coreA', body: { title: 'Live Generic Form v2' } });
    await api('POST', `/forms/${id}/publish`, { as: 'coreA' });
    const r = await api('POST', '/registrations', { as: 'userB', body: { form_id: id, owner: { type: 'generic', id: null }, answers: { nickname: 'b' } }, expect: 201 });
    check(r.data && r.data.status === 'confirmed', 'generic form submission auto-confirmed', r.data && r.data.status);
    await api('POST', '/registrations', { as: 'userB', body: { form_id: id, owner: { type: 'generic', id: null }, answers: {} }, expect: [409, 422] });
    await api('GET', `/registrations?form_id=${id}`, { as: 'coreA' });
    await api('GET', '/forms?owner_type=generic', { as: 'coreB' });
    await api('DELETE', `/forms/${id}`, { as: 'coreA', expect: 403, why: 'archive of generic is coordinator+' });
    const ar = await api('DELETE', `/forms/${id}`, { as: 'coord' });
    check(ar.data && ar.data.status === 'archived', 'form archived', ar.data && ar.data.status);
}

async function strava() {
    // Not configured in this repo (STRAVA_CLIENT_* unset): routes that need the provider answer 503.
    await api('GET', '/strava/status', { as: 'userA', expect: [200, 503] });
    await api('GET', '/strava/connect', { as: 'userA', expect: [200, 503] });
    await api('POST', '/strava/link', { as: 'userA', body: { code: 'abc', state: 'def', scope: 'activity:read' }, expect: [400, 401, 409, 422, 503] });
    await api('DELETE', '/strava/disconnect', { as: 'userA', expect: [204, 200, 404, 503] });
    await api('POST', '/strava/sync', { as: 'userA', expect: [200, 409, 503] });
    await api('GET', '/strava/activities', { as: 'userA', expect: [200, 503] });
    await api('GET', `/strava/users/${S.u.userB.id}/activities`, { as: 'userA', expect: [200, 404, 503] });
    const cb = await api('GET', '/strava/callback?error=access_denied', { expect: 302, noEnvelope: true });
    check(/strava=denied/.test(String(cb.headers.location || '')), 'strava callback redirects on cancel', cb.headers.location);
    skip('strava OAuth link/sync success paths', 'STRAVA_CLIENT_ID/SECRET not configured; 503 strava_not_configured is the documented state');
}

async function authJourney() {
    // refresh rotation
    const a = S.u.userB;
    const tk = (r) => (r && r.data && r.data.tokens) || null;
    const r1 = await api('POST', '/auth/refresh', { body: { refresh_token: a.refresh } });
    need(tk(r1) && tk(r1).refresh_token, 'rotation returns { tokens }');
    check(tk(r1).refresh_token !== a.refresh, 'rotation issues a new refresh token');
    const old = a.refresh;
    a.refresh = tk(r1).refresh_token; a.token = tk(r1).access_token;
    await api('POST', '/auth/refresh', { body: { refresh_token: old }, expect: 401, why: 'retired token (inside grace) refused but not a logout' });
    const still = await api('POST', '/auth/refresh', { body: { refresh_token: a.refresh } });
    check(still.status === 200, 'session survives a late duplicate of the retired token');
    if (tk(still)) { a.refresh = tk(still).refresh_token; a.token = tk(still).access_token; }
    // concurrent race with the same token
    const [x, y] = await Promise.all([
        api('POST', '/auth/refresh', { body: { refresh_token: a.refresh }, expect: [200, 401] }),
        api('POST', '/auth/refresh', { body: { refresh_token: a.refresh }, expect: [200, 401] }),
    ]);
    const winners = [x, y].filter((r) => r.status === 200);
    check(winners.length >= 1, 'concurrent refresh: at least one wins', [x.status, y.status]);
    if (winners[0]) {
        const w = tk(winners[winners.length - 1]);
        const after = await api('POST', '/auth/refresh', { body: { refresh_token: w.refresh_token }, expect: [200, 401] });
        const w0 = tk(winners[0]);
        const alt = after.status === 200 ? after : await api('POST', '/auth/refresh', { body: { refresh_token: w0.refresh_token }, expect: [200, 401] });
        check(alt.status === 200, 'concurrent refresh race does not log the user out', [x.status, y.status, after.status, alt.status]);
        if (tk(alt)) { a.refresh = tk(alt).refresh_token; a.token = tk(alt).access_token; }
    }
    await api('POST', '/auth/refresh', { body: { refresh_token: 'garbage' }, expect: 401 });
    // logout by refresh token
    await login('userB');
    const rt = S.u.userB.refresh;
    await api('POST', '/auth/logout', { body: { refresh_token: rt } });
    await api('POST', '/auth/refresh', { body: { refresh_token: rt }, expect: 401 });
    await api('POST', '/auth/logout', { body: {}, expect: 401 });
    await login('userB');
    await api('POST', '/auth/logout', { as: 'userB' });
    await login('userB');

    // forgot / reset
    const since = logLineCount('auth-service') - 1;
    await api('POST', '/auth/forgot-password', { body: { email: S.u.member.email } });
    const tok = await mailToken(S.u.member.email, 'Reset', since);
    if (check(!!tok, 'reset token printed to the auth-service log')) {
        await api('POST', '/auth/reset-password', { body: { token: tok, new_password: 'short' }, expect: 422 });
        await api('POST', '/auth/reset-password', { body: { token: tok, new_password: 'NewLivePass#2026' } });
        await api('POST', '/auth/reset-password', { body: { token: tok, new_password: 'NewLivePass#2026' }, expect: 400, why: 'token consumed' });
        await api('POST', '/auth/login', { body: { login: S.u.member.email, password: PW }, expect: 401 });
        S.u.member.password = 'NewLivePass#2026';
        await login('member');
    }
    await api('POST', '/auth/forgot-password', { body: { email: `nobody.${RUN}@example.com` }, why: 'anti-enumeration 200' });
    await api('POST', '/auth/resend-verification', { body: { email: S.u.userA.email } });

    // phone OTP
    const phone = `+9198${String(Date.now()).slice(-8)}`;
    const s2 = logLineCount('auth-service') - 1;
    await api('POST', '/auth/phone/send-otp', { as: 'userA', body: { phone_number: phone } });
    const otp = await otpFor(phone, s2);
    if (otp) {
        await api('POST', '/auth/phone/verify-otp', { as: 'userA', body: { phone_number: phone, otp: otp === '000000' ? '111111' : '000000' }, expect: [400, 401, 422] });
        const v = await api('POST', '/auth/phone/verify-otp', { as: 'userA', body: { phone_number: phone, otp } });
        void v;
        const me = await api('GET', '/users/me', { as: 'userA' });
        check(me.data && me.data.is_phone_verified === true, 'phone verified', me.data && me.data.is_phone_verified);
    } else skip('phone OTP verify', 'OTP not found in auth-service log');
    await api('POST', '/auth/phone/send-otp', { body: { phone_number: phone }, expect: 401 });

    // Google OAuth: not configured here
    await api('GET', '/auth/google', { expect: [302, 503], noEnvelope: true });
    await api('GET', '/auth/google/callback?code=x&state=y', { expect: [302, 400], noEnvelope: true });
    await api('POST', '/auth/google/exchange', { body: { login_code: 'a'.repeat(64) }, expect: [400, 401] });
    skip('Google OAuth success path', 'GOOGLE_CLIENT_ID/SECRET not configured (503 google_oauth_not_configured)');
}

/* ------------------------------------------------------------------ *
 * Generic refusal sweep over every parsed route
 * ------------------------------------------------------------------ */

function concrete(pattern) {
    return pattern.replace(/:([A-Za-z_]+)/g, (_, n) => (n === 'ticket_no' ? 'BG-AAAAAA' : n === 'key' || n === 'slugOrId' ? 'no-such-thing' : uuid()));
}
const BELOW = { member: 'userA', core: 'member', coordinator: 'coreA', founder: 'coord' };

async function refusalSweep() {
    for (const r of ROUTES) {
        const url = concrete(r.pattern);
        if (r.auth === 'required') {
            await api(r.method, url, { body: r.body ? {} : undefined, expect: 401, why: 'anonymous on an authed route' });
        }
        if (r.floor && rank(r.floor) > rank('user')) {
            const who = BELOW[r.floor];
            await api(r.method, url, { as: who, body: r.body ? {} : undefined, expect: 403, why: `below ${r.floor} floor (${r.floorKind})` });
        }
        if (r.body && !r.raw) {
            const opts = { body: [], expect: 422, want422Shape: true, why: 'array body fails every object schema' };
            if (r.auth === 'required') opts.as = 'founder';
            await api(r.method, url, opts);
        }
        if (r.method === 'GET' && r.auth !== 'required' && !/^\/auth\/google|^\/strava\/callback/.test(r.pattern)) {
            // Lenient optionalAuth: an invalid bearer must get exactly what an anonymous caller gets.
            const anon = await api('GET', url, { expect: 'any', quiet: true });
            await api('GET', url, { as: { token: 'garbage.not.a.jwt', label: 'garbage-bearer' }, expect: anon.status >= 500 ? 'any' : anon.status, why: 'invalid bearer on a public GET = guest view' });
        }
    }
}


async function cancellationReversals() {
    const e = await setupEvent('Live Cancelled Gala', { points_pool: { participation: 10, investment_enabled: true } });
    const rA = await register('userA', e); const rB = await register('userB', e);
    need(rA.data && rB.data, 'registrations');
    const a0 = await balance('userA'); const b0 = await balance('userB');
    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'ongoing' } });
    await api('POST', `/events/${e.id}/attendance`, { as: 'coreA', body: { attendances: [{ registration_id: rA.data._id, attended: true }, { registration_id: rB.data._id, attended: true }] } });
    const credited = await poll(async () => (await balance('userA')) === a0 + 10 && (await balance('userB')) === b0 + 10);
    check(!!credited, 'participation credited to both', { a0, b0 });
    await api('POST', `/events/${e.id}/attendance`, { as: 'coreA', body: { attendances: [{ registration_id: rB.data._id, attended: false }] } });
    const revoked = await poll(async () => (await balance('userB')) === b0);
    check(!!revoked, 'attendance revoked → participation reversed', { b0, now: await balance('userB') });
    const rid = uuid();
    const inv1 = await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'userA', body: { amount: 10, request_id: rid } });
    const inv2 = await api('POST', `/leaderboards/events/${e.id}/invest`, { as: 'userA', body: { amount: 10, request_id: rid } });
    check(inv1.data && inv1.data.replayed === false && inv2.data && inv2.data.replayed === true, 'invest with same request_id replays', [inv1.data && inv1.data.replayed, inv2.data && inv2.data.replayed]);
    check((await balance('userA')) === a0, 'investment debited exactly once', { a0, now: await balance('userA') });
    await api('PATCH', `/events/${e.id}`, { as: 'coreA', body: { status: 'cancelled' }, expect: 403 });
    const c = await api('PATCH', `/events/${e.id}`, { as: 'coord', body: { status: 'cancelled' } });
    check(c.data && c.data.status === 'cancelled', 'coordinator cancels', c.data && c.data.status);
    const settled = await poll(async () => {
        const tx = await pointsTx('userA');
        return tx.some((t) => t.type === 'refund') && tx.some((t) => t.reason === 'event.participation' && t.amount < 0) ? tx : null;
    });
    check(!!settled, 'cancel: investment refunded and participation reversed for userA');
    check((await balance('userA')) === a0, 'cancel nets userA back to the pre-event balance', { a0, now: await balance('userA') });
    const card = await poll(async () => (await notifications('userB', 'event.cancelled')).find((n) => n.data && n.data.event_id === e.id));
    check(!!card, 'event.cancelled notification to registrants');
    const snap = await poll(async () => {
        const r = await api('GET', `/leaderboards/events/${e.id}/snapshots`, { quiet: true, expect: 'any' });
        const arr = Array.isArray(r.data) ? r.data : [];
        return arr.find((s) => s.frozen) || null;
    });
    check(!!snap, 'cancelled event board frozen');
    await api('POST', `/events/${e.id}/attendance`, { as: 'coreA', body: { attendances: [{ registration_id: rA.data._id, attended: true }] }, expect: 409 });
    const late = await register('userC', e, null, [201, 409]);
    check(late.status === 409 || (late.data && late.data.status === 'rejected'), 'registering for a cancelled event never confirms', late.data && late.data.status);
}

async function demotionPromotesNext() {
    const e = await setupEvent('Live Demotion Cup', { registration: { max_participants: 1, waitlist_enabled: true } });
    const rB = await register('userB', e); const rC = await register('userC', e);
    check(rB.data && rB.data.status === 'confirmed' && rC.data && rC.data.status === 'waitlisted', 'B confirmed, C waitlisted');
    const d = await api('PATCH', `/registrations/${rB.data._id}/status`, { as: 'coreA', body: { status: 'waitlisted', reason: 'admin demote' } });
    check(d.data && d.data.status === 'waitlisted', 'B demoted to waitlist');
    const up = await poll(async () => {
        const r = await api('GET', `/registrations/${rC.data._id}`, { as: 'userC', quiet: true });
        return r.data && r.data.status === 'confirmed';
    });
    check(!!up, 'freed seat promotes the waitlist head (C)');
    await sleep(1000);
    const b = await api('GET', `/registrations/${rB.data._id}`, { as: 'userB' });
    check(b.data && b.data.status === 'waitlisted', 'admin-demoted B is not auto-promoted back', b.data && b.data.status);
    const ev = await api('GET', `/events/${e.id}`, { as: 'coreA' });
    check(ev.data && ev.data.counts.registrations_confirmed === 1, 'seat count stays 1', ev.data && ev.data.counts);
    S.e.E7 = e;
}

async function renamePropagates() {
    const name = `Renamed userB ${RUN}`;
    await api('PATCH', '/users/me', { as: 'userB', body: { full_name: name } });
    const p1 = await poll(async () => {
        const r = await api('GET', `/events/${S.e.E5.id}/participants?limit=50`, { quiet: true });
        return ((r.data && r.data.participants) || []).some((x) => x.user.user_id === S.u.userB.id && x.user.display_name === name);
    });
    check(!!p1, 'rename reaches registration snapshots');
    if (S.e.E3 && S.e.E3.alpha) {
        const p2 = await poll(async () => {
            const r = await api('GET', `/teams/${S.e.E3.alpha}`, { as: 'userB', quiet: true });
            return ((r.data && r.data.members) || []).some((m) => m.user_id === S.u.userB.id && m.display_name === name);
        });
        check(!!p2, 'rename reaches team member snapshot');
    }
    const p3 = await poll(async () => {
        const r = await api('GET', `/brackets/${S.e.E5.id}`, { quiet: true });
        return JSON.stringify(r.data || {}).includes(name);
    });
    check(!!p3, 'rename reaches bracket seed snapshot');
}

async function audiences() {
    const a = await api('POST', '/announcements', { as: 'coreA', body: { title: 'Core only', body: 'staff note', categories: ['highlight'], audience: { min_role: 'core' } }, expect: 201 });
    const id = need(a.data && a.data._id, 'core-only announcement');
    await api('POST', `/announcements/${id}/publish`, { as: 'coreA', body: {} });
    const seen = await poll(async () => (await notifications('coreB', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(id)));
    check(!!seen, 'core-only announcement notifies core');
    await api('GET', `/announcements/${id}`, { as: 'userA', expect: 404 });
    await api('GET', `/announcements/${id}`, { expect: 404 });
    await sleep(800);
    check(!(await notifications('userA', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(id)), 'core-only announcement does not notify users');
    const ev = await api('POST', '/announcements', { as: 'coreA', body: { title: 'Bracket players', body: 'Finals at 5', categories: ['deuce'], audience: { event_id: S.e.E5.id } }, expect: 201 });
    await api('POST', `/announcements/${ev.data._id}/publish`, { as: 'coreA', body: {} });
    const reg = await poll(async () => (await notifications('member', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(ev.data._id)));
    check(!!reg, 'event-targeted announcement notifies a registrant');
    await sleep(800);
    check(!(await notifications('coreB', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(ev.data._id)), 'event-targeted announcement skips non-registrants');
}

async function concurrency() {
    const e = await setupEvent('Live Race Cup', { registration: { max_participants: 1, waitlist_enabled: false } });
    const rs = await Promise.all(['userA', 'userB', 'userC'].map((k) => register(k, e, null, [201, 409])));
    const st = rs.map((r) => r.data && r.data.status);
    check(st.filter((x) => x === 'confirmed').length === 1, 'cap 1 under a 3-way race: exactly one confirmed', st);
    const ev = await api('GET', `/events/${e.id}`, { as: 'coreA' });
    check(ev.data && ev.data.counts.registrations_confirmed === 1, 'seat count 1 after race', ev.data && ev.data.counts);
    const e2 = await setupEvent('Live Double Click', {});
    const dup = await Promise.all([register('member', e2, null, [201, 409]), register('member', e2, null, [201, 409])]);
    check(dup.map((r) => r.status).sort().join() === '201,409', 'same user double submit → 201 + 409', dup.map((r) => r.status));
    const tr = await Promise.all([1, 2].map(() => api('PATCH', `/events/${e2.id}`, { as: 'coreA', body: { status: 'ongoing' }, expect: [200, 409] })));
    check(tr.map((r) => r.status).sort().join() === '200,409', 'concurrent status transition: one wins', tr.map((r) => r.status));

    // double approve of one challenge submission
    if (S.challenge1) {
        const p = await api('POST', `/challenges/${S.challenge1}/accept`, { as: 'userC', body: {}, expect: 201 });
        await api('POST', `/challenges/participations/${p.data._id}/submit`, { as: 'userC', body: { proofs: [{ type: 'text', value: 'race' }] } });
        const c0 = (await pointsTx('userC')).filter((t) => t.source === 'challenge' && t.amount === 25).length;
        const rv = await Promise.all(['coreA', 'coreB'].map((k) => api('POST', `/challenges/participations/${p.data._id}/review`, { as: k, body: { decision: 'approved' }, expect: [200, 409] })));
        check(rv.map((r) => r.status).sort().join() === '200,409', 'double approve: one 200, one 409', rv.map((r) => r.status));
        await poll(async () => (await pointsTx('userC')).filter((t) => t.source === 'challenge' && t.amount === 25).length > c0);
        await sleep(1500);
        const c1 = (await pointsTx('userC')).filter((t) => t.source === 'challenge' && t.amount === 25).length;
        check(c1 - c0 === 1, 'double approve pays once', { c0, c1 });
    }
    // idempotent adjust under a race
    const rid = uuid();
    const b0 = await balance('member');
    const adj = await Promise.all([1, 2, 3].map(() => api('POST', '/points/adjust', { as: 'coord', body: { user_id: S.u.member.id, amount: 7, note: 'race grant', request_id: rid }, expect: [200, 201, 409] })));
    check(adj.filter((r) => r.status === 201).length === 1, 'adjust race: exactly one 201', adj.map((r) => r.status));
    check((await balance('member')) - b0 === 7, 'adjust race credits once', { b0, now: await balance('member') });
    // double moderation
    const up = await api('POST', '/media/upload?category=memories', { as: 'member', raw: PNG, ctype: 'image/png', expect: 201 });
    if (up.data) {
        const mo = await Promise.all(['coreA', 'coreB'].map((k) => api('PATCH', `/media/${up.data._id}/moderate`, { as: k, body: { status: 'approved' }, expect: [200, 409] })));
        check(mo.filter((r) => r.status === 200).length === 1, 'double moderation: exactly one 200', mo.map((r) => r.status));
    }
}

async function misc() {
    // hidden brief until accept
    const c = await api('POST', '/challenges', { as: 'coreA', body: { title: 'Live Secret Brief', description: 'The secret brief text', domain: 'general', kind: 'digital', difficulty: 'medium', award_points: 3, brief_hidden_until_accept: true, submission: { requires_proof: true, proof_types: ['text'] } }, expect: 201 });
    await api('POST', `/challenges/${c.data._id}/activate`, { as: 'coreA' });
    const d0 = await api('GET', `/challenges/${c.data._id}`, { as: 'userB' });
    check(d0.data && d0.data.challenge.description === null, 'brief hidden before accept', d0.data && d0.data.challenge.description);
    const lst = await api('GET', '/challenges?q=Secret', { as: 'userB' });
    check(!JSON.stringify(lst.data || {}).includes('The secret brief text'), 'brief hidden in the catalog list');
    await api('POST', `/challenges/${c.data._id}/accept`, { as: 'userB', body: {}, expect: 201 });
    const d1 = await api('GET', `/challenges/${c.data._id}`, { as: 'userB' });
    check(d1.data && d1.data.challenge.description === 'The secret brief text', 'brief revealed after accept');

    // feedback per-submitter cap (5/hour)
    const statuses = [];
    for (let i = 0; i < 7; i++) {
        const r = await api('POST', '/feedback', { as: 'userC', body: { subject: `cap ${i}`, description: 'rate cap probe', category: 'general' }, expect: [201, 429] });
        statuses.push(r.status);
        if (r.status === 429) break;
    }
    check(statuses.includes(429) && statuses.filter((x) => x === 201).length <= 5, 'feedback cap refuses the 6th ticket in an hour', statuses);

    // a demoted core loses write rights on the next request (live role), token-claim reads lag by design
    await api('PATCH', `/users/${S.u.coreB.id}/role`, { as: 'founder', body: { role: 'user', reason: 'demotion probe' } });
    await api('POST', '/announcements', { as: 'coreB', body: { title: 'x', body: 'y', categories: ['bgec'] }, expect: 403, why: 'live role is user' });
    const lag = await api('GET', '/media/moderation/pending', { as: 'coreB', expect: [200, 403] });
    note(`demoted core with a still-valid core token: GET /media/moderation/pending (requireRole = token claim) → ${lag.status} (documented: reads trust the token for up to 15 min)`);
    await api('PATCH', `/users/${S.u.coreB.id}/role`, { as: 'founder', body: { role: 'core', reason: 'restore' } });
    await login('coreB');
}


async function privacyAndPrefs() {
    const pub = await api('GET', `/users/${S.u.userA.id}`, { as: 'userB' });
    check(pub.data && typeof pub.data.email === 'string' && pub.data.email.includes('***'), 'stranger sees a masked email', pub.data && pub.data.email);
    const adm = await api('GET', `/users/${S.u.userA.id}`, { as: 'coord' });
    check(adm.data && adm.data.email === S.u.userA.email, 'coordinator sees the full email', adm.data && adm.data.email);
    await api('PATCH', '/users/me/settings', { as: 'userA', body: { privacy: { is_profile_public: false } } });
    const priv = await api('GET', `/users/${S.u.userA.id}`, { as: 'userB' });
    check(priv.data && !priv.data.email && !(priv.data.profile && priv.data.profile.bio), 'private profile → minimal view for a stranger', priv.data);
    const card = await api('GET', `/users/${S.u.userA.id}/player-card`, { as: 'userB' });
    check(card.data && !JSON.stringify(card.data).includes('Live harness bio'), 'private profile → player card stub', card.data);
    await api('PATCH', '/users/me/settings', { as: 'userA', body: { privacy: { is_profile_public: true } } });
    const txs = await api('GET', '/points/me/transactions?limit=50', { as: 'userB' });
    check(!JSON.stringify(txs.data || {}).includes('"note"') && !JSON.stringify(txs.data || {}).includes('idempotency_key'), 'member ledger hides admin note/actor/idempotency_key');
    // mute announcements for member
    await api('PATCH', '/notifications/preferences', { as: 'member', body: { in_app: { announcement: false } } });
    const a = await api('POST', '/announcements', { as: 'coreA', body: { title: 'Muted test', body: 'members muted this', categories: ['airball'] }, expect: 201 });
    await api('POST', `/announcements/${a.data._id}/publish`, { as: 'coreA', body: {} });
    const got = await poll(async () => (await notifications('userB', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(a.data._id)));
    check(!!got, 'unmuted user gets the announcement card');
    check(!(await notifications('member', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(a.data._id)), 'muted category suppresses the card');
    await api('PATCH', '/notifications/preferences', { as: 'member', body: { in_app: { announcement: true } } });
}

async function schedulers() {
    // Announcement scheduled a few seconds out, and an event whose start_at arrives: both need the
    // 60s scheduler ticks, so they are set up together and polled for up to ~2 minutes.
    const a = await api('POST', '/announcements', { as: 'coreB', body: { title: 'Scheduled soon', body: 'goes out by itself', categories: ['offside'] }, expect: 201 });
    await api('POST', `/announcements/${a.data._id}/publish`, { as: 'coreB', body: { scheduled_for: iso(Date.now() + 4000) } });
    const now = Date.now();
    const ev = await api('POST', '/events', { as: 'coreA', expect: 201, body: {
        title: 'Live Auto Start', category: 'general', start_at: iso(now + 25_000), end_at: iso(now + 2 * H),
        registration: { closes_at: iso(now + 20_000) },
    } });
    const id = need(ev.data && ev.data._id, 'auto-start event');
    const f = await api('POST', '/forms', { as: 'coreA', body: { owner: { type: 'event', id }, title: 'auto', fields: formFields() }, expect: 201 });
    await api('POST', `/forms/${f.data._id}/publish`, { as: 'coreA' });
    await api('PATCH', `/events/${id}`, { as: 'coreA', body: { registration: { form_id: f.data._id }, status: 'upcoming' } });
    await register('userB', { id, formId: f.data._id });
    const [pubd, started] = await Promise.all([
        poll(async () => {
            const r = await api('GET', `/announcements/${a.data._id}`, { as: 'coreB', quiet: true });
            return r.data && r.data.status === 'published';
        }, 130_000, 3000),
        poll(async () => {
            const r = await api('GET', `/events/${id}`, { quiet: true });
            return r.data && r.data.status === 'ongoing';
        }, 130_000, 3000),
    ]);
    check(!!pubd, 'scheduled announcement published by the scheduler tick');
    check(!!started, 'event auto-started (upcoming → ongoing) at start_at by the scheduler tick');
    if (pubd) {
        const card = await poll(async () => (await notifications('userB', 'announcement.published')).some((n) => JSON.stringify(n.data || {}).includes(a.data._id)));
        check(!!card, 'scheduled publish fans out notifications');
    }
}

async function publicReadRefusals() {
    const u = uuid();
    const E1 = S.e.E1 ? S.e.E1.id : u;
    const E4 = S.e.E4 ? S.e.E4.id : u;
    const cases = [
        ['/auction/events/no-such-league/live', 404], [`/auction/lots/${u}`, 404], ['/events/no-such-league/auction/live', 404],
        [`/events/${E4}/auction/lots?status=bogus`, 422], ['/events/no-such-event', 404], ['/events/no-such-event/participants/stats', 404],
        [`/events/${E1}/participants?limit=0`, 422], ['/events/no-such-event/captains', 404], [`/events/${E1}/captains`, 200],
        ['/announcements?limit=0', 422], ['/announcements/not-a-uuid', 422], [`/announcements/${u}`, 404], ['/announcements/heads?x=1', 200],
        ['/leaderboards/global?period=decade', 422], ['/leaderboards/events/no-such-event', 404], ['/leaderboards/events/no-such-event/podium', 404],
        ['/leaderboards/events/no-such-event/snapshots', 404], ['/hall-of-fame?limit=0', 422], ['/hall-of-fame/no-such-entry', 404],
        ['/hall-of-fame/featured', 200], ['/media/albums?limit=0', 422], ['/media/albums/no-such-album', 404], ['/media/not-a-uuid', 422],
        ['/media?limit=0', 422], ['/brackets/not-a-uuid/standings', 422], [`/brackets/${u}/standings`, 404], ['/matches/not-a-uuid', 422],
        [`/matches/${u}`, 404], ['/uploads/media/general/nope.png', 404], ['/uploads/../../.env', [400, 403, 404]], ['/uploads/.private/x', 404],
    ];
    for (const [url, expect] of cases) await api('GET', url, { expect, noEnvelope: url.startsWith('/uploads') });
    skip('GET /auth/google, /auth/google/callback, /strava/callback refusal checks', 'browser redirect endpoints (no auth/body); exercised for their redirect/503 only');
    skip('GET /announcements/heads, /hall-of-fame/featured refusal checks', 'public, no params/query/body — nothing to refuse');
}

async function rateLimitLast() {
    const ip = '127.0.0.250';
    const login = `ratelimit.${RUN}@example.com`;
    const statuses = [];
    for (let i = 0; i < 6; i++) {
        const r = await api('POST', '/auth/login', { ip, body: { login, password: 'wrong-password' }, expect: i < 5 ? 401 : 429 });
        statuses.push(r.status);
    }
    check(statuses[5] === 429, '6th bad login → 429', statuses);
    const other = await api('POST', '/auth/login', { ip: '127.0.0.251', body: { login, password: 'wrong-password' }, expect: 401 });
    void other;
    const good = await api('POST', '/auth/login', { ip, body: { login: S.u.userA.email, password: PW }, expect: 200, why: 'other account from the same IP is not locked out' });
    void good;
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

function report(t0) {
    const all = [...ROUTES, STATIC_UPLOADS];
    const with2xx = all.filter((r) => r.ok2xx);
    const withRefusal = all.filter((r) => r.refusals.size > 0);
    const neither = all.filter((r) => !r.ok2xx);
    const lines = [];
    const P = (s = '') => lines.push(s);
    P(`BGSC live harness — ${new Date().toISOString()} — ${((Date.now() - t0) / 1000).toFixed(0)}s — db bgsc_live`);
    P('');
    P('SUMMARY');
    P(`  HTTP calls        ${R.calls}   pass ${R.callPass}   fail ${R.callFail}`);
    P(`  assertions        ${R.asserts}   pass ${R.assertPass}   fail ${R.assertFail}`);
    P(`  5xx (unexpected)  ${R.fivexx.length}`);
    P(`  503 not-configured (expected) ${R.configured503.length}`);
    P(`  routes            ${all.length} total   authorised 2xx ${with2xx.length}   refusal(401/403/404/422) ${withRefusal.length}   no 2xx ${neither.length}`);
    P('');
    P('JOURNEYS');
    for (const j of R.journeys) P(`  ${j.fails ? 'FAIL' : 'pass'}  ${j.name}${j.fails ? ` (${j.fails})` : ''}${j.error ? ' — aborted: ' + j.error : ''}`);
    P('');
    P(`FAILURES (${R.failures.length})`);
    for (const f of R.failures) P('  ' + f);
    P('');
    P(`5xx (${R.fivexx.length})`);
    for (const f of R.fivexx) { P('  ' + f.line); P(f.log.split('\n').map((l) => '      | ' + l).join('\n')); }
    P('');
    P('ROUTES WITHOUT AN AUTHORISED 2xx');
    for (const r of neither) P(`  ${r.method.padEnd(6)} ${r.pattern}  hits=${JSON.stringify(r.hits)}`);
    P('');
    P('ROUTES WITHOUT A REFUSAL CHECK (401/403/404/422)');
    for (const r of all.filter((x) => x.refusals.size === 0)) P(`  ${r.method.padEnd(6)} ${r.pattern}  auth=${r.auth}`);
    P('');
    P('503 NOT CONFIGURED (expected in this repo)');
    for (const s of [...new Set(R.configured503)]) P('  ' + s);
    P('');
    P('SKIPPED / LIMITATIONS');
    for (const s of R.skipped) P('  ' + s);
    for (const s of R.notes) P('  note: ' + s);
    const text = lines.join('\n');
    fs.writeFileSync(path.join(LIVE, 'report.txt'), text + '\n');
    console.log('\n' + text);
}

(async () => {
    const t0 = Date.now();
    console.log(`routes parsed: ${ROUTES.length} (+ static /uploads)`);
    await journey('Bootstrap accounts, verify, founder seed, roles', bootstrap);
    if (!S.u.founder || !S.u.founder.token || !S.u.coreA || !S.u.coreA.token) {
        report(t0);
        process.exit(1);
    }
    await journey('Gateway contract (bearer, /internal, unknown routes)', gatewayContract);
    await journey('Event lifecycle: capacity, waitlist, attendance, points, leaderboard, investment, podium', eventLifecycle);
    await journey('Requires-approval event + registration admin ops', approvalEvent);
    await journey('Event CRUD (draft/delete/validation)', eventCrud);
    await journey('Teamed event: captain applications, teams, max_teams, lock', teamedEvent);
    await journey('Auction league (ALL)', auctionLeague);
    await journey('Challenges: review, points once, auto-approve separation', challenges);
    await journey('Announcements: publish → notification, read state', announcements);
    await journey('Feedback + contact', feedback);
    await journey('Media: upload, moderation, /uploads delivery', media);
    await journey('Brackets: generate, report, champion', brackets);
    await journey('Hall of fame', hallOfFame);
    await journey('Points admin', pointsAdmin);
    await journey('Forms (generic)', formsMisc);
    await journey('Users: profile, avatar, search, suspend, delete → anonymise → reactivate', usersJourney);
    await journey('Notifications inbox', notificationsJourney);
    await journey('Strava (unconfigured)', strava);
    await journey('Auth: refresh rotation/race, logout, reset, phone OTP, OAuth', authJourney);
    await journey('Event cancellation: attendance revoke, investment idempotency, refunds, reversals', cancellationReversals);
    await journey('Admin demotion frees a seat → next promoted, demoted row stays', demotionPromotesNext);
    await journey('Profile rename propagates to snapshots', renamePropagates);
    await journey('Announcement audiences (role floor, event registrants)', audiences);
    await journey('Concurrency: seat race, double submit, double approve, adjust replay, double moderation', concurrency);
    await journey('Misc: hidden brief, feedback cap, demotion takes effect', misc);
    await journey('Privacy (PII masking, private profile) and notification mute', privacyAndPrefs);
    await journey('Schedulers: scheduled announcement, event auto-start', schedulers);
    await journey('Public reads: bad input / unknown ids', publicReadRefusals);
    await journey('Refusal sweep over every route (401 / under-rank 403 / 422 / invalid bearer)', refusalSweep);
    await journey('Rate limit on /auth/login (last)', rateLimitLast);
    report(t0);
    process.exit(R.callFail + R.assertFail + R.fivexx.length > 0 ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
