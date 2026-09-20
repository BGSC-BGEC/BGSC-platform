import { config } from '@bgsc/shared';

/**
 * The one thing this service cannot do for itself: lock a team's roster.
 *
 * `teams` is written by the Registration Service alone (relationships.md §1), and a lock is a
 * write — so this is HTTP, not a direct save, even though we share the database
 * (adding-a-service.md §6.5). Validating the team before acceptance is a read, and reads go
 * straight to the model.
 *
 * Why lock at all: `member_user_ids` is snapshotted at acceptance and the Points Service pays
 * exactly that list (challenge-model.md §3.1). A roster that keeps moving afterwards produces
 * members who did the work and are paid nothing, with nothing in the participation recording it.
 */

const TIMEOUT_MS = 5000;

/**
 * Best-effort by design, and the only call in this service that swallows its failure.
 *
 * It runs AFTER the participation exists, so the payout roster is already frozen in our document.
 * An unreachable Registration Service therefore costs a team that can still be edited — confusing,
 * not wrong — and failing the acceptance instead would lose a participation over a lock.
 */
export async function lockTeam(teamId: string, lockedBy: string): Promise<boolean> {
    try {
        const res = await fetch(`${config.services.registration}/internal/teams/${teamId}/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Token': config.internalToken },
            body: JSON.stringify({ locked_by: lockedBy }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
            console.error(`[challenge-service] team lock ${teamId} responded ${res.status}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`[challenge-service] team lock ${teamId} unreachable:`, (err as Error).message);
        return false;
    }
}
