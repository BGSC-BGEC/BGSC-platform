import { FormSubmission, Team, User, connectDB, disconnectDB, publish } from '@bgsc/shared';
import assert from 'assert';
import { v4 as uuid } from 'uuid';
import * as formService from '../forms/form.service';
import * as registrationService from '../registrations/registration.service';
import * as teamService from '../teams/team.service';
import { seedUser, dropUsers } from './seed';
import { initializeConsumers } from '../events/consumers';

/**
 * Teams selfcheck: captain approval gate, team creation, roster changes.
 * Run: npx tsx apps/registration-service/src/selfcheck/teams.selfcheck.ts
 *
 * No Event Service is needed: registrations are moved to `confirmed` through the same admin
 * transition an operator would use.
 */

const NAME_FIELD = {
    key: 'name',
    label: 'Name',
    help_text: null,
    type: 'short_text' as const,
    required: true,
    placeholder: null,
    options: null,
    validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
    visible_if: null,
    admin_only: false,
    order: 0,
};

async function main() {
    await connectDB();

    const eventId = uuid();
    const adminId = uuid();
    const captain = await seedUser('Captain');
    const member = await seedUser('Member');
    const outsider = await seedUser('Outsider');
    const userIds = [captain._id, member._id, outsider._id];

    const form = await formService.createForm({
        owner: { type: 'event', id: eventId },
        title: 'Team Event',
        fields: [NAME_FIELD],
        created_by: adminId,
    });
    await formService.publishForm(form._id);

    const register = async (userId: string, role: 'captain' | 'member') => {
        const reg = await registrationService.submitRegistration({
            form_id: form._id,
            owner: { type: 'event', id: eventId },
            answers: { name: 'x' },
            context: { event: { role } },
            user_id: userId,
            is_admin: false,
        });
        return reg;
    };

    console.log('1. Captain registers and waits for approval...');
    const captainReg = await register(captain._id, 'captain');
    assert(captainReg.status === 'submitted', 'A captain application must not take a seat yet');
    assert(
        captainReg.context.event!.captain_application.status === 'pending',
        'Captain registration should open a pending application'
    );
    console.log('✓ Captain application pending, no seat held');

    console.log('2. Team creation is refused before approval...');
    await assert.rejects(
        () => teamService.createTeam({ owner: { type: 'event', id: eventId }, name: 'Early', captain_user_id: captain._id }),
        (err: any) => err.code === 'captain_not_approved',
        'An unapproved captain must not be able to create a team'
    );
    console.log('✓ Refused');

    console.log('3. Approving the captain...');
    await registrationService.updateCaptainApplication(captainReg._id, adminId, 'approved');
    // The Event Service is not running, so the seat reservation could not settle; confirm by hand,
    // which is the same path an admin uses.
    const approved = await registrationService.getRegistration(captainReg._id);
    if (approved.status !== 'confirmed') {
        await registrationService.transition(approved, 'confirmed', adminId, 'selfcheck');
        await approved.save();
    }
    assert(
        approved.context.event!.captain_application.status === 'approved',
        'Application should be approved'
    );
    console.log('✓ Captain approved and confirmed');

    console.log('4. Creating the team...');
    const team = await teamService.createTeam({
        owner: { type: 'event', id: eventId },
        name: `Team ${uuid().slice(0, 6)}`,
        captain_user_id: captain._id,
        join_policy: 'open',
        size_max: 2,
    });
    // The model requires the captain to be in members[]; creating with an empty roster never saved.
    assert(
        team.members.some((m) => m.user_id === captain._id),
        'The captain must be a member of their own team'
    );
    assert(team.members[0].registration_id === captainReg._id, 'Captain member links their registration');
    assert(team.invite_code.length === 8, 'Invite code must be 8 characters');
    const linkedCaptainReg = await registrationService.getRegistration(captainReg._id);
    assert(linkedCaptainReg.context.event!.team_id === team._id, 'Captain registration links to the team');
    console.log('✓ Team created with the captain on the roster');

    console.log('5. Duplicate team for the same captain is refused...');
    await assert.rejects(
        () => teamService.createTeam({ owner: { type: 'event', id: eventId }, name: 'Second', captain_user_id: captain._id }),
        (err: any) => err.code === 'captain_already_has_team',
        'A captain may hold one team per event'
    );
    console.log('✓ Refused');

    console.log('6. Adding a member...');
    const memberReg = await register(member._id, 'member');
    await registrationService.transition(memberReg, 'confirmed', adminId, 'selfcheck');
    await memberReg.save();

    const withMember = await teamService.addMemberToTeam(team._id, member._id, memberReg._id, 'join');
    assert(withMember.members.length === 2, 'Roster should hold two');
    const linkedMemberReg = await registrationService.getRegistration(memberReg._id);
    assert(linkedMemberReg.context.event!.team_id === team._id, 'Member registration links to the team');
    console.log('✓ Member added and linked');

    console.log('7. A full roster is refused...');
    const outsiderReg = await register(outsider._id, 'member');
    await registrationService.transition(outsiderReg, 'confirmed', adminId, 'selfcheck');
    await outsiderReg.save();
    await assert.rejects(
        () => teamService.addMemberToTeam(team._id, outsider._id, outsiderReg._id, 'join'),
        (err: any) => err.code === 'team_full',
        'size_max must be enforced as a refusal, not as a model crash'
    );
    console.log('✓ Refused with team_full');

    console.log('8. The captain cannot be removed from their own team...');
    await assert.rejects(
        () => teamService.removeMemberFromTeam(team._id, captain._id, adminId),
        (err: any) => err.code === 'cannot_remove_captain',
        'Removing the captain would break the model invariant'
    );
    console.log('✓ Refused');

    console.log('9. Removing a member unlinks their registration...');
    const afterRemove = await teamService.removeMemberFromTeam(team._id, member._id, adminId, 'left');
    assert(afterRemove.members.length === 1, 'Only the captain should remain');
    const unlinked = await registrationService.getRegistration(memberReg._id);
    assert(unlinked.context.event!.team_id === null, 'Removed member registration must be unlinked');
    console.log('✓ Member removed and unlinked');

    // relationships.md §4: a profile change must rewrite the snapshots this service owns.
    console.log('10. Testing snapshot refresh on UserProfileUpdated...');
    initializeConsumers();

    // A change that touches neither display_name nor avatar_url must not rewrite anything.
    publish('UserProfileUpdated', 'user-service', { user_id: captain._id, changed_fields: ['bio'] });
    await new Promise((r) => setTimeout(r, 150));
    let refreshed = await teamService.getTeam(team._id);
    assert(
        refreshed.members.find((m) => m.user_id === captain._id)!.display_name === 'Captain',
        'A bio-only change must not touch the snapshot'
    );

    await User.updateOne({ _id: captain._id }, { $set: { 'profile.full_name': 'Captain Renamed' } });
    publish('UserProfileUpdated', 'user-service', { user_id: captain._id, changed_fields: ['full_name'] });
    await new Promise((r) => setTimeout(r, 300));

    refreshed = await teamService.getTeam(team._id);
    assert(
        refreshed.members.find((m) => m.user_id === captain._id)!.display_name === 'Captain Renamed',
        'The team roster snapshot must follow a renamed user'
    );
    const refreshedReg = await registrationService.getRegistration(captainReg._id);
    assert(
        refreshedReg.user.display_name === 'Captain Renamed',
        'The submission snapshot must follow a renamed user'
    );
    console.log('✓ Snapshots refreshed on rename, untouched on an unrelated edit');

    console.log('11. Disbanding the team...');
    const disbanded = await teamService.disbandTeam(team._id, 'selfcheck');
    assert(disbanded.status === 'disbanded', 'Team should be disbanded');
    const unlinkedCaptain = await registrationService.getRegistration(captainReg._id);
    assert(unlinkedCaptain.context.event!.team_id === null, 'Disband must unlink every member');
    console.log('✓ Team disbanded and rosters unlinked');

    // Cleanup
    await Team.deleteMany({ 'owner.id': eventId });
    await FormSubmission.deleteMany({ form_id: form._id });
    await formService.archiveForm(form._id);
    await dropUsers(userIds);

    await disconnectDB();
    console.log('\n✅ All teams selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
