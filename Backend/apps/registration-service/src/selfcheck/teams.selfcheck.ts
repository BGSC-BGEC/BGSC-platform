import './scratch-env';
import { Challenge, Event, FormSubmission, Team, TeamMembership, User, publish, subscribe } from '@bgsc/shared';
import { rosterLockSweep } from '../events/sweeps';
import assert from 'assert';
import { v4 as uuid } from 'uuid';
import * as formService from '../forms/form.service';
import * as registrationService from '../registrations/registration.service';
import * as teamService from '../teams/team.service';
import { closeScratchDb, openScratchDb, seedEvent, seedUser, startEventStub } from './seed';
import { initializeConsumers } from '../events/consumers';

/**
 * Teams selfcheck: captain approval gate, team creation, roster changes, purse ops.
 * Run: npx ts-node apps/registration-service/src/selfcheck/teams.selfcheck.ts
 *
 * Seats come from a stub Event Service (seed.ts), so registrations confirm through the real path.
 */

const NAME_FIELD = {
    key: 'name', label: 'Name', help_text: null, type: 'short_text' as const, required: true, placeholder: null,
    options: null, validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
    visible_if: null, admin_only: false, order: 0,
};

const settle = () => new Promise((r) => setTimeout(r, 300));
/** Poll until the bus-driven state shows up (a fixed sleep flaked under load). */
const until = async (ok: () => Promise<boolean>, ms = 5000) => {
    for (const end = Date.now() + ms; Date.now() < end; await settle()) if (await ok()) return;
};

async function main() {
    await openScratchDb();
    const stub = await startEventStub();
    initializeConsumers();
    const locked: any[] = [];
    subscribe('TeamLocked', (e) => void locked.push(e.payload));
    const invites: any[] = [];
    subscribe('TeamInviteCreated', (e) => void invites.push(e.payload));

    const adminId = uuid();
    const admin = { id: adminId, role: 'core' }; // creator of the event: its admin
    const as = (id: string) => ({ id, role: 'user' });
    const [captain, member, outsider, stranger, spare, racerA, racerB, closed] = await Promise.all(
        ['Captain', 'Member', 'Outsider', 'Stranger', 'Spare', 'Racer A', 'Racer B', 'Closed'].map((n) => seedUser(n))
    );

    const eventId = uuid();
    const form = await formService.createForm({ owner: { type: 'event', id: eventId }, title: 'Team Event', fields: [NAME_FIELD], created_by: adminId });
    await formService.publishForm(form._id);
    // The event, not the captain, says how big a team is (known issue 3).
    await seedEvent({ id: eventId, formId: form._id, createdBy: adminId, teamSize: [2, 2] });

    const register = (userId: string, role: 'captain' | 'member', visibility: 'open' | 'closed' = 'open') =>
        registrationService.submitRegistration({
            form_id: form._id,
            owner: { type: 'event', id: eventId },
            answers: { name: 'x' },
            context: { event: { role, team_visibility: visibility } },
            user_id: userId,
        });

    console.log('1. Captain registers and waits for approval...');
    const captainReg = await register(captain._id, 'captain');
    assert.strictEqual(captainReg.status, 'submitted', 'A captain application must not take a seat yet');
    assert.strictEqual(captainReg.context.event!.captain_application.status, 'pending');
    await assert.rejects(
        () => teamService.createTeam({ owner: { type: 'event', id: eventId }, name: 'Early', captain_user_id: captain._id }),
        (err: any) => err.code === 'captain_not_approved'
    );
    console.log('✓ pending, no seat, no team');

    console.log('2. Approval takes a seat and allows a team sized by the event...');
    const approved = await registrationService.updateCaptainApplication(captainReg._id, admin, 'approved');
    assert.strictEqual(approved.status, 'confirmed');
    const team = await teamService.createTeam({
        owner: { type: 'event', id: eventId },
        name: 'Alpha',
        captain_user_id: captain._id,
        join_policy: 'open',
    });
    assert(team.size_min === 2 && team.size_max === 2, `bounds come from events.teaming, got ${team.size_min}..${team.size_max}`);
    assert.strictEqual(team.members[0].registration_id, captainReg._id);
    assert.strictEqual((await registrationService.getRegistration(captainReg._id)).context.event!.team_id, team._id);
    await assert.rejects(
        () => teamService.createTeam({ owner: { type: 'event', id: eventId }, name: 'Second', captain_user_id: captain._id }),
        (err: any) => err.code === 'captain_already_has_team'
    );
    console.log('✓');

    console.log('3. Mismatched member arguments are refused...');
    const strangerReg = await register(stranger._id, 'member');
    await assert.rejects(
        () => teamService.addMemberToTeam(team._id, stranger._id, captainReg._id, 'auction'),
        (err: any) => err.code === 'registration_user_mismatch'
    );
    const otherEventReg = await FormSubmission.create({
        _id: uuid(), form_id: uuid(), form_version: 1,
        owner: { type: 'event', id: uuid() },
        user: { user_id: stranger._id, display_name: 'Stranger', avatar_url: null },
        answers: {}, files: [],
        context: { event: { role: 'member', team_id: null, team_visibility: 'open', base_price: null,
            captain_application: { status: 'none', reviewed_by: null, reviewed_at: null, note: null }, attended: null } },
        status: 'confirmed', waitlist_position: null, status_history: [], submitted_at: new Date(), confirmed_at: new Date(),
    });
    await assert.rejects(
        () => teamService.addMemberToTeam(team._id, stranger._id, otherEventReg._id, 'auction'),
        (err: any) => err.code === 'registration_owner_mismatch'
    );
    console.log('✓');

    console.log('4. An invite is an offer the invitee accepts; closed users cannot be invited...');
    const closedReg = await register(closed._id, 'member', 'closed');
    await assert.rejects(() => teamService.inviteMember(team._id, captain._id, closed._id),
        (err: any) => err.code === 'not_accepting_invites', 'team_visibility closed refuses invites');
    await assert.rejects(() => teamService.inviteMember(team._id, member._id, closed._id), (err: any) => err.code === 'not_captain');

    const memberReg = await register(member._id, 'member');
    const offered = await teamService.inviteMember(team._id, captain._id, member._id);
    assert.strictEqual(offered.members.length, 1, 'an invite does not seat anyone');
    assert(offered.pending.some((p) => p.user_id === member._id), 'it waits in pending[]');
    assert.deepStrictEqual(
        Object.keys(invites.find((p) => p.user_id === member._id)).sort(),
        ['invited_by', 'owner', 'team_id', 'team_name', 'user_id'],
        'TeamInviteCreated carries exactly what the notification consumer reads'
    );
    const mine = await teamService.listTeams({ invited_user: member._id, limit: 10, offset: 0 });
    assert(mine.length === 1 && mine[0]._id === team._id, 'GET /teams?invited=me finds the invite');
    // An expired invite is invisible and does not block a fresh one.
    await Team.updateOne({ _id: team._id, 'pending.user_id': member._id }, { $set: { 'pending.$.expires_at': new Date(Date.now() - 1000) } });
    assert.strictEqual((await teamService.listTeams({ invited_user: member._id, limit: 10, offset: 0 })).length, 0);
    await teamService.inviteMember(team._id, captain._id, member._id);
    await Team.updateOne({ _id: team._id }, { $set: { join_policy: 'invite_only' } });
    const joined = await teamService.joinTeam(team._id, member._id);
    assert.strictEqual(joined.members.length, 2);
    assert.strictEqual(joined.members[1].acquired_via, 'invite', 'accepting an invite works on an invite-only team');
    assert(!joined.pending.some((p) => p.user_id === member._id), 'and consumes the invite');
    assert.strictEqual((await registrationService.getRegistration(memberReg._id)).context.event!.team_id, team._id);
    await assert.rejects(() => teamService.addMemberToTeam(team._id, stranger._id, strangerReg._id, 'join'),
        (err: any) => err.code === 'team_full');
    console.log('✓');

    console.log('5. Remove, captain guard, lock guard...');
    await assert.rejects(() => teamService.removeMemberFromTeam(team._id, captain._id, adminId), (err: any) => err.code === 'cannot_remove_captain');
    const afterRemove = await teamService.removeMemberFromTeam(team._id, member._id, adminId, 'left');
    assert.strictEqual(afterRemove.members.length, 1);
    assert.strictEqual((await registrationService.getRegistration(memberReg._id)).context.event!.team_id, null);
    await assert.rejects(() => teamService.lockTeam(team._id, adminId), (err: any) => err.code === 'team_below_minimum_size');
    console.log('✓');

    console.log('6. Two joins for the last slot: exactly one lands (membership race)...');
    await Team.updateOne({ _id: team._id }, { $set: { join_policy: 'open' } });
    const [ra, rb] = await Promise.all([register(racerA._id, 'member'), register(racerB._id, 'member')]);
    const raced = await Promise.allSettled([teamService.joinTeam(team._id, racerA._id), teamService.joinTeam(team._id, racerB._id)]);
    assert.strictEqual(raced.filter((r) => r.status === 'fulfilled').length, 1, 'one join wins');
    const full = await teamService.getTeam(team._id);
    assert.strictEqual(full.members.length, 2, 'the roster never exceeds size_max');
    const loserReg = raced[0].status === 'fulfilled' ? rb : ra;
    assert.strictEqual((await registrationService.getRegistration(loserReg._id)).context.event!.team_id, null, 'the loser is not linked');
    console.log('✓');

    console.log('7. Cancelling a member\'s registration takes them off the roster...');
    const winner = full.members.find((m) => m.user_id !== captain._id)!;
    await registrationService.cancelRegistration(winner.registration_id!, as(winner.user_id));
    assert.strictEqual((await teamService.getTeam(team._id)).members.length, 1, 'a cancelled registration holds no team seat');
    console.log('✓');

    console.log('8. Demoting a confirmed team member drops the link...');
    const spareReg = await register(spare._id, 'member');
    await teamService.joinTeam(team._id, spare._id);
    const demoted = await registrationService.updateRegistrationStatus(spareReg._id, admin, 'rejected', 'demoted');
    assert.strictEqual(demoted.status, 'rejected');
    assert.strictEqual(demoted.context.event!.team_id, null);
    assert(!(await teamService.getTeam(team._id)).members.some((m) => m.user_id === spare._id), 'and the roster row');
    console.log('✓');

    console.log('9. Team names: a duplicate is a 409, not a 500...');
    const cap2 = await seedUser('Cap Two');
    const cap2Reg = await register(cap2._id, 'captain');
    await registrationService.updateCaptainApplication(cap2Reg._id, admin, 'approved');
    await assert.rejects(
        () => teamService.createTeam({ owner: { type: 'event', id: eventId }, name: 'ALPHA', captain_user_id: cap2._id }),
        (err: any) => err.status === 409 && err.code === 'team_name_taken'
    );
    console.log('✓');

    console.log('10. Snapshots follow rename, delete and restore...');
    publish('UserProfileUpdated', 'user-service', { user_id: captain._id, changed_fields: ['bio'] });
    await settle();
    assert.strictEqual((await teamService.getTeam(team._id)).members[0].display_name, 'Captain', 'a bio edit touches nothing');
    await User.updateOne({ _id: captain._id }, { $set: { 'profile.full_name': 'Captain Renamed' } });
    publish('UserProfileUpdated', 'user-service', { user_id: captain._id, changed_fields: ['full_name'] });
    await until(async () => (await registrationService.getRegistration(captainReg._id)).user.display_name === 'Captain Renamed');
    assert.strictEqual((await teamService.getTeam(team._id)).members[0].display_name, 'Captain Renamed');
    assert.strictEqual((await registrationService.getRegistration(captainReg._id)).user.display_name, 'Captain Renamed');

    publish('UserDeleted', 'user-service', { user_id: captain._id });
    await until(async () => (await teamService.getTeam(team._id)).members[0].deleted === true);
    let snap = (await teamService.getTeam(team._id)).members[0];
    assert(snap.display_name === 'Deleted user' && snap.deleted === true && snap.user_id === captain._id);

    publish('UserRestored', 'auth-service', { user_id: captain._id });
    await until(async () => (await teamService.getTeam(team._id)).members[0].deleted === false);
    snap = (await teamService.getTeam(team._id)).members[0];
    assert(snap.display_name === 'Captain Renamed' && snap.deleted === false, 'a restored account gets its name back');
    assert.strictEqual((await registrationService.getRegistration(captainReg._id)).user.deleted, false);
    console.log('✓');

    console.log('11. Disband unlinks everyone and releases the claims...');
    const disbanded = await teamService.disbandTeam(team._id, 'selfcheck');
    assert.strictEqual(disbanded.status, 'disbanded');
    assert.strictEqual((await registrationService.getRegistration(captainReg._id)).context.event!.team_id, null);
    await assert.rejects(() => teamService.disbandTeam(team._id), (err: any) => err.code === 'already_disbanded');
    console.log('✓');

    console.log('12. Challenge teams: no registrations, owner bounds, one team per user...');
    const challengeId = uuid();
    await Challenge.create({
        _id: challengeId, slug: `sc-${challengeId.slice(0, 12)}`, title: 'Selfcheck Team Challenge', description: 'x',
        domain: 'sports', kind: 'digital', difficulty: 'easy', award_points: 10,
        teaming: { enabled: true, team_size_min: 2, team_size_max: 4, max_teams: 2 },
        submission: { requires_proof: true, proof_types: ['url'], max_files: 1, auto_approve: false },
        status: 'active', created_by: adminId,
    });
    const crew = await teamService.createTeam({ owner: { type: 'challenge', id: challengeId }, name: 'Crew', captain_user_id: captain._id, join_policy: 'open' });
    assert(crew.members[0].registration_id === null && crew.size_min === 2 && crew.size_max === 4);
    const duo = await teamService.joinTeam(crew._id, member._id);
    assert(duo.members.length === 2 && duo.members[1].registration_id === null);
    await assert.rejects(() => teamService.joinTeam(crew._id, member._id), (err: any) => err.code === 'already_member');
    await assert.rejects(
        () => teamService.createTeam({ owner: { type: 'challenge', id: challengeId }, name: 'Breakaway', captain_user_id: member._id }),
        (err: any) => err.code === 'already_in_team',
        'a member of one team cannot captain another in the same challenge'
    );
    const lockedCrew = await teamService.lockTeam(crew._id, adminId);
    assert.strictEqual(lockedCrew.status, 'locked');
    assert(locked.some((p) => p.team_id === crew._id && p.owner?.id === challengeId), 'TeamLocked carries owner');
    await Challenge.updateOne({ _id: challengeId }, { $set: { status: 'archived' } });
    await assert.rejects(() => teamService.createTeam({ owner: { type: 'challenge', id: challengeId }, name: 'Late', captain_user_id: outsider._id }),
        (err: any) => err.code === 'challenge_not_active');
    console.log('✓');

    console.log('13. Rosters lock when the event runs; an unfinished auction league waits (§6)...');
    const lockForm = await formService.createForm({ owner: { type: 'event', id: uuid() }, title: 'L', fields: [NAME_FIELD], created_by: adminId });
    const seedTeam = async (ownerId: string, name: string) =>
        Team.create({
            _id: uuid(), owner: { type: 'event', id: ownerId }, name, captain_user_id: captain._id, size_min: 1, size_max: 3,
            invite_code: uuid().replace(/-/g, '').slice(0, 8), status: 'forming',
            members: [{ user_id: captain._id, display_name: 'C', avatar_url: null, registration_id: captainReg._id, joined_at: new Date(), acquired_via: 'created' }],
        });
    const running = await seedEvent({ formId: lockForm._id, createdBy: adminId, teamSize: [1, 3], status: 'ongoing' });
    const league = await seedEvent({ formId: lockForm._id, createdBy: adminId, teamSize: [1, 3], status: 'ongoing', type: 'ALL', auctionStatus: 'live' });
    const t1 = await seedTeam(running, 'Run');
    const t2 = await seedTeam(league, 'League');
    const short = await seedTeam(running, 'Short');
    await Team.updateOne({ _id: short._id }, { $set: { size_min: 2 } });
    locked.length = 0;
    publish('EventStarted', 'event-service', { event_id: running, title: 'x' });
    publish('EventStarted', 'event-service', { event_id: league, title: 'y' });
    await settle();
    assert.strictEqual((await teamService.getTeam(t1._id)).status, 'locked', 'a running event locks its ready rosters');
    assert.strictEqual((await teamService.getTeam(t2._id)).status, 'forming', 'an auction league with a live auction does not');
    assert.strictEqual((await teamService.getTeam(short._id)).status, 'forming', 'a roster below size_min stays open');
    assert(locked.some((p) => p.team_id === t1._id && p.owner?.id === running), 'TeamLocked carries the owner');
    await Event.collection.updateOne({ _id: league as any }, { $set: { 'auction.status': 'finished' } });
    assert(await rosterLockSweep() >= 1, 'the sweep catches what the bus dropped');
    assert.strictEqual((await teamService.getTeam(t2._id)).status, 'locked');

    console.log('14. Auction add-member is idempotent on request_id (§9)...');
    const auctionForm = await formService.createForm({ owner: { type: 'event', id: uuid() }, title: 'A', fields: [NAME_FIELD], created_by: adminId });
    await formService.publishForm(auctionForm._id);
    const auctionEvent = await seedEvent({ id: auctionForm.owner.id!, formId: auctionForm._id, createdBy: adminId, teamSize: [1, 3] });
    const player = await seedUser('Player');
    const playerReg = await registrationService.submitRegistration({
        form_id: auctionForm._id, owner: { type: 'event', id: auctionEvent }, answers: { name: 'p' },
        context: { event: { role: 'member' } }, user_id: player._id,
    });
    const auctionTeam = await seedTeam(auctionEvent, 'Bidders');
    const key = `lot1:${auctionTeam._id}:add`;
    const [first, again] = await Promise.all([
        teamService.addMemberToTeam(auctionTeam._id, player._id, playerReg._id, 'auction', key),
        teamService.addMemberToTeam(auctionTeam._id, player._id, playerReg._id, 'auction', key),
    ]);
    assert(first.members.some((m) => m.user_id === player._id) && again.members.some((m) => m.user_id === player._id),
        'a concurrent repeat answers 200, not 409');
    const final = await teamService.getTeam(auctionTeam._id);
    assert(final.members.filter((m) => m.user_id === player._id).length === 1 && final.member_ops!.includes(key));

    // Staggered: the repeat reads after the first call linked the registration but before its push.
    const player2 = await seedUser('Player 2');
    const player2Reg = await registrationService.submitRegistration({
        form_id: auctionForm._id, owner: { type: 'event', id: auctionEvent }, answers: { name: 'p' },
        context: { event: { role: 'member' } }, user_id: player2._id,
    });
    const key2 = `lot2:${auctionTeam._id}:add`;
    await TeamMembership.create({ _id: `${auctionEvent}:${player2._id}`, owner_id: auctionEvent, user_id: player2._id, team_id: auctionTeam._id });
    await FormSubmission.updateOne({ _id: player2Reg._id }, { $set: { 'context.event.team_id': auctionTeam._id } });
    const repeat = teamService.addMemberToTeam(auctionTeam._id, player2._id, player2Reg._id, 'auction', key2);
    await new Promise((r) => setTimeout(r, 100));
    await Team.updateOne({ _id: auctionTeam._id }, {
        $push: {
            members: { user_id: player2._id, display_name: 'P2', avatar_url: null, registration_id: player2Reg._id, joined_at: new Date(), acquired_via: 'auction' },
            member_ops: key2,
        },
    });
    assert((await repeat).member_ops!.includes(key2), 'a repeat that saw the link but not the seat answers 200, not 409');
    console.log('✓');

    console.log('15. Purse ops are idempotent and never clamp...');
    const purseTeam = await Team.create({
        _id: uuid(), owner: { type: 'event', id: eventId }, name: 'Purse', captain_user_id: captain._id, size_min: 1, size_max: 5,
        invite_code: 'PURSE123', status: 'forming', auction: null,
        members: [{ user_id: captain._id, display_name: 'Captain', avatar_url: null, registration_id: captainReg._id, joined_at: new Date(), acquired_via: 'created' }],
    });
    assert.deepStrictEqual(await teamService.setAuctionPurses(eventId, 1000), { updated_count: 1 });
    assert.deepStrictEqual(await teamService.setAuctionPurses(eventId, 5), { updated_count: 0 }, 'a purse is set once');

    assert.strictEqual((await teamService.debitPurse(purseTeam._id, 350, 'lot1:debit')).auction!.purse_spent, 350);
    assert.strictEqual((await teamService.debitPurse(purseTeam._id, 350, 'lot1:debit')).auction!.purse_spent, 350, 'a retried debit is a no-op');
    await assert.rejects(() => teamService.debitPurse(purseTeam._id, 700, 'lot2:debit'), (err: any) => err.code === 'insufficient_purse');
    assert.strictEqual((await teamService.refundPurse(purseTeam._id, 200, 'lot1:refund')).auction!.purse_spent, 150);
    assert.strictEqual((await teamService.refundPurse(purseTeam._id, 200, 'lot1:refund')).auction!.purse_spent, 150, 'a retried refund is a no-op');
    await assert.rejects(() => teamService.refundPurse(purseTeam._id, 500, 'lot3:refund'), (err: any) => err.code === 'refund_exceeds_spent',
        'an over-refund is refused, not clamped');
    await assert.rejects(() => teamService.setAuctionBudget(purseTeam._id, { purse_total: 100, reason: null, overridden_by: adminId }),
        (err: any) => err.code === 'purse_below_spent');
    const overridden = await teamService.setAuctionBudget(purseTeam._id, { purse_total: 2000, reason: 'oc', overridden_by: adminId });
    assert(overridden.auction!.is_overridden && overridden.auction!.purse_total === 2000 && overridden.auction!.purse_spent === 150);
    await assert.rejects(() => teamService.setAuctionBudget(purseTeam._id, { purse_total: 3000, reason: null, overridden_by: adminId }),
        (err: any) => err.code === 'team_already_overridden');
    console.log('✓');


    await stub.close();
    await closeScratchDb();
    console.log('\n✅ All teams selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
