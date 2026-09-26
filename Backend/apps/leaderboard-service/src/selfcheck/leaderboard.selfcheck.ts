import assert from 'assert';
import {
    Challenge,
    DELETED_DISPLAY_NAME,
    DomainEvent,
    Event,
    FormSubmission,
    LeaderboardEntry,
    LeaderboardSnapshot,
    PointTransaction,
    ServiceError,
    User,
    UserRole,
    normalize,
    rawScore,
    resetBus,
    subscribe,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import * as svc from '../leaderboard/leaderboard.service';
import { closeRedis } from '../leaderboard/redis';
import { handlers } from '../events/consumers';
import {
    closeScratchDb,
    openScratchDb,
    pass,
    refuses,
    resetCollections,
    section,
    seedEntry,
    seedEvent,
    seedLockedTeam,
    seedRegistration,
    seedUser,
    startPointsService,
    usePointsUrl,
} from './seed';

async function main(): Promise<void> {
    console.log('Starting Leaderboard Service selfcheck suite...');
    await openScratchDb();
    await startPointsService();

    /*  *
     * 1. Scoring parameter calculation and min-max normalization
     *  */
    section('1. Scoring parameter calculation and min-max normalization');
    {
        // 1.1 Pure math rawScore
        const params = [
            { key: 'kills', kind: 'int' as const, weight: 10 },
            { key: 'kd_ratio', kind: 'float' as const, weight: 5 },
            { key: 'won', kind: 'bool' as const, weight: 50 },
        ];
        const raw = { kills: 5, kd_ratio: 2.5, won: true };
        const score = rawScore(raw, params);
        assert.strictEqual(score, 5 * 10 + 2.5 * 5 + 1 * 50); // 50 + 12.5 + 50 = 112.5
        pass('rawScore computes weighted sum correctly across int, float, bool');

        // 1.2 Pure math normalize
        const normMinMax = normalize(50, 0, 100, 0, 1000);
        assert.strictEqual(normMinMax, 500);
        const normEqual = normalize(10, 10, 10, 0, 1000);
        assert.strictEqual(normEqual, 0); // min  max returns lower bound
        pass('normalize correctly handles min-max scaling and minmax boundary');

        // 1.3 submitScores parameter validation
        await resetCollections();
        const admin = await seedUser(0, UserRole.CORE, 'Admin Core');
        const userA = await seedUser(0, UserRole.USER, 'Player A');
        const userB = await seedUser(0, UserRole.USER, 'Player B');

        const event = await seedEvent({
            min_participants: 2,
            parameters: [
                { key: 'goals', label: 'Goals', kind: 'int', weight: 10 },
                { key: 'mvp', label: 'MVP', kind: 'bool', weight: 20 },
            ],
            normalization: { lower: 10, upper: 100 },
        });

        await seedRegistration(event._id, userA._id);
        await seedRegistration(event._id, userB._id);

        // Only an admin of THIS event scores it; being core elsewhere is not enough.
        await refuses(
            svc.submitScores(event._id, { id: admin._id, role: 'core' }, {
                scores: [{ participant_id: userA._id, raw: { goals: 1 } }],
            }),
            403,
            'forbidden',
            'a core member scoring an event they do not administer'
        );

        // Unknown parameter key rejected
        await refuses(
            svc.submitScores(event._id, { id: admin._id, role: 'coordinator' }, {
                scores: [{ participant_id: userA._id, raw: { unknown_param: 5 } }],
            }),
            400,
            'invalid_scoring_parameter',
            'submission with unknown scoring parameter'
        );

        // Invalid type for int rejected
        await refuses(
            svc.submitScores(event._id, { id: admin._id, role: 'coordinator' }, {
                scores: [{ participant_id: userA._id, raw: { goals: 3.14 } }],
            }),
            400,
            'invalid_parameter_type',
            'float provided where int expected'
        );

        // Submit valid scores for userA and userB
        await svc.submitScores(event._id, { id: admin._id, role: 'coordinator' }, {
            scores: [
                { participant_id: userA._id, raw: { goals: 4, mvp: true } }, // rawScore = 40 + 20 = 60
                { participant_id: userB._id, raw: { goals: 1, mvp: false } }, // rawScore = 10 + 0 = 10
            ],
        });

        const entryA = await LeaderboardEntry.findOne({ event_id: event._id, 'participant.id': userA._id });
        const entryB = await LeaderboardEntry.findOne({ event_id: event._id, 'participant.id': userB._id });
        assert.ok(entryA && entryB);
        assert.strictEqual(entryA.raw_score, 60);
        assert.strictEqual(entryB.raw_score, 10);
        // Min raw = 10, Max raw = 60, lower = 10, upper = 100
        // entryA (60): 10 + (60-10)/(60-10) * 90 = 100
        // entryB (10): 10 + (10-10)/(60-10) * 90 = 10
        assert.strictEqual(entryA.normalized_score, 100);
        assert.strictEqual(entryB.normalized_score, 10);
        pass('submitScores calculates whole-event min-max normalization');

        // Unregistered participant: refused, and nothing in the batch is written.
        const stranger = await seedUser(0, UserRole.USER, 'Stranger');
        await refuses(
            svc.submitScores(event._id, { id: admin._id, role: 'coordinator' }, {
                scores: [
                    { participant_id: userA._id, raw: { goals: 9 } },
                    { participant_id: stranger._id, raw: { goals: 1 } },
                ],
            }),
            404,
            'participant_not_found',
            'scoring someone who never registered'
        );
        assert.strictEqual((await LeaderboardEntry.findById(entryA._id))?.raw_score, 60, 'userA untouched');
        assert.strictEqual(await LeaderboardEntry.countDocuments({ 'participant.id': stranger._id }), 0);
        pass('an unknown participant refuses the whole batch before any write');

        // Weights edited mid-event: every entry is rescored under the current formula.
        await Event.updateOne({ _id: event._id }, { $set: { 'scoring.parameters.0.weight': 1 } });
        await svc.recomputeEventRanks(event._id, 'score_update');
        assert.strictEqual((await LeaderboardEntry.findById(entryB._id))?.raw_score, 1, 'goals 1 x weight 1');
        pass('raw scores follow the current weights');
    }

    /*  *
     * 2. Rank materialization and minimum participants threshold
     *  */
    section('2. Rank materialization and minimum participants threshold');
    {
        await resetCollections();
        const admin = await seedUser(0, UserRole.CORE, 'Admin');
        const user1 = await seedUser(0, UserRole.USER, 'Charlie');
        const user2 = await seedUser(0, UserRole.USER, 'Alice');
        const user3 = await seedUser(0, UserRole.USER, 'Bob');

        // min_participants = 3
        const event = await seedEvent({
            min_participants: 3,
            normalization: { lower: 0, upper: 100 },
        });

        for (const u of [user1, user2, user3]) await seedRegistration(event._id, u._id);

        // Submit score for only 2 participants (threshold not met)
        await svc.submitScores(event._id, { id: admin._id, role: 'coordinator' }, {
            scores: [
                { participant_id: user1._id, raw: { goals: 2 } },
                { participant_id: user2._id, raw: { goals: 5 } },
            ],
        });

        let lb = await svc.getEventLeaderboard(event._id, { page: 1, limit: 10 });
        assert.strictEqual(lb.threshold_met, false);
        assert.strictEqual(lb.standings[0].rank, null);
        assert.strictEqual(lb.standings[1].rank, null);
        pass('entries remain unranked (rank: null) when threshold is not met');

        // Add 3rd participant (threshold met: 3 >= 3)
        await svc.submitScores(event._id, { id: admin._id, role: 'coordinator' }, {
            scores: [{ participant_id: user3._id, raw: { goals: 3 } }],
        });

        lb = await svc.getEventLeaderboard(event._id, { page: 1, limit: 10 });
        assert.strictEqual(lb.threshold_met, true);
        assert.strictEqual(lb.standings.length, 3);
        assert.strictEqual(lb.standings[0].rank, 1);
        assert.strictEqual(lb.standings[1].rank, 2);
        assert.strictEqual(lb.standings[2].rank, 3);
        // User 2 had 5 goals (highest), User 3 had 3 goals, User 1 had 2 goals
        assert.strictEqual(lb.standings[0].participant.id, user2._id);
        assert.strictEqual(lb.standings[1].participant.id, user3._id);
        assert.strictEqual(lb.standings[2].participant.id, user1._id);
        pass('ranks materialize as 1, 2, 3 in sorted order once threshold is met');

        // Podium test
        const podiumRes = await svc.getPodium(event._id);
        assert.strictEqual(podiumRes.podium.length, 3);
        assert.strictEqual(podiumRes.podium[0].rank, 1);
        pass('podium returns top 3 entries ordered by rank');

        // Snapshots saved
        const snapshots = await svc.getSnapshots(event._id);
        assert.ok(snapshots.length >= 1);
        assert.strictEqual(snapshots[0].reason, 'score_update');
        pass('snapshot was recorded with reason score_update');
    }

    /*  *
     * 3. Points investment eligibility, cap enforcement, and OCC version locking
     *  */
    section('3. Points investment eligibility, cap enforcement, and OCC version locking');
    {
        await resetCollections();
        const user = await seedUser(500, UserRole.USER, 'Investor User');
        const outsider = await seedUser(500, UserRole.USER, 'Outsider User');

        const event = await seedEvent({
            min_participants: 1,
            investment_enabled: true,
            investment_cap: 100,
            status: 'ongoing',
        });

        // Seed entry for user
        const entry = await seedEntry(event._id, {
            type: 'user',
            id: user._id,
            display_name: 'Investor User',
        }, { normalized_score: 50 });
        await svc.recomputeEventRanks(event._id, 'investment');

        // 3.1 Non-participant rejected
        await refuses(
            svc.investPoints(event._id, { id: outsider._id }, 20),
            403,
            'not_a_participant',
            'investment from non-participant'
        );

        // 3.2 Investment below 10 rejected
        await refuses(
            svc.investPoints(event._id, { id: user._id }, 5),
            400,
            'minimum_investment_not_met',
            'investment below minimum 10 points'
        );

        // 3.3 Event with disabled investments rejected
        const eventNoInvest = await seedEvent({ investment_enabled: false, status: 'ongoing' });
        await seedEntry(eventNoInvest._id, { type: 'user', id: user._id, display_name: 'User' });
        await refuses(
            svc.investPoints(eventNoInvest._id, { id: user._id }, 20),
            400,
            'investment_disabled',
            'investment on event with investment disabled'
        );

        // 3.4 Inactive event rejected
        const pastEvent = await seedEvent({ status: 'past', investment_enabled: true });
        await seedEntry(pastEvent._id, { type: 'user', id: user._id, display_name: 'User' });
        await refuses(
            svc.investPoints(pastEvent._id, { id: user._id }, 20),
            400,
            'event_not_ongoing',
            'investment on non-ongoing event'
        );

        // 3.5 Successful investment
        const investRes = await svc.investPoints(event._id, { id: user._id }, 40);
        assert.strictEqual(investRes.entry?.invested_points, 40);
        assert.strictEqual(investRes.entry?.final_score, 90); // 50 normalized + 40 invested
        const userAfter = await User.findById(user._id);
        assert.strictEqual(userAfter?.points_balance, 460); // 500 - 40
        pass('investPoints correctly debits user balance and updates final score');

        // 3.6 Exceeding cap rejected (already invested 40, cap is 100, adding 70 exceeds 100)
        await refuses(
            svc.investPoints(event._id, { id: user._id }, 70),
            400,
            'investment_cap_exceeded',
            'investment exceeding event investment cap'
        );

        // 3.7 OCC version locking under concurrency
        // Seed an entry and simulate 3 concurrent investments of 10 points
        const occEvent = await seedEvent({
            min_participants: 1,
            investment_enabled: true,
            investment_cap: 500,
            status: 'ongoing',
        });
        const occUser = await seedUser(300, UserRole.USER, 'OCC User');
        await seedEntry(occEvent._id, {
            type: 'user',
            id: occUser._id,
            display_name: 'OCC User',
        }, { normalized_score: 10 });
        await svc.recomputeEventRanks(occEvent._id, 'investment');

        const results = await Promise.all([
            svc.investPoints(occEvent._id, { id: occUser._id }, 10),
            svc.investPoints(occEvent._id, { id: occUser._id }, 10),
            svc.investPoints(occEvent._id, { id: occUser._id }, 10),
        ]);
        assert.strictEqual(results.filter((r) => r.entry).length, 3);
        const finalOccEntry = await LeaderboardEntry.findOne({
            event_id: occEvent._id,
            'participant.id': occUser._id,
        });
        assert.strictEqual(finalOccEntry?.invested_points, 30);
        assert.strictEqual(finalOccEntry?.version, 3);
        pass('concurrent investments succeed without lost updates via OCC version retry');

        // 3.8 The cap sits in the $inc filter: two investments that each fit alone cannot both land.
        const capUser = await seedUser(200, UserRole.USER, 'Cap Racer');
        const capEvent = await seedEvent({ min_participants: 1, investment_cap: 100, status: 'ongoing' });
        await seedEntry(capEvent._id, { type: 'user', id: capUser._id, display_name: 'Cap Racer' });
        const raced = await Promise.allSettled([
            svc.investPoints(capEvent._id, { id: capUser._id }, 60),
            svc.investPoints(capEvent._id, { id: capUser._id }, 60),
        ]);
        assert.strictEqual(raced.filter((r) => r.status === 'fulfilled').length, 1, 'one fits');
        const loser = raced.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        assert.strictEqual((loser.reason as ServiceError).code, 'investment_cap_exceeded');
        const capEntry = await LeaderboardEntry.findOne({ event_id: capEvent._id });
        assert.strictEqual(capEntry?.invested_points, 60, 'never over the cap');
        assert.strictEqual((await User.findById(capUser._id))?.points_balance, 140, 'the loser was refunded');
        assert.strictEqual(await PointTransaction.countDocuments({ user_id: capUser._id, type: 'refund' }), 1);
        pass('concurrent investments cannot exceed the cap; the one that did not land is refunded');

        // 3.9 Eliminated entries take no investment.
        const gone = await seedUser(100, UserRole.USER, 'Gone');
        const goneEvent = await seedEvent({ min_participants: 1, status: 'ongoing' });
        const goneEntry = await seedEntry(goneEvent._id, { type: 'user', id: gone._id, display_name: 'Gone' });
        await LeaderboardEntry.updateOne({ _id: goneEntry._id }, { $set: { 'stats.eliminated': true } });
        await refuses(svc.investPoints(goneEvent._id, { id: gone._id }, 20), 409, 'entry_eliminated', 'investing in an eliminated entry');

        // 3.10 Points Service down: nothing credited, no local fallback — the request stays pending
        // and the settle sweep resolves it on Points' final answer once Points is back.
        const offline = await seedUser(100, UserRole.USER, 'Offline');
        const offEvent = await seedEvent({ min_participants: 1, status: 'ongoing' });
        const offEntry = await seedEntry(offEvent._id, { type: 'user', id: offline._id, display_name: 'Offline' });
        const { config } = await import('@bgsc/shared');
        const realUrl = config.services.points;
        const lostId = uuid();
        usePointsUrl('http://127.0.0.1:1');
        try {
            await refuses(svc.investPoints(offEvent._id, { id: offline._id }, 20, lostId), 503, 'investment_pending', 'investing while Points is down');
        } finally {
            usePointsUrl(realUrl);
        }
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 100, 'balance untouched');
        assert.strictEqual(await PointTransaction.countDocuments({ user_id: offline._id }), 0, 'no ledger row written here');
        assert.strictEqual((await LeaderboardEntry.findById(offEntry._id))?.pending_requests.length, 1, 'left pending');
        assert.strictEqual(await svc.settlePendingInvestments(0), 1, 'the sweep settles it');
        assert.strictEqual((await LeaderboardEntry.findById(offEntry._id))?.pending_requests.length, 0);
        await refuses(svc.debitPoints(offline._id, 20, offEntry._id, lostId), 409, 'request_voided', 'the lost debit arriving late');
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 100, 'and it cannot land');

        // A debit that landed but whose $inc never ran (crash between the two) is refunded by the sweep.
        const crashId = uuid();
        await LeaderboardEntry.updateOne(
            { _id: offEntry._id },
            { $push: { pending_requests: { request_id: crashId, user_id: offline._id, amount: 30, at: new Date(0), settle: 'apply' } } }
        );
        await svc.debitPoints(offline._id, 30, offEntry._id, crashId);
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 70);
        await svc.settlePendingInvestments();
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 100, 'the orphaned debit came back');

        // A client retry with the same request_id is the same investment.
        const retryId = uuid();
        const first = await svc.investPoints(offEvent._id, { id: offline._id }, 10, retryId);
        const again = await svc.investPoints(offEvent._id, { id: offline._id }, 10, retryId);
        assert.strictEqual(first.replayed, false);
        assert.strictEqual(again.replayed, true, 'replayed, not reinvested');
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 90, 'debited once');
        assert.strictEqual((await LeaderboardEntry.findById(offEntry._id))?.invested_points, 10);
        // A settle that lost the race to the `$inc` (the request is applied, not pending) refunds nothing.
        await svc.settleByRefund(offEntry._id, retryId, offline._id);
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 90, 'an applied request is never refunded');

        // A pending request of an investor deleted since: Points' 404 is final, not retried forever.
        const leaver = await seedUser(50, UserRole.USER, 'Leaver');
        const leaverEntry = await seedEntry(offEvent._id, { type: 'user', id: leaver._id, display_name: 'Leaver' });
        const leaverReq = uuid();
        await LeaderboardEntry.updateOne(
            { _id: leaverEntry._id },
            { $push: { pending_requests: { request_id: leaverReq, user_id: leaver._id, amount: 20, at: new Date(0), settle: 'apply' } } }
        );
        await svc.debitPoints(leaver._id, 20, leaverEntry._id, leaverReq);
        await User.updateOne({ _id: leaver._id }, { $set: { deleted_at: new Date() } });
        await svc.settlePendingInvestments();
        assert.strictEqual((await LeaderboardEntry.findById(leaverEntry._id))?.pending_requests.length, 0, "a deleted investor's request is dropped");

        // The board closes between the debit and the $inc: the investment is undone and refunded.
        svc.investHooks.afterDebit = async () => {
            await LeaderboardSnapshot.create({ event_id: offEvent._id, taken_at: new Date(), reason: 'final', frozen: true, ranks: [] });
        };
        try {
            await refuses(svc.investPoints(offEvent._id, { id: offline._id }, 10), 400, 'leaderboard_frozen', 'an investment landing after the final');
        } finally {
            svc.investHooks.afterDebit = async () => undefined;
        }
        assert.strictEqual((await LeaderboardEntry.findById(offEntry._id))?.invested_points, 10, 'undone');
        assert.strictEqual((await User.findById(offline._id))?.points_balance, 90, 'and refunded');
        pass('an unreachable Points Service fails closed');
    }

    /*  *
     * 4. Advisory rank projection
     *  */
    section('4. Advisory rank projection');
    {
        await resetCollections();
        const userA = await seedUser(100, UserRole.USER, 'Player A');
        const userB = await seedUser(100, UserRole.USER, 'Player B');

        const event = await seedEvent({ min_participants: 2 });
        await seedEntry(event._id, { type: 'user', id: userA._id, display_name: 'Player A' }, {
            normalized_score: 40,
        });
        await seedEntry(event._id, { type: 'user', id: userB._id, display_name: 'Player B' }, {
            normalized_score: 80,
        });
        await svc.recomputeEventRanks(event._id, 'investment');

        // Player A is currently rank 2 (40 pts) vs Player B rank 1 (80 pts)
        const myEntryBefore = await svc.getMyEntry(event._id, userA._id);
        assert.strictEqual(myEntryBefore.rank, 2);

        // Project what happens if Player A invests 50 points (40 + 50 = 90 pts > 80 pts)
        const projection = await svc.projectInvestment(event._id, { id: userA._id }, 50);
        assert.strictEqual(projection.current_score, 40);
        assert.strictEqual(projection.projected_score, 90);
        assert.strictEqual(projection.current_rank, 2);
        assert.strictEqual(projection.projected_rank, 1);

        // Verify read-only advisory guarantee: database state was NOT modified
        const myEntryAfter = await svc.getMyEntry(event._id, userA._id);
        assert.strictEqual(myEntryAfter.final_score, 40);
        assert.strictEqual(myEntryAfter.rank, 2);
        assert.strictEqual(myEntryAfter.invested_points, 0);
        pass('projectInvestment accurately projects rank/score without mutating database');
    }

    /*  *
     * 5. Global leaderboard aggregation
     *  */
    section('5. Global leaderboard aggregation');
    {
        await resetCollections();
        const u1 = await seedUser(100, UserRole.USER, 'Top Gamer');
        const u2 = await seedUser(50, UserRole.USER, 'Mid Gamer');

        const sportEvent = await seedEvent({ domain: 'sports' });
        const esportsEvent = await seedEvent({ domain: 'esports' });

        const sportChallenge = await Challenge.create({
            _id: uuid(),
            title: '10k Running Quest',
            slug: '10k-running-quest',
            description: 'Run 10km verified by Strava',
            domain: 'sports',
            kind: 'physical',
            location: { name: 'Campus Running Track', details: null },
            difficulty: 'medium',
            status: 'active',
            created_by: u1._id,
            award_points: 100,
            submission: {
                requires_proof: true,
                proof_types: ['url'],
                max_files: 1,
                auto_approve: true,
            },
        });

        // Seed PointTransaction entries
        // u1 earned 100 in sports via challenge, 50 in esports via event
        await PointTransaction.create({
            _id: uuid(),
            user_id: u1._id,
            amount: 100,
            type: 'earn',
            source: 'challenge',
            reason: 'challenge.completed',
            reference: { type: 'challenge', id: sportChallenge._id },
            idempotency_key: uuid(),
            balance_after: 100,
            actor: { type: 'system', user_id: null },
            created_at: new Date(),
        });
        await PointTransaction.create({
            _id: uuid(),
            user_id: u1._id,
            amount: 50,
            type: 'earn',
            source: 'event',
            reason: 'event.participation',
            reference: { type: 'event', id: esportsEvent._id },
            idempotency_key: uuid(),
            balance_after: 150,
            actor: { type: 'system', user_id: null },
            created_at: new Date(),
        });

        // u2 earned 80 in esports
        await PointTransaction.create({
            _id: uuid(),
            user_id: u2._id,
            amount: 80,
            type: 'earn',
            source: 'event',
            reason: 'event.participation',
            reference: { type: 'event', id: esportsEvent._id },
            idempotency_key: uuid(),
            balance_after: 80,
            actor: { type: 'system', user_id: null },
            created_at: new Date(),
        });

        // Non-earn transaction (spend) must NOT count
        await PointTransaction.create({
            _id: uuid(),
            user_id: u2._id,
            amount: -20,
            type: 'spend',
            source: 'leaderboard',
            reason: 'leaderboard.investment',
            reference: { type: 'event', id: esportsEvent._id },
            idempotency_key: uuid(),
            balance_after: 60,
            actor: { type: 'user', user_id: u2._id },
            created_at: new Date(),
        });

        // 5.1 Global all domain
        const globalAll = await svc.getGlobalLeaderboard({
            period: 'all',
            domain: 'all',
            limit: 10,
            page: 1,
        });
        assert.strictEqual(globalAll.standings.length, 2);
        assert.strictEqual(globalAll.standings[0].user_id, u1._id);
        assert.strictEqual(globalAll.standings[0].points, 150); // 100 + 50
        assert.strictEqual(globalAll.standings[1].user_id, u2._id);
        assert.strictEqual(globalAll.standings[1].points, 80);
        pass('getGlobalLeaderboard aggregates earn points across all domains');

        // 5.2 Global esports domain
        const globalEsports = await svc.getGlobalLeaderboard({
            period: 'all',
            domain: 'esports',
            source: 'all',
            limit: 10,
            page: 1,
        });
        // In esports: u2 has 80, u1 has 50 -> u2 is rank 1!
        assert.strictEqual(globalEsports.standings.length, 2);
        assert.strictEqual(globalEsports.standings[0].user_id, u2._id);
        assert.strictEqual(globalEsports.standings[0].points, 80);
        assert.strictEqual(globalEsports.standings[1].user_id, u1._id);
        assert.strictEqual(globalEsports.standings[1].points, 50);
        pass('getGlobalLeaderboard filters and ranks correctly by domain');

        // 5.3 Global source filter: challenge vs event
        const challengeLeaderboard = await svc.getGlobalLeaderboard({
            period: 'all',
            domain: 'all',
            source: 'challenge',
            limit: 10,
            page: 1,
        });
        assert.strictEqual(challengeLeaderboard.standings.length, 1);
        assert.strictEqual(challengeLeaderboard.standings[0].user_id, u1._id);
        assert.strictEqual(challengeLeaderboard.standings[0].points, 100);

        const eventLeaderboard = await svc.getGlobalLeaderboard({
            period: 'all',
            domain: 'all',
            source: 'event',
            limit: 10,
            page: 1,
        });
        assert.strictEqual(eventLeaderboard.standings.length, 2);
        assert.strictEqual(eventLeaderboard.standings[0].user_id, u2._id);
        assert.strictEqual(eventLeaderboard.standings[0].points, 80);
        assert.strictEqual(eventLeaderboard.standings[1].user_id, u1._id);
        assert.strictEqual(eventLeaderboard.standings[1].points, 50);
        pass('getGlobalLeaderboard filters correctly by source (challenge vs event)');

        // A reversed credit (event cancelled) no longer counts; ties read the same as the ZSET.
        const reversed = await seedUser(0, UserRole.USER, 'Reversed');
        const creditId = uuid();
        const row = (user_id: string, amount: number, type: 'earn' | 'adjust', key: string, id = uuid()) =>
            PointTransaction.create({
                _id: id,
                user_id,
                amount,
                type,
                source: 'event',
                reason: 'event.participation',
                reference: { type: 'event', id: esportsEvent._id },
                idempotency_key: key,
                balance_after: 0,
                actor: { type: 'system', user_id: null },
            });
        await row(reversed._id, 70, 'earn', uuid(), creditId);
        await row(reversed._id, -70, 'adjust', `event.participation.reversal:${creditId}`);
        const tieA = await seedUser(0, UserRole.USER, 'Tie A');
        const tieB = await seedUser(0, UserRole.USER, 'Tie B');
        await row(tieA._id, 25, 'earn', uuid());
        await row(tieB._id, 25, 'earn', uuid());
        const week = await svc.getGlobalLeaderboard({ period: 'week', domain: 'all', limit: 10, page: 1 });
        assert.ok(!week.standings.some((s) => s.user_id === reversed._id), 'net zero after the reversal');
        const tied = week.standings.filter((s) => s.points === 25).map((s) => s.user_id);
        assert.deepStrictEqual(tied, [tieA._id, tieB._id].sort().reverse(), 'ties by user id descending, as ZREVRANGE');
        pass('reversals are netted out; ties order like the Redis cache');
    }

    /*  *
     * 6. Event consumers lifecycle
     *  */
    section('6. Event consumers lifecycle');
    {
        await resetCollections();
        const user = await seedUser(0, UserRole.USER, 'Lifecycle Player');
        const soloEvent = await seedEvent({
            is_teamed: false,
            min_participants: 1,
            status: 'upcoming',
        });

        // 6.1 RegistrationCreated
        const regId = await seedRegistration(soloEvent._id, user._id);
        await handlers.onRegistrationCreated({
            registration_id: regId,
            owner: { type: 'event', id: soloEvent._id },
            user_id: user._id,
        });

        let entry = await LeaderboardEntry.findOne({
            event_id: soloEvent._id,
            'participant.id': user._id,
        });
        assert.ok(entry, 'LeaderboardEntry created on RegistrationCreated');
        assert.strictEqual(entry.participant.display_name, 'Lifecycle Player');
        pass('RegistrationCreated creates participant entry on solo event');

        // 6.2 UserProfileUpdated
        user.profile.full_name = 'Renamed Player';
        await user.save();
        await handlers.onUserProfileUpdated({ user_id: user._id, changed_fields: ['bio'] });
        entry = await LeaderboardEntry.findOne({ _id: entry!._id });
        assert.strictEqual(entry?.participant.display_name, 'Lifecycle Player', 'an unrelated field changes nothing');
        await handlers.onUserProfileUpdated({ user_id: user._id, changed_fields: ['full_name'] });
        entry = await LeaderboardEntry.findOne({ _id: entry!._id });
        assert.strictEqual(entry?.participant.display_name, 'Renamed Player');
        pass('UserProfileUpdated synchronizes participant display name');

        // 6.3a A late cancel for a row that is confirmed again (demote, re-promote) changes nothing.
        await handlers.onRegistrationCancelled({
            registration_id: regId,
            owner: { type: 'event', id: soloEvent._id },
            user_id: user._id,
        });
        assert.ok(await LeaderboardEntry.exists({ _id: entry!._id }), 'a stale cancel must not withdraw a confirmed row');
        pass('RegistrationCancelled for a re-confirmed row is ignored');

        // 6.3 RegistrationCancelled (pre-start drops entry)
        await FormSubmission.updateOne({ _id: regId }, { $set: { status: 'cancelled' } });
        await handlers.onRegistrationCancelled({
            registration_id: regId,
            owner: { type: 'event', id: soloEvent._id },
            user_id: user._id,
        });
        entry = await LeaderboardEntry.findOne({ _id: entry?._id });
        assert.strictEqual(entry, null, 'Entry removed on pre-start cancellation');
        pass('RegistrationCancelled removes entry before event start');

        // 6.4 EventCompleted freezes leaderboard
        const completedEvent = await seedEvent({ min_participants: 1 });
        await seedEntry(completedEvent._id, { type: 'user', id: user._id, display_name: 'Player' }, { raw_score: 50 });
        const frozen: DomainEvent[] = [];
        resetBus();
        subscribe('LeaderboardFrozen', (e: DomainEvent) => void frozen.push(e));
        await handlers.onEventCompleted({ event_id: completedEvent._id });
        resetBus();
        const podium = frozen[0]?.payload.podium as { place: number; user_ids: string[] }[];
        assert.strictEqual(frozen[0]?.payload.reason, 'final');
        assert.deepStrictEqual(podium, [{ place: 1, participant: { type: 'user', id: user._id }, user_ids: [user._id] }]);
        pass('LeaderboardFrozen(final) carries the podium');

        const finalSnapshot = await LeaderboardSnapshot.findOne({ event_id: completedEvent._id }).sort({ taken_at: -1 });
        assert.ok(finalSnapshot);
        assert.strictEqual(finalSnapshot.reason, 'final');
        assert.strictEqual(finalSnapshot.frozen, true);
        pass('EventCompleted captures frozen final snapshot');

        // A write after the final (late cancel, a recompute, a score) must not reopen the board.
        await Event.updateOne({ _id: completedEvent._id }, { $set: { status: 'past' } });
        await svc.recomputeEventRanks(completedEvent._id, 'score_update');
        const stillFinal = await LeaderboardSnapshot.findOne({ event_id: completedEvent._id }).sort({ taken_at: -1 });
        assert.strictEqual(stillFinal?.reason, 'final', 'no snapshot after the final');
        await refuses(
            svc.submitScores(completedEvent._id, { id: user._id, role: 'coordinator' }, { scores: [{ participant_id: user._id, raw: { goals: 1 } }] }),
            409,
            'leaderboard_final',
            'scoring a finished event'
        );

        // 6.5 EventCancelled freezes but keeps the entries (Points finds refunds through them).
        const cancelledEvent = await seedEvent({ min_participants: 1 });
        await seedEntry(cancelledEvent._id, { type: 'user', id: user._id, display_name: 'Player' }, { invested_points: 20 });
        await handlers.onEventCancelled({ event_id: cancelledEvent._id });
        assert.strictEqual(await LeaderboardEntry.countDocuments({ event_id: cancelledEvent._id }), 1, 'entries kept');
        const cancelSnap = await LeaderboardSnapshot.findOne({ event_id: cancelledEvent._id }).sort({ taken_at: -1 });
        assert.strictEqual(cancelSnap?.frozen, true, 'and frozen');
        pass('EventCancelled freezes the board without deleting entries');

        // 6.6 UserDeleted anonymizes participant display name and nulls avatar (GDPR)
        const uToDel = await seedUser(0, UserRole.USER, 'Privacy User');
        const entryToDel = await seedEntry(soloEvent._id, {
            type: 'user',
            id: uToDel._id,
            display_name: 'Privacy User',
            avatar_url: 'https://example.com/avatar.png',
        });
        await handlers.onUserDeleted({ user_id: uToDel._id });
        const anonymizedEntry = await LeaderboardEntry.findById(entryToDel._id);
        assert.strictEqual(anonymizedEntry?.participant.display_name, DELETED_DISPLAY_NAME);
        assert.strictEqual(anonymizedEntry?.participant.avatar_url, null);
        assert.strictEqual(anonymizedEntry?.participant.deleted, true);
        pass('UserDeleted anonymizes participant display name and nulls avatar (GDPR)');

        // 6.6b UserRestored restores participant details
        await handlers.onUserRestored({ user_id: uToDel._id });
        const restoredEntry = await LeaderboardEntry.findById(entryToDel._id);
        assert.strictEqual(restoredEntry?.participant.display_name, uToDel.profile.full_name);
        assert.strictEqual(restoredEntry?.participant.avatar_url, uToDel.profile.avatar_url);
        assert.strictEqual(restoredEntry?.participant.deleted, false);
        pass('UserRestored restores participant display name and avatar upon account reactivation');

        // 6.7 Mid-event cancellation marks participant eliminated instead of purging
        const ongoingEvent = await seedEvent({ status: 'ongoing', min_participants: 1 });
        const ongoingEntry = await seedEntry(ongoingEvent._id, {
            type: 'user',
            id: user._id,
            display_name: 'Active Racer',
        });
        await FormSubmission.updateOne({ _id: ongoingEntry.registration_id! }, { $set: { status: 'cancelled' } });
        await handlers.onRegistrationCancelled({
            registration_id: ongoingEntry.registration_id!,
            owner: { type: 'event', id: ongoingEvent._id },
            user_id: user._id,
        });
        const survivingEntry = await LeaderboardEntry.findById(ongoingEntry._id);
        assert.ok(survivingEntry, 'Entry remains in database for audit trail');
        assert.strictEqual(survivingEntry.stats.eliminated, true);
        pass('RegistrationCancelled marks participant eliminated mid-event');

        // 6.8 Eliminated participant ranks after active participants even with higher raw score
        const raceEvent = await seedEvent({ status: 'ongoing', min_participants: 2 });
        const activeRunner = await seedEntry(raceEvent._id, {
            type: 'user',
            id: 'runner-1',
            display_name: 'Active Runner',
        }, { raw_score: 50 });
        const droppedRunner = await seedEntry(raceEvent._id, {
            type: 'user',
            id: 'runner-2',
            display_name: 'Dropped Runner',
        }, { raw_score: 100 });
        droppedRunner.stats.eliminated = true;
        await droppedRunner.save();

        await svc.recomputeEventRanks(raceEvent._id, 'score_update');

        const activeRefreshed = await LeaderboardEntry.findById(activeRunner._id);
        const droppedRefreshed = await LeaderboardEntry.findById(droppedRunner._id);
        assert.strictEqual(activeRefreshed?.rank, 1, 'Active runner takes Rank 1');
        assert.strictEqual(droppedRefreshed?.rank, 2, 'Eliminated runner ranks after active runners');
        pass('Eliminated participant sorts after active participants');

        // 6.9 Normalization ignores unscored entries: under penalty scoring (negative weight) an
        // unscored registrant used to be the maximum and take rank 1.
        const penaltyEvent = await seedEvent({
            status: 'ongoing',
            min_participants: 1,
            parameters: [{ key: 'strokes', label: 'Strokes', kind: 'int', weight: -1 }],
        });
        const golfers = await Promise.all(['G1', 'G2', 'G3'].map((n) => seedUser(0, UserRole.USER, n)));
        for (const g of golfers) await seedRegistration(penaltyEvent._id, g._id);
        const g3Reg = (await FormSubmission.findOne({ 'owner.id': penaltyEvent._id, 'user.user_id': golfers[2]._id }))!._id;
        await handlers.onRegistrationCreated({ registration_id: g3Reg, owner: { type: 'event', id: penaltyEvent._id }, user_id: golfers[2]._id });
        await svc.submitScores(penaltyEvent._id, { id: golfers[0]._id, role: 'coordinator' }, {
            scores: [
                { participant_id: golfers[0]._id, raw: { strokes: 70 } },
                { participant_id: golfers[1]._id, raw: { strokes: 80 } },
            ],
        });
        const unscored = await LeaderboardEntry.findOne({ event_id: penaltyEvent._id, 'participant.id': golfers[2]._id });
        assert.strictEqual(unscored?.rank, 3, 'the unscored entry ranks last');
        pass('normalization runs over scored entries only');

        // 6.10 Teams join on TeamLocked, built from the Team document.
        const teamEvent = await seedEvent({ status: 'ongoing', is_teamed: true, min_participants: 1 });
        const teamId = await seedLockedTeam(teamEvent._id, 'Lockers', [golfers[0]._id]);
        await handlers.onTeamLocked({ team_id: teamId });
        const teamEntry = await LeaderboardEntry.findOne({ event_id: teamEvent._id, 'participant.id': teamId });
        assert.strictEqual(teamEntry?.participant.display_name, 'Lockers');
        pass('TeamLocked builds the team entry');

        // 6.11 A literal search: regex metacharacters are not a 500.
        const found = await svc.getEventLeaderboard(penaltyEvent._id, { page: 1, limit: 10, search: '(' });
        assert.strictEqual(found.total, 0);
        pass('search is escaped');
    }

    section('7. Route guards are live middleware');
    {
        const { hallOfFameRouter } = await import('../hall-of-fame/hallOfFame.routes');
        const { leaderboardRoutes } = await import('../leaderboard/leaderboard.routes');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const guardOf = (router: any, path: string, method: string) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route.stack[1].handle;
        for (const guard of [
            guardOf(hallOfFameRouter, '/', 'post'),
            guardOf(hallOfFameRouter, '/:id', 'delete'),
            guardOf(leaderboardRoutes, '/events/:ref/invest', 'post'),
        ]) {
            let status = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const res: any = { json: () => res };
            res.status = (c: number) => ((status = c), res);
            await guard({ header: () => undefined }, res, () => undefined);
            assert.strictEqual(status, 401, 'a session-less request is refused 401, not thrown');
        }
        pass('Hall of Fame writes and invest run requireActiveUser');
    }

    section('8. Audit #2: finals, replay, revival, snapshots, public reads');
    {
        await resetCollections();
        const frozen: DomainEvent[] = [];
        resetBus();
        subscribe('LeaderboardFrozen', (e: DomainEvent) => void frozen.push(e));

        // One LeaderboardFrozen per final, however many times EventCompleted arrives.
        const done = await seedEvent({ min_participants: 1 });
        const p1 = await seedUser(0, UserRole.USER, 'Finisher');
        await seedEntry(done._id, { type: 'user', id: p1._id, display_name: 'Finisher' });
        await handlers.onEventCompleted({ event_id: done._id });
        await handlers.onEventCompleted({ event_id: done._id });
        assert.strictEqual(frozen.length, 1, 'published only by the call that wrote the final');

        // The replay sweep finalizes a completion whose message was lost, and re-announces the rest.
        const missed = await seedEvent({ min_participants: 1, status: 'past' });
        await Event.updateOne({ _id: missed._id }, { $set: { completed_at: new Date() } });
        await Event.updateOne({ _id: done._id }, { $set: { status: 'past', completed_at: new Date() } });
        await seedEntry(missed._id, { type: 'user', id: p1._id, display_name: 'Finisher' });
        const { replayFinals } = await import('../leaderboard/sweeps');
        const replay = await replayFinals();
        assert.deepStrictEqual(replay, { finalized: 1, republished: 1 });
        assert.ok(await LeaderboardSnapshot.exists({ event_id: missed._id, reason: 'final' }));
        resetBus();
        pass('finals publish once; the replay sweep finalizes and re-announces');

        // EventCancelled's freeze is serialized behind a queued recompute: the freeze is the last word.
        const racing = await seedEvent({ min_participants: 1 });
        await seedEntry(racing._id, { type: 'user', id: p1._id, display_name: 'Finisher' });
        await Promise.all([svc.recomputeEventRanks(racing._id, 'score_update'), handlers.onEventCancelled({ event_id: racing._id })]);
        const last = await LeaderboardSnapshot.findOne({ event_id: racing._id }).sort({ taken_at: -1 });
        assert.strictEqual(last?.frozen, true, 'no unfrozen snapshot after the freeze');
        pass('the cancel freeze cannot be overtaken by a recompute');

        // Re-registering revives an eliminated entry; a stale message for a cancelled registration does not.
        const back = await seedUser(0, UserRole.USER, 'Returner');
        const live = await seedEvent({ min_participants: 1, status: 'ongoing' });
        const backEntry = await seedEntry(live._id, { type: 'user', id: back._id, display_name: 'Returner' }, { invested_points: 20 });
        await LeaderboardEntry.updateOne({ _id: backEntry._id }, { $set: { 'stats.eliminated': true } });
        const again = await seedRegistration(live._id, back._id);
        await handlers.onRegistrationCreated({ registration_id: again, owner: { type: 'event', id: live._id }, user_id: back._id });
        const revived = await LeaderboardEntry.findById(backEntry._id);
        assert.strictEqual(revived?.stats.eliminated, false, 'revived');
        assert.strictEqual(revived?.registration_id, again);
        assert.strictEqual(revived?.invested_points, 20, 'with its investment');
        await FormSubmission.updateOne({ _id: again }, { $set: { status: 'cancelled' } });
        await handlers.onRegistrationCreated({ registration_id: again, owner: { type: 'event', id: live._id }, user_id: back._id });
        assert.strictEqual((await LeaderboardEntry.findById(backEntry._id))?.stats.eliminated, true, 'a stale create is withdrawn');
        pass('RegistrationCreated revives, and checks the registration still stands');

        // A deleted user: no fresh entry, and a stale profile refresh cannot bring the name back.
        const ghost = await seedUser(0, UserRole.USER, 'Ghost Name');
        const ghostEntry = await seedEntry(live._id, { type: 'user', id: ghost._id, display_name: 'Ghost Name' });
        await handlers.onUserDeleted({ user_id: ghost._id });
        await handlers.onUserProfileUpdated({ user_id: ghost._id, changed_fields: ['full_name'] });
        assert.strictEqual((await LeaderboardEntry.findById(ghostEntry._id))?.participant.display_name, DELETED_DISPLAY_NAME);
        await User.updateOne({ _id: ghost._id }, { $set: { deleted_at: new Date() } });
        const other = await seedEvent({ min_participants: 1, status: 'ongoing' });
        await handlers.onRegistrationCreated({ registration_id: await seedRegistration(other._id, ghost._id), owner: { type: 'event', id: other._id }, user_id: ghost._id });
        assert.strictEqual(await LeaderboardEntry.countDocuments({ event_id: other._id }), 0, 'no new snapshot of a deleted user');
        pass('deleted users never re-appear');

        // Public reads: projected fields only; drafts do not exist; deleted users on the global board are anonymous.
        const board = await svc.getEventLeaderboard(live._id, { page: 1, limit: 10 });
        const row = board.standings[0] as unknown as Record<string, unknown>;
        assert.ok(!('registration_id' in row) && !('scored_by' in row) && !('pending_requests' in row), 'no internals');
        const draft = await seedEvent({ status: 'draft' });
        await refuses(svc.getEventLeaderboard(draft._id, { page: 1, limit: 10 }), 404, 'event_not_found', 'a draft board');
        await PointTransaction.create({
            user_id: ghost._id,
            amount: 5,
            type: 'earn',
            source: 'event',
            reason: 'event.participation',
            reference: { type: 'event', id: live._id },
            idempotency_key: uuid(),
            balance_after: 5,
            actor: { type: 'system', user_id: null },
        });
        const global = await svc.getGlobalLeaderboard({ period: 'week', domain: 'all', limit: 10, page: 1 });
        assert.strictEqual(global.standings.find((r) => r.user_id === ghost._id)?.display_name, DELETED_DISPLAY_NAME);
        pass('public reads are projected, drafts hidden, deleted users anonymous');
    }

    const hallOfFameSelfcheck = require('./hallOfFame.selfcheck');
    await hallOfFameSelfcheck.runSelfcheck();

    await closeRedis();
    await closeScratchDb();
    console.log('\nleaderboard.selfcheck: all test sections passed successfully!');
}

main().catch((err) => {
    console.error('Leaderboard selfcheck failed:', err);
    process.exit(1);
});
