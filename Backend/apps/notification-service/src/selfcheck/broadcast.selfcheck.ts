import assert from 'assert';
import {
    Announcement,
    ChallengeParticipation,
    FeedbackTicket,
    FormSubmission,
    Notification,
    NotificationDispatch,
    Team,
    UserRole,
    UserStatus,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { dedupe, deliverAnnouncement, recipientsFor, summarize } from '../broadcast/broadcast';
import { retractDeleted } from '../scheduler/tick';
import { BODY_MAX, render, renderMessage } from '../broadcast/templates';
import { handlers } from '../events/consumers';
import {
    closeScratchDb,
    mute,
    openScratchDb,
    seedAnnouncement,
    seedChallenge,
    seedEvent,
    seedParticipation,
    seedRegistration,
    seedUser,
} from './seed';

/**
 * In-app fan-out: who gets a card, what it says, and what happens on a replay.
 *
 * The audience rules are asserted as the *result of the query*, not by calling a predicate: a
 * filter that is right in isolation can still be wrong once combined, and it is the combination
 * that ships.
 */

async function main(): Promise<void> {
    await openScratchDb();

    const author = await seedUser('Author', UserRole.CORE);

    /* ---- the role ladder ---------------------------------------------- */

    const guestish = await seedUser('Regular', UserRole.USER);
    const member = await seedUser('Member', UserRole.MEMBER);
    const core = await seedUser('Core', UserRole.CORE);
    const founder = await seedUser('Founder', UserRole.FOUNDER);

    const open = await seedAnnouncement(author, 'Open to everyone');
    const openRecipients = new Set(await recipientsFor(open));
    for (const u of [guestish, member, core, founder, author]) {
        assert.ok(openRecipients.has(u._id), `a guest-floor announcement reaches ${u.profile.full_name}`);
    }
    assert.ok(openRecipients.has(author._id), 'the author is part of their own audience');
    console.log('✓ a guest-floor announcement reaches every active user, author included');

    const gated = await seedAnnouncement(author, 'Core only', { min_role: 'core', categories: ['teams'] });
    const gatedRecipients = new Set(await recipientsFor(gated));
    assert.ok(gatedRecipients.has(core._id) && gatedRecipients.has(founder._id), 'core+ see a core-floored one');
    assert.ok(!gatedRecipients.has(member._id), 'a member does not');
    assert.ok(!gatedRecipients.has(guestish._id), 'a user does not');
    console.log('✓ the role floor is enforced as a query, not after the fact');

    /* ---- inactive accounts -------------------------------------------- */

    const suspended = await seedUser('Suspended', UserRole.USER, UserStatus.SUSPENDED);
    const deletedUser = await seedUser('Gone', UserRole.USER);
    await deletedUser.updateOne({ deleted_at: new Date() });

    const active = new Set(await recipientsFor(open));
    assert.ok(!active.has(suspended._id), 'a suspended account gets nothing');
    assert.ok(!active.has(deletedUser._id), 'a soft-deleted account gets nothing');
    console.log('✓ suspended and deleted accounts are out of every audience');

    /* ---- event scoping ------------------------------------------------- */

    const eventId = await seedEvent('Scoped Event');
    const registrant = await seedUser('Registrant', UserRole.USER);
    const waitlisted = await seedUser('Waitlisted', UserRole.USER);
    await seedRegistration(registrant._id, eventId, 'confirmed');
    await seedRegistration(waitlisted._id, eventId, 'waitlisted');

    const scoped = await seedAnnouncement(author, 'For registrants', { event_id: eventId });
    const scopedRecipients = new Set(await recipientsFor(scoped));
    assert.ok(scopedRecipients.has(registrant._id), 'a confirmed registrant is in scope');
    assert.ok(!scopedRecipients.has(waitlisted._id), 'a waitlisted one is not');
    assert.ok(!scopedRecipients.has(core._id), 'nor is a core member who did not register');
    console.log('✓ event scoping matches the feed rule: confirmed registrations only');

    /* ---- preferences --------------------------------------------------- */

    const muted = await seedUser('Muted', UserRole.USER);
    await mute(muted._id, 'announcement');
    const afterMute = new Set(await recipientsFor(open));
    assert.ok(!afterMute.has(muted._id), 'a muted user is excluded');
    assert.ok(afterMute.has(guestish._id), 'their neighbour is not');
    console.log('✓ a muted category removes that user and nobody else');

    /* ---- delivery + replay --------------------------------------------- */

    const broadcast = await seedAnnouncement(author, 'Broadcast me', { body: 'Body text here.' });
    const first = await deliverAnnouncement(broadcast._id);
    assert.ok(first && first.created > 0, 'the first delivery creates rows');

    const second = await deliverAnnouncement(broadcast._id);
    assert.strictEqual(second?.created, 0, 'a replay creates none');

    const rows = await Notification.countDocuments({ dedupe_key: dedupe.announcement(broadcast._id) });
    assert.strictEqual(rows, first.created, 'and leaves exactly one row per recipient');

    const mine = await Notification.findOne({
        dedupe_key: dedupe.announcement(broadcast._id),
        user_id: core._id,
    }).lean();
    assert.ok(mine, 'a recipient has a card');
    assert.strictEqual(mine!.title, 'Broadcast me', 'titled with the announcement');
    assert.strictEqual(mine!.body, 'Body text here.', 'summarised body');
    assert.strictEqual(mine!.category, 'announcement', 'categorised for preferences');
    assert.strictEqual(mine!.read_at, null, 'and unread');
    assert.strictEqual((mine!.data as { announcement_id: string }).announcement_id, broadcast._id, 'deep link id');
    console.log('✓ delivery is idempotent and the card carries its deep link');

    /* ---- an edited announcement does not leave stale cards ---------------- */

    await Announcement.updateOne(
        { _id: broadcast._id },
        { $set: { title: 'Broadcast me (moved to 7pm)', body: 'New body text.' } }
    );
    await handlers.onAnnouncementUpdated({ announcement_id: broadcast._id, changed_fields: ['title', 'body'] });

    const refreshed = await Notification.findOne({
        dedupe_key: dedupe.announcement(broadcast._id),
        user_id: core._id,
    }).lean();
    assert.strictEqual(refreshed!.title, 'Broadcast me (moved to 7pm)', 'the card follows the announcement');
    assert.strictEqual(refreshed!.body, 'New body text.', 'body too');
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.announcement(broadcast._id) }),
        first.created,
        'and the refresh creates no cards — a muted user does not gain one from a typo fix'
    );

    // An edit that does not touch the card must not rewrite rows across the collection, exactly as
    // `changed_fields` gates every other snapshot consumer in this repo.
    await Announcement.updateOne({ _id: broadcast._id }, { $set: { title: 'Never rendered' } });
    await handlers.onAnnouncementUpdated({ announcement_id: broadcast._id, changed_fields: ['priority'] });
    const untouched = await Notification.findOne({
        dedupe_key: dedupe.announcement(broadcast._id),
        user_id: core._id,
    }).lean();
    assert.strictEqual(untouched!.title, 'Broadcast me (moved to 7pm)', 'a priority edit changes no card');
    console.log('✓ editing a published announcement updates its cards, and only when it should');

    /* ---- nothing is broadcast that should not be ------------------------ */

    const draft = await seedAnnouncement(author, 'Draft', { status: 'draft' });
    assert.strictEqual(await deliverAnnouncement(draft._id), null, 'a draft is never delivered');

    const gone = await seedAnnouncement(author, 'Deleted', { deleted: true });
    assert.strictEqual(await deliverAnnouncement(gone._id), null, 'nor is a soft-deleted announcement');
    assert.strictEqual(await Notification.countDocuments({ dedupe_key: dedupe.announcement(gone._id) }), 0, 'no rows');
    assert.strictEqual(
        await NotificationDispatch.countDocuments({ 'source.id': gone._id }),
        0,
        'and no dispatch rows either'
    );
    console.log('✓ drafts and deleted announcements produce nothing at all');

    /* ---- retraction ----------------------------------------------------- */

    await handlers.onAnnouncementDeleted({ announcement_id: broadcast._id });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.announcement(broadcast._id) }),
        0,
        'deleting an announcement clears it from every inbox'
    );
    assert.ok(
        (await NotificationDispatch.countDocuments({ 'source.id': broadcast._id })) > 0,
        'but the dispatch ledger keeps the record of what was already sent'
    );
    console.log('✓ a deleted announcement is retracted from inboxes, not from the ledger');

    // A delete landing between delivery's read and its insert: the retraction already ran against
    // zero cards. Simulated by deleting the moment the first read resolves.
    const racedDelete = await seedAnnouncement(author, 'Deleted mid-delivery');
    const realFindById = Announcement.findById.bind(Announcement);
    (Announcement as unknown as { findById: unknown }).findById = (...args: Parameters<typeof realFindById>) => {
        (Announcement as unknown as { findById: unknown }).findById = realFindById;
        return realFindById(...args).then(async (doc) => {
            await Announcement.updateOne({ _id: racedDelete._id }, { $set: { deleted_at: new Date() } });
            return doc;
        });
    };
    await deliverAnnouncement(racedDelete._id);
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.announcement(racedDelete._id) }),
        0,
        'cards inserted after a concurrent delete are retracted by the delivery itself'
    );

    // A delete whose AnnouncementDeleted was never heard (bus outage): the sweep retracts it.
    const unheard = await seedAnnouncement(author, 'Deleted during an outage');
    await deliverAnnouncement(unheard._id);
    assert.ok(await Notification.countDocuments({ dedupe_key: dedupe.announcement(unheard._id) }), 'delivered');
    await Announcement.updateOne({ _id: unheard._id }, { $set: { deleted_at: new Date() } });
    await retractDeleted();
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.announcement(unheard._id) }),
        0,
        'the retraction sweep clears cards of a delete nobody announced'
    );
    console.log('✓ deletes racing delivery, or lost on the bus, still leave no cards behind');

    /* ---- templates ------------------------------------------------------ */

    assert.throws(
        () => render('Hello {{name}}', {}),
        /template variable 'name' is missing/,
        'a missing variable throws rather than rendering a placeholder at four hundred people'
    );
    assert.throws(() => render('Hello {{name}}', { name: '' }), /missing/, 'an empty string is missing too');

    const long = renderMessage('announcement.published', { title: 'T', summary: 'x'.repeat(900) });
    assert.ok(long.body.length <= BODY_MAX, 'a long body is clamped to what the model accepts');
    assert.ok(long.body.endsWith('…'), 'and says it was clamped');

    assert.strictEqual(summarize('one\n\n  two   three'), 'one two three', 'summaries collapse whitespace');
    assert.ok(summarize('y'.repeat(500)).length <= 200, 'and are a teaser, not the announcement');
    console.log('✓ templates are strict on input and clamped on output');

    /* ---- per-user triggers ---------------------------------------------- */

    // `RegistrationCreated` is the one "now confirmed" event (straight in, or promoted); the retired
    // `RegistrationConfirmed` must not be listened to at all.
    assert.ok(!('onRegistrationConfirmed' in handlers), 'RegistrationConfirmed is retired');

    const registrationId = await seedRegistration(member._id, eventId, 'confirmed');
    const confirmed = { registration_id: registrationId, owner: { type: 'event', id: eventId }, user_id: member._id };
    await handlers.onRegistrationCreated(confirmed);
    const confirmation = await Notification.findOne({ dedupe_key: dedupe.registrationConfirmed(registrationId, 1) }).lean();
    assert.ok(confirmation, 'a confirmed registration notifies its owner');
    assert.ok(confirmation!.title.includes('Scoped Event'), 'naming the event, read from the event document');
    assert.strictEqual(confirmation!.category, 'event', 'under the event category');

    // A redelivery is still exactly one card.
    await handlers.onRegistrationCreated(confirmed);
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.registrationConfirmed(registrationId, 1) }),
        1,
        'and a redelivery does not duplicate it'
    );

    // Confirmed, rejected by an admin, confirmed again: that second confirmation is its own card.
    await FormSubmission.collection.updateOne(
        { _id: registrationId as never },
        { $push: { status_history: { $each: [{ to: 'confirmed' }, { to: 'rejected' }, { to: 'confirmed' }] } } as never }
    );
    await handlers.onRegistrationCreated(confirmed);
    assert.strictEqual(
        await Notification.countDocuments({ user_id: member._id, type: 'registration.confirmed' }),
        2,
        'a re-confirmation is good news again'
    );

    // Preferences apply to per-user triggers too, not only to the fan-outs.
    const eventMuted = await seedUser('Event muted', UserRole.USER);
    await mute(eventMuted._id, 'event');
    const mutedReg = await seedRegistration(eventMuted._id, eventId, 'confirmed');
    await handlers.onRegistrationCreated({
        registration_id: mutedReg,
        owner: { type: 'event', id: eventId },
        user_id: eventMuted._id,
    });
    assert.strictEqual(
        await Notification.countDocuments({ user_id: eventMuted._id }),
        0,
        'a user who muted `event` gets no confirmation card'
    );

    // A challenge registration is not a seat at an event, so it gets nothing.
    await handlers.onRegistrationCreated({
        registration_id: 'challenge-registration',
        owner: { type: 'challenge', id: 'c-1' },
        user_id: core._id,
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.registrationConfirmed('challenge-registration', 1) }),
        0,
        'a challenge registration is not an event seat'
    );

    // An event that does not exist must produce nothing rather than a card with a blank name.
    await handlers.onRegistrationCreated({
        registration_id: 'nope',
        owner: { type: 'event', id: 'missing-event' },
        user_id: member._id,
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.registrationConfirmed('nope', 1) }),
        0,
        'a missing event notifies nobody'
    );
    console.log('✓ per-user triggers are idempotent and never render a blank name');

    /* ---- points (unblocked by the Sep 27 audit) ---------------------------- */

    await handlers.onPointsEarned({
        transaction_id: 'tx-1',
        user_id: member._id,
        amount: 25,
        balance_after: 125,
        reason: 'event.participation',
        source: 'event',
    });
    const pointsCard = await Notification.findOne({ dedupe_key: dedupe.pointsEarned('tx-1') }).lean();
    assert.ok(pointsCard, 'a credit tells the person who earned it');
    assert.ok(pointsCard!.title.includes('25'), 'how many');
    assert.ok(pointsCard!.body.includes('Event participation'), 'in words, not as a machine key');
    assert.ok(pointsCard!.body.includes('125'), 'and what the balance is now');
    assert.strictEqual(pointsCard!.category, 'system', 'under the system category');

    await handlers.onPointsEarned({
        transaction_id: 'tx-1',
        user_id: member._id,
        amount: 25,
        balance_after: 125,
        reason: 'event.participation',
        source: 'event',
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.pointsEarned('tx-1') }),
        1,
        'and the ledger row is the dedupe key, so a redelivery pays out one card'
    );
    console.log('✓ a points credit produces one card, in words');

    /* ---- waitlist, challenges and cancellation --------------------------- */

    const waitlistReg = await seedRegistration(guestish._id, eventId, 'waitlisted');
    await handlers.onRegistrationWaitlisted({
        registration_id: waitlistReg,
        owner: { type: 'event', id: eventId },
        user_id: guestish._id,
        position: 3,
    });
    const waitCard = await Notification.findOne({ dedupe_key: dedupe.registrationWaitlisted(waitlistReg) }).lean();
    assert.ok(waitCard, 'a waitlisted registration notifies its owner');
    assert.ok(waitCard!.body.includes('3'), 'with their position, which is the whole point of the message');

    // Registrations also cover challenges and generic forms; only an event has a waitlist position.
    await handlers.onRegistrationWaitlisted({
        registration_id: 'challenge-reg',
        owner: { type: 'challenge', id: 'c1' },
        user_id: guestish._id,
        position: 1,
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.registrationWaitlisted('challenge-reg') }),
        0,
        'a non-event owner produces nothing rather than a card about an event that does not exist'
    );

    const challengeId = await seedChallenge('Run 5k');
    const teamMate = await seedUser('Team mate', UserRole.USER);
    const participationId = await seedParticipation(challengeId, [member._id, teamMate._id]);

    await handlers.onChallengeCompleted({
        participation_id: participationId,
        challenge_id: challengeId,
        member_user_ids: [member._id, teamMate._id],
        award_points: 50,
    });
    const approved = await Notification.find({ dedupe_key: dedupe.challengeApproved(participationId) }).lean();
    assert.strictEqual(approved.length, 2, 'every member of a team challenge is told, not just the captain');
    assert.ok(approved[0].title.includes('Run 5k'), 'naming the challenge');
    assert.ok(approved[0].body.includes('50'), 'and what it paid');
    assert.strictEqual(approved[0].category, 'challenge', 'under the challenge category');

    await handlers.onChallengeCompleted({
        participation_id: participationId,
        challenge_id: challengeId,
        member_user_ids: [member._id, teamMate._id],
        award_points: 50,
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.challengeApproved(participationId) }),
        2,
        'and a replay pays out no second card'
    );

    // The rejection payload carries no recipients: who it belongs to is on the participation.
    await handlers.onChallengeRejected({
        participation_id: participationId,
        challenge_id: challengeId,
        reason: null,
    });
    const rejected = await Notification.find({ dedupe_key: dedupe.challengeRejected(participationId, 1) }).lean();
    assert.strictEqual(rejected.length, 2, 'the roster is read from the participation, not from the payload');
    assert.ok(rejected[0].body.includes('not stated'), 'and a reviewer who gave no reason does not break the render');

    // Resubmitted and rejected again, this time with an empty reason (the producer trims and accepts
    // ''): a second notice, not a dedupe hit, and not a template throw.
    await ChallengeParticipation.updateOne(
        { _id: participationId },
        { $push: { status_history: { $each: [{ to: 'rejected' }, { to: 'rejected' }] } } }
    );
    await handlers.onChallengeRejected({ participation_id: participationId, challenge_id: challengeId, reason: '  ' });
    const reRejected = await Notification.find({ dedupe_key: dedupe.challengeRejected(participationId, 2) }).lean();
    assert.strictEqual(reRejected.length, 2, 'a second rejection of the same participation is its own notice');
    assert.ok(reRejected[0].body.includes('not stated'), "and '' reads as no reason instead of dropping the notice");

    // The producer's own ordinal wins over the history count (which would say 3 here, not 7).
    for (let i = 0; i < 2; i += 1) {
        await handlers.onChallengeRejected({
            participation_id: participationId,
            challenge_id: challengeId,
            reason: 'blurry',
            rejection_no: 7,
        });
    }
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.challengeRejected(participationId, 7) }),
        2,
        'keyed on rejection_no, once per member however often it is replayed'
    );

    await handlers.onEventCancelled({ event_id: eventId });
    const cancelled = await Notification.find({ dedupe_key: dedupe.eventCancelled(eventId) }).lean();
    assert.ok(cancelled.length > 0, 'a cancelled event tells its registrants');
    assert.ok(
        cancelled.every((n) => n.category === 'event'),
        'as event notifications'
    );
    const cancelledIds = new Set(cancelled.map((n) => n.user_id));
    assert.ok(cancelledIds.has(waitlisted._id), 'a waitlisted user is told too — they were waiting on it');
    assert.ok(!cancelledIds.has(deletedUser._id), 'and a deleted account is never a recipient of any fan-out');
    console.log('✓ waitlist, challenge and cancellation triggers all reach exactly their people');

    /* ---- feedback tickets (staff fan-out) -------------------------------- */
    const ticketId = 'ticket-123';
    await handlers.onFeedbackSubmitted({
        ticket_id: ticketId,
        ticket_no: 'TICK-42',
        kind: 'bug',
        category: 'app',
        subject: 'Cannot login with OAuth',
    });
    const staffNotifs = await Notification.find({ dedupe_key: dedupe.feedbackSubmitted(ticketId) }).lean();
    assert.ok(staffNotifs.length > 0, 'feedback ticket fans out to staff');
    assert.ok(staffNotifs.every((n) => n.category === 'system'), 'under system category');
    assert.ok(staffNotifs[0].title.includes('TICK-42'), 'contains ticket number');
    assert.ok(staffNotifs[0].body.includes('Cannot login with OAuth'), 'contains subject');

    // Replay assertion
    await handlers.onFeedbackSubmitted({
        ticket_id: ticketId,
        ticket_no: 'TICK-42',
        kind: 'bug',
        category: 'app',
        subject: 'Cannot login with OAuth',
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.feedbackSubmitted(ticketId) }),
        staffNotifs.length,
        'replay does not duplicate feedback notifications'
    );
    console.log('✓ feedback ticket fan-out reaches staff and dedupes properly');

    /* ---- team invites, auction sales, feedback replies (audit #2) ---------- */

    // Raw inserts: these consumers only READ teams and tickets, and the owning models' full
    // invariants are another service's fixture problem.
    const teamId = uuid();
    const invitedAt = new Date();
    await Team.collection.insertOne({
        _id: teamId as never,
        name: 'Night Owls',
        owner: { type: 'event', id: eventId },
        pending: [{ user_id: guestish._id, direction: 'invite', created_by: core._id, created_at: invitedAt }],
    });
    const invite = { team_id: teamId, owner: { type: 'event', id: eventId }, invited_by: core._id };
    await handlers.onTeamInviteCreated({ ...invite, user_id: guestish._id });
    await handlers.onTeamInviteCreated({ ...invite, user_id: guestish._id });
    const inviteCards = await Notification.find({ user_id: guestish._id, type: 'team.invited' }).lean();
    assert.strictEqual(inviteCards.length, 1, 'an invite is one card, however often replayed');
    assert.ok(inviteCards[0].title.includes('Night Owls'), 'naming the team, read from the team');
    await handlers.onTeamInviteCreated({ ...invite, user_id: member._id });
    assert.strictEqual(
        await Notification.countDocuments({ user_id: member._id, type: 'team.invited' }),
        0,
        'an invite that is no longer pending produces nothing'
    );

    await handlers.onPlayerSold({
        event_id: eventId, lot_id: 'lot-1', player_user_id: teamMate._id, team_id: teamId, captain_user_id: core._id, amount: 40,
    });
    const playerCard = await Notification.findOne({ dedupe_key: dedupe.auctionSold('lot-1', 'player') }).lean();
    const captainCard = await Notification.findOne({ dedupe_key: dedupe.auctionSold('lot-1', 'captain') }).lean();
    assert.strictEqual(playerCard?.user_id, teamMate._id, 'the player is told where they went');
    assert.ok(playerCard!.body.includes('40') && playerCard!.body.includes('Night Owls'), 'for how much, and to whom');
    assert.strictEqual(captainCard?.user_id, core._id, 'the buying captain gets the receipt');
    assert.ok(captainCard!.title.includes('Team mate'), 'naming the player');

    await handlers.onPlayerSold({
        event_id: eventId, lot_id: 'lot-2', player_user_id: deletedUser._id, team_id: teamId, captain_user_id: core._id, amount: 5,
    });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.auctionSold('lot-2', 'player') }),
        0,
        'a deleted player gets no card'
    );
    const anonymous = await Notification.findOne({ dedupe_key: dedupe.auctionSold('lot-2', 'captain') }).lean();
    assert.ok(anonymous && !anonymous.title.includes('Gone'), 'and is not named to their buyer');

    const ticketWithReply = uuid();
    const respondedAt = new Date();
    await FeedbackTicket.collection.insertOne({
        _id: ticketWithReply as never,
        response: { body: 'Fixed', by_user_id: core._id, at: respondedAt },
    });
    const reply = { ticket_id: ticketWithReply, ticket_no: 'FB-7' };
    await handlers.onFeedbackResponded({ ...reply, reporter_user_id: member._id });
    await handlers.onFeedbackResponded({ ...reply, reporter_user_id: member._id });
    assert.strictEqual(
        await Notification.countDocuments({ dedupe_key: dedupe.feedbackResponded(ticketWithReply, respondedAt.getTime()) }),
        1,
        'the reporter hears about a reply, once'
    );
    await handlers.onFeedbackResponded({ ...reply, reporter_user_id: null });
    assert.strictEqual(
        await Notification.countDocuments({ type: 'feedback.responded' }),
        1,
        'an anonymous ticket notifies nobody in-app'
    );

    // Mutes apply to every new trigger (createOne): a reporter who muted `system` hears nothing.
    await mute(teamMate._id, 'system');
    await handlers.onFeedbackResponded({ ...reply, reporter_user_id: teamMate._id });
    assert.strictEqual(
        await Notification.countDocuments({ user_id: teamMate._id, type: 'feedback.responded' }),
        0,
        'a muted category silences the new triggers too'
    );
    console.log('✓ team invites, auction sales and feedback replies reach exactly their people');

    await closeScratchDb();
    console.log('\nbroadcast selfcheck: all checks passed');
}

main().catch(async (err) => {
    console.error('broadcast selfcheck failed:', err);
    await closeScratchDb().catch(() => undefined);
    process.exit(1);
});
