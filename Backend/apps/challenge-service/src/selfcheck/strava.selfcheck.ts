import assert from 'assert';
import { ServiceError, StravaActivity, StravaCredential, User, config } from '@bgsc/shared';
import jwt from 'jsonwebtoken';
import { closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * Strava linking, against a stubbed `fetch`. No Strava application is registered for this repo and
 * none is needed: every network call goes through `fetch`, so replacing it exercises the token
 * exchange, the refresh margin, the sync upsert and the rate-limit path without an account.
 *
 *   npx ts-node src/selfcheck/strava.selfcheck.ts
 */

const section = (name: string) => console.log(`\n-- ${name} --`);
const pass = (what: string) => console.log(`  ok  ${what}`);

/** The service reads config at call time, so the stub must be installed before it is imported. */
process.env.STRAVA_CLIENT_ID = 'selfcheck-client';
process.env.STRAVA_CLIENT_SECRET = 'selfcheck-secret';
config.strava.clientId = 'selfcheck-client';
config.strava.clientSecret = 'selfcheck-secret';

const realFetch = globalThis.fetch;
interface StubCall {
    url: string;
    method: string;
    body: string | null;
}
const calls: StubCall[] = [];
let respond: (url: string, init?: RequestInit) => { status?: number; body?: unknown; headers?: Record<string, string> };

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', body: (init?.body as string) ?? null });
    const r = respond(url, init);
    const status = r.status ?? 200;
    return new Response(JSON.stringify(r.body ?? {}), {
        status,
        headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
}) as typeof fetch;

import * as svc from '../strava/strava.service';
import { open, resetKeyCache, seal, tokenKey } from '../strava/tokens';

const epoch = (ms: number) => Math.floor((Date.now() + ms) / 1000);

async function refuses(status: number, code: string, fn: () => Promise<unknown>): Promise<void> {
    try {
        await fn();
    } catch (err) {
        assert.ok(err instanceof ServiceError, `expected ServiceError ${code}, got ${(err as Error).message}`);
        assert.strictEqual(err.status, status, `expected ${status} ${code}, got ${err.status} ${err.code}`);
        assert.strictEqual(err.code, code);
        return;
    }
    assert.fail(`expected ${status} ${code}, but the call succeeded`);
}

async function main(): Promise<void> {
    await openScratchDb();
    try {
        section('token sealing');
        const secret = 'strava-access-token-abc123';
        const sealed = seal(secret);
        assert.notStrictEqual(sealed, secret);
        assert.ok(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(sealed), 'iv:tag:ciphertext hex');
        assert.strictEqual(open(sealed), secret);
        assert.notStrictEqual(seal(secret), seal(secret), 'a fresh iv every time, so the same token never repeats');
        pass('seal/open round-trips and never produces the same ciphertext twice');

        const [iv, tag, data] = sealed.split(':');
        const tamperedTag = `${iv}:${tag.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'))}:${data}`;
        assert.throws(() => open(tamperedTag), 'a tampered auth tag must not decrypt');
        const tamperedData = `${iv}:${tag}:${data.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))}`;
        assert.throws(() => open(tamperedData), 'tampered ciphertext must not decrypt');
        pass('GCM refuses a tampered tag and tampered ciphertext — this is why it is not CBC');

        section('the encryption key');
        assert.strictEqual(tokenKey().length, 32);
        resetKeyCache();
        config.strava.tokenKey = 'not-hex';
        assert.throws(() => tokenKey(), /64 hex characters/);
        resetKeyCache();
        config.strava.tokenKey = '';
        const wasEnv = config.nodeEnv;
        config.nodeEnv = 'production';
        assert.throws(() => tokenKey(), /must be set in production/);
        config.nodeEnv = wasEnv;
        resetKeyCache();
        pass('a malformed key and a blank key in production are both boot errors, not silent defaults');

        section('OAuth state');
        const user = await seedUser('Strava User');
        const url = svc.authorizeUrl(user._id);
        const state = new URL(url).searchParams.get('state')!;
        assert.strictEqual(svc.verifyState(state), user._id);
        assert.ok(url.includes('activity%3Aread_all'), 'requests the activity scope');
        await refuses(400, 'invalid_oauth_state', async () => svc.verifyState(undefined));
        await refuses(400, 'invalid_oauth_state', async () => svc.verifyState('forged.token.here'));
        // Signed with the right secret but missing the nonce: a replayed JWT from somewhere else.
        const noNonce = jwt.sign({ sub: user._id }, config.jwt.accessSecret, { algorithm: 'HS256', expiresIn: '5m' });
        await refuses(400, 'invalid_oauth_state', async () => svc.verifyState(noNonce));
        const expired = jwt.sign({ sub: user._id, nonce: 'x' }, config.jwt.accessSecret, { algorithm: 'HS256', expiresIn: -10 });
        await refuses(400, 'invalid_oauth_state', async () => svc.verifyState(expired));
        pass('state must be signed, carry a nonce, and still be alive');

        section('callback stores sealed tokens and nothing else');
        respond = () => ({
            body: {
                access_token: 'access-1',
                refresh_token: 'refresh-1',
                expires_at: epoch(6 * 3600_000),
                athlete: { id: 998877 },
                scope: 'activity:read_all',
            },
        });
        const redirect = await svc.handleCallback('code-1', state);
        assert.ok(redirect.includes('strava=connected'));

        const cred = await StravaCredential.findOne({ user_id: user._id });
        assert.ok(cred, 'a credential row exists');
        assert.strictEqual(cred!.athlete_id, '998877');
        assert.notStrictEqual(cred!.access_token_enc, 'access-1', 'the token is never stored in the clear');
        assert.strictEqual(open(cred!.access_token_enc), 'access-1');
        assert.strictEqual((await User.findById(user._id))!.profile.social_links!.strava_id, '998877');
        pass('the callback seals both tokens and links the athlete id onto the user');

        // Reconnecting must refresh the row, not collide on the unique user_id index.
        const state2 = new URL(svc.authorizeUrl(user._id)).searchParams.get('state')!;
        respond = () => ({
            body: { access_token: 'access-2', refresh_token: 'refresh-2', expires_at: epoch(6 * 3600_000), athlete: { id: 998877 } },
        });
        await svc.handleCallback('code-2', state2);
        assert.strictEqual(await StravaCredential.countDocuments({ user_id: user._id }), 1);
        assert.strictEqual(open((await StravaCredential.findOne({ user_id: user._id }))!.access_token_enc), 'access-2');
        pass('reconnecting upserts rather than duplicating');

        section('one Strava athlete belongs to one BGSC account');
        {
            const rival = await seedUser('Rival');
            const rivalState = new URL(svc.authorizeUrl(rival._id)).searchParams.get('state')!;
            // Same athlete id as the user linked above.
            respond = () => ({
                body: { access_token: 'x', refresh_token: 'y', expires_at: epoch(3600_000), athlete: { id: 998877 } },
            });
            await refuses(409, 'strava_athlete_already_linked', () => svc.handleCallback('code-rival', rivalState));

            assert.strictEqual(await StravaCredential.countDocuments({ athlete_id: '998877' }), 1);
            assert.strictEqual((await User.findById(rival._id))!.profile.social_links!.strava_id ?? null, null,
                'a refused link must not leave the athlete id on the second user');
            pass('a second account cannot link an athlete that is already linked — the activities would move with it');
        }

        section('refresh happens inside the margin and not outside it');
        calls.length = 0;
        respond = () => ({ body: [] });
        await svc.sync(user._id);
        assert.ok(!calls.some((c) => c.url.includes('/oauth/token')), 'a token with 6h left is not refreshed');

        await StravaCredential.updateOne({ user_id: user._id }, { $set: { expires_at: new Date(Date.now() + 60_000) } });
        calls.length = 0;
        respond = (url) =>
            url.includes('/oauth/token')
                ? { body: { access_token: 'access-3', refresh_token: 'refresh-3', expires_at: epoch(6 * 3600_000) } }
                : { body: [] };
        await svc.sync(user._id);
        assert.ok(calls.some((c) => c.url.includes('/oauth/token')), 'a token expiring in 60s IS refreshed');
        assert.strictEqual(open((await StravaCredential.findOne({ user_id: user._id }))!.access_token_enc), 'access-3');
        pass('the 5-minute refresh margin is respected in both directions, and the new token is sealed');

        section('sync upserts by strava id');
        const activity = (id: number, when: string) => ({
            id,
            sport_type: 'Run',
            name: `Run ${id}`,
            distance: 5000,
            moving_time: 1500,
            elapsed_time: 1600,
            total_elevation_gain: 12,
            start_date: when,
        });
        respond = (url) =>
            url.includes('page=1')
                ? { body: [activity(1, '2026-09-19T08:00:00Z'), activity(2, '2026-09-20T08:00:00Z'), { id: 3, name: 'No date' }] }
                : { body: [] };

        const first = await svc.sync(user._id);
        assert.strictEqual(first.synced, 2);
        assert.strictEqual(first.skipped, 1, 'an activity with no usable start_date is skipped, not stored broken');
        assert.strictEqual(first.has_more, false);
        assert.strictEqual(await StravaActivity.countDocuments({ user_id: user._id }), 2);

        const second = await svc.sync(user._id);
        assert.strictEqual(await StravaActivity.countDocuments({ user_id: user._id }), 2, 'a re-sync upserts, never duplicates');
        assert.ok(second.synced >= 0);
        pass('sync stores what it can, skips what it cannot, and is idempotent over the same window');

        const watermark = (await StravaCredential.findOne({ user_id: user._id }))!.last_synced_at!;
        assert.strictEqual(watermark.toISOString(), '2026-09-20T08:00:00.000Z');
        pass('last_synced_at advances to the newest activity, so the next call asks for less');

        section('the page cap is real');
        let page = 0;
        respond = () => {
            page++;
            return { body: Array.from({ length: 100 }, (_, i) => activity(1000 + page * 100 + i, '2026-09-21T08:00:00Z')) };
        };
        const capped = await svc.sync(user._id);
        assert.strictEqual(page, 3, 'never more than MAX_PAGES requests in one call');
        assert.strictEqual(capped.has_more, true, 'and the caller is told there is more');
        pass('one sync spends at most 3 of the application-wide rate-limit budget');

        section('upstream failures are typed, not 500s');
        respond = () => ({ status: 429, body: {}, headers: { 'retry-after': '900' } });
        await refuses(503, 'strava_rate_limited', () => svc.sync(user._id));
        respond = () => ({ status: 401, body: {} });
        await refuses(401, 'strava_token_rejected', () => svc.sync(user._id));
        respond = () => ({ status: 500, body: {} });
        await refuses(502, 'strava_api_failed', () => svc.sync(user._id));
        pass('429 -> 503 rate limited, 401 -> token rejected, 5xx -> 502');

        section('private activities never reach another user\'s profile');
        {
            respond = (url) =>
                url.includes('page=1')
                    ? {
                          body: [
                              { id: 9001, sport_type: 'Run', name: 'Public run', distance: 1, moving_time: 1, elapsed_time: 1, start_date: '2026-09-22T08:00:00Z', private: false, visibility: 'everyone' },
                              { id: 9002, sport_type: 'Run', name: 'Secret run', distance: 1, moving_time: 1, elapsed_time: 1, start_date: '2026-09-23T08:00:00Z', private: true },
                              // Strava told us neither flag: default to private rather than guess.
                              { id: 9003, sport_type: 'Run', name: 'Unknown run', distance: 1, moving_time: 1, elapsed_time: 1, start_date: '2026-09-24T08:00:00Z' },
                          ],
                      }
                    : { body: [] };
            await svc.sync(user._id);

            const own = await svc.listActivities(user._id, { limit: 50 } as never);
            const ownIds = own.rows.map((r) => r._id);
            assert.ok(ownIds.includes('9001') && ownIds.includes('9002') && ownIds.includes('9003'), 'you see all of your own');

            const visitor = await svc.listActivities(user._id, { limit: 50 } as never, { publicOnly: true });
            const visitorIds = visitor.rows.map((r) => r._id);
            assert.ok(visitorIds.includes('9001'));
            assert.ok(!visitorIds.includes('9002'), 'a private activity must not appear on a public profile');
            assert.ok(!visitorIds.includes('9003'), 'an activity with no privacy flag defaults to private');
            pass('activity:read_all returns private activities; another user\'s feed filters them out');
        }

        section('reads and disconnect');
        respond = () => ({ body: [] });
        const feed = await svc.listActivities(user._id, { limit: 1 } as never);
        assert.strictEqual(feed.rows.length, 1);
        assert.ok(feed.next_cursor, 'a full page carries a cursor');
        const nextPage = await svc.listActivities(user._id, { limit: 1, cursor: feed.next_cursor! } as never);
        assert.notStrictEqual(nextPage.rows[0]?._id, feed.rows[0]._id, 'the cursor moves past the first row');
        pass('the activity feed paginates by keyset');

        assert.strictEqual((await svc.connectionOf(user._id)).connected, true);
        await svc.disconnect(user._id);
        assert.strictEqual(await StravaCredential.countDocuments({ user_id: user._id }), 0);
        assert.strictEqual((await User.findById(user._id))!.profile.social_links!.strava_id, null);
        assert.strictEqual((await svc.connectionOf(user._id)).connected, false);
        await refuses(404, 'strava_not_connected', () => svc.sync(user._id));
        pass('disconnect drops the credential, clears the link, and leaves sync with nothing to do');

        section('unconfigured means 503, never a crash');
        config.strava.clientId = '';
        await refuses(503, 'strava_not_configured', async () => svc.authorizeUrl(user._id));
        config.strava.clientId = 'selfcheck-client';
        pass('a blank client id refuses the connect flow with a code the frontend can render');

        console.log('\nstrava.selfcheck: all good.');
    } finally {
        globalThis.fetch = realFetch;
        await closeScratchDb();
    }
}

main().catch((err) => {
    console.error('\nstrava.selfcheck FAILED:', err);
    process.exit(1);
});
