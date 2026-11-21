const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const jwt = require('jsonwebtoken');

test('local provider contracts and restart persistence', { timeout: 25000 }, async t => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bgsc-providers-'));
    const callback = 'http://localhost:3000/strava/callback';
    const signingKey = 'isolated-provider-test';
    let child, base;
    async function stop() {
        if (!child || child.exitCode !== null || child.signalCode) return;
        const done = once(child, 'exit');
        child.kill();
        await done;
    }
    t.after(async () => { await stop(); rmSync(dir, { recursive: true, force: true }); });
    async function start() {
        child = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], {
            env: { ...process.env, NODE_ENV: 'development', FAKE_PORT: '0', FAKE_BIND: '127.0.0.1',
                FAKE_DATA_DIR: dir, STRAVA_CALLBACK_URL: callback, JWT_ACCESS_SECRET: signingKey },
            stdio: ['ignore', 'pipe', 'inherit'],
        });
        for await (const line of createInterface({ input: child.stdout })) {
            const match = /ready on port (\d+)/.exec(line);
            if (match) { base = 'http://127.0.0.1:' + match[1]; return; }
        }
        throw Error('Fake provider exited before listening');
    }
    const postForm = (url, body) => fetch(url, { method: 'POST', redirect: 'manual', body: new URLSearchParams(body) });
    const exchange = body => postForm(base + '/oauth/token', { client_id: 'demo-strava', client_secret: 'local-strava-secret', ...body });
    const bearer = token => ({ authorization: 'Bearer ' + token });
    await start();
    const state = jwt.sign({ nonce: 'fixture', sub: 'fixture-user' }, signingKey, { expiresIn: '1m' });
    const query = new URLSearchParams({ client_id: 'demo-strava', scope: 'activity:read_all', response_type: 'code', redirect_uri: callback, state });
    const authUrl = base + '/oauth/authorize?' + query;
    const authorize = await postForm(authUrl, { choice: 'allow' });
    assert.equal(authorize.status, 303);
    const target = new URL(authorize.headers.get('location'));
    assert.equal(target.searchParams.get('state'), state);
    const grant = { grant_type: 'authorization_code', code: target.searchParams.get('code') };
    const tokens = await (await exchange(grant)).json();
    assert.match(tokens.athlete.id, /^demo-athlete-/);
    assert.equal((await exchange(grant)).status, 400);
    const refresh = { grant_type: 'refresh_token', refresh_token: tokens.refresh_token };
    const rotated = await (await exchange(refresh)).json();
    assert.notEqual(rotated.refresh_token, tokens.refresh_token);
    assert.equal((await exchange(refresh)).status, 400);

    const outboxHeaders = { ...bearer('local-whatsapp-token'), 'content-type': 'application/json' };
    const message = { messaging_product: 'whatsapp', type: 'text', to: 'demo-bgec', text: { body: 'Test announcement' } };
    const sent = await fetch(base + '/v21.0/demo-phone/messages', { method: 'POST', headers: outboxHeaders, body: JSON.stringify(message) });
    assert.equal(sent.status, 200);
    const messageId = (await sent.json()).messages[0].id;

    await stop();
    await start();
    const activities = base + '/api/v3/athlete/activities';
    const options = { headers: bearer(rotated.access_token) };
    const page = await (await fetch(activities + '?per_page=1&page=2', options)).json();
    assert.equal(page.length, 1);
    assert.equal(page[0].sport_type, 'Ride');
    assert.deepEqual(await (await fetch(activities + '?after=' + Math.ceil(Date.now() / 1000), options)).json(), []);
    assert.equal((await fetch(activities, { headers: bearer(tokens.access_token) })).status, 401);
    assert.equal((await fetch(base + '/oauth/deauthorize', { method: 'POST', ...options })).status, 200);
    assert.equal((await fetch(activities, options)).status, 401);
    assert.equal((await fetch(base + '/outbox')).status, 401);
    const { messages } = await (await fetch(base + '/outbox', { headers: outboxHeaders })).json();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].id, messageId);
    assert.equal(messages[0].body, message.text.body);
});
