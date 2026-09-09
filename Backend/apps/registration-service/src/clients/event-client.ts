import { config } from '@bgsc/shared';

/**
 * The one thing this service cannot do for itself: reserve capacity on an event.
 *
 * `events` is written by the Event Service alone (relationships.md §1), and the seat count is a
 * write — so this is HTTP, not a direct read, even though we share the database. Everything else
 * this service needs from another domain is a read, and reads go straight to the model.
 *
 * Lives here rather than in @bgsc/shared because it has exactly one caller and encodes an
 * Event-domain contract; shared is models, middleware, bus and config only.
 */

/** Failure reasons agreed with BE-1 (be2-registration-service-plan.md §12.1). */
export type ReserveFailure = 'capacity_full' | 'waitlist_disabled' | 'event_closed' | 'event_not_found';

export interface ReserveSeatResult {
    reserved: boolean;
    reason?: ReserveFailure;
}

const TIMEOUT_MS = 5000;

/**
 * A refusal (`reserved: false`) is an answer; anything else throws. The caller must be able to
 * tell "the event says no" from "we never reached the event", because the first is a waitlist and
 * the second is a retry.
 */
async function call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${config.services.event}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': config.internalToken },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
        throw new Error(`event-service ${path} responded ${res.status}`);
    }
    return (await res.json()) as T;
}

/**
 * `idempotencyKey` is derived from the registration, not random: a retry after a timeout must
 * present the same key or the Event Service counts the seat twice (plan §D1).
 */
export function reserveSeat(
    eventId: string,
    registrationId: string,
    idempotencyKey: string
): Promise<ReserveSeatResult> {
    return call<ReserveSeatResult>(`/internal/events/${eventId}/reserve-seat`, {
        registration_id: registrationId,
        idempotency_key: idempotencyKey,
    });
}

export function releaseSeat(eventId: string, registrationId: string): Promise<{ released: boolean }> {
    return call<{ released: boolean }>(`/internal/events/${eventId}/release-seat`, {
        registration_id: registrationId,
    });
}
