import { config } from '../config/env';

/**
 * The one way a service calls another service's `/internal` route.
 *
 * Every service wraps its replies in `{ success: true, data }` (`successEnvelope`), and the first
 * hand-written client read `result.reserved` off the wrapper — `undefined`, every time, so every
 * event registration settled as `rejected` (backend-audit-2026-09-26 C1). Unwrapping lives here so no
 * caller can forget it again.
 *
 * Failure is typed, and the distinction matters:
 *  - `status >= 400`: the other service answered and refused. Its `error` code is carried through.
 *    Never "fall back" on one of these — a refusal is a decision, not an outage.
 *  - `status === 0`: we never got an answer (refused connection, timeout). The call MAY have been
 *    applied. The only safe recovery is retrying with the same idempotency key, never writing the
 *    other service's collection directly.
 */

export class InternalCallError extends Error {
    constructor(
        /** HTTP status, or 0 when no response arrived (outcome unknown). */
        public status: number,
        public code: string,
        public details?: unknown
    ) {
        super(`internal call failed: ${status} ${code}`);
        this.name = 'InternalCallError';
        Object.setPrototypeOf(this, InternalCallError.prototype);
    }

    /** True when the request may or may not have been applied on the other side. */
    get outcomeUnknown(): boolean {
        return this.status === 0 || this.status >= 500;
    }
}

export interface InternalCallOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    /** Default 5000ms. A hung neighbour must not hang the caller's request. */
    timeoutMs?: number;
}

/** `{ success: true, data }` -> `data`; anything else is returned as-is. */
export function unwrapEnvelope<T>(body: unknown): T {
    if (body !== null && typeof body === 'object' && (body as { success?: unknown }).success === true && 'data' in (body as object)) {
        return (body as { data: T }).data;
    }
    return body as T;
}

export async function callInternal<T>(baseUrl: string, path: string, opts: InternalCallOptions = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${baseUrl}${path}`, {
            method: opts.method ?? 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Token': config.internalToken },
            body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
            signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
        });
    } catch (err) {
        const code = (err as Error)?.name === 'TimeoutError' ? 'timeout' : 'unreachable';
        throw new InternalCallError(0, code);
    }

    // A 2xx whose body cannot be read (the abort landing mid-body, a proxy's HTML) is NOT a success
    // with `null` data — the other side may well have applied the call. Outcome unknown (audit #2).
    let parsed: unknown;
    let readFailed = false;
    try {
        parsed = res.status === 204 ? null : await res.json();
    } catch {
        parsed = null;
        readFailed = true;
    }
    if (!res.ok) {
        const body = (parsed ?? {}) as { error?: unknown; details?: unknown; fields?: unknown };
        throw new InternalCallError(
            res.status,
            typeof body.error === 'string' ? body.error : `http_${res.status}`,
            // validate() answers `fields`, a ServiceError answers `details`: carry whichever exists.
            body.details ?? body.fields
        );
    }
    if (readFailed) throw new InternalCallError(0, 'bad_response');
    return unwrapEnvelope<T>(parsed);
}
