import { InternalCallError, callInternal, config } from '@bgsc/shared';

/**
 * The one thing this service cannot do for itself: hold capacity on an event.
 *
 * `events` is written by the Event Service alone (relationships.md §1), and the seat count is a
 * write — so this is HTTP, not a direct read, even though we share the database.
 *
 * Contract: reserve and release are idempotent per registration id — the
 * Event Service keeps `seat_holders[]` — so retrying either with the same registration is always
 * safe. `callInternal` unwraps the `{ success, data }` envelope; reading `result.reserved` off the
 * wrapper is what made every registration `rejected` (backend-audit-2026-09-26 C1).
 */

export type ReserveFailure = 'capacity_full' | 'waitlist_disabled' | 'event_closed' | 'not_open' | 'event_not_found';

export type ReserveSeatResult = { reserved: true } | { reserved: false; reason: ReserveFailure | string };

/** What a registration becomes when the event says no. Only `capacity_full` means "there is a waitlist". */
export const settleRefusal = (reason: string): 'waitlisted' | 'rejected' =>
    reason === 'capacity_full' ? 'waitlisted' : 'rejected';

/** Throws `InternalCallError`: `outcomeUnknown` means retry with the same registration, never assume. */
export async function reserveSeat(eventId: string, registrationId: string): Promise<ReserveSeatResult> {
    const result = await callInternal<{ reserved?: unknown; reason?: unknown }>(
        config.services.event,
        `/internal/events/${encodeURIComponent(eventId)}/reserve-seat`,
        { body: { registration_id: registrationId, idempotency_key: registrationId } }
    );
    if (result?.reserved === true) return { reserved: true };
    return { reserved: false, reason: typeof result?.reason === 'string' ? result.reason : 'seat_unavailable' };
}

export async function releaseSeat(eventId: string, registrationId: string): Promise<{ released: boolean }> {
    const result = await callInternal<{ released?: unknown }>(
        config.services.event,
        `/internal/events/${encodeURIComponent(eventId)}/release-seat`,
        { body: { registration_id: registrationId } }
    );
    return { released: result?.released === true };
}

/**
 * Release that never throws, retried once when the outcome is unknown (safe: release is idempotent).
 * `released` is true only when the Event Service confirmed it gave a seat back — which is the only
 * thing `RegistrationCancelled.freed_seat` may claim (H9).
 *
 * ponytail: one retry, then logged. A seat still held after that is the Event Service's recount to
 * repair; a queue of pending releases is the upgrade if that ever happens in practice.
 */
export async function releaseSeatQuietly(eventId: string, registrationId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            return (await releaseSeat(eventId, registrationId)).released;
        } catch (err) {
            if (!(err instanceof InternalCallError) || !err.outcomeUnknown || attempt === 1) {
                console.error(`[registration-service] release-seat failed for ${registrationId}:`, err);
                return false;
            }
        }
    }
    return false;
}
