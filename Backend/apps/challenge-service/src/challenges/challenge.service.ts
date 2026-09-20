import {
    Challenge,
    ChallengeParticipation,
    IChallenge,
    MVP_PROOF_TYPES,
    ProofType,
    ServiceError,
    publish,
    recordAudit,
} from '@bgsc/shared';
import { randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';
import { allOf, keysetFilter, keysetSort, pageOf } from './cursor';
import { CreateChallengeInput, ListChallengesInput, UpdateChallengeInput } from './challenge.schemas';

/**
 * The catalog half of the Challenge Service: `challenges` only. The participation lifecycle lives
 * in `participation.service.ts`.
 *
 * Everything the model's `pre('validate')` hook would throw about is refused here as a
 * `ServiceError` first — the hook throws a plain `Error`, which the shared handler maps to 500
 * (adding-a-service.md §6.3). A valid-looking request that answers 500 is the single largest
 * source of avoidable bugs in this codebase, so §2 of this file is longer than §1.
 */

export const PRODUCER = 'challenge-service';

export interface Actor {
    id: string;
    ip: string | null;
}

/** Every read of a soft-deleting collection carries this. Built here so no path can forget it. */
const alive = { deleted_at: null };

/* ------------------------------------------------------------------ *
 * 1. Normalization — turning a valid request into a savable document
 * ------------------------------------------------------------------ */

const slugify = (title: string): string =>
    title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 100)
        // Trimmed AFTER the slice, not before: cutting at 100 can land mid-word and leave a
        // trailing separator. A title with no Latin characters at all reduces to nothing, which is
        // what the fallback is for — `freeSlug` then makes it unique.
        .replace(/^-+|-+$/g, '') || 'challenge';

/**
 * The model defaults `proof_types` to `[...MVP_PROOF_TYPES]` (Challenge.ts:129) while
 * `requires_proof` defaults `true` (Challenge.ts:128). An admin creating a no-proof challenge sends
 * `{ requires_proof: false }` and nothing else; the default then fills `['url','text']`, the hook
 * at Challenge.ts:173 throws, and a request that was never wrong answers 500.
 *
 * So this normalizes rather than refuses: `requires_proof: false` means there are no proof types,
 * which is a restatement of the same fact, not a second decision the admin has to remember to make.
 */
function normalizeSubmission(s: {
    requires_proof: boolean;
    proof_types?: string[];
    max_files: number;
    auto_approve: boolean;
}): { requires_proof: boolean; proof_types: ProofType[]; max_files: number; auto_approve: boolean } {
    const proof_types = s.requires_proof ? ((s.proof_types ?? [...MVP_PROOF_TYPES]) as ProofType[]) : [];
    return { ...s, proof_types };
}

/** `teaming.enabled === false` must leave every size null (Challenge.ts:158-161). Same reasoning. */
function normalizeTeaming(t: {
    enabled: boolean;
    team_size_min: number | null;
    team_size_max: number | null;
    max_teams: number | null;
}) {
    return t.enabled ? t : { enabled: false, team_size_min: null, team_size_max: null, max_teams: null };
}

/* ------------------------------------------------------------------ *
 * 2. Guards — every model invariant, as a 422, before .save()
 * ------------------------------------------------------------------ */

type Draftish = Pick<IChallenge, 'kind' | 'location' | 'teaming' | 'window' | 'submission' | 'award_points'>;

function assertSavable(c: Draftish): void {
    const fail = (code: string, details?: unknown): never => {
        throw new ServiceError(422, code, details);
    };

    if (c.award_points < 1) fail('award_points_must_be_positive');
    if (c.kind === 'physical' && c.location == null) fail('location_required_for_physical_challenge');

    const t = c.teaming;
    if (t.enabled && !(t.team_size_min != null && t.team_size_max != null && t.team_size_min >= 1 && t.team_size_min <= t.team_size_max)) {
        fail('invalid_team_size');
    }
    if (t.enabled && t.max_teams != null && t.max_teams < 1) fail('invalid_max_teams');

    const w = c.window;
    const chain = [w.opens_at, w.closes_at, w.submissions_close_at].filter((d): d is Date => d != null);
    if (chain.some((d, i) => i > 0 && d < chain[i - 1])) fail('invalid_window');

    const s = c.submission;
    if (!s.requires_proof && s.proof_types.length > 0) fail('proof_types_without_proof');
    if (s.auto_approve && !s.requires_proof) fail('auto_approve_needs_proof');
    if (s.requires_proof && s.proof_types.length === 0) fail('proof_types_required');
    // The enum accepts image/video; Media Service does not exist until Week 4, so a challenge
    // demanding a file upload would be unsatisfiable (challenge-model.md §6).
    const unsupported = s.proof_types.filter((p) => !MVP_PROOF_TYPES.includes(p));
    if (unsupported.length > 0) fail('proof_type_not_available_yet', { proof_types: unsupported });
}

/* ------------------------------------------------------------------ *
 * 3. Writes
 * ------------------------------------------------------------------ */

export async function createChallenge(input: CreateChallengeInput, actor: Actor): Promise<IChallenge> {
    const submission = normalizeSubmission(input.submission);
    const teaming = normalizeTeaming(input.teaming);
    // challenge-model.md §2.2: a Legend challenge grants Hall of Fame by default. Applied here and
    // not as a schema default so an admin can still send `false` in the same request — which is
    // what `grants_hall_of_fame` being optional in the zod schema buys (D2).
    const grants_hall_of_fame = input.grants_hall_of_fame ?? input.difficulty === 'legend';

    assertSavable({ ...input, submission, teaming });

    const base = slugify(input.title);
    const challenge = new Challenge({
        ...input,
        _id: uuid(),
        slug: base,
        submission,
        teaming,
        grants_hall_of_fame,
        status: 'draft',
        created_by: actor.id,
    });
    await saveWithFreshSlug(challenge, base);

    await recordAudit({
        actor_id: actor.id,
        action: 'challenge.created',
        target_type: 'challenge',
        target_id: challenge._id,
        new_value: { title: challenge.title, award_points: challenge.award_points, difficulty: challenge.difficulty },
        ip: actor.ip,
    });

    publish('ChallengeCreated', PRODUCER, {
        challenge_id: challenge._id,
        title: challenge.title,
        domain: challenge.domain,
        difficulty: challenge.difficulty,
        created_by: actor.id,
    });

    return challenge;
}

const isDuplicateKey = (err: unknown): boolean => (err as { code?: number } | null)?.code === 11000;

/**
 * The slug is unique by index (Challenge.ts:83), so a second "Run 5K" is a duplicate-key error —
 * a 500 for a request that was never wrong. Try the clean slug, and on a collision re-suffix and
 * try again.
 *
 * There used to be an `exists()` pre-check first. The mutation pass showed it was dead weight:
 * breaking it changed nothing, because this retry already produces a distinct slug either way. It
 * cost an indexed read on every create to save a failed insert on the rare duplicate title, and a
 * pre-check cannot close the race anyway — two creates in the same millisecond both see the base
 * free. One mechanism, and it is the one that actually holds.
 */
async function saveWithFreshSlug(challenge: IChallenge, base: string): Promise<void> {
    try {
        await challenge.save();
    } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        // 32 random bits, so a second collision needs two creates of one title to draw the same
        // suffix in the same instant. If that ever happens the caller sees a 500 and retries.
        challenge.slug = `${base}-${randomBytes(4).toString('hex')}`;
        await challenge.save();
    }
}

export async function updateChallenge(
    id: string,
    patch: UpdateChallengeInput,
    actor: Actor
): Promise<IChallenge> {
    const challenge = await Challenge.findOne({ _id: id, ...alive });
    if (!challenge) throw new ServiceError(404, 'challenge_not_found');

    // Participations snapshot `award_points` at acceptance and never refresh it
    // (relationships.md §4). Repricing a live challenge would pay two people different amounts for
    // the same work with nothing recording why (D4). Archive and re-create is the path.
    if (patch.award_points != null && patch.award_points !== challenge.award_points) {
        if (await ChallengeParticipation.exists({ challenge_id: id })) {
            throw new ServiceError(409, 'challenge_has_participations');
        }
    }

    const previous = {
        title: challenge.title,
        award_points: challenge.award_points,
        difficulty: challenge.difficulty,
    };

    // The same Legend rule `createChallenge` applies (D2). Without this, promoting a challenge to
    // 'legend' by PATCH left `grants_hall_of_fame` false and the Legend never reached Hall of Fame
    // — the default fired on one write path and not the other.
    const promotedToLegend = patch.difficulty === 'legend' && challenge.difficulty !== 'legend';
    if (promotedToLegend && patch.grants_hall_of_fame === undefined) {
        challenge.grants_hall_of_fame = true;
    }

    Object.assign(challenge, patch);
    // Re-normalize: a patch that only flips `requires_proof` leaves the stored `proof_types` in
    // place, which is exactly the 500 that normalization exists to prevent.
    challenge.submission = normalizeSubmission(challenge.submission) as IChallenge['submission'];
    challenge.teaming = normalizeTeaming(challenge.teaming) as IChallenge['teaming'];
    assertSavable(challenge);
    await challenge.save();

    const changed_fields = Object.keys(patch);
    await recordAudit({
        actor_id: actor.id,
        action: 'challenge.updated',
        target_type: 'challenge',
        target_id: id,
        previous_value: previous,
        new_value: { changed_fields },
        ip: actor.ip,
    });

    publish('ChallengeUpdated', PRODUCER, { challenge_id: id, changed_fields, updated_by: actor.id });
    return challenge;
}

/**
 * Status moves are compare-and-swaps, never read-then-save: two clicks on "activate" would
 * otherwise both succeed and write two audit rows for one transition.
 */
const TRANSITIONS = {
    activate: { from: ['draft'], to: 'active' },
    complete: { from: ['active'], to: 'completed' },
    archive: { from: ['draft', 'active', 'completed'], to: 'archived' },
} as const;

export async function transition(
    id: string,
    verb: keyof typeof TRANSITIONS,
    actor: Actor
): Promise<IChallenge> {
    const { from, to } = TRANSITIONS[verb];
    const updated = await Challenge.findOneAndUpdate(
        { _id: id, ...alive, status: { $in: from } },
        { $set: { status: to } },
        { returnDocument: 'after' }
    );

    if (!updated) {
        // Absent and wrong-state must be distinguishable: one is retryable by fixing the id, the
        // other never is.
        const exists = await Challenge.exists({ _id: id, ...alive });
        throw exists
            ? new ServiceError(409, `challenge_not_${from.join('_or_')}`)
            : new ServiceError(404, 'challenge_not_found');
    }

    await recordAudit({
        actor_id: actor.id,
        action: `challenge.${to}`,
        target_type: 'challenge',
        target_id: id,
        new_value: { status: to },
        ip: actor.ip,
    });
    publish('ChallengeUpdated', PRODUCER, { challenge_id: id, changed_fields: ['status'], updated_by: actor.id });
    return updated;
}

export async function softDelete(id: string, actor: Actor): Promise<void> {
    // relationships.md §3: forbid while any participation is approved. Points were paid against
    // this challenge and `point_transactions.reference` is immutable, so the row the ledger points
    // at must keep existing. `archive` is the reversible verb for "stop showing this".
    if (await ChallengeParticipation.exists({ challenge_id: id, status: 'approved' })) {
        throw new ServiceError(409, 'challenge_has_approved_participations');
    }

    const deleted = await Challenge.findOneAndUpdate(
        { _id: id, ...alive },
        { $set: { deleted_at: new Date(), status: 'archived' } },
        { returnDocument: 'after' }
    );
    if (!deleted) throw new ServiceError(404, 'challenge_not_found');

    await recordAudit({
        actor_id: actor.id,
        action: 'challenge.deleted',
        target_type: 'challenge',
        target_id: id,
        // An audit row must carry at least one of previous/new (AuditLog.ts:66); a delete's diff is
        // the status and the tombstone, not the whole document.
        previous_value: { status: 'active_or_earlier', deleted_at: null },
        new_value: { status: 'archived', deleted_at: deleted.deleted_at },
        ip: actor.ip,
    });
}

/* ------------------------------------------------------------------ *
 * 4. Reads
 * ------------------------------------------------------------------ */

export async function listChallenges(q: ListChallengesInput): Promise<{ rows: IChallenge[]; next_cursor: string | null }> {
    const conditions: Record<string, unknown>[] = [{ ...alive, status: q.status }];
    if (q.domain) conditions.push({ domain: q.domain });
    if (q.difficulty) conditions.push({ difficulty: q.difficulty });
    if (q.kind) conditions.push({ kind: q.kind });
    if (q.tag) conditions.push({ tags: q.tag });
    // ponytail: anchored case-insensitive regex, not a text index. A text index is a write cost on
    // every create for a search nobody has run yet; anchoring keeps it prefix-ish rather than a
    // full scan of every title. Swap for `$text` when the browser grows a real search box.
    if (q.q) conditions.push({ title: { $regex: `^${escapeRegex(q.q)}`, $options: 'i' } });
    if (q.cursor) conditions.push(keysetFilter('created_at', q.cursor));

    const rows = await Challenge.find(allOf(conditions))
        .sort(keysetSort('created_at'))
        .limit(q.limit);
    return pageOf(rows, q.limit, 'created_at');
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Detail by `_id` or `slug` — the mobile app deep-links on slug, the admin panel holds ids. */
export async function getByKey(key: string): Promise<IChallenge> {
    const challenge = await Challenge.findOne(allOf([{ ...alive }, { $or: [{ _id: key }, { slug: key }] }]));
    if (!challenge) throw new ServiceError(404, 'challenge_not_found');
    return challenge;
}

export async function getById(id: string): Promise<IChallenge> {
    const challenge = await Challenge.findOne({ _id: id, ...alive });
    if (!challenge) throw new ServiceError(404, 'challenge_not_found');
    return challenge;
}
