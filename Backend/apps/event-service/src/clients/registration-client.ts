import { config, Team } from '@bgsc/shared';

const TIMEOUT_MS = 5000;

/**
 * Service-to-service client calling Registration Service (:3004) for auction mutations.
 * If Registration Service is unreachable (e.g. isolated test environments), falls back to direct
 * database atomic updates on the shared `teams` collection so operations never silently fail.
 */

export async function debitTeamPurse(teamId: string, amount: number): Promise<boolean> {
    try {
        const res = await fetch(`${config.services.registration}/internal/teams/${teamId}/debit-purse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': config.internalToken,
            },
            body: JSON.stringify({ amount }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return true;
        console.warn(`[event-service] registration service debit-purse responded ${res.status}, falling back to atomic DB update`);
    } catch {
        // Fallback to direct DB update
    }

    const team = await Team.findById(teamId);
    if (!team || !team.auction) return false;
    const remaining = team.auction.purse_total - team.auction.purse_spent;
    if (remaining < amount) return false;

    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            'auction.purse_spent': { $lte: team.auction.purse_total - amount },
        },
        {
            $inc: { 'auction.purse_spent': amount, 'auction.version': 1 },
        },
        { returnDocument: 'after' }
    );
    return Boolean(updated);
}

export async function addAuctionTeamMember(
    teamId: string,
    userId: string,
    registrationId: string,
    playerSnapshot?: { display_name: string; avatar_url: string | null }
): Promise<boolean> {
    try {
        const res = await fetch(`${config.services.registration}/internal/teams/${teamId}/add-member`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': config.internalToken,
            },
            body: JSON.stringify({ user_id: userId, registration_id: registrationId }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return true;
        console.warn(`[event-service] registration service add-member responded ${res.status}, falling back to atomic DB update`);
    } catch {
        // Fallback to direct DB update
    }

    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            'members.user_id': { $ne: userId },
        },
        {
            $push: {
                members: {
                    user_id: userId,
                    display_name: playerSnapshot?.display_name || 'Auction Player',
                    avatar_url: playerSnapshot?.avatar_url || null,
                    registration_id: registrationId,
                    joined_at: new Date(),
                    acquired_via: 'auction',
                },
            },
        },
        { returnDocument: 'after' }
    );
    return Boolean(updated);
}
