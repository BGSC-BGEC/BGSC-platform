import { ANNOUNCEMENT_CATEGORY, AnnouncementCategory, config } from '@bgsc/shared';

/**
 * WhatsApp Business (Cloud) API provider (Spec §9.4, plan §5.1).
 *
 * One function and one predicate, so the rest of the service never knows which provider is behind
 * it. Unconfigured is a first-class state, not an error: with no credentials every dispatch row
 * resolves `skipped / not_configured` and no HTTP call is made — the same shape as `/strava/*`
 * answering `503 strava_not_configured`, and the state this repo ships in.
 *
 * Note what the Cloud API actually is (plan §0.3): it addresses **phone numbers**, and has no
 * public endpoint for posting into a WhatsApp group. Spec §9.4's "tag maps to a group ID" is
 * therefore not implementable as written, so `destinationFor()` returns an **opaque destination**
 * that this module hands to the API unchanged. Swap this file for another provider and the map,
 * the ledger and the rate limit are all still correct.
 *
 * Two hygiene rules this module owns, because nothing downstream can fix them:
 *  - the access token never leaves here — not into a log line, not into a stored `error`;
 *  - destinations are PII (a phone number or group id) and are never written into a message body.
 */

const TIMEOUT_MS = 8000;
/** Provider failures are stored on a dispatch row, which caps `error` at 300. */
const ERROR_MAX = 240;

export class ProviderError extends Error {
    constructor(public readonly status: number | null, message: string) {
        super(message);
        this.name = 'ProviderError';
    }
}

export function isConfigured(): boolean {
    return Boolean(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
}

/**
 * Say what this deployment can actually do, once, at boot.
 *
 * A key in `WHATSAPP_GROUP_MAP` that is not an announcement category — `bgecc` for `bgec` — is
 * never looked up, so that tag simply never broadcasts and every dispatch row for it reads
 * `no_group_mapped`. Nothing else in the system would ever say why. The map cannot be validated in
 * `config/env.ts` without that shared module importing a model, so it is checked here, by the one
 * service that uses it.
 */
export function reportConfiguration(): void {
    const tag = '[notification-service]';
    if (!isConfigured()) {
        console.log(`${tag} WhatsApp is not configured; every broadcast will resolve 'skipped'.`);
        return;
    }

    const known = new Set<string>(ANNOUNCEMENT_CATEGORY);
    const mapped = Object.keys(config.whatsapp.groupMap);
    const unknown = mapped.filter((c) => !known.has(c));

    console.log(
        `${tag} WhatsApp configured: ${mapped.length - unknown.length} category destinations, ` +
            `${config.whatsapp.ratePerHour}/hour per tag.`
    );
    if (unknown.length > 0) {
        console.error(
            `${tag} WHATSAPP_GROUP_MAP has ${unknown.length} key(s) that are not announcement ` +
                `categories and will never be used: ${unknown.join(', ')}`
        );
    }
}

/** The destination a category broadcasts to, or null when the deployment has not mapped it. */
export function destinationFor(category: AnnouncementCategory): string | null {
    return config.whatsapp.groupMap[category] ?? null;
}

/**
 * Send one text message. Resolves with the provider's message id; throws `ProviderError` on
 * anything else.
 *
 * The error message is built from the status and a clipped body. Meta echoes the destination and
 * request metadata in its error payloads, so the clip is a privacy measure as much as a length one
 * — and the Authorization header is never part of what is read back.
 */
export async function sendText(to: string, body: string): Promise<string> {
    const url = `${config.whatsapp.apiBase}/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.whatsapp.accessToken}`,
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                // The API auto-links URLs when previews are on, which turns an announcement body
                // into a link card. Off, so what we send is what was written.
                text: { preview_url: false, body },
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (err) {
        // A timeout or a DNS failure. Retryable, and it never carries a response to leak.
        throw new ProviderError(null, `unreachable: ${(err as Error).message}`.slice(0, ERROR_MAX));
    }

    const text = await res.text().catch(() => '');
    if (!res.ok) {
        throw new ProviderError(res.status, `http ${res.status}: ${text}`.slice(0, ERROR_MAX));
    }

    try {
        const parsed = JSON.parse(text) as { messages?: { id?: string }[] };
        const id = parsed.messages?.[0]?.id;
        // A 200 with no message id is a contract the provider broke. Treating it as success would
        // record a send nobody can trace; treating it as failure retries something that may have
        // gone out. Recorded as sent-but-untraceable is the lesser of those, so: id or a marker.
        return id ?? 'unknown';
    } catch {
        return 'unknown';
    }
}
