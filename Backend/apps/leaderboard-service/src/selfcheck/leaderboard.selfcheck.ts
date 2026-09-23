import assert from 'assert';
import {
    Challenge,
    Event,
    LeaderboardEntry,
    LeaderboardSnapshot,
    PointTransaction,
    User,
    UserRole,
    normalize,
    rawScore,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import * as svc from '../leaderboard/leaderboard.service';
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
    seedUser,
} from './seed';

async function main(): Promise<void> {
    console.log('Starting Leaderboard Service selfcheck suite...');
    await openScratchDb();

    /* ================================================================== *
     * 1. Scoring parameter calculation and min-max normalization
     * ================================================================== */
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
        assert.strictEqual(normEqual, 0); // min == max returns lower bound
        pass('normalize correctly handles min-max scaling and min==max boundary');

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

        // Unknown parameter key rejected
        await refuses(
            svc.submitScores(event._id, { id: admin._id }, {
                scores: [{ participant_id: userA._id, raw: { unknown_param: 5 } }],
            }),
            400,
            'invalid_scoring_parameter',
            'submission with unknown scoring parameter'
        );

        // Invalid type for int rejected
        await refuses(
            svc.submitScores(event._id, { id: admin._id }, {
                scores: [{ participant_id: userA._id, raw: { goals: 3.14 } }],
            }),
            400,
            'invalid_parameter_type',
            'float provided where int expected'
        );

        // Submit valid scores for userA and userB
        await svc.submitScores(event._id, { id: admin._id }, {
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
    }

    /* ================================================================== *
     * 2. Rank materialization and minimum participants threshold
     * ================================================================== */
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

        // Submit score for only 2 participants (threshold not met)
        await svc.submitScores(event._id, { id: admin._id }, {
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
        await svc.submitScores(event._id, { id: admin._id }, {
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

    /* ================================================================== *
     * 3. Points investment eligibility, cap enforcement, and OCC version locking
     * ================================================================== */
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
        assert.strictEqual(investRes.success, true);
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
        assert.strictEqual(results.filter((r) => r.success).length, 3);
        const finalOccEntry = await LeaderboardEntry.findOne({
            event_id: occEvent._id,
            'participant.id': occUser._id,
        });
        assert.strictEqual(finalOccEntry?.invested_points, 30);
        assert.strictEqual(finalOccEntry?.version, 3);
        pass('concurrent investments succeed without lost updates via OCC version retry');
    }

    /* ================================================================== *
     * 4. Advisory rank projection
     * ================================================================== */
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

    /* ================================================================== *
     * 5. Global leaderboard aggregation
     * ================================================================== */
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
    }

    /* ================================================================== *
     * 6. Event consumers lifecycle
     * ================================================================== */
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
        const regId = uuid();
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
        await handlers.onUserProfileUpdated({ user_id: user._id });
        entry = await LeaderboardEntry.findOne({ _id: entry._id });
        assert.strictEqual(entry?.participant.display_name, 'Renamed Player');
        pass('UserProfileUpdated synchronizes participant display name');

        // 6.3 RegistrationCancelled (pre-start drops entry)
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
        await handlers.onEventCompleted({ event_id: completedEvent._id });

        const finalSnapshot = await LeaderboardSnapshot.findOne({ event_id: completedEvent._id }).sort({ taken_at: -1 });
        assert.ok(finalSnapshot);
        assert.strictEqual(finalSnapshot.reason, 'final');
        assert.strictEqual(finalSnapshot.frozen, true);
        pass('EventCompleted captures frozen final snapshot');

        // 6.5 EventCancelled purges entries and snapshots
        await handlers.onEventCancelled({ event_id: completedEvent._id });
        const remainingEntries = await LeaderboardEntry.countDocuments({ event_id: completedEvent._id });
        const remainingSnapshots = await LeaderboardSnapshot.countDocuments({ event_id: completedEvent._id });
        assert.strictEqual(remainingEntries, 0);
        assert.strictEqual(remainingSnapshots, 0);
        pass('EventCancelled cleans up all entries and snapshots');

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
        assert.strictEqual(anonymizedEntry?.participant.display_name, 'Deleted User');
        assert.strictEqual(anonymizedEntry?.participant.avatar_url, null);
        pass('UserDeleted anonymizes participant display name and nulls avatar (GDPR)');

        // 6.7 Mid-event cancellation marks participant eliminated instead of purging
        const ongoingEvent = await seedEvent({ status: 'ongoing', min_participants: 1 });
        const ongoingEntry = await seedEntry(ongoingEvent._id, {
            type: 'user',
            id: user._id,
            display_name: 'Active Racer',
        });
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
    }

    await closeScratchDb();
    console.log('\nleaderboard.selfcheck: all 6 test sections passed successfully!');
}

main().catch((err) => {
    console.error('Leaderboard selfcheck failed:', err);
    process.exit(1);
});
