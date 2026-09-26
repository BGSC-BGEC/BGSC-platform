import { InternalCallError, ServiceError, callInternal, config } from '@bgsc/shared';

/**
 * Registration Service (:3004) owns `teams` and `form_submissions` (relationships.md §1). Everything
 * this service needs to change there goes through its `/internal` routes.
 *
 * There is no fallback. The old client wrote `teams` directly on ANY failure — a timeout after the
 * debit had landed debited twice, and a deliberate `team_full` refusal was overridden by a raw
 * `$push` (audit Sep 26). Every mutating call carries a request id derived from the thing it
 * settles, so a retry after "outcome unknown" is safe and a second debit is impossible.
 */

const base = () => config.services.registration;

/** A refusal keeps its status and code; "never got an answer" is a 503 the caller can retry. */
export function asServiceError(err: unknown): unknown {
    if (!(err instanceof InternalCallError)) return err;
    // 401/403 here means our service token was refused — a deployment fault, not the member's
    // session. Passing it through made the client log the user out.
    if (err.outcomeUnknown || err.status === 401 || err.status === 403) {
        return new ServiceError(503, 'registration_service_unavailable');
    }
    return new ServiceError(err.status, err.code, err.details);
}

export const debitTeamPurse = (teamId: string, amount: number, requestId: string) =>
    callInternal(base(), `/internal/teams/${encodeURIComponent(teamId)}/debit-purse`, {
        body: { amount, request_id: requestId },
    });

export const refundTeamPurse = (teamId: string, amount: number, requestId: string) =>
    callInternal(base(), `/internal/teams/${encodeURIComponent(teamId)}/refund-purse`, {
        body: { amount, request_id: requestId },
    });

/** `requestId` = `<lot>:<team>:add`; Registration records it with the `$push`, so a repeat is a 200. */
export const addAuctionTeamMember = (teamId: string, userId: string, registrationId: string, requestId: string) =>
    callInternal(base(), `/internal/teams/${encodeURIComponent(teamId)}/add-member`, {
        body: { user_id: userId, registration_id: registrationId, request_id: requestId },
    });

/** Idempotent: sets a purse only on teams that lack one, so overridden budgets survive. */
export const setAuctionPurses = (eventId: string, purseTotal: number) =>
    callInternal(base(), `/internal/events/${encodeURIComponent(eventId)}/auction-purses`, {
        body: { purse_total: purseTotal },
    });

export const setTeamAuctionBudget = (
    teamId: string,
    body: { purse_total: number; reason: string | null; overridden_by: string }
) =>
    callInternal<unknown>(base(), `/internal/teams/${encodeURIComponent(teamId)}/auction-budget`, {
        method: 'PATCH',
        body,
    });

export const recordAttendance = (body: {
    event_id: string;
    marked_by: string;
    attendances: { registration_id: string; attended: boolean }[];
}) =>
    callInternal<{ updated_count: number; skipped: string[] }>(base(), '/internal/registrations/attendance', {
        body,
        // One bulk call may touch 500 rows.
        timeoutMs: 15000,
    });

export const promoteRegistration = (registrationId: string, by: string) =>
    callInternal<unknown>(base(), `/internal/registrations/${encodeURIComponent(registrationId)}/promote`, {
        body: { by },
        // Promote calls back into reserve-seat and publishes; 5s cut that chain off mid-flight.
        timeoutMs: 12000,
    });
