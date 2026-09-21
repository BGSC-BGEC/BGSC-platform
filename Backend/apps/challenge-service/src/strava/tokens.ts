import { IStravaCredential, ServiceError, StravaCredential, config } from '@bgsc/shared';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Strava token storage and refresh.
 *
 * The stored tokens are bearer credentials for somebody's third-party account: a database dump or
 * a mis-scoped read must not be a set of live Strava sessions. AES-256-GCM from node's `crypto` —
 * authenticated, stdlib, no dependency (strava-integration.md §6.1 asks for the same cipher).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const KEY_HEX = /^[0-9a-f]{64}$/i;

let cachedKey: Buffer | null = null;

/**
 * A configured 64-hex key, or a development key derived from the JWT secret.
 *
 * The derived key is deterministic, so a dev database survives a restart — and is exactly why it
 * is refused in production: predictable key material on a third-party bearer token is not a
 * convenience worth shipping. Same shape as `assertInternalTokenConfigured` in the shared service
 * bootstrap: fatal at boot, never a surprise at the first request.
 */
export function tokenKey(): Buffer {
    if (cachedKey) return cachedKey;

    const configured = config.strava.tokenKey;
    if (configured) {
        if (!KEY_HEX.test(configured)) {
            throw new Error('STRAVA_TOKEN_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)');
        }
        cachedKey = Buffer.from(configured, 'hex');
        return cachedKey;
    }

    if (config.nodeEnv === 'production') {
        throw new Error('STRAVA_TOKEN_ENCRYPTION_KEY must be set in production');
    }
    cachedKey = scryptSync(config.jwt.accessSecret, 'bgsc.strava.token.v1', 32);
    return cachedKey;
}

/** Fails the boot rather than the first connect, so a misconfigured deploy never half-works. */
export function assertStravaKeyConfigured(): void {
    if (config.strava.clientId && config.strava.clientSecret) tokenKey();
    else if (config.nodeEnv === 'production' && config.strava.tokenKey) tokenKey();
}

/** Test seam: the selfcheck flips NODE_ENV and the key between cases. */
export function resetKeyCache(): void {
    cachedKey = null;
}

export function seal(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, tokenKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
}

export function open(sealed: string): string {
    const [ivHex, tagHex, dataHex] = sealed.split(':');
    if (!ivHex || !tagHex || !dataHex) throw new ServiceError(500, 'strava_token_unreadable');
    const decipher = createDecipheriv(ALGORITHM, tokenKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    // `final()` throws when the tag does not verify — tampering and a wrong key are the same
    // answer here, which is the point of an AEAD.
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/* ------------------------------------------------------------------ */

const STRAVA_API = 'https://www.strava.com';
/** Refresh inside this margin rather than on expiry: a token that dies mid-request is a 401. */
const REFRESH_MARGIN_MS = 5 * 60_000;

export function assertConfigured(): void {
    if (!config.strava.clientId || !config.strava.clientSecret) {
        throw new ServiceError(503, 'strava_not_configured');
    }
}

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    /** Strava returns epoch seconds. */
    expires_at: number;
    athlete?: { id: number | string };
    scope?: string;
}

export async function exchange(body: Record<string, string>): Promise<TokenResponse> {
    assertConfigured();
    const res = await fetch(`${STRAVA_API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: config.strava.clientId,
            client_secret: config.strava.clientSecret,
            ...body,
        }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new ServiceError(res.status === 429 ? 503 : 401, 'strava_token_exchange_failed');
    return (await res.json()) as TokenResponse;
}

/**
 * The access token for a credential, refreshed if it is about to die. Returns the plaintext token
 * and never stores it — the row keeps only the sealed copy.
 */
export async function freshToken(cred: IStravaCredential): Promise<string> {
    if (cred.expires_at.getTime() - Date.now() > REFRESH_MARGIN_MS) return open(cred.access_token_enc);

    const refreshed = await exchange({
        grant_type: 'refresh_token',
        refresh_token: open(cred.refresh_token_enc),
    });

    cred.access_token_enc = seal(refreshed.access_token);
    cred.refresh_token_enc = seal(refreshed.refresh_token);
    cred.expires_at = new Date(refreshed.expires_at * 1000);
    await cred.save();
    return refreshed.access_token;
}

/**
 * One authenticated GET against Strava's API.
 *
 * A 429 is surfaced as a 503 with the upstream `Retry-After`, not swallowed and not a 500: Strava
 * allows 200 requests per 15 minutes for the whole application, so hitting the ceiling is an
 * expected state the client can act on (strava-integration.md §9.2).
 */
export async function apiGet<T>(path: string, token: string): Promise<T> {
    const res = await fetch(`${STRAVA_API}/api/v3${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
        throw new ServiceError(503, 'strava_rate_limited', { retry_after: res.headers.get('retry-after') });
    }
    if (res.status === 401) throw new ServiceError(401, 'strava_token_rejected');
    if (!res.ok) throw new ServiceError(502, 'strava_api_failed');
    return (await res.json()) as T;
}

/** Best-effort revocation on Strava's side; the local row is gone either way. */
export async function deauthorize(token: string): Promise<void> {
    try {
        await fetch(`${STRAVA_API}/oauth/deauthorize`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        });
    } catch (err) {
        console.error('[challenge-service] strava deauthorize failed:', (err as Error).message);
    }
}

/** Convenience for callers that only have a user id. */
export async function credentialFor(user_id: string): Promise<IStravaCredential> {
    const cred = await StravaCredential.findOne({ user_id });
    if (!cred) throw new ServiceError(404, 'strava_not_connected');
    return cred;
}
