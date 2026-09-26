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
import { apiGet, assertConfigured, credentialFor, deauthorize, exchange, freshToken, open, reauthRequired, seal } from './tokens';

/**
 * Strava account linking. A CONNECTION, never a login method: the caller already holds a BGSC
 * session before any of this runs (Spec §9.1, §12.4 "Connect / Disconnect Strava").
 *
 * Scope is the two MVP plan lines — "Strava OAuth integration (basic)" and "Strava activity sync
 * endpoint". Webhooks, the nightly batch job and points for activities are out;
 * Spec §14's own scope table lists the whole integration as
 * excluded from MVP, so this stays deliberately small.
 */

const PRODUCER = 'challenge-service';
const SCOPES = 'activity:read_all,profile:read_all';
/** Bound one sync: Strava allows 200 requests / 15 min for the whole application. */
const MAX_PAGES = 3;
const PER_PAGE = 100;

/**
 * The OAuth `state`: a short-lived HMAC token naming the BGSC user who started the flow
 * (RFC 6749 §10.12). Signed rather than stored, so it needs no session store.
 *
 * A signature alone does NOT bind the flow to the person finishing it: an attacker could start a
 * connect as themselves and hand the victim the authorize URL, and a callback that trusted `sub`
 * bound the victim's Strava athlete — and their private activities — to the attacker's account.
 * So the callback no longer links anything. It bounces the browser to the app, and the link is
 * completed by `POST /strava/link`, an AUTHENTICATED request whose caller must be `sub` (`link()`).
 * The victim's app would post with the victim's session, and the state names the attacker.
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

/** Where every callback outcome sends the browser. */
export const settingsUrl = (params: Record<string, string>): string =>
    `${config.frontendUrl}/settings/integrations?${new URLSearchParams(params).toString()}`;

/**
 * The public callback's whole job: check the state is ours and still alive (so a forged or stale
 * one is refused before the app sees it), then hand `code`, `state` and the GRANTED `scope` to the
 * app, which completes the link with its own session. Writes nothing.
 *
 * In the URL FRAGMENT, not the query: a fragment is never sent to a server, so the one-time code
 * stays out of the frontend host's access logs and out of any `Referer` the settings page emits.
 */
export function callbackTarget(code: string, state: string | undefined, scope: string | undefined): string {
    verifyState(state);
    assertConfigured();
    const secret = new URLSearchParams({ code, state: state!, scope: scope ?? '' });
    return `${settingsUrl({ strava: 'authorized' })}#${secret.toString()}`;
}

/** The athlete granted something that lets us read activities. `read_all` contains `read`. */
const canReadActivities = (scope: string): boolean => /(^|,)activity:read(_all)?(,|$)/.test(scope);

/**
 * Spend a code we are refusing, so it cannot be replayed within its lifetime: exchanging it is
 * what spends it. The grant it produced is revoked only when that athlete is linked to nobody here:
 * Strava's deauthorize revokes EVERY token the app holds for the athlete, so it would also cut an
 * existing link (a victim's who followed a forwarded authorize URL, or the caller's own).
 * Best-effort — the refusal stands whatever Strava answers.
 */
async function burn(code: string): Promise<void> {
    try {
        const tokens = await exchange({ code, grant_type: 'authorization_code' });
        const athleteId = tokens.athlete?.id;
        if (athleteId && !(await StravaCredential.exists({ athlete_id: String(athleteId) }))) {
            await deauthorize(tokens.access_token);
        }
    } catch {
        // Already used, expired, or Strava is down: in every case it is not usable by anyone else.
    }
}

export async function link(userId: string, code: string, state: string, scope: string): Promise<void> {
    // The binding: the session completing the link must be the one that started it. A mismatch is
    // the forwarded-URL attack in progress; the code in hand is the victim's, so it is burnt.
    if (verifyState(state) !== userId) {
        await burn(code);
        throw new ServiceError(400, 'oauth_state_mismatch');
    }
    // The athlete can untick scopes on Strava's consent screen, and the token response does not
    // say which were kept — the callback query does. Without an activity scope every sync would
    // fail, so a link that cannot do its one job is refused up front (and its grant revoked).
    if (!canReadActivities(scope)) {
        await burn(code);
        throw new ServiceError(409, 'strava_scope_insufficient');
    }

    const tokens = await exchange({ code, grant_type: 'authorization_code' });
    const athleteId = String(tokens.athlete?.id ?? '');
    if (!athleteId) throw new ServiceError(502, 'strava_athlete_missing');

    // Someone else's athlete: refuse BEFORE touching this user's current link (the unique index
    // below stays the real guard; this only keeps a refused relink from costing the old one).
    // Not deauthorized: that would revoke the owner's tokens too, and the code is already spent.
    if (await StravaCredential.exists({ athlete_id: athleteId, user_id: { $ne: userId } })) {
        throw new ServiceError(409, 'strava_athlete_already_linked');
    }
    // Relinking to a DIFFERENT athlete is a disconnect plus a connect: the old athlete's activities
    // and sync watermark belong to the old link, and keeping the watermark would skip the new
    // athlete's whole history.
    const current = await StravaCredential.findOne({ user_id: userId }).select('athlete_id');
    if (current && current.athlete_id !== athleteId) await unlink(userId);

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
                    scope,
                    // A fresh grant may sync at once (e.g. right after a reauth-required reconnect).
                    last_sync_started_at: null,
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
}

/**
 * Everything a link left behind: Strava-side grant (best-effort), the credential, the synced
 * activities and the profile's `strava_id`. Shared by disconnect and account deletion.
 * Returns whether there was a credential at all.
 */
export async function unlink(userId: string): Promise<boolean> {
    const cred = await StravaCredential.findOne({ user_id: userId });
    if (cred) {
        // Revoke on Strava's side first, while the token may still be readable. `open()` is inside
        // the try: a token sealed under a key we no longer have used to throw before anything was
        // deleted, and the link could then never be removed.
        let token: string | null = null;
        try {
            token = open(cred.access_token_enc);
        } catch {
            console.error(`[${PRODUCER}] strava token for ${userId} unreadable; skipping remote deauthorize`);
        }
        if (token) await deauthorize(token);
        await StravaCredential.deleteOne({ _id: cred._id });
    }
    // Always, even with no credential: a sync that raced a disconnect may have written rows after
    // the credential went (see `sync`), and a feed of a disconnected account is not one to keep.
    await StravaActivity.deleteMany({ user_id: userId });
    if (cred) {
        await User.updateOne({ _id: userId }, { $set: { 'profile.social_links.strava_id': null } });
        publish('StravaDisconnected', PRODUCER, { user_id: userId });
    }
    return cred != null;
}

export async function disconnect(userId: string): Promise<void> {
    if (!(await unlink(userId))) throw new ServiceError(404, 'strava_not_connected');
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
 * Strava's `private` is only the "only me" case: a `followers_only` activity arrives with
 * `private: false`, so `private ?? …` published it to every BGSC user. Public means
 * `visibility: 'everyone'` (or, absent visibility, an explicit `private: false`); anything we
 * cannot read is private.
 */
export function isPrivate(a: Pick<StravaActivityResponse, 'private' | 'visibility'>): boolean {
    if (a.private === true) return true;
    if (a.visibility != null) return a.visibility !== 'everyone';
    return a.private !== false;
}

/** One sync per user per window. Each sync spends up to MAX_PAGES + 1 of the app-wide budget. */
export const SYNC_COOLDOWN_MS = 5 * 60_000;

/**
 * The per-user cooldown, as a compare-and-swap on `last_sync_started_at`: a user hammering the
 * button (or a script with a valid session) used to spend the whole application's 200-per-15-min
 * Strava budget for everybody. Claimed at START, not on success: a failing sync costs Strava calls
 * too. `null` also matches a row written before the field existed.
 */
async function claimSync(userId: string) {
    const now = Date.now();
    const cred = await StravaCredential.findOneAndUpdate(
        {
            user_id: userId,
            $or: [{ last_sync_started_at: null }, { last_sync_started_at: { $lte: new Date(now - SYNC_COOLDOWN_MS) } }],
        },
        { $set: { last_sync_started_at: new Date(now) } },
        { returnDocument: 'after' }
    );
    if (cred) return cred;
    const existing = await credentialFor(userId); // 404 strava_not_connected when there is none
    const retry_after = Math.max(1, Math.ceil(((existing.last_sync_started_at?.getTime() ?? now) + SYNC_COOLDOWN_MS - now) / 1000));
    throw new ServiceError(429, 'sync_cooldown', { retry_after });
}

/**
 * The MVP plan's "Strava activity sync endpoint". Pull-based, because nothing in this stack is
 * publicly reachable and a webhook needs to be (strava-integration.md §17 says so itself).
 *
 * ponytail: capped at MAX_PAGES per call and the caller is told whether there is more. One user's
 * button press must not spend the whole application's rate-limit budget. The upgrade, when there
 * is a reason, is a stored page cursor plus the expiry sweeper's `setInterval` — neither exists
 * yet because no one has run out of quota.
 */
export async function sync(userId: string): Promise<{ synced: number; skipped: number; has_more: boolean }> {
    assertConfigured();
    const cred = await claimSync(userId);
    // Linked before the granted scope was stored, or with the activity box unticked.
    if (cred.scope && !canReadActivities(cred.scope)) throw reauthRequired();
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
            const type = a.sport_type || a.type || 'Workout';
            // Upsert by Strava's own id: that IS the dedupe, so a re-sync of an overlapping window
            // rewrites rows instead of duplicating them.
            const written = await StravaActivity.updateOne(
                { _id },
                {
                    $set: {
                        user_id: userId,
                        athlete_id: cred.athlete_id,
                        type,
                        name: a.name || 'Activity',
                        distance_meters: a.distance ?? 0,
                        moving_time_seconds: a.moving_time ?? 0,
                        elapsed_time_seconds: a.elapsed_time ?? 0,
                        total_elevation_gain: a.total_elevation_gain ?? null,
                        is_private: isPrivate(a),
                        start_date,
                        synced_at: new Date(),
                    },
                },
                { upsert: true }
            );
            synced++;
            if (!newest || start_date > newest) newest = start_date;

            // Only a genuinely new row is news. A rewrite (overlapping window, two syncs at once)
            // republished the same activity, and a future activity-points consumer would pay twice.
            if (written.upsertedCount === 1) {
                publish('StravaActivitySynced', PRODUCER, {
                    user_id: userId,
                    activity_id: _id,
                    type,
                    distance_meters: a.distance ?? 0,
                    moving_time_seconds: a.moving_time ?? 0,
                });
            }
        }

        if (batch.length < PER_PAGE) break;
        if (page === MAX_PAGES) has_more = true;
    }

    // Only moved on success, and only forward: a failed sync must re-fetch the same window rather
    // than skip it. A query update, not `cred.save()`: the document may be gone if a disconnect
    // landed mid-sync, and `save()` on a deleted document is a DocumentNotFoundError 500.
    const still = await StravaCredential.updateOne({ _id: cred._id }, { $set: { last_synced_at: newest } });
    if (still.matchedCount === 0) {
        // Disconnected while we were writing: what we just wrote belongs to no link.
        await StravaActivity.deleteMany({ user_id: userId });
        throw new ServiceError(404, 'strava_not_connected');
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

/**
 * Another user's feed, for the profile screen: public activities only, and only when the profile
 * itself is public and the account is alive. A private or deleted profile is 404 — the same
 * answer as a user that does not exist, so the feed cannot be used to probe either.
 */
export async function feedOf(
    targetId: string,
    viewerId: string,
    q: ActivitiesInput
): Promise<{ rows: IStravaActivity[]; next_cursor: string | null }> {
    if (targetId === viewerId) return listActivities(targetId, q);
    const visible = await User.exists({ _id: targetId, deleted_at: null, 'settings.privacy.is_profile_public': { $ne: false } });
    if (!visible) throw new ServiceError(404, 'user_not_found');
    return listActivities(targetId, q, { publicOnly: true });
}

export async function connectionOf(userId: string): Promise<{ connected: boolean; athlete_id: string | null; last_synced_at: Date | null }> {
    const cred = await StravaCredential.findOne({ user_id: userId }).select('athlete_id last_synced_at');
    return {
        connected: cred != null,
        athlete_id: cred?.athlete_id ?? null,
        last_synced_at: cred?.last_synced_at ?? null,
    };
}
