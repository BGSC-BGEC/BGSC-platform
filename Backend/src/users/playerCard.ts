import { IUser } from '../models/User';
import { FormSubmission } from '../models/Registration';
import { LeaderboardEntry } from '../models/Leaderboard';
import { ChallengeParticipation } from '../models/Challenge';

/**
 * Player card payload and rating (Spec §5.3, decision D1 in docs/be2-user-service-plan.md).
 *
 * Spec calls for a "Fixed Rating Section (computed metrics)" and gives no formula. These weights are
 * a first guess; `formula_version` is what makes them cheap to change — a new version plus a
 * recompute, never a migration.
 */

export const RATING_VERSION = 1;

export const RATING_WEIGHTS = {
    participation: 2,
    podium: 15,
    challenge: 5,
    /** Points contribute at 1/50th, so a season of points cannot drown out actual results. */
    points_divisor: 50,
} as const;

/** How long a cached rating is served before recomputing. */
export const RATING_TTL_MS = 5 * 60 * 1000;

export interface RatingInputs {
    participations: number;
    podiums: number;
    challenges: number;
    points_balance: number;
}

export interface RatingResult {
    rating: number;
    formula_version: number;
    computed_at: Date;
    inputs: RatingInputs;
}

/** Pure. No DB, no clock beyond the stamp — the whole point is that it is trivially checkable. */
export function computeRating(inputs: RatingInputs, now: Date = new Date()): RatingResult {
    const w = RATING_WEIGHTS;
    const rating =
        inputs.participations * w.participation +
        inputs.podiums * w.podium +
        inputs.challenges * w.challenge +
        Math.floor(inputs.points_balance / w.points_divisor);

    return { rating, formula_version: RATING_VERSION, computed_at: now, inputs };
}

/**
 * Three of the four inputs live in collections other services own. relationships.md §2 forbids
 * joins, so these are three independent counts.
 *
 * ponytail: recompute on read behind a 5-minute cache. If card reads get hot, recompute on
 * RegistrationCreated / EventCompleted / ChallengeCompleted / PointsEarned instead.
 */
export async function gatherRatingInputs(user: IUser): Promise<RatingInputs> {
    const [participations, podiums, challenges] = await Promise.all([
        FormSubmission.countDocuments({ 'user.user_id': user._id, status: 'confirmed' }),
        LeaderboardEntry.countDocuments({ 'participant.id': user._id, rank: { $ne: null, $lte: 3 } }),
        ChallengeParticipation.countDocuments({ member_user_ids: user._id, status: 'approved' }),
    ]);

    return { participations, podiums, challenges, points_balance: user.points_balance ?? 0 };
}

function cachedRating(user: IUser, now: Date): RatingResult | null {
    const stats = (user.player_card?.stats ?? {}) as Partial<RatingResult>;
    if (typeof stats.rating !== 'number' || stats.formula_version !== RATING_VERSION) return null;

    const at = stats.computed_at ? new Date(stats.computed_at) : null;
    if (!at || now.getTime() - at.getTime() > RATING_TTL_MS) return null;

    return { rating: stats.rating, formula_version: RATING_VERSION, computed_at: at, inputs: stats.inputs! };
}

/** Serves the cache when fresh, otherwise recomputes. `force` skips the cache. */
export async function ratingFor(user: IUser, force = false, now: Date = new Date()): Promise<RatingResult> {
    if (!force) {
        const hit = cachedRating(user, now);
        if (hit) return hit;
    }

    const result = computeRating(await gatherRatingInputs(user), now);

    // Cache write is best-effort: a failed write must not fail the card read.
    try {
        user.set('player_card.stats', { ...(user.player_card?.stats ?? {}), ...result });
        await user.save();
    } catch (err) {
        console.error('Failed to cache player card rating:', err);
    }

    return result;
}

export interface PlayerCardDTO {
    user_id: string;
    username: string;
    avatar_url: string | null;
    bio: string;
    interests: string[];
    card_tier: string;
    rating: number;
    formula_version: number;
    social_links: Record<string, string | null>;
    stats: Record<string, unknown>;
}

/**
 * MVP omissions vs Spec §5.3, all deliberate: sponsor badge (sponsors out of MVP), shareable image
 * export (Phase 2 §17.1), matchmaking (§17.3), friend-given tags (friends out of MVP).
 */
export async function playerCardFor(user: IUser): Promise<PlayerCardDTO> {
    const { rating, formula_version } = await ratingFor(user);
    const p = user.profile ?? ({} as IUser['profile']);

    return {
        user_id: user._id,
        username: user.username,
        avatar_url: p.avatar_url ?? null,
        bio: p.bio ?? '',
        interests: p.interests ?? [],
        card_tier: user.player_card?.card_tier ?? 'Rookie',
        rating,
        formula_version,
        social_links: (p.social_links ?? {}) as Record<string, string | null>,
        stats: (user.player_card?.stats ?? {}) as Record<string, unknown>,
    };
}
