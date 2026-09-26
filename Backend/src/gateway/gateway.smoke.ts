import assert from 'assert';
import { config } from '@bgsc/shared';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { ROUTES, LIVE_SERVICES } from './routing';

/**
 * Gateway smoke suite — routing, isolation and the response envelope, asserted against a running
 * stack rather than by reading the table.
 *
 * These checks used to live in throwaway scripts, which meant a routing regression was only caught
 * when someone remembered to look. Everything here has been a real bug at least once: avatars
 * unreachable because /uploads went to an unbuilt service, /internal exposed at the edge,
 * /account/reactivate outside the strict rate-limit bucket.
 *
 * Needs the stack up (docker compose up, or each service via npm start). Exits 0 and skips if the
 * gateway is not listening, so it is safe to chain after the unit-level checks.
 *
 * The last check deliberately spends the strict rate-limit bucket (5 per 15 min per IP), so a
 * login or register from the same IP will 429 for a while afterwards. The limiter store is
 * in-memory per gateway process — restart the gateway to clear it.
 *
 * Run: npm run smoke
 */

const BASE = `http://localhost:${config.gatewayPort}`;
const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
    if (actual === expected) {
        console.log(`  ok   ${label}`);
    } else {
        console.log(`  FAIL ${label} — got ${actual}, want ${expected}`);
        failures.push(label);
    }
}

const token = (role = 'core') =>
    jwt.sign({ sub: randomUUID(), role }, config.jwt.accessSecret, {
        algorithm: 'HS256',
        expiresIn: '15m',
    });

async function status(method: string, path: string, headers: Record<string, string> = {}): Promise<number> {
    const r = await fetch(BASE + path, { method, headers });
    return r.status;
}

async function main(): Promise<void> {
    try {
        await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    } catch {
        console.log(`gateway smoke: nothing listening on ${BASE} — skipped.`);
        return;
    }

    const auth = { authorization: `Bearer ${token()}` };

    console.log('\n-- every live service is reachable through the gateway --');
    // 401, not 404: the request reached the service and its own auth middleware answered.
    check('GET  /users/me      -> user-service', await status('GET', '/users/me'), 401);
    check('GET  /forms         -> registration-service', await status('GET', '/forms'), 401);
    check('POST /auth/logout   -> auth-service', await status('POST', '/auth/logout'), 401);
    check('GET  /points/me     -> points-service', await status('GET', '/points/me'), 401);
    check('GET  /challenges     -> challenge-service', await status('GET', '/challenges'), 401);
    // Two ROUTES keys, one container: /strava is served by challenge-service, so a 503 here would
    // mean the second routing row never went live while the first did.
    check('GET  /strava/activities -> challenge-service', await status('GET', '/strava/activities'), 401);
    // Added when notification-service went live: a service in LIVE_SERVICES drops out of the 503
    // loop below, so without a line here the prefix would be asserted by nothing at all.
    check('GET  /notifications -> notification-service', await status('GET', '/notifications'), 401);
    // The staff inbox needs a session; submission deliberately does not (Spec §5.12 is public), so
    // the 401 here is the inbox answering, which is exactly what should be asserted.
    check('GET  /feedback      -> feedback-service', await status('GET', '/feedback'), 401);
    // A spectator read with no event: the service answers 422, which proves it was reached.
    check('GET  /matches       -> bracket-service', await status('GET', '/matches'), 422);

    console.log('\n-- services that do not exist yet answer, rather than hang --');
    for (const [key, route] of Object.entries(ROUTES)) {
        if (LIVE_SERVICES.has(key)) continue;
        // The first prefix is enough; they all mount the same handler.
        check(`GET  ${route.prefixes[0]}`, await status('GET', route.prefixes[0], auth), 503);
    }

    console.log('\n-- /internal is service-to-service only, never reachable from the edge --');
    check('GET /internal/users/snapshot', await status('GET', '/internal/users/snapshot', auth), 404);
    check('GET /internal/teams/snapshot', await status('GET', '/internal/teams/snapshot', auth), 404);
    // The Points Service's leaderboard debit: reachable by Leaderboard over the internal network,
    // never by a client that happens to know the path.
    check('POST /internal/points/spend', await status('POST', '/internal/points/spend', auth), 404);
    // The Challenge Service's team lock: reachable by challenge-service over the internal network,
    // never by a client that happens to know the path.
    check('POST /internal/teams/x/lock', await status('POST', '/internal/teams/x/lock', auth), 404);
    // The Announcement Service's delivery writeback: reachable by notification-service over the
    // internal network, never by a client that happens to know the path.
    check(
        'PATCH /internal/announcements/x/delivery',
        await status('PATCH', '/internal/announcements/x/delivery', auth),
        404
    );
    check(
        'GET /internal/* even with a valid service token',
        await status('GET', '/internal/users/snapshot?ids=x', {
            ...auth,
            'x-internal-token': config.internalToken,
        }),
        404
    );

    console.log('\n-- prefixes match whole segments, so neighbours do not leak --');
    check('GET /usersfoo', await status('GET', '/usersfoo', auth), 404);
    check('GET /challengesfoo', await status('GET', '/challengesfoo', auth), 404);
    check('GET /stravafoo', await status('GET', '/stravafoo', auth), 404);
    check('GET /formsfoo', await status('GET', '/formsfoo', auth), 404);
    check('GET /notificationsfoo', await status('GET', '/notificationsfoo', auth), 404);
    check('GET /feedbackfoo', await status('GET', '/feedbackfoo', auth), 404);
    check('GET /bracketsfoo', await status('GET', '/bracketsfoo', auth), 404);
    check('GET /nope', await status('GET', '/nope', auth), 404);

    console.log('\n-- every upload is served by media-service from the one shared upload root --');
    // 404 = media-service answered and the file is absent; a 502/503 would mean nothing serves it.
    check('GET /uploads/avatars/<missing>', await status('GET', '/uploads/avatars/nope.png'), 404);
    check('GET /uploads/registrations/<missing>', await status('GET', '/uploads/registrations/nope.pdf'), 404);
    check('GET /uploads/events/<missing>', await status('GET', '/uploads/events/nope.png'), 404);

    console.log('\n-- the routing table is operator information --');
    check('GET /gateway/services anonymous', await status('GET', '/gateway/services'), 401);
    check('GET /gateway/services as core', await status('GET', '/gateway/services', auth), 403);
    check('GET /gateway/services as coordinator', await status('GET', '/gateway/services', {
        authorization: `Bearer ${token('coordinator')}`,
    }), 200);

    console.log('\n-- forged gateway identity headers are stripped before proxying --');
    check(
        'GET /users/me with a forged x-gateway-user',
        await status('GET', '/users/me', { 'x-gateway-user': randomUUID(), 'x-gateway-role': 'founder' }),
        401
    );

    console.log('\n-- one success envelope across services --');
    const health = (await (await fetch(`${BASE}/health`)).json()) as Record<string, unknown>;
    assert.ok(health.status, '/health stays unwrapped for orchestrators');
    const forms = (await (await fetch(`${BASE}/forms`)).json()) as Record<string, unknown>;
    assert.ok('error' in forms, 'failures keep the bare { error } shape');
    console.log('  ok   /health unwrapped, failures bare');

    console.log('\n-- brute-forceable endpoints sit in the strict bucket --');
    let last = 0;
    for (let i = 0; i < 7; i++) last = await status('POST', '/account/reactivate');
    check('7x POST /account/reactivate is throttled', last, 429);
    // Express matches case-insensitively and ignores a trailing slash; the limiter must too.
    check('POST /Account/Reactivate/ shares the bucket', await status('POST', '/Account/Reactivate/'), 429);

    if (failures.length > 0) {
        console.error(`\ngateway smoke: ${failures.length} failed:\n  - ${failures.join('\n  - ')}`);
        process.exit(1);
    }
    console.log('\ngateway smoke: all checks passed');
}

main().catch((err) => {
    console.error('gateway smoke failed:', err);
    process.exit(1);
});
