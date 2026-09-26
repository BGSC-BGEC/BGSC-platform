import {
    Challenge,
    ChallengeParticipation,
    IChallenge,
    IChallengeParticipation,
    ParticipationStatus,
    PointTransaction,
    ServiceError,
    Team,
    User,
    UserRole,
    idempotencyKey,
    publish,
    rankOf,
    recordAudit,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { lockTeam } from '../clients/registration-client';
import { Actor, PRODUCER, getById } from './challenge.service';
import { AcceptInput, MyParticipationsInput, ProgressInput, QueueInput, ReviewInput, SubmitInput } from './challenge.schemas';
import { allOf, keysetFilter, keysetSort, pageOf } from './cursor';

/**
 * The participation lifecycle (challenge-model.md §3.1), start to finish, in one file — because it
 * is one document: accept, progress, submit, review, expire.
 *
 * Every transition is a compare-and-swap. Read-then-save lets a double-click through twice, and
 * one of these transitions publishes an event that mints points on the other side of the bus.
 */

const alive = { deleted_at: null };

const isDuplicateKey = (err: unknown): boolean => (err as { code?: number } | null)?.code === 11000;

/* ------------------------------------------------------------------ *
 * Accept
 * ------------------------------------------------------------------ */

/** challenge-model.md §3: min(accepted_at + time_limit, window.submissions_close_at), null if neither. */
function deadlineFor(challenge: IChallenge, accepted_at: Date): Date | null {
    const personal =
        challenge.window.time_limit_minutes != null
            ? new Date(accepted_at.getTime() + challenge.window.time_limit_minutes * 60_000)
            : null;
    const hard = challenge.window.submissions_close_at;
    if (personal && hard) return personal < hard ? personal : hard;
    return personal ?? hard ?? null;
}

function assertOpen(challenge: IChallenge, now: Date): void {
    // Only `active` accepts new participants. A `completed` challenge still takes submissions from
    // people who accepted in time (challenge-model.md §2.1) — that is the submit path, not this one.
    if (challenge.status !== 'active') throw new ServiceError(409, 'challenge_not_active');
    const { opens_at, closes_at, submissions_close_at } = challenge.window;
    if (opens_at && now < opens_at) throw new ServiceError(409, 'challenge_not_open_yet');
    if (closes_at && now > closes_at) throw new ServiceError(409, 'challenge_window_closed');
    // With `closes_at` null nothing above stops an accept after the hard stop, and the deadline it
    // would get is already past: the sweeper expires it within a minute and the seat is
    // never given back.
    if (submissions_close_at && now >= submissions_close_at) throw new ServiceError(409, 'challenge_submissions_closed');
}

/**
 * Capacity is claimed inside the update filter, not read and then checked: two people accepting the
 * last slot simultaneously must not both match. `$expr` compares two fields of the same document,
 * which a plain filter cannot do.
 *
 * Claimed BEFORE the insert and given back if the insert fails, for the same reason the points
 * ledger moves the balance before appending its row: a count that is one too high is repairable,
 * a participation past the cap is not detectable.
 */
async function claimSlot(challenge_id: string, cap: number | null): Promise<void> {
    const claimed = await Challenge.findOneAndUpdate(
        {
            _id: challenge_id,
            ...alive,
            status: 'active',
            ...(cap == null ? {} : { $expr: { $lt: ['$counts.accepted', cap] } }),
        },
        { $inc: { 'counts.accepted': 1 } },
        { returnDocument: 'after', projection: { _id: 1 } }
    );
    if (!claimed) throw new ServiceError(409, 'challenge_full');
}

const releaseSlot = (challenge_id: string): Promise<unknown> =>
    Challenge.updateOne({ _id: challenge_id, 'counts.accepted': { $gt: 0 } }, { $inc: { 'counts.accepted': -1 } }).catch((err) =>
        console.error(`[${PRODUCER}] failed to release a slot on ${challenge_id}:`, err)
    );

export async function accept(
    challengeId: string,
    input: AcceptInput,
    actor: Actor
): Promise<IChallengeParticipation> {
    const now = new Date();
    const challenge = await getById(challengeId);
    assertOpen(challenge, now);

    return input.team_id
        ? acceptAsTeam(challenge, input.team_id, actor, now)
        : acceptAsUser(challenge, actor, now);
}

async function acceptAsUser(
    challenge: IChallenge,
    actor: Actor,
    now: Date
): Promise<IChallengeParticipation> {
    // A teamed challenge is team-only, even at team_size_min 1 (a solo player is a team of one).
    // Letting both kinds in shared one `counts.accepted` between two caps — `max_participants` for
    // solos, `max_teams` for teams — so solos filled `max_teams` and teams ignored
    // `max_participants`. One kind per challenge makes each cap mean exactly one thing (audit Sep 26).
    if (challenge.teaming.enabled) throw new ServiceError(409, 'team_required');

    const user = await User.findOne({ _id: actor.id, ...alive }).select('profile.full_name profile.avatar_url username');
    if (!user) throw new ServiceError(404, 'user_not_found');

    // The mirror of the team path's `member_already_participating` guard. Teaming can be switched off after teams accepted,
    // and then a member of an accepted team could accept alone: a second participation, a second
    // idempotency key, and Points pays them twice. Only TEAM rows are checked here — a repeat solo
    // accept is the unique index's job and keeps its own `already_accepted`.
    if (await ChallengeParticipation.exists({ challenge_id: challenge._id, 'participant.type': 'team', member_user_ids: actor.id })) {
        throw new ServiceError(409, 'member_already_participating');
    }

    await claimSlot(challenge._id, challenge.max_participants);
    try {
        return await insertParticipation(challenge, {
            participant: {
                type: 'user',
                id: actor.id,
                display_name: user.profile?.full_name || user.username,
                avatar_url: user.profile?.avatar_url ?? null,
            },
            member_user_ids: [actor.id],
            now,
        });
    } catch (err) {
        await releaseSlot(challenge._id);
        throw err;
    }
}

async function acceptAsTeam(
    challenge: IChallenge,
    teamId: string,
    actor: Actor,
    now: Date
): Promise<IChallengeParticipation> {
    if (!challenge.teaming.enabled) throw new ServiceError(409, 'teaming_not_enabled');

    const team = await Team.findById(teamId);
    if (!team) throw new ServiceError(404, 'team_not_found');
    if (team.owner.type !== 'challenge' || team.owner.id !== challenge._id) {
        throw new ServiceError(409, 'team_wrong_owner');
    }
    if (team.captain_user_id !== actor.id) throw new ServiceError(403, 'not_team_captain');
    // NOT `status === 'complete'`, which challenge-model.md §3.1 originally asked for: nothing in
    // registration-service ever assigns that state. A team goes `forming` -> `locked` (core-only)
    // -> `disbanded`, so requiring it made the ordinary path — captain creates, members join,
    // captain accepts — a permanent 409 unless an admin locked the roster by hand first.
    //
    // The guard that actually matters is the size check below, against the challenge's own bounds,
    // and acceptance locks the roster itself a few lines later. `disbanded` is the only state that
    // cannot accept.
    if (team.status === 'disbanded') throw new ServiceError(409, 'team_disbanded');

    const memberIds = team.members.map((m) => m.user_id);
    const { team_size_min, team_size_max } = challenge.teaming;
    if ((team_size_min != null && memberIds.length < team_size_min) || (team_size_max != null && memberIds.length > team_size_max)) {
        throw new ServiceError(409, 'invalid_team_size');
    }

    // The unique index is on `participant.id`, which for a team is the TEAM id — so the same user
    // in two different teams on one challenge passes it, and then Points pays them twice, because
    // it fans out over `member_user_ids` (points consumers.ts:203). A query is the only expression
    // of this rule the model can't carry; it is racy in a millisecond window.
    if (await ChallengeParticipation.exists({ challenge_id: challenge._id, member_user_ids: { $in: memberIds } })) {
        throw new ServiceError(409, 'member_already_participating');
    }

    await claimSlot(challenge._id, challenge.teaming.max_teams);
    let participation: IChallengeParticipation;
    try {
        participation = await insertParticipation(challenge, {
            participant: {
                type: 'team',
                id: team._id,
                display_name: team.name,
                avatar_url: team.logo_url ?? null,
            },
            member_user_ids: memberIds,
            now,
        });
    } catch (err) {
        await releaseSlot(challenge._id);
        throw err;
    }

    // Best-effort, and deliberately after the participation exists: `member_user_ids` is already
    // snapshotted, so a failed lock costs a roster that can still change, not a wrong payout.
    await lockTeam(team._id, actor.id);
    return participation;
}

async function insertParticipation(
    challenge: IChallenge,
    args: {
        participant: IChallengeParticipation['participant'];
        member_user_ids: string[];
        now: Date;
    }
): Promise<IChallengeParticipation> {
    const participation = new ChallengeParticipation({
        _id: uuid(),
        challenge_id: challenge._id,
        // Historical by design (relationships.md §4): what the challenge was worth when accepted.
        challenge_snapshot: {
            title: challenge.title,
            difficulty: challenge.difficulty,
            award_points: challenge.award_points,
        },
        participant: args.participant,
        member_user_ids: args.member_user_ids,
        status: 'accepted',
        accepted_at: args.now,
        deadline_at: deadlineFor(challenge, args.now),
        status_history: [{ from: 'none', to: 'accepted', by: args.participant.id, at: args.now }],
    });

    try {
        await participation.save();
    } catch (err) {
        if (isDuplicateKey(err)) throw new ServiceError(409, 'already_accepted');
        throw err;
    }

    publish('ChallengeAccepted', PRODUCER, {
        participation_id: participation._id,
        challenge_id: challenge._id,
        participant: { type: args.participant.type, id: args.participant.id },
        member_user_ids: args.member_user_ids,
    });
    return participation;
}

/* ------------------------------------------------------------------ *
 * Progress and submission
 * ------------------------------------------------------------------ */

async function loadForMember(id: string, userId: string): Promise<IChallengeParticipation> {
    const p = await ChallengeParticipation.findById(id);
    if (!p) throw new ServiceError(404, 'participation_not_found');
    // 404, not 403: a viewer who may not see a document should not learn that it exists
    // (adding-a-service.md §6.6).
    if (!p.member_user_ids.includes(userId)) throw new ServiceError(404, 'participation_not_found');
    return p;
}

export async function updateProgress(
    id: string,
    patch: ProgressInput,
    actor: Actor
): Promise<IChallengeParticipation> {
    const p = await loadForMember(id, actor.id);
    // `accepted` is also the "in progress" state; there is no separate start (challenge-model.md §3.1).
    if (p.status !== 'accepted') throw new ServiceError(409, 'participation_not_in_progress');

    if (patch.percent != null) p.progress.percent = patch.percent;
    if (patch.notes !== undefined) p.progress.notes = patch.notes;
    if (patch.steps) {
        const previous = new Map(p.progress.steps.map((s) => [s.key, s]));
        p.progress.steps = patch.steps.map((s) => ({
            ...s,
            // `done_at` is preserved for a step that was already done, so re-sending the list does
            // not rewrite history with today's date.
            done_at: s.done ? previous.get(s.key)?.done_at ?? new Date() : null,
        }));
    }
    await p.save();
    return p;
}

const SUBMITTABLE_FROM = ['accepted', 'submitted', 'under_review', 'rejected'] as const;

export async function submit(
    id: string,
    input: SubmitInput,
    actor: Actor
): Promise<IChallengeParticipation> {
    const now = new Date();
    const p = await loadForMember(id, actor.id);
    const challenge = await getById(p.challenge_id);

    if (!challenge.submission.requires_proof) throw new ServiceError(409, 'no_proof_required');
    if (challenge.status === 'archived') throw new ServiceError(409, 'challenge_archived');
    if (!(SUBMITTABLE_FROM as readonly string[]).includes(p.status)) {
        throw new ServiceError(409, 'participation_not_submittable');
    }
    if (p.deadline_at && now > p.deadline_at) throw new ServiceError(409, 'deadline_passed');
    if (input.proofs.length > challenge.submission.max_files) throw new ServiceError(422, 'too_many_proofs');

    const allowed = new Set(challenge.submission.proof_types);
    const rejected = input.proofs.filter((pr) => !allowed.has(pr.type as never));
    if (rejected.length > 0) throw new ServiceError(422, 'proof_type_not_accepted');
    for (const proof of input.proofs) {
        if (proof.type === 'url' && !/^https?:\/\//i.test(proof.value)) throw new ServiceError(422, 'proof_url_invalid');
    }

    // Straight to `under_review`, never through `submitted`. challenge-model.md §3.1 draws
    // `submitted` as an intermediate, but there is nothing to do in it: the next transition is
    // unconditional, so a row could only ever be caught there between two lines of the same write.
    // `submitted` stays in PARTICIPATION_STATUS and in REVIEWABLE_FROM so a row written by an older
    // build still reviews, but nothing in this service assigns it.
    //
    // A participation a reviewer has EVER rejected goes back to a reviewer, whatever the challenge
    // says now: otherwise flipping `auto_approve` on turns every rejection into a resubmit away
    // from a payout nobody approved.
    const everRejected = p.status_history.some((h) => h.to === 'rejected');
    const to = challenge.submission.auto_approve && !everRejected ? 'approved' : 'under_review';

    // `p.status` was read a moment ago, so the `from` recorded below is that read's value. The CAS
    // filter bounds it to SUBMITTABLE_FROM either way, so the worst case is a history row naming
    // the wrong member of that set — never a transition that should not have happened.
    const common: Record<string, unknown> = {
        status: to,
        // A resubmit after a rejection must not leave the old verdict standing.
        review: null,
    };
    // An auto-approved participation is approved HERE, so it has to carry the reward here too —
    // the review route is not involved and `fillRewardIds` does nothing without one.
    if (to === 'approved') {
        common.reward = {
            points_awarded: p.challenge_snapshot.award_points,
            point_transaction_ids: [],
            hall_of_fame_entry_id: null,
        };
    }
    const proofs = input.proofs.map((pr) => ({ ...pr, size_bytes: null, mime: null }));
    const filter = {
        _id: id,
        status: { $in: [...SUBMITTABLE_FROM] as ParticipationStatus[] },
        // The rejection check again, inside the CAS: a reviewer rejecting between the read above and
        // this write must not be overtaken by an auto-approve.
        ...(to === 'approved' ? { 'status_history.to': { $ne: 'rejected' } } : {}),
    };
    const $push = { status_history: { from: p.status, to, by: actor.id, at: now } };

    // Two compare-and-swaps rather than one, so "first submit" and `version` are decided by the
    // database, not by the read above: a double-clicked first submit used to count twice in
    // `counts.submitted` and write `version: 1` twice. The first CAS only matches a row with no
    // submission yet; everything else is a resubmit, whose version is `$inc`ed in the same write.
    let updated = await ChallengeParticipation.findOneAndUpdate(
        { ...filter, submission: null },
        { $set: { ...common, submission: { proofs, notes: input.notes, submitted_at: now, version: 1 } }, $push },
        { returnDocument: 'after' }
    );
    const firstSubmit = updated != null;
    updated ??= await ChallengeParticipation.findOneAndUpdate(
        { ...filter, submission: { $ne: null } },
        {
            $set: { ...common, 'submission.proofs': proofs, 'submission.notes': input.notes, 'submission.submitted_at': now },
            $inc: { 'submission.version': 1 },
            $push,
        },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'participation_not_submittable');

    if (firstSubmit) await Challenge.updateOne({ _id: challenge._id }, { $inc: { 'counts.submitted': 1 } });

    publish('ChallengeSubmitted', PRODUCER, {
        participation_id: id,
        challenge_id: challenge._id,
        version: updated.submission!.version,
    });

    // Trust-based digital challenges approve on submit (challenge-model.md §3.1). The transition
    // already happened above; this pays for it.
    if (to === 'approved') await settleApproval(updated, challenge, { id: actor.id, ip: actor.ip });
    return updated;
}

/* ------------------------------------------------------------------ *
 * Review — the only place money moves
 * ------------------------------------------------------------------ */

export function mayReview(challenge: IChallenge, userId: string, role: UserRole): boolean {
    return challenge.reviewers.includes(userId) || rankOf(role) >= rankOf(UserRole.CORE);
}

const REVIEWABLE_FROM = ['submitted', 'under_review'] as const;

export async function review(
    id: string,
    input: ReviewInput,
    actor: Actor,
    role: UserRole
): Promise<IChallengeParticipation> {
    const now = new Date();
    const existing = await ChallengeParticipation.findById(id);
    if (!existing) throw new ServiceError(404, 'participation_not_found');
    const challenge = await getById(existing.challenge_id);
    // 404, like the detail and the queue: a caller who may not review must not learn the row exists.
    if (!mayReview(challenge, actor.id, role)) throw new ServiceError(404, 'participation_not_found');
    // Separation of duties: `mayReview` lets any Core+ approve, and a Core+ can also accept a
    // challenge. Without this a coordinator could author a 100k-point challenge, accept it and
    // approve their own payout in three requests, all of them audited as legitimate.
    if (existing.member_user_ids.includes(actor.id)) {
        throw new ServiceError(403, 'cannot_review_own_participation');
    }

    // A challenge with `requires_proof: false` is approved straight out of `accepted`: the
    // reviewer verified it in person (challenge-model.md §3.1).
    const from: ParticipationStatus[] = challenge.submission.requires_proof
        ? [...REVIEWABLE_FROM]
        : [...REVIEWABLE_FROM, 'accepted'];
    if (input.decision === 'rejected' && !challenge.submission.requires_proof && existing.status === 'accepted') {
        throw new ServiceError(409, 'nothing_to_reject');
    }

    const set: Record<string, unknown> = {
        status: input.decision,
        review: {
            reviewer_user_id: actor.id,
            decision: input.decision,
            reason: input.reason,
            reviewed_at: now,
        },
    };
    // Only an approved participation may carry a reward (Challenge.ts:372); the payout amount is
    // the snapshot, never today's price.
    if (input.decision === 'approved') {
        set.reward = {
            points_awarded: existing.challenge_snapshot.award_points,
            point_transaction_ids: [],
            hall_of_fame_entry_id: null,
        };
    }

    const updated = await ChallengeParticipation.findOneAndUpdate(
        { _id: id, status: { $in: from } },
        {
            $set: set,
            $push: {
                status_history: {
                    from: existing.status,
                    to: input.decision,
                    by: actor.id,
                    at: now,
                    reason: input.reason,
                },
            },
        },
        { returnDocument: 'after' }
    );
    // The loser of a double-click matches nothing. This is what makes "approved once" true under
    // concurrency rather than true in the common case — and an approve publishes a payout.
    if (!updated) throw new ServiceError(409, 'participation_not_reviewable');

    if (input.decision === 'approved') {
        await settleApproval(updated, challenge, actor);
    } else {
        await recordAudit({
            actor_id: actor.id,
            action: 'challenge.rejected',
            target_type: 'challenge',
            target_id: challenge._id,
            new_value: { participation_id: id },
            reason: input.reason,
            ip: actor.ip,
        });
        publish('ChallengeRejected', PRODUCER, {
            participation_id: id,
            challenge_id: challenge._id,
            reason: input.reason,
            // 1-based ordinal of THIS rejection, from the document the CAS just wrote. Notification
            // keys its dedupe on it; reading it at consume time raced a quick second rejection.
            rejection_no: updated.status_history.filter((h) => h.to === 'rejected').length,
        });
    }
    return updated;
}

/**
 * Everything an approval owes the rest of the platform. Called from exactly two places (the review
 * route and the auto-approve branch of submit) so there is one definition of "what approved means".
 *
 * Publishes rather than calls: the Points Service consumes `ChallengeCompleted` and dedupes on
 * `challenge.completed:<participation_id>:<user_id>` (Points.ts:212), so a replay pays once and a
 * synchronous call would buy nothing but a failure mode.
 */
async function settleApproval(
    p: IChallengeParticipation,
    challenge: IChallenge,
    actor: Actor
): Promise<void> {
    await Challenge.updateOne({ _id: challenge._id }, { $inc: { 'counts.approved': 1 } });

    await recordAudit({
        actor_id: actor.id,
        action: 'challenge.approved',
        target_type: 'challenge',
        target_id: challenge._id,
        new_value: {
            participation_id: p._id,
            member_user_ids: p.member_user_ids,
            award_points: p.challenge_snapshot.award_points,
        },
        ip: actor.ip,
    });

    publishCompleted(p);
    if (challenge.grants_hall_of_fame) publishLegend(p);
}

/**
 * The two approval events, built in one place because the replay sweep (scheduler/replay.ts)
 * republishes them and a replay must be byte-for-byte the event it stands in for.
 */
export function publishCompleted(p: IChallengeParticipation): void {
    publish('ChallengeCompleted', PRODUCER, {
        participation_id: p._id,
        challenge_id: p.challenge_id,
        participant: { type: p.participant.type, id: p.participant.id },
        member_user_ids: p.member_user_ids,
        // The snapshot's amount, never today's. Points resolves `challenge.completed` with this as
        // the override and the seeded rule's default is 0 (Points.ts:195) — so sending 0 or nothing
        // pays nobody, silently. That is why this is never computed and never optional.
        award_points: p.challenge_snapshot.award_points,
    });
}

export function publishLegend(p: IChallengeParticipation): void {
    publish('ChallengeLegendAchieved', PRODUCER, {
        participation_id: p._id,
        challenge_id: p.challenge_id,
        member_user_ids: p.member_user_ids,
    });
}

export async function withdraw(id: string, reason: string | null, actor: Actor): Promise<IChallengeParticipation> {
    const now = new Date();
    const existing = await ChallengeParticipation.findById(id);
    if (!existing) throw new ServiceError(404, 'participation_not_found');
    // Never from `approved`: the points are paid and the ledger row references this challenge.
    const updated = await ChallengeParticipation.findOneAndUpdate(
        { _id: id, status: { $in: ['accepted', 'submitted', 'under_review', 'rejected'] } },
        {
            $set: { status: 'withdrawn' },
            $push: { status_history: { from: existing.status, to: 'withdrawn', by: actor.id, at: now, reason } },
        },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'participation_not_withdrawable');

    // `counts.accepted` is "slots consumed", and a withdrawal is an admin undo, so the slot comes
    // back. Expiry deliberately does NOT return it: the participant took their attempt and
    // ran out of time. `counts.submitted` and `counts.approved` are cumulative totals and are never
    // decremented — they answer "how many ever got that far", which a withdrawal does not unmake.
    await Challenge.updateOne({ _id: existing.challenge_id, 'counts.accepted': { $gt: 0 } }, { $inc: { 'counts.accepted': -1 } });
    await recordAudit({
        actor_id: actor.id,
        action: 'challenge.withdrawn',
        target_type: 'challenge',
        target_id: existing.challenge_id,
        new_value: { participation_id: id },
        reason,
        ip: actor.ip,
    });
    return updated;
}

/* ------------------------------------------------------------------ *
 * Reward ids — read back from the ledger, never listened for
 * ------------------------------------------------------------------ */

/**
 * `reward.point_transaction_ids[]` is filled by READING `point_transactions`, not by consuming
 * `PointsEarned`.
 *
 * The event route loses rows permanently and silently: `record()` returns early on a replay and
 * publishes nothing (points ledger.ts:114-115), and `PointsEarned.reference.id` is the challenge,
 * not the participation (ledger.ts:96). A dropped message would leave the array short forever.
 *
 * The key is exact and shared (`idempotencyKey.challengeCompleted`, Points.ts:212) and
 * `idempotency_key` is uniquely indexed (Points.ts:128), so this is one indexed lookup that
 * converges whatever the bus did. Reading another service's collection is the sanctioned form
 * (adding-a-service.md §6.5) — this writes nothing of theirs.
 */
export async function fillRewardIds(p: IChallengeParticipation): Promise<IChallengeParticipation> {
    if (!p.reward || p.reward.point_transaction_ids.length >= p.member_user_ids.length) return p;

    const keys = p.member_user_ids.map((u) => idempotencyKey.challengeCompleted(p._id, u));
    const rows = await PointTransaction.find({ idempotency_key: { $in: keys } }).select('_id');
    if (rows.length === 0) return p;

    const ids = rows.map((r) => r._id);
    // `timestamps: false`: `updated_at` is the replay sweep's window key, and a bookkeeping fill must
    // not keep a partially-paid approval (a member whose credit never lands) inside it forever.
    await ChallengeParticipation.updateOne(
        { _id: p._id },
        { $addToSet: { 'reward.point_transaction_ids': { $each: ids } } },
        { timestamps: false }
    );
    p.reward.point_transaction_ids = [...new Set([...p.reward.point_transaction_ids, ...ids])];
    return p;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function myParticipations(
    userId: string,
    q: MyParticipationsInput
): Promise<{ rows: IChallengeParticipation[]; next_cursor: string | null }> {
    const conditions: Record<string, unknown>[] = [{ member_user_ids: userId }];
    if (q.status) conditions.push({ status: q.status });
    if (q.cursor) conditions.push(keysetFilter('accepted_at', q.cursor));

    const rows = await ChallengeParticipation.find(allOf(conditions))
        .sort(keysetSort('accepted_at'))
        .limit(q.limit);
    return pageOf(rows, q.limit, 'accepted_at');
}

/**
 * Statuses a participation can only reach by submitting. For those the queue orders by
 * `submission.submitted_at`; for the rest that field is null and `accepted_at` is the only thing
 * to order by.
 *
 * NOT `approved`: a `requires_proof: false` challenge is approved straight out of `accepted` with
 * no submission, the cursor cannot be built from a null, and the list stopped after one page.
 */
const HAS_SUBMISSION = new Set<string>(['submitted', 'under_review', 'rejected']);

/**
 * The reviewer queue. **Oldest submission first** — it is a work queue, so whoever has waited
 * longest is reviewed first, which is also what `{ challenge_id, status, submission.submitted_at }`
 * (Challenge.ts:377) exists to serve.
 *
 * It used to sort `accepted_at` descending: newest acceptance first, ignoring its own index, and
 * the reverse of the order a reviewer should work in. `challenge-model.md §5` had said ascending
 * on `submission.submitted_at` all along.
 */
export async function queue(
    challengeId: string,
    q: QueueInput
): Promise<{ rows: IChallengeParticipation[]; next_cursor: string | null }> {
    const bySubmission = HAS_SUBMISSION.has(q.status);
    const field = bySubmission ? 'submission.submitted_at' : 'accepted_at';
    const dir = bySubmission ? 'asc' : 'desc';

    const conditions: Record<string, unknown>[] = [{ challenge_id: challengeId, status: q.status }];
    if (q.cursor) conditions.push(keysetFilter(field, q.cursor, dir));
    const rows = await ChallengeParticipation.find(allOf(conditions))
        .sort(keysetSort(field, dir))
        .limit(q.limit);
    return pageOf(rows, q.limit, field);
}

/** Detail for a member, or for anyone who may review this challenge. */
export async function getParticipation(
    id: string,
    actor: Actor,
    role: UserRole
): Promise<IChallengeParticipation> {
    const p = await ChallengeParticipation.findById(id);
    if (!p) throw new ServiceError(404, 'participation_not_found');
    if (!p.member_user_ids.includes(actor.id)) {
        const challenge = await getById(p.challenge_id);
        if (!mayReview(challenge, actor.id, role)) throw new ServiceError(404, 'participation_not_found');
    }
    return fillRewardIds(p);
}
