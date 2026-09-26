import assert from 'assert';
import { Challenge, ChallengeParticipation, ServiceError, UserRole } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import * as catalog from '../challenges/challenge.service';
import { CreateChallengeBody, UpdateChallengeBody } from '../challenges/challenge.schemas';
import { actorOf, challengeInput, closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * The catalog: normalization, the invariants, the transitions.
 *
 * Model invariants themselves are tested in packages/shared/src/models/models.selfcheck.ts and are
 * NOT retested here (adding-a-service.md §7.1). What is tested here is that this service refuses
 * every one of them as a 4xx BEFORE .save() — because the model hook throws a plain Error, which
 * the shared handler maps to 500 (§6.3).
 *
 *   npx ts-node src/selfcheck/challenge.selfcheck.ts
 */

const section = (name: string) => console.log(`\n-- ${name} --`);
const pass = (what: string) => console.log(`  ok  ${what}`);

/** Asserts a refusal is a deliberate ServiceError, never the model hook surfacing as a 500. */
async function refuses(status: number, code: string, fn: () => Promise<unknown>): Promise<void> {
    try {
        await fn();
    } catch (err) {
        assert.ok(
            err instanceof ServiceError,
            `expected ServiceError ${code}, got ${(err as Error).constructor.name}: ${(err as Error).message}`
        );
        assert.strictEqual(err.status, status, `expected ${status} for ${code}, got ${err.status} (${err.code})`);
        assert.strictEqual(err.code, code);
        return;
    }
    assert.fail(`expected ${status} ${code}, but the call succeeded`);
}

async function main(): Promise<void> {
    await openScratchDb();
    try {
        const admin = await seedUser('Catalog Admin', UserRole.CORE);
        const actor = actorOf(admin);

        section('normalization keeps a valid request out of the model hook');

        // The schema default fills proof_types with ['url','text'] while requires_proof is false,
        // which the model hook (Challenge.ts:173) throws about as a plain Error -> 500.
        const noProof = await catalog.createChallenge(
            challengeInput({ submission: { requires_proof: false, max_files: 0, auto_approve: false } }) as never,
            actor
        );
        assert.deepStrictEqual(noProof.submission.proof_types, []);
        pass('requires_proof:false normalizes proof_types to [] instead of 500-ing');

        const soloTeaming = await catalog.createChallenge(
            challengeInput({ teaming: { enabled: false, team_size_min: 3, team_size_max: 9, max_teams: 2 } }) as never,
            actor
        );
        assert.strictEqual(soloTeaming.teaming.team_size_min, null);
        assert.strictEqual(soloTeaming.teaming.max_teams, null);
        pass('teaming disabled normalizes the sizes to null');

        const legend = await catalog.createChallenge(challengeInput({ difficulty: 'legend' }) as never, actor);
        assert.strictEqual(legend.grants_hall_of_fame, true);
        const legendOverride = await catalog.createChallenge(
            challengeInput({ difficulty: 'legend', grants_hall_of_fame: false }) as never,
            actor
        );
        assert.strictEqual(legendOverride.grants_hall_of_fame, false);
        pass('legend grants Hall of Fame by default, and an explicit false still wins');

        section('every invariant is a 422, never a 500');

        await refuses(422, 'location_required_for_physical_challenge', () =>
            catalog.createChallenge(challengeInput({ kind: 'physical', location: null }) as never, actor)
        );
        await refuses(422, 'invalid_team_size', () =>
            catalog.createChallenge(
                challengeInput({ teaming: { enabled: true, team_size_min: 5, team_size_max: 2, max_teams: null } }) as never,
                actor
            )
        );
        await refuses(422, 'invalid_window', () =>
            catalog.createChallenge(
                challengeInput({
                    window: {
                        opens_at: new Date(Date.now() + 86_400_000),
                        closes_at: new Date(Date.now() + 3600_000),
                        submissions_close_at: null,
                        time_limit_minutes: null,
                    },
                }) as never,
                actor
            )
        );
        await refuses(422, 'auto_approve_needs_proof', () =>
            catalog.createChallenge(
                challengeInput({ submission: { requires_proof: false, max_files: 0, auto_approve: true } }) as never,
                actor
            )
        );
        await refuses(422, 'proof_type_not_available_yet', () =>
            catalog.createChallenge(
                challengeInput({ submission: { requires_proof: true, proof_types: ['image'], max_files: 5, auto_approve: false } }) as never,
                actor
            )
        );
        await refuses(422, 'max_files_required', () =>
            catalog.createChallenge(
                challengeInput({ submission: { requires_proof: true, proof_types: ['url'], max_files: 0, auto_approve: false } }) as never,
                actor
            )
        );
        pass('physical/team-size/window/auto-approve/media-proof/zero-files all refuse as 422');

        section('request schemas');
        {
            // zod 4 applies `.default()` inside `.partial()`; the update schema must carry none.
            assert.deepStrictEqual(Object.keys(UpdateChallengeBody.parse({ title: 'x' })), ['title'], 'a PATCH body is only what was sent');
            assert.deepStrictEqual(UpdateChallengeBody.parse({ teaming: { max_teams: 5 } }).teaming, { max_teams: 5 }, 'nested groups too');
            const js = CreateChallengeBody.safeParse({ ...challengeInput(), resources: [{ label: 'x', url: 'javascript:alert(1)' }] });
            assert.ok(!js.success, 'a javascript: resource URL is refused');
            assert.ok(!CreateChallengeBody.safeParse({ ...challengeInput(), cover_media_url: 'javascript:alert(1)' }).success);
            pass('PATCH parses to exactly the sent fields; only http(s) URLs are accepted');
        }

        section('a PATCH merges into what is stored');
        {
            const reviewer = await seedUser('Kept Reviewer');
            const rich = await catalog.createChallenge(
                challengeInput({
                    brief_hidden_until_accept: true,
                    max_participants: 7,
                    reviewers: [reviewer._id],
                    tags: ['Keep'],
                    teaming: { enabled: true, team_size_min: 2, team_size_max: 4, max_teams: 3 },
                    window: { opens_at: null, closes_at: new Date(Date.now() + 86_400_000), submissions_close_at: null, time_limit_minutes: 30 },
                    submission: { requires_proof: true, proof_types: ['url'], max_files: 2, auto_approve: false },
                }) as never,
                actor
            );
            const renamed = await catalog.updateChallenge(rich._id, UpdateChallengeBody.parse({ title: 'Renamed Rich' }) as never, actor);
            assert.strictEqual(renamed.brief_hidden_until_accept, true);
            assert.strictEqual(renamed.max_participants, 7);
            assert.deepStrictEqual([...renamed.reviewers], [reviewer._id]);
            assert.deepStrictEqual([...renamed.tags], ['keep'], 'tags are lowercased per element');
            assert.strictEqual(renamed.teaming.enabled, true);
            assert.strictEqual(renamed.window.time_limit_minutes, 30);
            assert.deepStrictEqual([...renamed.submission.proof_types], ['url']);
            assert.strictEqual(renamed.submission.max_files, 2);

            const oneKnob = await catalog.updateChallenge(rich._id, UpdateChallengeBody.parse({ teaming: { max_teams: 5 } }) as never, actor);
            assert.strictEqual(oneKnob.teaming.enabled, true, 'changing max_teams does not switch teaming off');
            assert.strictEqual(oneKnob.teaming.max_teams, 5);
            assert.strictEqual(oneKnob.teaming.team_size_min, 2);
            pass('PATCH { title } keeps every other field; PATCH { teaming: { max_teams } } changes one number');
        }

        section('slugs');
        const a = await catalog.createChallenge(challengeInput({ title: 'Run Five K' }) as never, actor);
        const b = await catalog.createChallenge(challengeInput({ title: 'Run Five K' }) as never, actor);
        assert.strictEqual(a.slug, 'run-five-k');
        assert.notStrictEqual(b.slug, a.slug);
        assert.ok(b.slug.startsWith('run-five-k-'));
        pass('a colliding title gets a suffixed slug, not a duplicate-key 500');

        // Every one of these sees the base slug free, because they all check before any of them
        // inserts. One wins the base; the rest hit the unique index and must recover.
        const title = `Race ${uuid().slice(0, 8)}`;
        const racers = await Promise.allSettled([1, 2, 3, 4, 5].map(() => catalog.createChallenge(challengeInput({ title }) as never, actor)));
        const won = racers.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ slug: string }>[];
        assert.strictEqual(won.length, 5, `5 concurrent creates of one title produced ${won.length} challenges — a slug race is a 500, not a refusal`);
        assert.strictEqual(new Set(won.map((r) => r.value.slug)).size, 5, 'and every slug is distinct');
        pass('5 concurrent creates of the same title all succeed with distinct slugs');

        // 99 + separator puts the separator at exactly character 100, which is where the slice
        // lands. 98 does not, which is why the first version of this test passed either way.
        const longTitle = 'a'.repeat(99) + ' word';
        const cut = await catalog.createChallenge(challengeInput({ title: longTitle }) as never, actor);
        assert.ok(!cut.slug.endsWith('-'), `slug '${cut.slug}' ends with a separator`);
        assert.ok(!cut.slug.startsWith('-'));
        pass('a title sliced mid-word does not leave a trailing separator');

        const unicodeOnly = await catalog.createChallenge(challengeInput({ title: 'दौड़' }) as never, actor);
        assert.ok(unicodeOnly.slug.length > 0, 'a title with no Latin characters still gets a slug');
        pass('a title that reduces to nothing falls back rather than saving an empty slug');

        section('status transitions are compare-and-swaps');
        const c = await catalog.createChallenge(challengeInput() as never, actor);
        const [first, second] = await Promise.allSettled([
            catalog.transition(c._id, 'activate', actor),
            catalog.transition(c._id, 'activate', actor),
        ]);
        const outcomes = [first, second].map((r) => r.status);
        assert.ok(outcomes.includes('fulfilled') && outcomes.includes('rejected'), 'exactly one activate must win');
        const loser = [first, second].find((r) => r.status === 'rejected') as PromiseRejectedResult;
        assert.strictEqual((loser.reason as ServiceError).status, 409);
        pass('two simultaneous activates: one 200, one 409');

        await refuses(409, 'challenge_not_draft', () => catalog.transition(c._id, 'activate', actor));
        await refuses(404, 'challenge_not_found', () => catalog.transition(uuid(), 'activate', actor));
        pass('wrong state is a 409 and a missing id is a 404 — distinguishable');

        section('repricing and deletion');
        const priced = await catalog.createChallenge(challengeInput({ award_points: 10 }) as never, actor);
        await catalog.updateChallenge(priced._id, { award_points: 20 } as never, actor);
        pass('award_points is editable while nobody has accepted');

        await ChallengeParticipation.create({
            _id: uuid(),
            challenge_id: priced._id,
            challenge_snapshot: { title: priced.title, difficulty: priced.difficulty, award_points: 20 },
            participant: { type: 'user', id: admin._id, display_name: 'Catalog Admin', avatar_url: null },
            member_user_ids: [admin._id],
            status: 'approved',
            accepted_at: new Date(),
            review: { reviewer_user_id: admin._id, decision: 'approved', reason: null, reviewed_at: new Date() },
        });

        await refuses(409, 'challenge_has_participations', () =>
            catalog.updateChallenge(priced._id, { award_points: 30 } as never, actor)
        );
        pass('repricing is refused once a participation snapshotted the old amount');

        await refuses(409, 'challenge_has_approved_participations', () => catalog.softDelete(priced._id, actor));
        pass('deleting is refused while an approved participation stands — the ledger references it');

        // Same-value patch must not trip the participation guard: it changes nothing.
        await catalog.updateChallenge(priced._id, { award_points: 20, title: 'Renamed' } as never, actor);
        pass('a patch that does not move award_points is still allowed');

        // The Legend rule has to fire on BOTH write paths. It used to fire only on create, so a
        // challenge promoted to Legend by PATCH never reached Hall of Fame.
        const promoted = await catalog.createChallenge(challengeInput({ difficulty: 'easy' }) as never, actor);
        assert.strictEqual(promoted.grants_hall_of_fame, false);
        const nowLegend = await catalog.updateChallenge(promoted._id, { difficulty: 'legend' } as never, actor);
        assert.strictEqual(nowLegend.grants_hall_of_fame, true, 'promoting to legend grants Hall of Fame');

        const promotedButRefused = await catalog.createChallenge(challengeInput({ difficulty: 'easy' }) as never, actor);
        const explicit = await catalog.updateChallenge(
            promotedButRefused._id,
            { difficulty: 'legend', grants_hall_of_fame: false } as never,
            actor
        );
        assert.strictEqual(explicit.grants_hall_of_fame, false, 'an explicit false still wins on update');

        const alreadyLegend = await catalog.createChallenge(
            challengeInput({ difficulty: 'legend', grants_hall_of_fame: false }) as never,
            actor
        );
        const reLegend = await catalog.updateChallenge(alreadyLegend._id, { difficulty: 'legend' } as never, actor);
        assert.strictEqual(reLegend.grants_hall_of_fame, false, 'a no-op difficulty patch does not re-apply the default');
        pass('the Legend default fires on update as well as create, and never overrides an explicit choice');

        section('reads');
        await catalog.transition(c._id, 'complete', actor);
        const staff = { admin: true };
        const student = { admin: false };
        const activeOnly = await catalog.listChallenges({ status: 'active', limit: 50 } as never, student);
        assert.ok(!activeOnly.rows.some((r) => r._id === c._id), 'a completed challenge is not in the active list');
        const byKey = await catalog.getByKey(a.slug, staff);
        assert.strictEqual(byKey._id, a._id);
        assert.strictEqual((await catalog.getByKey(a._id, staff))._id, a._id);
        pass('detail resolves by slug and by id; filters respect status');

        // `a` is still a draft: unpublished below Core, on both read paths.
        await refuses(404, 'challenge_not_found', () => catalog.getByKey(a.slug, student));
        await refuses(403, 'forbidden', () => catalog.listChallenges({ status: 'draft', limit: 50 } as never, student));
        await refuses(403, 'forbidden', () => catalog.listChallenges({ status: 'archived', limit: 50 } as never, student));
        assert.ok((await catalog.listChallenges({ status: 'draft', limit: 50 } as never, staff)).rows.length > 0);
        pass('drafts are 404 by key and unlistable below Core; Core still sees them');

        const deletable = await catalog.createChallenge(challengeInput() as never, actor);
        await catalog.softDelete(deletable._id, actor);
        await refuses(404, 'challenge_not_found', () => catalog.getByKey(deletable._id, staff));
        assert.ok(await Challenge.exists({ _id: deletable._id }), 'soft delete keeps the row');
        pass('a soft-deleted challenge is 404 on every read path but still on disk');

        console.log('\nchallenge.selfcheck: all good.');
    } finally {
        await closeScratchDb();
    }
}

main().catch((err) => {
    console.error('\nchallenge.selfcheck FAILED:', err);
    process.exit(1);
});
