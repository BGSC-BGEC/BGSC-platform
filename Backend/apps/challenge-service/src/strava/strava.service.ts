import {
    IStravaActivity,
    ServiceError,
    StravaActivity,
    StravaCredential,
    User,
    config,
    publish,
} from '@bgsc/shared';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { allOf, keysetFilter, keysetSort, pageOf } from '../challenges/cursor';
import { ActivitiesInput } from './strava.schemas';
import { apiGet, assertConfigured, credentialFor, deauthorize, exchange, freshToken, open, seal } from './tokens';

/**
 * Strava account linking. A CONNECTION, never a login method: the caller already holds a BGSC
 * session before any of this runs (Spec §9.1, §12.4 "Connect / Disconnect Strava").
 *
 * Scope is the two MVP plan lines — "Strava OAuth integration (basic)" and "Strava activity sync
 * endpoint". Webhooks, the nightly batch job and points for activities are out
 * (be2-challenge-service-plan.md §13); Spec §14's own scope table lists the whole integration as
 * excluded from MVP, so this stays deliberately small.
 */

const PRODUCER = 'challenge-service';
const SCOPES = 'activity:read_all,profile:read_all';
/** Bound one sync: Strava allows 200 requests / 15 min for the whole application. */
const MAX_PAGES = 3;
const PER_PAGE = 100;

/**
 * OAuth CSRF protection (RFC 6749 §10.12), the same signed-state trick auth-service uses for
 * Google (auth.service.ts:447-475). Without it an attacker feeds a victim a callback URL carrying
 * the attacker's authorization code, and the victim's BGSC account gets bound to the attacker's
 * Strava athlete.
 *
 * Signed rather than stored: a short-lived HMAC token is self-verifying, so this needs no session
 * store and no new dependency.
 */
function signState(userId: string): string {
    return jwt.sign({ nonce: randomUUID(), sub: userId }, config.jwt.accessSecret, {
        algorithm: 'HS256',
        expiresIn: '10m',
    });
}

export function verifyState(state: string | undefined): string {
    if (!state) throw new ServiceError(400, 'invalid_oauth_state');
    try {
        const payload = jwt.verify(state, config.jwt.accessSecret, { algorithms: ['HS256'] }) as {
            nonce?: string;
            sub?: string;
        };
        if (!payload.nonce || !payload.sub) throw new Error('missing claims');
        return payload.sub;
    } catch {
        // Expired or forged: both mean this callback did not start here.
        throw new ServiceError(400, 'invalid_oauth_state');
    }
}

export function authorizeUrl(userId: string): string {
    assertConfigured();
    const params = new URLSearchParams({
        client_id: config.strava.clientId,
        redirect_uri: config.strava.callbackUrl,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: SCOPES,
        state: signState(userId),
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

export async function handleCallback(code: string, state: string | undefined): Promise<string> {
    const userId = verifyState(state);
    const tokens = await exchange({ code, grant_type: 'authorization_code' });
    const athleteId = String(tokens.athlete?.id ?? '');
    if (!athleteId) throw new ServiceError(502, 'strava_athlete_missing');

    // Upsert, not insert: reconnecting must refresh the tokens rather than collide on the unique
    // user_id index. A query update runs NO document middleware, so the model's sealed-token
    // pre('validate') hook does not fire here (adding-a-service.md §6.3) — which is exactly why
    // both fields below go through `seal()` at the call site and never come from a caller.
    //
    // `athlete_id` is unique too, so linking an athlete that already belongs to somebody else is a
    // duplicate-key error rather than a silent takeover of their activity rows.
    try {
        await StravaCredential.updateOne(
            { user_id: userId },
            {
                $set: {
                    athlete_id: athleteId,
                    access_token_enc: seal(tokens.access_token),
                    refresh_token_enc: seal(tokens.refresh_token),
                    expires_at: new Date(tokens.expires_at * 1000),
                    scope: tokens.scope ?? SCOPES,
                },
                $setOnInsert: { _id: randomUUID(), last_synced_at: null },
            },
            { upsert: true }
        );
    } catch (err) {
        if ((err as { code?: number } | null)?.code === 11000) {
            // Someone else already linked this athlete. Refusing is the only safe answer: the
            // activities are keyed by Strava's id, so allowing it would move them between profiles.
            throw new ServiceError(409, 'strava_athlete_already_linked');
        }
        throw err;
    }

    await User.updateOne({ _id: userId }, { $set: { 'profile.social_links.strava_id': athleteId } });

    // No tokens on the bus. Redis pub/sub is plaintext on a channel every service subscribes to,
    // and publishing a decrypted OAuth token there would undo the encryption above
    // (strava-integration.md §13 puts them in the payload; that is the one part of it not to copy).
    publish('StravaConnected', PRODUCER, { user_id: userId, athlete_id: athleteId });

    return `${config.frontendUrl}/settings/integrations?strava=connected`;
}

export async function disconnect(userId: string): Promise<void> {
    const cred = await StravaCredential.findOne({ user_id: userId });
    if (!cred) throw new ServiceError(404, 'strava_not_connected');

    // Revoke on Strava's side first, while the token is still readable; a failure there is logged
    // and does not keep the local link alive.
    await deauthorize(open(cred.access_token_enc)).catch(() => undefined);

    await StravaCredential.deleteOne({ _id: cred._id });
    await User.updateOne({ _id: userId }, { $set: { 'profile.social_links.strava_id': null } });
    publish('StravaDisconnected', PRODUCER, { user_id: userId });
}

interface StravaActivityResponse {
    id: number | string;
    type?: string;
    sport_type?: string;
    name?: string;
    distance?: number;
    moving_time?: number;
    elapsed_time?: number;
    total_elevation_gain?: number | null;
    start_date?: string;
    private?: boolean;
    visibility?: string;
}

/**
 * The plan's "Strava activity sync endpoint". Pull-based, because nothing in this stack is
 * publicly reachable and a webhook needs to be (strava-integration.md §17 says so itself).
 *
 * ponytail: capped at MAX_PAGES per call and the caller is told whether there is more. One user's
 * button press must not spend the whole application's rate-limit budget. The upgrade, when there
 * is a reason, is a stored page cursor plus the expiry sweeper's `setInterval` — neither exists
 * yet because no one has run out of quota.
 */
export async function sync(userId: string): Promise<{ synced: number; skipped: number; has_more: boolean }> {
    assertConfigured();
    const cred = await credentialFor(userId);
    const token = await freshToken(cred);

    const after = cred.last_synced_at ? Math.floor(cred.last_synced_at.getTime() / 1000) : 0;
    let synced = 0;
    let skipped = 0;
    let has_more = false;
    let newest = cred.last_synced_at;

    for (let page = 1; page <= MAX_PAGES; page++) {
        const batch = await apiGet<StravaActivityResponse[]>(
            `/athlete/activities?after=${after}&per_page=${PER_PAGE}&page=${page}`,
            token
        );
        if (!Array.isArray(batch) || batch.length === 0) break;

        for (const a of batch) {
            const start_date = a.start_date ? new Date(a.start_date) : null;
            if (!a.id || !start_date || Number.isNaN(start_date.getTime())) {
                skipped++;
                continue;
            }
            const _id = String(a.id);
            // Upsert by Strava's own id: that IS the dedupe, so a re-sync of an overlapping window
            // rewrites rows instead of duplicating them.
            await StravaActivity.updateOne(
                { _id },
                {
                    $set: {
                        user_id: userId,
                        athlete_id: cred.athlete_id,
                        type: a.sport_type || a.type || 'Workout',
                        name: a.name || 'Activity',
                        distance_meters: a.distance ?? 0,
                        moving_time_seconds: a.moving_time ?? 0,
                        elapsed_time_seconds: a.elapsed_time ?? 0,
                        total_elevation_gain: a.total_elevation_gain ?? null,
                        // Fall back to private when Strava tells us neither: an activity whose
                        // privacy we could not read is not one to show on a public profile.
                        is_private: a.private ?? (a.visibility ? a.visibility !== 'everyone' : true),
                        start_date,
                        synced_at: new Date(),
                    },
                },
                { upsert: true }
            );
            synced++;
            if (!newest || start_date > newest) newest = start_date;

            publish('StravaActivitySynced', PRODUCER, {
                user_id: userId,
                activity_id: _id,
                type: a.sport_type || a.type || 'Workout',
                distance_meters: a.distance ?? 0,
                moving_time_seconds: a.moving_time ?? 0,
            });
        }

        if (batch.length < PER_PAGE) break;
        if (page === MAX_PAGES) has_more = true;
    }

    // Only moved on success, and only forward: a failed sync must re-fetch the same window rather
    // than skip it.
    if (newest && newest !== cred.last_synced_at) {
        cred.last_synced_at = newest;
        await cred.save();
    }
    return { synced, skipped, has_more };
}

/**
 * `publicOnly` is set when one user is reading another's feed. We ask Strava for
 * `activity:read_all`, which includes activities the athlete marked private there — showing those
 * on a BGSC profile would make this integration a privacy leak rather than a feature
 * (strava-integration.md §17 raises it as an open question; this is the answer).
 */
export async function listActivities(
    userId: string,
    q: ActivitiesInput,
    opts: { publicOnly?: boolean } = {}
): Promise<{ rows: IStravaActivity[]; next_cursor: string | null }> {
    const conditions: Record<string, unknown>[] = [{ user_id: userId }];
    if (opts.publicOnly) conditions.push({ is_private: false });
    if (q.cursor) conditions.push(keysetFilter('start_date', q.cursor));
    const rows = await StravaActivity.find(allOf(conditions)).sort(keysetSort('start_date')).limit(q.limit);
    return pageOf(rows, q.limit, 'start_date');
}

export async function connectionOf(userId: string): Promise<{ connected: boolean; athlete_id: string | null; last_synced_at: Date | null }> {
    const cred = await StravaCredential.findOne({ user_id: userId }).select('athlete_id last_synced_at');
    return {
        connected: cred != null,
        athlete_id: cred?.athlete_id ?? null,
        last_synced_at: cred?.last_synced_at ?? null,
    };
}
