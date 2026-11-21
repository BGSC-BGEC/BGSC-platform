// Development-only HTTP stand-ins for the provider contracts consumed by BGSC.
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

if (process.env.NODE_ENV !== 'development' || !process.env.JWT_ACCESS_SECRET) {
    throw new Error('Use a local development environment with JWT_ACCESS_SECRET set.');
}
const callback = process.env.STRAVA_CALLBACK_URL || 'http://localhost:3000/strava/callback';
const dataDir = process.env.FAKE_DATA_DIR || path.join(__dirname, '.data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'providers.sqlite'));
db.exec(`
    CREATE TABLE IF NOT EXISTS athletes (id INTEGER PRIMARY KEY, subject TEXT UNIQUE, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS grants (access TEXT PRIMARY KEY, refresh TEXT UNIQUE, athlete INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, destination TEXT NOT NULL, body TEXT NOT NULL, sent_at TEXT NOT NULL);
`);
const fixture = name => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const now = () => Math.floor(Date.now() / 1000);
const codes = new Map();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }), express.urlencoded({ extended: false, limit: '16kb' }));
app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.all('/oauth/authorize', (req, res) => {
    const { state, scope, client_id, redirect_uri, response_type } = req.query;
    if (client_id !== 'demo-strava' || redirect_uri !== callback || response_type !== 'code' || typeof scope !== 'string') {
        return res.status(400).json({ error: 'invalid_request' });
    }
    let claims;
    try { claims = jwt.verify(state, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }); }
    catch { return res.status(400).json({ error: 'invalid_state' }); }
    if (!claims.nonce || typeof claims.sub !== 'string') return res.status(400).json({ error: 'invalid_state' });

    if (req.method === 'GET') {
        return res.type('html').send('<!doctype html><title>Demo Strava</title><h1>Connect demo athlete</h1><p>Use sample activities from the local test provider.</p><form method="post"><button name="choice" value="allow">Connect</button> <button name="choice" value="deny">Cancel</button></form>');
    }
    if (req.method !== 'POST') return res.sendStatus(405);
    const url = new URL(callback);
    url.searchParams.set('state', state);
    if (req.body?.choice === 'deny') url.searchParams.set('error', 'access_denied');
    else if (req.body?.choice === 'allow') {
        db.prepare('INSERT OR IGNORE INTO athletes(subject,created) VALUES (?,?)').run(claims.sub, now());
        const athlete = db.prepare('SELECT id FROM athletes WHERE subject=?').get(claims.sub);
        for (const [key, value] of codes) if (value.expires <= now()) codes.delete(key);
        const code = randomUUID();
        codes.set(code, { athlete: athlete.id, expires: now() + 600 });
        url.searchParams.set('code', code);
        url.searchParams.set('scope', scope);
    } else return res.status(400).json({ error: 'invalid_choice' });
    res.redirect(303, url.href);
});

app.post('/oauth/token', (req, res) => {
    const { client_id, client_secret, grant_type, code, refresh_token } = req.body || {};
    if (client_id !== 'demo-strava' || client_secret !== 'local-strava-secret') return res.sendStatus(401);
    let athlete;
    if (grant_type === 'authorization_code') {
        const grant = codes.get(code);
        codes.delete(code);
        if (grant && grant.expires > now()) athlete = grant.athlete;
    } else if (grant_type === 'refresh_token' && typeof refresh_token === 'string') {
        athlete = db.prepare('SELECT athlete FROM grants WHERE refresh=?').get(refresh_token)?.athlete;
    }
    if (!athlete) return res.status(400).json({ error: 'invalid_grant' });
    const access = randomUUID();
    const refresh = randomUUID();
    const expires = now() + 3600;
    if (grant_type === 'refresh_token') {
        db.prepare('UPDATE grants SET access=?,refresh=?,expires=? WHERE refresh=?').run(access, refresh, expires, refresh_token);
    } else {
        db.prepare('INSERT INTO grants VALUES (?,?,?,?)').run(access, refresh, athlete, expires);
    }
    res.json({ access_token: access, refresh_token: refresh, expires_at: expires, athlete: { id: `demo-athlete-${athlete}` } });
});

function activities(athlete) {
    return fixture('strava-activities.json').map(({ key, hours_before_link, ...values }) => ({
        ...values, id: `demo-${athlete.id}-${key}`,
        start_date: new Date((athlete.created - hours_before_link * 3600) * 1000).toISOString(),
    })).sort((a, b) => b.start_date.localeCompare(a.start_date));
}
function token(req) { return /^Bearer (.+)$/.exec(req.get('authorization') || '')?.[1] || ''; }
app.get('/api/v3/athlete/activities', (req, res) => {
    const athlete = db.prepare('SELECT athletes.* FROM athletes JOIN grants ON athlete=id WHERE access=? AND expires>?').get(token(req), now());
    if (!athlete) return res.sendStatus(401);
    const after = Number(req.query.after || 0), perPage = Number(req.query.per_page || 30), page = Number(req.query.page || 1);
    if (!Number.isFinite(after) || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(perPage) || perPage < 1 || perPage > 200) return res.sendStatus(400);
    const rows = activities(athlete).filter(row => Date.parse(row.start_date) / 1000 > after);
    res.json(rows.slice((page - 1) * perPage, page * perPage));
});
app.get('/activities/:id', (req, res) => {
    const match = /^demo-(\d+)-[a-z]+$/.exec(req.params.id);
    const athlete = match && db.prepare('SELECT id,created FROM athletes WHERE id=?').get(match[1]);
    const row = athlete && activities(athlete).find(a => a.id === req.params.id && a.visibility === 'everyone');
    if (!row) return res.sendStatus(404);
    res.json(row);
});
app.post('/oauth/deauthorize', (req, res) => {
    const grant = db.prepare('SELECT athlete FROM grants WHERE access=?').get(token(req));
    if (!grant) return res.sendStatus(401);
    db.prepare('DELETE FROM grants WHERE athlete=?').run(grant.athlete);
    res.json({});
});

app.post('/v21.0/demo-phone/messages', (req, res) => {
    if (req.get('authorization') !== 'Bearer local-whatsapp-token') return res.sendStatus(401);
    const { messaging_product, type, to, text } = req.body || {};
    if (messaging_product !== 'whatsapp' || type !== 'text' || !fixture('whatsapp-destinations.json').includes(to) || typeof text?.body !== 'string' || !text.body.trim()) return res.sendStatus(400);
    const id = 'wamid.demo.' + randomUUID();
    db.prepare('INSERT INTO outbox VALUES (?,?,?,?)').run(id, to, text.body, new Date().toISOString());
    res.json({ messaging_product, messages: [{ id }] });
});
app.get('/outbox', (req, res) => {
    if (req.get('authorization') !== 'Bearer local-whatsapp-token') return res.sendStatus(401);
    res.json({ messages: db.prepare('SELECT * FROM outbox ORDER BY rowid DESC').all() });
});
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'fake' }));
const server = app.listen(Number(process.env.FAKE_PORT || 3100), process.env.FAKE_BIND || '127.0.0.1', () => {
    console.log('Local fake providers ready on port', server.address().port);
});
