import assert from 'assert';
import { Bracket, IMatch, Match, ServiceError, UserRole, resetBus, subscribe } from '@bgsc/shared';
import { Actor, Viewer } from '../brackets/actor';
import * as brackets from '../brackets/bracket.service';
import { standingsOf } from '../brackets/standings';
import * as matches from '../matches/match.service';
import { closeScratchDb, openScratchDb, seedEvent, seedField, seedTeam, seedUser } from './seed';

/**
 * The draw against a real database, and everything a result sets off
 * (be2-feedback-bracket-plan.md §13).
 *
 * `generate.selfcheck.ts` proves the arithmetic; this proves the writes: who may report, what a
 * report advances, what a correction may and may not overwrite, and when a bracket is finished.
 */

const core = (id: string): Actor => ({ id, role: 'core', ip: null });
const guest: Viewer = { id: null, role: undefined };
const asViewer = (id: string, role: 'user' | 'core' | 'coordinator'): Viewer => ({ id, role });
const coordinator = (id: string): Actor => ({ id, role: 'coordinator', ip: null });

const byRound = (list: IMatch[], round: number) => list.filter((m) => m.round === round).sort((a, b) => a.slot - b.slot);

async function expectError(fn: () => Promise<unknown>, code: string, what: string): Promise<void> {
    await assert.rejects(fn, (err: ServiceError) => {
        assert.strictEqual(err.code, code, `${what}: expected ${code}, got ${err.code}`);
        return true;
    }, what);
}

async function main(): Promise<void> {
    await openScratchDb();
    resetBus();

    const admin = await seedUser('Organiser', UserRole.CORE);
    const outsider = await seedUser('Other Core', UserRole.CORE);
    const boss = await seedUser('Coordinator', UserRole.COORDINATOR);

    /* ---- who may draw --------------------------------------------------- */

    const event = await seedEvent('Knockout Cup', { format: 'single_elim', created_by: admin._id });
    const field = await seedField(event._id, 5);

    await expectError(
        () => brackets.generateBracket({ event_id: event._id, seeding: 'registration' }, core(outsider._id)),
        'forbidden',
        'a core member who does not run this event cannot draw it'
    );

    const generated = await brackets.generateBracket(
        { event_id: event._id, seeding: 'registration' },
        core(admin._id)
    );
    assert.strictEqual(generated.bracket.format, 'single_elim', 'the format comes from the event, not the request');
    assert.strictEqual(generated.bracket.participant_type, 'user', 'a solo event draws its registrants');
    assert.strictEqual(generated.matches.length, 7, '5 players pad to 8: seven fixtures');
    assert.strictEqual(generated.matches.filter((m) => m.status === 'bye').length, 3, 'three byes');
    console.log('✓ a draw is made by the event\'s own organiser, in the event\'s own format');

    await expectError(
        () => brackets.generateBracket({ event_id: event._id, seeding: 'registration' }, core(admin._id)),
        'bracket_exists',
        'a second draw for the same event is a 409, not a duplicate'
    );

    /* ---- reporting ------------------------------------------------------- */

    const r1 = byRound(generated.matches, 1);
    const real = r1.find((m) => m.status === 'scheduled')!;
    assert.ok(real.a && real.b, 'the only played first-round fixture has two participants');

    await expectError(
        () => matches.reportResult(real._id, { score_a: 1, score_b: 0 }, core(outsider._id)),
        'forbidden',
        'and scored by the same people who may draw it'
    );

    const reported = await matches.reportResult(real._id, { score_a: 3, score_b: 1 }, core(admin._id));
    assert.strictEqual(reported.status, 'completed', 'a score completes the fixture');
    assert.strictEqual(reported.winner, 'a', 'the higher score wins');
    assert.strictEqual(reported.reported_by, admin._id, 'and the reporter is recorded');

    const advancedInto = await Match.findById(real.advances_to!.match_id).lean<IMatch>();
    assert.strictEqual(
        advancedInto![real.advances_to!.slot]?.id,
        real.a!.id,
        'the winner is seated in the next round, in the slot the draw wired'
    );
    console.log('✓ a result completes its fixture and advances the winner');

    await expectError(
        () => matches.reportResult(real._id, { score_a: 0, score_b: 9 }, core(admin._id)),
        'already_reported',
        'core cannot rewrite a result'
    );

    const byeMatch = r1.find((m) => m.status === 'bye')!;
    await expectError(
        () => matches.reportResult(byeMatch._id, { score_a: 1, score_b: 0 }, core(admin._id)),
        'cannot_report_bye',
        'a bye was never played'
    );

    await expectError(
        () => matches.reportResult(real._id, { score_a: 2, score_b: 2 }, coordinator(boss._id)),
        'draw_not_allowed',
        'a knockout has to knock somebody out'
    );
    console.log('✓ byes, draws and double reports are each refused with their own reason');

    /* ---- corrections ------------------------------------------------------ */

    const corrected = await matches.reportResult(real._id, { score_a: 0, score_b: 4 }, coordinator(boss._id));
    assert.strictEqual(corrected.winner, 'b', 'a coordinator may correct a result');

    const afterCorrection = await Match.findById(real.advances_to!.match_id).lean<IMatch>();
    assert.strictEqual(
        afterCorrection![real.advances_to!.slot]?.id,
        real.b!.id,
        'and the next round follows the correction'
    );

    // Once the next fixture has been played, the result underneath it is frozen: this service
    // cannot un-play a match, so it refuses to invalidate one.
    const semi = await Match.findById(real.advances_to!.match_id).lean<IMatch>();
    if (semi!.a && semi!.b) {
        await matches.reportResult(semi!._id, { score_a: 5, score_b: 0 }, core(admin._id));
        await expectError(
            () => matches.reportResult(real._id, { score_a: 7, score_b: 0 }, coordinator(boss._id)),
            'downstream_already_played',
            'a result cannot be rewritten once the round after it has been played'
        );
    }
    console.log('✓ a coordinator may correct a result, until the next round has been played');

    /* ---- regeneration ------------------------------------------------------ */

    await expectError(
        () => brackets.deleteBracket(event._id, coordinator(boss._id)),
        'bracket_already_played',
        'a draw that has been played cannot be redone'
    );

    // A bracket with byes but no results: byes are `completed` at generation, so a guard keyed on
    // status rather than on `reported_by` would make this undeletable.
    const fresh = await seedEvent('Fresh Cup', { format: 'single_elim', created_by: admin._id });
    await seedField(fresh._id, 6);
    await brackets.generateBracket({ event_id: fresh._id, seeding: 'registration' }, core(admin._id));
    assert.ok(
        await Match.exists({ event_id: fresh._id, status: 'bye' }),
        'this draw has byes, which are completed the moment they are created'
    );
    await brackets.deleteBracket(fresh._id, coordinator(boss._id));
    assert.strictEqual(await Bracket.countDocuments({ event_id: fresh._id }), 0, 'the bracket is gone');
    assert.strictEqual(await Match.countDocuments({ event_id: fresh._id }), 0, 'and so are its fixtures');
    console.log('✓ an unplayed draw can be redone even when it contains byes');

    /* ---- a whole round robin, to the last fixture ---------------------------- */

    const league = await seedEvent('Round Robin League', { format: 'round_robin', created_by: admin._id });
    const players = await seedField(league._id, 4);
    const draw = await brackets.generateBracket({ event_id: league._id, seeding: 'registration' }, core(admin._id));
    assert.strictEqual(draw.matches.length, 6, 'four players play every pair once');

    const completed: string[] = [];
    subscribe('BracketCompleted', (e) => completed.push((e.payload as { winner_id: string }).winner_id));

    // Player 1 wins everything, player 2 wins the rest, and one fixture is drawn.
    for (const m of draw.matches) {
        const aIsFirst = m.a!.id === players[0]._id;
        const bIsFirst = m.b!.id === players[0]._id;
        const drawn = !aIsFirst && !bIsFirst && m.a!.seed === 3 && m.b!.seed === 4;
        const scores = drawn ? { score_a: 1, score_b: 1 } : aIsFirst ? { score_a: 2, score_b: 0 } : bIsFirst ? { score_a: 0, score_b: 2 } : { score_a: 3, score_b: 1 };
        await matches.reportResult(m._id, scores, core(admin._id));
    }

    const finished = await brackets.getBracket(league._id, guest);
    assert.strictEqual(finished.bracket.status, 'completed', 'the last result finishes the bracket');
    assert.strictEqual(completed.length, 1, 'and BracketCompleted is emitted exactly once');
    assert.strictEqual(completed[0], players[0]._id, 'naming the top of the table');

    const table = standingsOf(finished.bracket, finished.matches);
    assert.strictEqual(table.rows[0].id, players[0]._id, 'the winner of every game is top');
    assert.strictEqual(table.rows[0].played, 3, 'having played everyone');
    assert.strictEqual(table.rows[0].points, 9, 'three wins is nine points');
    assert.strictEqual(table.rows.reduce((n, r) => n + r.drawn, 0), 2, 'one drawn fixture shows on both rows');
    assert.strictEqual(table.champion?.id, players[0]._id, 'and the champion is the table leader');
    assert.ok(
        table.rows.every((r) => r.difference === r.scored - r.conceded),
        'goal difference is what it says'
    );
    console.log('✓ a full round robin: table, draws counted both sides, champion, one completion event');

    /* ---- elimination standings read as a bracket ------------------------------ */

    const cupEvent = await seedEvent('Standings Cup', { format: 'single_elim', created_by: admin._id });
    await seedField(cupEvent._id, 4);
    const cupDraw = await brackets.generateBracket({ event_id: cupEvent._id, seeding: 'registration' }, core(admin._id));
    for (const round of [1, 2]) {
        for (const m of (await brackets.listMatches(cupEvent._id)).filter((x) => x.round === round && x.status === 'scheduled')) {
            await matches.reportResult(m._id, { score_a: 2, score_b: 1 }, core(admin._id));
        }
    }
    const cupTable = standingsOf(
        (await brackets.getBracket(cupEvent._id, guest)).bracket,
        await brackets.listMatches(cupEvent._id)
    );
    const champion = cupTable.rows[0];
    assert.strictEqual(champion.eliminated, false, 'the champion is the one nobody knocked out');
    assert.strictEqual(
        champion.round_reached,
        cupDraw.bracket.rounds,
        'and their round_reached is the final, not one past it — there is no round after the last one'
    );
    assert.ok(
        cupTable.rows.every((r) => (r.round_reached ?? 0) <= cupDraw.bracket.rounds),
        'nobody reaches a round the bracket does not have'
    );
    assert.strictEqual(
        cupTable.rows.filter((r) => !r.eliminated).length,
        1,
        'exactly one participant is left standing'
    );
    console.log('✓ elimination standings: one survivor, and no round beyond the last');

    /* ---- teamed events ------------------------------------------------------ */

    const cup = await seedEvent('Team Cup', { format: 'single_elim', teamed: true, created_by: admin._id });
    const captains = [await seedUser('Cap A'), await seedUser('Cap B'), await seedUser('Cap C')];
    await seedTeam('Alpha', cup._id, captains[0]);
    await seedTeam('Bravo', cup._id, captains[1]);
    await seedTeam('Charlie', cup._id, captains[2], 'forming'); // not locked: not in the draw

    const teamDraw = await brackets.generateBracket({ event_id: cup._id, seeding: 'registration' }, core(admin._id));
    assert.strictEqual(teamDraw.bracket.participant_type, 'team', 'a teamed event draws teams');
    assert.strictEqual(teamDraw.bracket.participants.length, 2, 'only locked rosters are seeded');
    assert.deepStrictEqual(
        teamDraw.bracket.participants.map((p) => p.display_name).sort(),
        ['Alpha', 'Bravo'],
        'by name, so the bracket reads as a bracket'
    );
    console.log('✓ a teamed event draws its locked rosters, and nothing that is still forming');

    /* ---- a draft event's draw is not public (audit 3) --------------------------- */

    const secret = await seedEvent('Unannounced Cup', { format: 'single_elim', status: 'draft', created_by: admin._id });
    await seedField(secret._id, 4);
    await brackets.generateBracket({ event_id: secret._id, seeding: 'registration' }, core(admin._id));

    await expectError(
        () => brackets.getBracket(secret._id, guest),
        'bracket_not_found',
        'a guest cannot read the draw of an event the Event Service hides from them'
    );
    await expectError(
        () => brackets.getBracket(secret._id, asViewer(outsider._id, 'core')),
        'bracket_not_found',
        'nor can a core member who does not run it'
    );
    assert.ok(
        (await brackets.getBracket(secret._id, asViewer(admin._id, 'core'))).matches.length > 0,
        'its own organiser can'
    );
    assert.ok(
        (await brackets.getBracket(secret._id, asViewer(boss._id, 'coordinator'))).matches.length > 0,
        'and so can a coordinator'
    );

    const secretMatch = (await brackets.listMatches(secret._id))[0];
    await expectError(
        () => brackets.getMatch(secretMatch._id, guest),
        'match_not_found',
        'a single fixture of a draft event is hidden the same way'
    );
    await expectError(
        () => brackets.listMatchesFor(secret._id, guest),
        'bracket_not_found',
        'and so is its fixture list'
    );

    // A published event is public, which is the whole point of the spectator view.
    assert.ok((await brackets.getBracket(league._id, guest)).matches.length > 0, 'a live event is public');
    console.log('✓ a draft event\'s bracket, fixtures and standings are hidden exactly as the event is');

    /* ---- a deleted account comes off the draw --------------------------------- */

    const { handlers: bracketHandlers } = await import('../events/consumers');
    const gone = players[0];
    await bracketHandlers.anonymize({ user_id: gone._id });

    const afterDelete = await brackets.getBracket(league._id, guest);
    const seat = afterDelete.bracket.participants.find((p) => p.id === gone._id)!;
    assert.strictEqual(seat.display_name, 'Deleted user', 'the name comes off the draw');
    assert.strictEqual(seat.deleted, true, 'with the flag the spectator view renders from');
    assert.strictEqual(seat.seed, 1, 'the seed stays — the draw is still the draw');

    const playedIn = afterDelete.matches.filter((m) => m.a?.id === gone._id || m.b?.id === gone._id);
    assert.ok(playedIn.length > 0, 'they played fixtures');
    assert.ok(
        playedIn.every((m) => (m.a?.id === gone._id ? m.a : m.b)!.display_name === 'Deleted user'),
        'and their name is off every one of them'
    );
    assert.ok(playedIn.every((m) => m.winner !== null), 'while the results are untouched');
    console.log('✓ a deleted account keeps its seed and its results, and loses its name');

    /* ---- two reporters, one fixture (audit 2) ----------------------------------- */

    const race = await seedEvent('Race Cup', { format: 'round_robin', created_by: admin._id });
    await seedField(race._id, 2);
    const raceDraw = await brackets.generateBracket({ event_id: race._id, seeding: 'registration' }, core(admin._id));
    const only = raceDraw.matches[0];

    const outcomes = await Promise.allSettled([
        matches.reportResult(only._id, { score_a: 1, score_b: 0 }, core(admin._id)),
        matches.reportResult(only._id, { score_a: 0, score_b: 3 }, core(admin._id)),
    ]);
    const won = outcomes.filter((o) => o.status === 'fulfilled');
    const lost = outcomes.filter((o) => o.status === 'rejected');
    assert.strictEqual(won.length, 1, 'exactly one of two simultaneous reports lands');
    assert.strictEqual(lost.length, 1, 'and the other is refused');
    assert.strictEqual((lost[0] as PromiseRejectedResult).reason.code, 'already_reported', 'with the right code');
    console.log('✓ two reporters hitting one fixture at once produce one result');

    /* ---- refusals on the way in ---------------------------------------------- */

    const empty = await seedEvent('Nobody Came', { format: 'single_elim', created_by: admin._id });
    await expectError(
        () => brackets.generateBracket({ event_id: empty._id, seeding: 'registration' }, core(admin._id)),
        'not_enough_participants',
        'a field of nobody is not a tournament'
    );

    const direct = await seedEvent('Direct Event', { type: 'DE', created_by: admin._id });
    await expectError(
        () => brackets.generateBracket({ event_id: direct._id, seeding: 'registration' }, core(admin._id)),
        'event_has_no_leaderboard',
        'a direct event has no competition to draw'
    );

    const unsupported = await seedEvent('Double Elim Cup', { format: 'double_elim', created_by: admin._id });
    await seedField(unsupported._id, 4);
    await expectError(
        () => brackets.generateBracket({ event_id: unsupported._id, seeding: 'registration' }, core(admin._id)),
        'format_not_supported',
        'and a format we cannot draw yet says so by name'
    );

    const cancelled = await seedEvent('Called Off', { format: 'single_elim', status: 'cancelled', created_by: admin._id });
    await seedField(cancelled._id, 4);
    await expectError(
        () => brackets.generateBracket({ event_id: cancelled._id, seeding: 'registration' }, core(admin._id)),
        'event_cancelled',
        'a cancelled event is not drawn'
    );
    console.log('✓ empty fields, direct events, unsupported formats and cancelled events are each refused');

    await closeScratchDb();
    console.log('\nresults selfcheck: all checks passed');
}

main().catch(async (err) => {
    console.error('results selfcheck failed:', err);
    await closeScratchDb().catch(() => undefined);
    process.exit(1);
});
