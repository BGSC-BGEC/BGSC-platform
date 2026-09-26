import assert from 'assert';
import {
    AuditLog,
    Challenge,
    ChallengeParticipation,
    DomainEvent,
    HallOfFameEntry,
    PointTransaction,
    ServiceError,
    Team,
    User,
    UserRole,
    idempotencyKey,
    resetBus,
    subscribe,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import * as catalog from '../challenges/challenge.service';
import * as part from '../challenges/participation.service';
import { tick } from '../scheduler/expiry';
import { replayTick } from '../scheduler/replay';
import { actorOf, challengeInput, closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * The participation lifecycle, and the one event this service exists to produce.
 *
 * `ChallengeCompleted` is consumed by the Points Service (points-service consumers.ts) with a payload
 * type it pinned on Sep 19. The assertions below are written against THAT shape, not against this
 * service's convenience — if the producer drifts, this file goes red before the payout does.
 *
 *   npx ts-node src/selfcheck/participation.selfcheck.ts
 */

const section = (name: string) => console.log(`\n-- ${name} --`);
const pass = (what: string) => console.log(`  ok  ${what}`);

async function refuses(status: number, code: string, fn: () => Promise<unknown>): Promise<void> {
    try {
        await fn();
    } catch (err) {
        assert.ok(err instanceof ServiceError, `expected ServiceError ${code}, got ${(err as Error).message}`);
        assert.strictEqual(err.status, status, `expected ${status} ${code}, got ${err.status} ${err.code}`);
        assert.strictEqual(err.code, code);
        return;
    }
    assert.fail(`expected ${status} ${code}, but the call succeeded`);
}

/** Collects one event type off the in-process bus for the duration of a block. */
function collect<P extends Record<string, unknown>>(type: string): { events: DomainEvent<P>[]; stop: () => void } {
    const events: DomainEvent<P>[] = [];
    const stop = subscribe<P>(type, (e) => void events.push(e));
    return { events, stop };
}

async function main(): Promise<void> {
    await openScratchDb();
    try {
        const admin = await seedUser('Reviewer', UserRole.CORE);
        const adminActor = actorOf(admin);
        const alice = await seedUser('Alice');
        const bob = await seedUser('Bob');

        /** A live challenge, ready to accept. */
        const live = async (over: Record<string, unknown> = {}) => {
            const c = await catalog.createChallenge(challengeInput(over) as never, adminActor);
            return catalog.transition(c._id, 'activate', adminActor);
        };

        section('solo acceptance');
        const c1 = await live();
        const p1 = await part.accept(c1._id, {}, actorOf(alice));
        assert.strictEqual(p1.status, 'accepted');
        assert.deepStrictEqual(p1.member_user_ids, [alice._id]);
        assert.strictEqual(p1.challenge_snapshot.award_points, 50);
        assert.strictEqual((await Challenge.findById(c1._id))!.counts.accepted, 1);
        pass('accept snapshots the award and increments counts.accepted');

        await refuses(409, 'already_accepted', () => part.accept(c1._id, {}, actorOf(alice)));
        assert.strictEqual((await Challenge.findById(c1._id))!.counts.accepted, 1);
        pass('a second accept is a 409 and does NOT leave counts.accepted inflated');

        const draft = await catalog.createChallenge(challengeInput() as never, adminActor);
        await refuses(409, 'challenge_not_active', () => part.accept(draft._id, {}, actorOf(bob)));
        pass('a draft challenge refuses acceptance');

        const closed = await live({
            window: {
                opens_at: null,
                closes_at: new Date(Date.now() - 3600_000),
                submissions_close_at: null,
                time_limit_minutes: null,
            },
        });
        await refuses(409, 'challenge_window_closed', () => part.accept(closed._id, {}, actorOf(bob)));
        pass('a closed window refuses acceptance');

        // Evergreen acceptance window, but the hard stop has passed: the deadline would already be
        // behind us and the seat would be burnt by the sweeper a minute later.
        const hardStopped = await live({
            window: { opens_at: null, closes_at: null, submissions_close_at: new Date(Date.now() - 1000), time_limit_minutes: null },
        });
        await refuses(409, 'challenge_submissions_closed', () => part.accept(hardStopped._id, {}, actorOf(bob)));
        assert.strictEqual((await Challenge.findById(hardStopped._id))!.counts.accepted, 0);
        pass('past submissions_close_at refuses acceptance even with no closes_at');

        section('capacity is claimed inside the filter, not around it');
        const capped = await live({ max_participants: 3 });
        const crowd = await Promise.all([1, 2, 3, 4, 5].map(() => seedUser('Crowd')));
        const results = await Promise.allSettled(crowd.map((u) => part.accept(capped._id, {}, actorOf(u))));
        const accepted = results.filter((r) => r.status === 'fulfilled').length;
        assert.strictEqual(accepted, 3, `5 racing accepts on a cap of 3 produced ${accepted}`);
        assert.strictEqual(await ChallengeParticipation.countDocuments({ challenge_id: capped._id }), 3);
        assert.strictEqual((await Challenge.findById(capped._id))!.counts.accepted, 3);
        for (const r of results.filter((x) => x.status === 'rejected') as PromiseRejectedResult[]) {
            assert.strictEqual((r.reason as ServiceError).code, 'challenge_full');
        }
        pass('5 simultaneous accepts on a cap of 3: exactly 3 rows, counts.accepted === 3');

        // A re-click by someone who got a seat, on a full challenge: the claim used to run first and
        // answer `challenge_full`, which reads as "you are not in" to the one person who is.
        const seated = crowd[results.findIndex((r) => r.status === 'fulfilled')];
        await refuses(409, 'already_accepted', () => part.accept(capped._id, {}, actorOf(seated)));
        assert.strictEqual((await Challenge.findById(capped._id))!.counts.accepted, 3);
        pass('a repeat accept at the cap is already_accepted, not challenge_full');

        section('deadlines');
        const timed = await live({
            window: { opens_at: null, closes_at: null, submissions_close_at: null, time_limit_minutes: 60 },
        });
        const pt = await part.accept(timed._id, {}, actorOf(alice));
        assert.ok(pt.deadline_at, 'a time limit produces a deadline');
        assert.ok(Math.abs(pt.deadline_at!.getTime() - (pt.accepted_at.getTime() + 3_600_000)) < 1000);

        const hardStop = new Date(Date.now() + 10 * 60_000);
        const both = await live({
            window: { opens_at: null, closes_at: null, submissions_close_at: hardStop, time_limit_minutes: 60 },
        });
        const pb = await part.accept(both._id, {}, actorOf(bob));
        assert.strictEqual(pb.deadline_at!.getTime(), hardStop.getTime());
        pass('deadline_at is min(personal limit, submissions_close_at)');

        section('progress and submission');
        const flow = await live({ reviewers: [] });
        const pf = await part.accept(flow._id, {}, actorOf(alice));

        await refuses(404, 'participation_not_found', () =>
            part.updateProgress(pf._id, { percent: 50 } as never, actorOf(bob))
        );
        pass('a non-member gets 404, not 403 — they must not learn the row exists');

        const progressed = await part.updateProgress(pf._id, { percent: 40, steps: [{ key: 'a', label: 'A', done: true }] } as never, actorOf(alice));
        assert.strictEqual(progressed.progress.percent, 40);
        const firstDoneAt = progressed.progress.steps[0].done_at!;
        const again = await part.updateProgress(pf._id, { steps: [{ key: 'a', label: 'A', done: true }] } as never, actorOf(alice));
        assert.strictEqual(again.progress.steps[0].done_at!.getTime(), firstDoneAt.getTime());
        pass('re-sending a done step keeps its original done_at');

        await refuses(422, 'proof_url_invalid', () =>
            part.submit(pf._id, { proofs: [{ type: 'url', value: 'not-a-url', name: null }], notes: null } as never, actorOf(alice))
        );
        await refuses(422, 'proof_type_not_accepted', () =>
            part.submit(pf._id, { proofs: [{ type: 'text', value: 'trust me', name: null }], notes: null } as never, actorOf(alice))
        );
        {
            const url = { type: 'url', value: 'https://example.com/p', name: null };
            const one = await live({ submission: { requires_proof: true, proof_types: ['url'], max_files: 1, auto_approve: false } });
            const po = await part.accept(one._id, {}, actorOf(alice));
            await refuses(422, 'too_many_proofs', () => part.submit(po._id, { proofs: [url, url], notes: null } as never, actorOf(alice)));

            const inPerson = await live({ submission: { requires_proof: false, max_files: 0, auto_approve: false } });
            const pi = await part.accept(inPerson._id, {}, actorOf(alice));
            await refuses(409, 'no_proof_required', () => part.submit(pi._id, { proofs: [url], notes: null } as never, actorOf(alice)));
            await refuses(409, 'nothing_to_reject', () =>
                part.review(pi._id, { decision: 'rejected', reason: null } as never, adminActor, UserRole.CORE)
            );
        }
        pass('proof type, proof count, no-proof and nothing-to-reject refusals carry their own codes');
        const submitted = await part.submit(
            pf._id,
            { proofs: [{ type: 'url', value: 'https://example.com/proof', name: null }], notes: null } as never,
            actorOf(alice)
        );
        assert.strictEqual(submitted.status, 'under_review');
        assert.strictEqual(submitted.submission!.version, 1);
        assert.strictEqual((await Challenge.findById(flow._id))!.counts.submitted, 1);
        pass('submit moves to under_review and counts.submitted once');

        const resubmitted = await part.submit(
            pf._id,
            { proofs: [{ type: 'url', value: 'https://example.com/better', name: null }], notes: null } as never,
            actorOf(alice)
        );
        assert.strictEqual(resubmitted.submission!.version, 2);
        assert.strictEqual((await Challenge.findById(flow._id))!.counts.submitted, 1);
        pass('a resubmit bumps version and does NOT double-count counts.submitted');

        {
            // A double-clicked FIRST submit: both requests read `submission: null`. The database,
            // not that read, decides which one is first.
            const dbl = await live();
            const pd = await part.accept(dbl._id, {}, actorOf(bob));
            const proof = { proofs: [{ type: 'url', value: 'https://example.com/dbl', name: null }], notes: null } as never;
            const both = await Promise.all([part.submit(pd._id, proof, actorOf(bob)), part.submit(pd._id, proof, actorOf(bob))]);
            assert.deepStrictEqual(both.map((x) => x.submission!.version).sort(), [1, 2], 'versions are 1 and 2, never 1 twice');
            assert.strictEqual((await Challenge.findById(dbl._id))!.counts.submitted, 1, 'counted once');
            pass('two simultaneous first submits count once and get distinct versions');
        }

        section('the deadline is enforced on submit, not only on the sweeper');
        {
            const late = await live({
                window: { opens_at: null, closes_at: null, submissions_close_at: null, time_limit_minutes: 60 },
            });
            const pl2 = await part.accept(late._id, {}, actorOf(bob));
            await ChallengeParticipation.updateOne({ _id: pl2._id }, { $set: { deadline_at: new Date(Date.now() - 1000) } });
            await refuses(409, 'deadline_passed', () =>
                part.submit(pl2._id, { proofs: [{ type: 'url', value: 'https://example.com/late', name: null }], notes: null } as never, actorOf(bob))
            );
            pass('a submission after deadline_at is refused even before the sweeper has run');
        }

        section('an archived challenge stops taking submissions, a completed one does not');
        {
            const stillOpen = await live();
            const po = await part.accept(stillOpen._id, {}, actorOf(alice));
            await catalog.transition(stillOpen._id, 'complete', adminActor);
            const okAfterComplete = await part.submit(
                po._id,
                { proofs: [{ type: 'url', value: 'https://example.com/ok', name: null }], notes: null } as never,
                actorOf(alice)
            );
            assert.strictEqual(okAfterComplete.status, 'under_review', 'challenge-model.md §2.1');

            await catalog.transition(stillOpen._id, 'archive', adminActor);
            await refuses(409, 'challenge_archived', () =>
                part.submit(po._id, { proofs: [{ type: 'url', value: 'https://example.com/no', name: null }], notes: null } as never, actorOf(alice))
            );
            pass('a completed challenge still accepts submissions; an archived one does not');
        }

        section('review: the only place the payout is published');
        await refuses(404, 'participation_not_found', () =>
            part.review(pf._id, { decision: 'approved', reason: null } as never, actorOf(bob), UserRole.USER)
        );
        pass('a member who is neither a named reviewer nor CORE is refused with 404, like detail and queue');

        // The interesting case is the privileged one: rank alone must not let someone pay themselves.
        const selfDealer = await seedUser('Self Dealer', UserRole.COORDINATOR);
        const ownChallenge = await live();
        const ownP = await part.accept(ownChallenge._id, {}, actorOf(selfDealer));
        await part.submit(
            ownP._id,
            { proofs: [{ type: 'url', value: 'https://example.com/self', name: null }], notes: null } as never,
            actorOf(selfDealer)
        );
        await refuses(403, 'cannot_review_own_participation', () =>
            part.review(ownP._id, { decision: 'approved', reason: null } as never, actorOf(selfDealer), UserRole.COORDINATOR)
        );
        // ...and somebody else still can.
        const byOther = await part.review(ownP._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE);
        assert.strictEqual(byOther.status, 'approved');
        pass('a coordinator cannot approve their own participation, but another reviewer can');

        resetBus();
        const completed = collect<{ participation_id: string; challenge_id: string; member_user_ids: string[]; award_points: number }>('ChallengeCompleted');
        const approved = await part.review(pf._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE);
        completed.stop();

        assert.strictEqual(approved.status, 'approved');
        assert.strictEqual(approved.reward!.points_awarded, 50);
        assert.strictEqual(completed.events.length, 1, 'exactly one ChallengeCompleted');
        const payload = completed.events[0].payload;
        // The exact fields points-service/src/events/consumers.ts destructures.
        assert.strictEqual(payload.participation_id, pf._id);
        assert.strictEqual(payload.challenge_id, flow._id);
        assert.deepStrictEqual(payload.member_user_ids, [alice._id]);
        assert.strictEqual(typeof payload.award_points, 'number');
        assert.ok(payload.award_points > 0, 'award_points must be non-zero: the seeded rule defaults to 0, so a 0 here pays nobody, silently');
        pass('ChallengeCompleted carries the four fields the live consumer reads, with a non-zero award');

        const doubleClick = collect('ChallengeCompleted');
        await refuses(409, 'participation_not_reviewable', () =>
            part.review(pf._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE)
        );
        doubleClick.stop();
        assert.strictEqual(doubleClick.events.length, 0, 'a losing approve must publish nothing');
        assert.strictEqual((await Challenge.findById(flow._id))!.counts.approved, 1);
        pass('a second approve is 409, publishes nothing, and does not re-count');

        {
            // Two reviewers at once, not one after the other: both read `under_review`.
            const race = await live();
            const pr2 = await part.accept(race._id, {}, actorOf(bob));
            await part.submit(pr2._id, { proofs: [{ type: 'url', value: 'https://example.com/r', name: null }], notes: null } as never, actorOf(bob));
            const second = await seedUser('Second Reviewer', UserRole.CORE);
            resetBus();
            const paid = collect('ChallengeCompleted');
            const outcomes = await Promise.allSettled([
                part.review(pr2._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE),
                part.review(pr2._id, { decision: 'approved', reason: null } as never, actorOf(second), UserRole.CORE),
            ]);
            paid.stop();
            assert.strictEqual(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
            assert.strictEqual(paid.events.length, 1, 'exactly one ChallengeCompleted');
            assert.strictEqual((await Challenge.findById(race._id))!.counts.approved, 1, 'the loser gave its reservation back');
            pass('two concurrent approvals pay once and count once');
        }

        section('a named reviewer below CORE may review their own challenge');
        const scout = await seedUser('Scout', UserRole.MEMBER);
        const reviewed = await live({ reviewers: [scout._id] });
        const pr = await part.accept(reviewed._id, {}, actorOf(bob));
        await part.submit(pr._id, { proofs: [{ type: 'url', value: 'https://example.com/x', name: null }], notes: null } as never, actorOf(bob));
        const rejected = await part.review(pr._id, { decision: 'rejected', reason: 'blurry' } as never, actorOf(scout), UserRole.MEMBER);
        assert.strictEqual(rejected.status, 'rejected');
        pass('the challenge reviewers[] allow-list works below the CORE floor');

        const fixed = await part.submit(
            pr._id,
            { proofs: [{ type: 'url', value: 'https://example.com/clear', name: null }], notes: null } as never,
            actorOf(bob)
        );
        assert.strictEqual(fixed.status, 'under_review');
        assert.strictEqual(fixed.review, null, 'a resubmit clears the old verdict');
        pass('a rejected participation can resubmit, and the stale review is cleared');

        section('auto-approve pays on submit');
        resetBus();
        const trust = await live({ submission: { requires_proof: true, proof_types: ['text'], max_files: 1, auto_approve: true } });
        const auto = collect<{ award_points: number }>('ChallengeCompleted');
        const pa = await part.accept(trust._id, {}, actorOf(alice));
        const autoApproved = await part.submit(pa._id, { proofs: [{ type: 'text', value: 'done', name: null }], notes: null } as never, actorOf(alice));
        auto.stop();
        assert.strictEqual(autoApproved.status, 'approved');
        assert.strictEqual(auto.events.length, 1);
        assert.strictEqual(auto.events[0].payload.award_points, 50);
        // The review route is never involved on this path, so the reward has to be written by the
        // submit — without it fillRewardIds has nothing to fill and the payout is invisible.
        assert.ok(autoApproved.reward, 'an auto-approved participation still carries a reward');
        assert.strictEqual(autoApproved.reward!.points_awarded, 50);
        assert.strictEqual((await Challenge.findById(trust._id))!.counts.approved, 1);
        pass('auto_approve approves on submit, carries the reward, and publishes the same payout event');

        {
            // Core authors a trust challenge worth a fortune, accepts it and submits. `review` refuses
            // a member approving themselves; auto-approve must not be the way around that.
            const author = await seedUser('Author', UserRole.CORE);
            const jackpot = await live({ award_points: 100_000, submission: { requires_proof: true, proof_types: ['text'], max_files: 1, auto_approve: true } });
            resetBus();
            const minted = collect('ChallengeCompleted');
            const pj = await part.accept(jackpot._id, {}, actorOf(author));
            const held = await part.submit(pj._id, { proofs: [{ type: 'text', value: 'done', name: null }], notes: null } as never, actorOf(author));
            minted.stop();
            assert.strictEqual(held.status, 'under_review', 'a Core+ member goes to a reviewer');
            assert.strictEqual(held.reward, null);
            assert.strictEqual(minted.events.length, 0, 'and nothing is paid');
            assert.strictEqual((await Challenge.findById(jackpot._id))!.counts.approved, 0);
            await refuses(403, 'cannot_review_own_participation', () =>
                part.review(pj._id, { decision: 'approved', reason: null } as never, actorOf(author), UserRole.CORE)
            );
            pass('auto-approve does not pay a Core+ member: their submission waits for another reviewer');
        }

        {
            // A reviewer's rejection outlives a later switch to auto-approve.
            const strict = await live();
            const ps = await part.accept(strict._id, {}, actorOf(bob));
            const proof = { proofs: [{ type: 'url', value: 'https://example.com/s', name: null }], notes: null } as never;
            await part.submit(ps._id, proof, actorOf(bob));
            await part.review(ps._id, { decision: 'rejected', reason: 'no' } as never, adminActor, UserRole.CORE);
            await catalog.updateChallenge(strict._id, { submission: { auto_approve: true } } as never, adminActor);
            resetBus();
            const sneaky = collect('ChallengeCompleted');
            const back = await part.submit(ps._id, proof, actorOf(bob));
            sneaky.stop();
            assert.strictEqual(back.status, 'under_review', 'a rejected participation goes back to a reviewer');
            assert.strictEqual(sneaky.events.length, 0, 'and nothing is paid');
            pass('turning auto_approve on does not let a rejected participant approve themselves');

            // The second rejection of the same participation carries its ordinal.
            const rejections = collect<{ participation_id: string; rejection_no: number }>('ChallengeRejected');
            await part.review(ps._id, { decision: 'rejected', reason: 'still no' } as never, adminActor, UserRole.CORE);
            rejections.stop();
            assert.strictEqual(rejections.events.length, 1);
            assert.strictEqual(rejections.events[0].payload.rejection_no, 2, 'ChallengeRejected.rejection_no is 1-based per participation');
            pass('ChallengeRejected carries rejection_no');

            // The rejection is committed by the CAS; nothing replays its notice. An audit failure
            // after it may fail the request, but must not also swallow the event.
            const flaky = await live();
            const pk = await part.accept(flaky._id, {}, actorOf(alice));
            await part.submit(pk._id, proof, actorOf(alice));
            const notices = collect<{ participation_id: string }>('ChallengeRejected');
            const original = AuditLog.create.bind(AuditLog);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (AuditLog as any).create = async () => {
                throw new Error('audit storage is down');
            };
            try {
                await assert.rejects(part.review(pk._id, { decision: 'rejected', reason: 'no' } as never, adminActor, UserRole.CORE));
            } finally {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (AuditLog as any).create = original;
            }
            notices.stop();
            assert.strictEqual(notices.events.filter((e) => e.payload.participation_id === pk._id).length, 1);
            pass('a rejection is announced even when its audit row fails');
        }

        section('legend challenges announce themselves to Hall of Fame');
        resetBus();
        const legendEvents = collect('ChallengeLegendAchieved');
        const legend = await live({ difficulty: 'legend', submission: { requires_proof: true, proof_types: ['text'], max_files: 1, auto_approve: true } });
        const pl = await part.accept(legend._id, {}, actorOf(bob));
        await part.submit(pl._id, { proofs: [{ type: 'text', value: 'legendary', name: null }], notes: null } as never, actorOf(bob));
        legendEvents.stop();
        assert.strictEqual(legendEvents.events.length, 1);
        assert.strictEqual((await ChallengeParticipation.findById(pl._id))!.reward!.grants_hall_of_fame, true, 'the flag is frozen into the reward');
        pass('grants_hall_of_fame publishes ChallengeLegendAchieved alongside the payout');

        {
            // Leaderboard announces the entry; we write our own reward field.
            const { handlers: h } = await import('../events/consumers');
            await h.recordHallOfFame({ entry_id: 'hof-wrong', source: { type: 'challenge', id: uuid() }, participation_id: pl._id });
            assert.strictEqual((await ChallengeParticipation.findById(pl._id))!.reward!.hall_of_fame_entry_id, null, 'wrong challenge: no write');
            await h.recordHallOfFame({ entry_id: 'hof-1', source: { type: 'challenge', id: legend._id }, participation_id: pl._id });
            assert.strictEqual((await ChallengeParticipation.findById(pl._id))!.reward!.hall_of_fame_entry_id, 'hof-1');
            pass('HallOfFameEntryCreated fills reward.hall_of_fame_entry_id on the matching participation only');
        }

        section('team acceptance');
        const teamChallenge = await live({
            teaming: { enabled: true, team_size_min: 2, team_size_max: 4, max_teams: 1 },
        });
        const captain = await seedUser('Captain');
        const mate = await seedUser('Mate');
        const team = await Team.create({
            _id: uuid(),
            owner: { type: 'challenge', id: teamChallenge._id },
            name: 'The Pair',
            name_lower: 'the pair',
            captain_user_id: captain._id,
            invite_code: uuid().replace(/-/g, '').slice(0, 8),
            members: [
                { user_id: captain._id, display_name: 'Captain', avatar_url: null, registration_id: null, joined_at: new Date(), acquired_via: 'created' },
                { user_id: mate._id, display_name: 'Mate', avatar_url: null, registration_id: null, joined_at: new Date(), acquired_via: 'join_request' },
            ],
            size_min: 2,
            size_max: 4,
            // `forming` on purpose: nothing in registration-service ever produces 'complete', so a
            // fixture that used it was testing a state the platform cannot reach. Acceptance takes
            // a formed roster and locks it itself.
            status: 'forming',
        });

        await refuses(403, 'not_team_captain', () => part.accept(teamChallenge._id, { team_id: team._id }, actorOf(mate)));
        await refuses(409, 'teaming_not_enabled', () => part.accept(flow._id, { team_id: team._id }, actorOf(captain)));
        {
            const otherTeamed = await live({ teaming: { enabled: true, team_size_min: 2, team_size_max: 4, max_teams: 5 } });
            await refuses(409, 'team_wrong_owner', () => part.accept(otherTeamed._id, { team_id: team._id }, actorOf(captain)));
        }
        await refuses(409, 'team_required', () => part.accept(teamChallenge._id, {}, actorOf(bob)));
        pass('a teamed challenge is team-only: one kind of participant per cap');

        // A disbanded roster is the one state that cannot accept.
        await Team.updateOne({ _id: team._id }, { $set: { status: 'disbanded' } });
        await refuses(409, 'team_disbanded', () => part.accept(teamChallenge._id, { team_id: team._id }, actorOf(captain)));
        await Team.updateOne({ _id: team._id }, { $set: { status: 'forming' } });
        const tp = await part.accept(teamChallenge._id, { team_id: team._id }, actorOf(captain));
        assert.strictEqual(tp.participant.type, 'team');
        assert.deepStrictEqual([...tp.member_user_ids].sort(), [captain._id, mate._id].sort());
        assert.strictEqual(tp.status_history[0].by, captain._id, 'history names the captain who accepted, not the team');
        pass('a team still `forming` can accept — that is the only state a real roster is ever in');

        // The same captain clicking again on a full (max_teams 1) challenge.
        await refuses(409, 'already_accepted', () => part.accept(teamChallenge._id, { team_id: team._id }, actorOf(captain)));
        pass('a team re-click at the cap is already_accepted');

        const rival = await Team.create({
            _id: uuid(),
            owner: { type: 'challenge', id: teamChallenge._id },
            name: 'Rivals',
            name_lower: 'rivals',
            captain_user_id: mate._id,
            invite_code: uuid().replace(/-/g, '').slice(0, 8),
            members: [
                { user_id: mate._id, display_name: 'Mate', avatar_url: null, registration_id: null, joined_at: new Date(), acquired_via: 'created' },
                { user_id: alice._id, display_name: 'Alice', avatar_url: null, registration_id: null, joined_at: new Date(), acquired_via: 'join_request' },
            ],
            size_min: 2,
            size_max: 4,
            status: 'forming',
        });
        // The unique index is on the TEAM id, so without the overlap query this would be accepted
        // and Points would pay `mate` twice.
        await refuses(409, 'member_already_participating', () =>
            part.accept(teamChallenge._id, { team_id: rival._id }, actorOf(mate))
        );
        pass('a member already on another accepted roster is refused — the index cannot express this');

        // Teaming switched off after the team accepted: a member must not come back alone, or
        // Points pays them on two participations.
        await catalog.updateChallenge(teamChallenge._id, { teaming: { enabled: false } } as never, adminActor);
        await refuses(409, 'member_already_participating', () => part.accept(teamChallenge._id, {}, actorOf(mate)));
        pass('a member of an accepted team cannot also accept solo');

        resetBus();
        const teamPayout = collect<{ member_user_ids: string[]; award_points: number }>('ChallengeCompleted');
        await part.submit(tp._id, { proofs: [{ type: 'url', value: 'https://example.com/team', name: null }], notes: null } as never, actorOf(captain));
        await part.review(tp._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE);
        teamPayout.stop();
        assert.strictEqual(teamPayout.events[0].payload.member_user_ids.length, 2);
        pass('a team payout names both members — Points fans out over exactly this list');

        section('the reviewer queue is a work queue: oldest submission first');
        {
            const qc = await live({ reviewers: [admin._id] });
            const workers = await Promise.all([...Array(3)].map(() => seedUser('Worker')));
            const pids: string[] = [];
            for (const w of workers) {
                const pw = await part.accept(qc._id, {}, actorOf(w));
                pids.push(pw._id);
            }
            // Submit middle, first, last. Deliberately an order that matches NEITHER acceptance
            // ascending NOR descending — reverse order would have made "oldest submitted" and
            // "newest accepted" the same sequence, and the test would pass against either sort.
            const submitOrder = [1, 0, 2];
            for (const i of submitOrder) {
                await part.submit(pids[i], { proofs: [{ type: 'url', value: 'https://example.com/q', name: null }], notes: null } as never, actorOf(workers[i]));
                await new Promise((r) => setTimeout(r, 15));
            }
            const expected = submitOrder.map((i) => pids[i]);
            assert.notDeepStrictEqual(expected, pids, 'the fixture must not coincide with acceptance order');
            assert.notDeepStrictEqual(expected, [...pids].reverse(), 'nor with reverse acceptance order');

            const page = await part.queue(qc._id, { status: 'under_review', limit: 10 } as never);
            const order = page.rows.map((r) => r._id);
            assert.deepStrictEqual(order, expected, 'the queue must run oldest submission first');
            const times = page.rows.map((r) => r.submission!.submitted_at.getTime());
            assert.deepStrictEqual(times, [...times].sort((a, b) => a - b), 'submitted_at must ascend');
            pass('the queue orders by submission time ascending, not by acceptance');

            // Paginate it, since the cursor now runs in the other direction too.
            const first = await part.queue(qc._id, { status: 'under_review', limit: 2 } as never);
            assert.strictEqual(first.rows.length, 2);
            assert.ok(first.next_cursor);
            const second = await part.queue(qc._id, { status: 'under_review', limit: 2, cursor: first.next_cursor! } as never);
            assert.deepStrictEqual(
                [...first.rows, ...second.rows].map((r) => r._id),
                order,
                'an ascending keyset cursor must cover the queue exactly once'
            );
            pass('the ascending cursor paginates the queue without gaps or repeats');

            // `accepted` rows carry no submission, so the sort field is null there. That used to be
            // a 500 from `.toISOString()` on the cursor.
            const accepted = await part.queue(qc._id, { status: 'accepted', limit: 1 } as never);
            assert.ok(Array.isArray(accepted.rows), 'a status with no submission must still list');
            pass('a status whose sort field is null lists instead of 500-ing');

            // In-person challenges are approved straight out of `accepted`, with no submission, so
            // `approved` cannot page by `submitted_at`: it used to stop after the first page.
            const inPerson = await live({ submission: { requires_proof: false, max_files: 0, auto_approve: false } });
            const walkers = await Promise.all([...Array(3)].map(() => seedUser('Walker')));
            for (const w of walkers) {
                const pw = await part.accept(inPerson._id, {}, actorOf(w));
                await part.review(pw._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE);
            }
            const ap1 = await part.queue(inPerson._id, { status: 'approved', limit: 2 } as never);
            assert.ok(ap1.next_cursor, 'a full page of approvals with no submission still carries a cursor');
            const ap2 = await part.queue(inPerson._id, { status: 'approved', limit: 2, cursor: ap1.next_cursor! } as never);
            assert.strictEqual(new Set([...ap1.rows, ...ap2.rows].map((r) => r._id)).size, 3);
            pass('the approved list pages past the first page when nothing was submitted');
        }

        section('reward ids are read back from the ledger, not listened for');
        const fresh = await ChallengeParticipation.findById(tp._id);
        assert.deepStrictEqual(fresh!.reward!.point_transaction_ids, [], 'empty until the rows exist');

        // Stand in for the Points Service: the rows it would have written, with the keys it uses.
        const txIds: string[] = [];
        for (const uid of fresh!.member_user_ids) {
            const txId = uuid();
            txIds.push(txId);
            await PointTransaction.create({
                _id: txId,
                user_id: uid,
                amount: 50,
                type: 'earn',
                source: 'challenge',
                reason: 'challenge.completed',
                reference: { type: 'challenge', id: teamChallenge._id },
                idempotency_key: idempotencyKey.challengeCompleted(tp._id, uid),
                balance_after: 50,
                actor: { type: 'system', user_id: null },
            });
        }

        const filled = await part.fillRewardIds((await ChallengeParticipation.findById(tp._id))!);
        assert.deepStrictEqual([...filled.reward!.point_transaction_ids].sort(), [...txIds].sort());
        const persisted = await ChallengeParticipation.findById(tp._id);
        assert.strictEqual(persisted!.reward!.point_transaction_ids.length, 2, 'the fill is persisted, not recomputed forever');
        // Idempotent: a second call must not duplicate.
        await part.fillRewardIds(persisted!);
        assert.strictEqual((await ChallengeParticipation.findById(tp._id))!.reward!.point_transaction_ids.length, 2);
        pass('fillRewardIds matches by idempotency key, persists, and is idempotent');

        section('the expiry sweeper is the only exit from accepted');
        const expiring = await live({
            window: { opens_at: null, closes_at: null, submissions_close_at: null, time_limit_minutes: 1 },
        });
        const pe = await part.accept(expiring._id, {}, actorOf(alice));
        await ChallengeParticipation.updateOne({ _id: pe._id }, { $set: { deadline_at: new Date(Date.now() - 1000) } });

        resetBus();
        const expired = collect<{ participation_id: string }>('ChallengeExpired');
        // Two ticks CONCURRENTLY, which is what two containers do. Sequential ticks would pass
        // with no compare-and-swap at all — the second one's `find` filters on `status: 'accepted'`
        // and simply returns nothing, so the guard that actually matters is never exercised.
        const [tickA, tickB] = await Promise.all([tick(), tick()]);
        expired.stop();

        // Counted per row, not per tick: other fixtures above are overdue too, so a tick total
        // says nothing about whether THIS row was moved twice.
        const row = (await ChallengeParticipation.findById(pe._id))!;
        assert.strictEqual(row.status, 'expired');
        const transitions = row.status_history.filter((h) => h.to === 'expired').length;
        assert.strictEqual(transitions, 1, `status_history records ${transitions} expiries for one row, want 1`);
        const mine = expired.events.filter((e) => e.payload.participation_id === pe._id);
        assert.strictEqual(mine.length, 1, `${mine.length} ChallengeExpired reached the bus for one row, want 1`);
        void tickA;
        void tickB;

        assert.strictEqual((await tick()).expired, 0, 'a later tick finds nothing left to do');
        pass('two concurrent sweepers expire an overdue participation exactly once, and publish once');

        const closing = await live({
            window: {
                opens_at: null,
                closes_at: new Date(Date.now() - 1000),
                submissions_close_at: null,
                time_limit_minutes: null,
            },
        });
        await tick();
        assert.strictEqual((await Challenge.findById(closing._id))!.status, 'completed');
        pass('a challenge past window.closes_at auto-completes');

        // An evergreen challenge sets no deadline at all. `deadline_at: null` must never match the
        // sweeper's `$lte` — it does not, because Mongo brackets comparisons by BSON type, but that
        // is exactly the kind of guarantee a well-meant `$or: [{deadline_at: null}, ...]` breaks.
        const evergreen = await live();
        const pever = await part.accept(evergreen._id, {}, actorOf(bob));
        assert.strictEqual(pever.deadline_at, null, 'no window and no time limit means no deadline');
        await tick();
        assert.strictEqual((await ChallengeParticipation.findById(pever._id))!.status, 'accepted');
        pass('a participation with no deadline is never swept');

        // Expiry does not free the unique slot, and that is deliberate: `expired` is terminal in
        // challenge-model.md §3.1 and there is no edge back to `accepted`.
        await refuses(409, 'already_accepted', () => part.accept(expiring._id, {}, actorOf(alice)));
        assert.strictEqual((await Challenge.findById(expiring._id))!.counts.accepted, 1, 'nor does it give the seat back');
        pass('one attempt per participant per challenge — expiring is terminal, not a reset');

        section('snapshot maintenance');
        const { handlers } = await import('../events/consumers');
        await User.updateOne({ _id: alice._id }, { $set: { 'profile.full_name': 'Alice Renamed' } });
        await handlers.refreshSnapshot({ user_id: alice._id, changed_fields: ['full_name'] });
        assert.strictEqual((await ChallengeParticipation.findById(p1._id))!.participant.display_name, 'Alice Renamed');
        // A (replayed) UserDeleted for an account that is not deleted now is ignored.
        await handlers.anonymize({ user_id: alice._id });
        assert.strictEqual((await ChallengeParticipation.findById(p1._id))!.participant.display_name, 'Alice Renamed', 'not deleted: no-op');
        await User.updateOne({ _id: alice._id }, { $set: { deleted_at: new Date() } });
        await handlers.anonymize({ user_id: alice._id });
        assert.strictEqual((await ChallengeParticipation.findById(p1._id))!.participant.display_name, 'Deleted user');
        const teamRow = await ChallengeParticipation.findById(tp._id);
        assert.strictEqual(teamRow!.participant.display_name, 'The Pair', 'a team snapshot is not a user snapshot');
        pass('UserProfileUpdated refreshes and UserDeleted anonymizes, solo rows only, deleted accounts only');

        // A profile refresh that read the user alive before the anonymization landed must not undo it.
        await User.updateOne({ _id: alice._id }, { $set: { deleted_at: null } });
        await handlers.refreshSnapshot({ user_id: alice._id, changed_fields: ['full_name'] });
        assert.strictEqual((await ChallengeParticipation.findById(p1._id))!.participant.display_name, 'Deleted user');
        pass('a profile refresh never un-anonymizes a row; only a restore does');

        await handlers.restoreSnapshot({ user_id: alice._id });
        const restored = (await ChallengeParticipation.findById(p1._id))!;
        assert.strictEqual(restored.participant.display_name, 'Alice Renamed');
        assert.strictEqual(restored.participant.deleted, false, 'the anonymized flag is cleared');
        pass('UserRestored re-snapshots from users and clears participant.deleted');

        section('the replay sweep republishes what the bus may have lost');
        {
            // Rows approved more than the settle time ago; everything else in this DB is fresher.
            const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
            const backdate = (id: string) =>
                ChallengeParticipation.updateOne({ _id: id }, { $set: { updated_at: tenMinutesAgo } }, { timestamps: false });

            // (A) `pf` was approved above and Points never wrote its rows here.
            await backdate(pf._id);
            resetBus();
            const replayed = collect<{ participation_id: string; award_points: number }>('ChallengeCompleted');
            await replayTick();
            replayed.stop();
            const mineA = replayed.events.filter((e) => e.payload.participation_id === pf._id);
            assert.strictEqual(mineA.length, 1, 'an approval with no ledger rows is republished');
            assert.strictEqual(mineA[0].payload.award_points, 50, 'with the snapshot amount');

            await PointTransaction.create({
                _id: uuid(),
                user_id: alice._id,
                amount: 50,
                type: 'earn',
                source: 'challenge',
                reason: 'challenge.completed',
                reference: { type: 'challenge', id: flow._id },
                idempotency_key: idempotencyKey.challengeCompleted(pf._id, alice._id),
                balance_after: 100,
                actor: { type: 'system', user_id: null },
            });
            await backdate(pf._id);
            const again = collect<{ participation_id: string }>('ChallengeCompleted');
            await replayTick();
            again.stop();
            assert.strictEqual(again.events.filter((e) => e.payload.participation_id === pf._id).length, 0, 'paid: not republished');
            assert.strictEqual((await ChallengeParticipation.findById(pf._id))!.reward!.point_transaction_ids.length, 1, 'and the ids are filled');
            assert.strictEqual((await ChallengeParticipation.findById(pf._id))!.updated_at.getTime(), tenMinutesAgo.getTime(),
                'the fill does not touch updated_at, so a partial payout still ages out of the window');
            pass('ChallengeCompleted is republished until the ledger shows the payout, then never again');

            // (B) a legend approval whose Hall of Fame entry never arrived.
            const legend2 = await live({ difficulty: 'legend', submission: { requires_proof: true, proof_types: ['text'], max_files: 1, auto_approve: true } });
            const pl2 = await part.accept(legend2._id, {}, actorOf(bob));
            await part.submit(pl2._id, { proofs: [{ type: 'text', value: 'again', name: null }], notes: null } as never, actorOf(bob));
            await backdate(pl2._id);
            const lost = collect<{ participation_id: string }>('ChallengeLegendAchieved');
            await replayTick();
            lost.stop();
            assert.strictEqual(lost.events.filter((e) => e.payload.participation_id === pl2._id).length, 1, 'no entry: republished');

            // Leaderboard made the entry but its announcement was lost: read it back instead.
            await HallOfFameEntry.collection.insertOne({
                _id: 'hof-readback' as never,
                category: 'challenge_legend',
                honoree: { type: 'user', id: bob._id, display_name: 'Bob' },
                source: { type: 'challenge', id: legend2._id },
                deleted_at: null,
            });
            await backdate(pl2._id);
            const quiet = collect<{ participation_id: string }>('ChallengeLegendAchieved');
            await replayTick();
            quiet.stop();
            assert.strictEqual(quiet.events.filter((e) => e.payload.participation_id === pl2._id).length, 0);
            assert.strictEqual((await ChallengeParticipation.findById(pl2._id))!.reward!.hall_of_fame_entry_id, 'hof-readback');
            pass('a legend approval is re-announced, or linked by reading Hall of Fame back when the entry exists');

            // The flag an approval froze wins over the challenge's flag now: switching Hall of Fame
            // on afterwards must not mint a Legend for `pf`, approved while `flow` did not grant it.
            await Challenge.updateOne({ _id: flow._id }, { $set: { grants_hall_of_fame: true } });
            await backdate(pf._id);
            const late = collect<{ participation_id: string }>('ChallengeLegendAchieved');
            await replayTick();
            late.stop();
            assert.strictEqual(late.events.filter((e) => e.payload.participation_id === pf._id).length, 0);
            // A row approved before the reward carried the flag falls back to the challenge's.
            await ChallengeParticipation.updateOne({ _id: pf._id }, { $unset: { 'reward.grants_hall_of_fame': 1 } }, { timestamps: false });
            await backdate(pf._id);
            const legacy = collect<{ participation_id: string }>('ChallengeLegendAchieved');
            await replayTick();
            legacy.stop();
            assert.strictEqual(legacy.events.filter((e) => e.payload.participation_id === pf._id).length, 1);
            await Challenge.updateOne({ _id: flow._id }, { $set: { grants_hall_of_fame: false } });
            pass('the replay reads the Hall of Fame flag frozen at approval, falling back to the challenge only for older rows');
        }

        section('withdraw: Core+ undo, compare-and-swap, the seat comes back');
        {
            const capped2 = await live({ max_participants: 5 });
            const [w1, w2, w3, w4] = await Promise.all([...Array(4)].map(() => seedUser('Withdrawn')));
            const pw1 = await part.accept(capped2._id, {}, actorOf(w1));
            const proof = { proofs: [{ type: 'url', value: 'https://example.com/w', name: null }], notes: null } as never;
            const pw2 = await part.accept(capped2._id, {}, actorOf(w2));
            await part.submit(pw2._id, proof, actorOf(w2));
            const pw3 = await part.accept(capped2._id, {}, actorOf(w3));
            await part.submit(pw3._id, proof, actorOf(w3));
            await part.review(pw3._id, { decision: 'rejected', reason: 'no' } as never, adminActor, UserRole.CORE);
            const pw4 = await part.accept(capped2._id, {}, actorOf(w4));
            await part.submit(pw4._id, proof, actorOf(w4));
            await part.review(pw4._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE);
            assert.strictEqual((await Challenge.findById(capped2._id))!.counts.accepted, 4);

            // Two admins at once on the same row: one transition, one audit row, one seat back.
            const both = await Promise.allSettled([part.withdraw(pw1._id, 'dup', adminActor), part.withdraw(pw1._id, 'dup', adminActor)]);
            assert.strictEqual(both.filter((o) => o.status === 'fulfilled').length, 1);
            const loser = both.find((o) => o.status === 'rejected') as PromiseRejectedResult;
            assert.strictEqual((loser.reason as ServiceError).code, 'participation_not_withdrawable');
            const w1row = (await ChallengeParticipation.findById(pw1._id))!;
            assert.strictEqual(w1row.status, 'withdrawn');
            assert.strictEqual(w1row.status_history.filter((h) => h.to === 'withdrawn').length, 1);
            assert.strictEqual(await AuditLog.countDocuments({ action: 'challenge.withdrawn', 'new_value.participation_id': pw1._id }), 1);
            assert.strictEqual((await Challenge.findById(capped2._id))!.counts.accepted, 3, 'the seat is released once');

            assert.strictEqual((await part.withdraw(pw2._id, null, adminActor)).status, 'withdrawn', 'from under_review');
            assert.strictEqual((await part.withdraw(pw3._id, null, adminActor)).status, 'withdrawn', 'from rejected');
            await refuses(409, 'participation_not_withdrawable', () => part.withdraw(pw4._id, null, adminActor));
            assert.strictEqual((await Challenge.findById(capped2._id))!.counts.accepted, 1);
            pass('withdraw is a CAS from accepted/submitted/under_review/rejected, never approved; it audits and gives the seat back');
        }

        section('deleting a challenge never strands a submission or orphans a payout');
        {
            const pending = await live();
            const pp = await part.accept(pending._id, {}, actorOf(alice));
            await part.submit(pp._id, { proofs: [{ type: 'url', value: 'https://example.com/d', name: null }], notes: null } as never, actorOf(alice));
            await refuses(409, 'challenge_has_pending_submissions', () => catalog.softDelete(pending._id, adminActor));
            pass('a challenge with a submission awaiting review cannot be deleted');

            // An approve and a delete racing: whichever lands, never an approved row on a deleted
            // challenge. In-person challenges approve straight out of `accepted`, so the pending
            // guard above is not what decides these.
            // Jittered starts, so the interleavings differ from run to run rather than one side always
            // finishing first.
            const after = <T>(ms: number, fn: () => Promise<T>) => new Promise((r) => setTimeout(r, ms)).then(fn);
            for (let i = 0; i < 12; i++) {
                const racing = await live({ submission: { requires_proof: false, max_files: 0, auto_approve: false } });
                const racer = await seedUser('Racer');
                const pr3 = await part.accept(racing._id, {}, actorOf(racer));
                await Promise.allSettled([
                    after(i % 4, () => catalog.softDelete(racing._id, adminActor)),
                    after(3 - (i % 4), () => part.review(pr3._id, { decision: 'approved', reason: null } as never, adminActor, UserRole.CORE)),
                ]);
                const c = (await Challenge.findById(racing._id))!;
                const row = (await ChallengeParticipation.findById(pr3._id))!;
                assert.ok(!(c.deleted_at && row.status === 'approved'), 'an approved participation on a deleted challenge');
                assert.strictEqual(c.counts.approved, row.status === 'approved' ? 1 : 0, 'the reservation matches the outcome');
            }
            pass('a delete racing an approve: one of them wins, never both');

            const audited = await live();
            await catalog.softDelete(audited._id, adminActor);
            const row = await AuditLog.findOne({ action: 'challenge.deleted', target_id: audited._id }).lean();
            assert.strictEqual((row!.previous_value as { status: string }).status, 'active', 'the audit records the real previous status');
            pass('the delete audit carries the status the challenge actually had');
        }

        console.log('\nparticipation.selfcheck: all good.');
    } finally {
        await closeScratchDb();
    }
}

main().catch((err) => {
    console.error('\nparticipation.selfcheck FAILED:', err);
    process.exit(1);
});
