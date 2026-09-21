import assert from 'assert';
import {
    AuditLog,
    FEEDBACK_RATE_PER_HOUR,
    FeedbackThrottle,
    FeedbackTicket,
    ServiceError,
    UserRole,
    resetBus,
} from '@bgsc/shared';
import { Actor, Submitter, listInbox, listMine, setSeverity, setStatus, subjectKey, submitContact, submitFeedback, getTicket } from '../feedback/feedback.service';
import { TICKET_NO_PATTERN, ticketNo } from '../feedback/ticketNo';
import { handlers } from '../events/consumers';
import { closeScratchDb, openScratchDb, seedUser, ticketInput } from './seed';

/**
 * Tickets (be2-feedback-bracket-plan.md §13).
 *
 * The block that matters most is the anonymous one: Spec §5.12 offers the toggle, and this is
 * where the promise behind it is either kept or quietly broken.
 */

const anon = (ip = '203.0.113.7'): Submitter => ({ user: null, ip });
const staff = (id: string): Actor => ({ id, role: 'core', ip: '198.51.100.4' });

async function expectError(fn: () => Promise<unknown>, code: string, what: string): Promise<void> {
    await assert.rejects(fn, (err: ServiceError) => {
        assert.strictEqual(err.code, code, `${what}: expected ${code}, got ${err.code}`);
        return true;
    }, what);
}

async function main(): Promise<void> {
    await openScratchDb();
    resetBus();

    const reporter = await seedUser('Priya Reporter');
    const stranger = await seedUser('Someone Else');
    const reviewer = await seedUser('Core Reviewer', UserRole.CORE);
    const signedIn: Submitter = { user: reporter, ip: '203.0.113.9' };

    /* ---- attributed submission --------------------------------------------- */

    const mine = await submitFeedback(ticketInput(), signedIn);
    assert.ok(TICKET_NO_PATTERN.test(mine.ticket_no), `ticket number is readable: ${mine.ticket_no}`);
    assert.strictEqual(mine.reporter?.user_id, reporter._id, 'an attributed ticket snapshots its reporter');
    assert.strictEqual(mine.contact_email, reporter.email, 'and replies go to the account address');
    assert.strictEqual(mine.status, 'submitted', 'the ladder starts at the bottom');
    assert.strictEqual(mine.kind, 'feedback');
    console.log('✓ a signed-in ticket is attributed and reachable');

    /* ---- the anonymous promise ---------------------------------------------- */

    const secret = await submitFeedback(
        ticketInput({ is_anonymous: true, contact_email: 'tipster@example.org', category: 'complaint' }),
        signedIn // signed in, and still asking to be anonymous
    );
    assert.strictEqual(secret.reporter, null, 'an anonymous ticket carries no reporter, even from a signed-in user');
    assert.strictEqual(secret.is_anonymous, true);
    assert.strictEqual(secret.contact_email, 'tipster@example.org', 'the reply goes where they said');

    const trail = await AuditLog.find({ target_id: secret._id }).lean();
    assert.strictEqual(trail.length, 1, 'the submission is audited');
    assert.strictEqual(trail[0].actor_id, null, 'with NO actor — the audit trail is not where the toggle is undone');
    assert.strictEqual(trail[0].ip, null, 'and no address either');

    const attributedTrail = await AuditLog.find({ target_id: mine._id }).lean();
    assert.strictEqual(attributedTrail[0].actor_id, reporter._id, 'while an attributed ticket records who filed it');
    console.log('✓ anonymous means anonymous: no reporter, no actor, no ip — anywhere');

    await expectError(
        () => submitFeedback(ticketInput({ is_anonymous: true }), anon()),
        'contact_email_required',
        'an anonymous ticket with no address is a message into a void'
    );

    // A signed-out submitter is anonymous whatever the toggle says, because there is nobody to attribute.
    const walkIn = await submitFeedback(
        ticketInput({ is_anonymous: false, contact_email: 'walkin@example.org' }),
        anon('198.51.100.20')
    );
    assert.strictEqual(walkIn.reporter, null, 'a signed-out ticket is anonymous by construction');
    console.log('✓ a public submission with no session needs no login and gets no attribution');

    /* ---- the rate limiter ----------------------------------------------------- */

    const flooder = anon('198.51.100.77');
    // The cap allows FEEDBACK_RATE_PER_HOUR through; the one after it is the refusal.
    for (let i = 0; i < FEEDBACK_RATE_PER_HOUR; i++) {
        await submitFeedback(ticketInput({ contact_email: 'flood@example.org', is_anonymous: true }), flooder);
    }
    await expectError(
        () => submitFeedback(ticketInput({ contact_email: 'flood@example.org', is_anonymous: true }), flooder),
        'too_many_tickets',
        `the ${FEEDBACK_RATE_PER_HOUR + 1}th ticket in an hour from one address is refused`
    );

    // Somebody else is unaffected: the cap is per submitter, not global.
    const neighbour = await submitFeedback(
        ticketInput({ contact_email: 'neighbour@example.org', is_anonymous: true }),
        anon('198.51.100.78')
    );
    assert.ok(neighbour.ticket_no, 'a different address is not caught by their neighbour\'s flood');

    const keys = await FeedbackThrottle.distinct('subject_key');
    assert.ok(keys.length > 0, 'the limiter keeps rows');
    assert.ok(
        keys.every((k: string) => !k.includes('198.51.100') && !k.includes('203.0.113')),
        'and NONE of them is a raw address'
    );
    assert.ok(keys.some((k: string) => k.startsWith('ip:') && k.length > 40), 'anonymous keys are hashes');
    assert.ok(keys.some((k: string) => k.startsWith(`user:${reporter._id}`)), 'a signed-in submitter is keyed by id');
    assert.notStrictEqual(
        subjectKey(anon('1.1.1.1')),
        subjectKey(anon('1.1.1.2')),
        'different addresses hash apart'
    );
    assert.strictEqual(subjectKey(anon('1.1.1.1')), subjectKey(anon('1.1.1.1')), 'and the same one hashes alike');
    console.log('✓ five an hour per submitter, keyed by a one-way hash rather than by an address');

    /* ---- ticket numbers -------------------------------------------------------- */

    const generated = new Set(Array.from({ length: 2000 }, () => ticketNo()));
    assert.strictEqual(generated.size, 2000, 'two thousand generated numbers, no collisions');
    assert.ok([...generated].every((n) => TICKET_NO_PATTERN.test(n)), 'every one matches the accepted shape');
    assert.ok([...generated].every((n) => !/[AEIOU01L]/.test(n.slice(3))), 'no vowels, no lookalike digits');
    console.log('✓ ticket numbers are unambiguous, unguessable and unique');

    /* ---- who may read a ticket --------------------------------------------------- */

    const asOwner = await getTicket(mine.ticket_no, { id: reporter._id, role: 'user' });
    assert.strictEqual(asOwner._id, mine._id, 'a reporter reads their own ticket');

    await expectError(
        () => getTicket(mine.ticket_no, { id: stranger._id, role: 'user' }),
        'ticket_not_found',
        "a stranger gets 404 rather than 403 — they should not learn the ticket exists"
    );

    const asStaff = await getTicket(mine.ticket_no, { id: reviewer._id, role: 'core' });
    assert.strictEqual(asStaff._id, mine._id, 'staff read any ticket');

    // An anonymous ticket belongs to nobody, so the number itself is the credential — which is
    // exactly how the receipt email works.
    const asBearer = await getTicket(secret.ticket_no, { id: stranger._id, role: 'user' });
    assert.strictEqual(asBearer._id, secret._id, 'whoever holds an anonymous number may read it');
    console.log('✓ own ticket, staff, or the number itself — anything else is a 404');

    /* ---- the ladder --------------------------------------------------------------- */

    const reviewing = await setStatus(mine.ticket_no, { status: 'under_review' }, staff(reviewer._id));
    assert.strictEqual(reviewing.status, 'under_review');
    assert.strictEqual(reviewing.status_history.length, 1, 'every move is recorded');
    assert.strictEqual(reviewing.status_history[0].from, 'submitted');

    await expectError(
        () => setStatus(mine.ticket_no, { status: 'submitted' }, staff(reviewer._id)),
        'illegal_transition',
        'the ladder does not go back to the bottom'
    );

    const resolved = await setStatus(
        mine.ticket_no,
        { status: 'resolved', response: 'Fixed in the scoreboard totals; thank you.' },
        staff(reviewer._id)
    );
    assert.strictEqual(resolved.status, 'resolved');
    assert.strictEqual(resolved.response?.by_user_id, reviewer._id, 'a response records who wrote it');
    assert.ok(resolved.response?.body.includes('Fixed'), 'and what it said');

    // A dispute has to be able to reopen a resolution, which is the one backwards move that exists.
    const reopened = await setStatus(mine.ticket_no, { status: 'under_review' }, staff(reviewer._id));
    assert.strictEqual(reopened.status, 'under_review', 'a resolved ticket can be reopened');
    console.log('✓ the status ladder moves forwards, records history, and can reopen a disputed result');

    const triaged = await setSeverity(mine.ticket_no, 'critical', staff(reviewer._id));
    assert.strictEqual(triaged.severity, 'critical', 'staff re-triage severity');

    /* ---- the inbox ------------------------------------------------------------------ */

    const contact = await submitContact(
        { subject: 'Where do I find the club?', description: 'Asking for a friend.', is_anonymous: false },
        { user: stranger, ip: null }
    );
    assert.strictEqual(contact.kind, 'contact', 'contact-us lands in the same collection');
    assert.strictEqual(contact.category, 'general', 'with the only category it can have');
    assert.strictEqual(contact.severity, 'low', 'and no severity to choose');

    const inbox = await listInbox({ limit: 50 });
    assert.ok(inbox.tickets.length >= 3, 'the inbox holds every kind');

    const contactsOnly = await listInbox({ limit: 50, kind: 'contact' });
    assert.ok(contactsOnly.tickets.every((t) => t.kind === 'contact'), 'kind filters');
    const complaints = await listInbox({ limit: 50, category: 'complaint' });
    assert.ok(complaints.tickets.every((t) => t.category === 'complaint'), 'category filters');

    const mineOnly = await listMine(reporter._id, { limit: 50 });
    assert.ok(
        mineOnly.tickets.every((t) => t.reporter?.user_id === reporter._id),
        '"my tickets" holds only attributed ones — an anonymous ticket is nobody\'s'
    );
    assert.ok(
        !mineOnly.tickets.some((t) => t._id === secret._id),
        'so the one they filed anonymously is not listed against them'
    );
    console.log('✓ the staff inbox filters, and "my tickets" never re-attaches an anonymous ticket');

    /* ---- paging ---------------------------------------------------------------------- */

    const page1 = await listInbox({ limit: 2 });
    assert.strictEqual(page1.tickets.length, 2);
    const page2 = await listInbox({ limit: 2, cursor: page1.next_cursor! });
    const overlap = page1.tickets.filter((t) => page2.tickets.some((u) => u._id === t._id));
    assert.strictEqual(overlap.length, 0, 'pages do not repeat rows');

    await expectError(() => listInbox({ limit: 2, cursor: 'nonsense' }), 'invalid_cursor', 'a bad cursor is a 422');
    console.log('✓ the inbox pages by keyset and refuses a forged cursor');

    /* ---- a deleted account leaves no name behind ---------------------------- */

    await handlers.handleUserDeleted({ user_id: reporter._id });
    const erased = await FeedbackTicket.findOne({ ticket_no: mine.ticket_no }).lean();
    assert.strictEqual(erased!.reporter!.display_name, 'Deleted user', 'the name goes');
    assert.strictEqual(erased!.reporter!.avatar_url, null, 'so does the avatar');
    assert.strictEqual(erased!.reporter!.deleted, true, 'and the flag the UI renders from is raised');
    assert.strictEqual(erased!.reporter!.user_id, reporter._id, 'the reference stays — it still has to resolve');

    const stillAnonymous = await FeedbackTicket.findOne({ ticket_no: secret.ticket_no }).lean();
    assert.strictEqual(stillAnonymous!.reporter, null, 'an anonymous ticket had nothing to erase');
    console.log('✓ deleting an account erases its name from every ticket it filed');

    assert.strictEqual(
        await FeedbackTicket.countDocuments({ is_anonymous: true, reporter: { $ne: null } }),
        0,
        'FINAL: not one anonymous ticket in the collection carries a reporter'
    );

    await closeScratchDb();
    console.log('\nfeedback selfcheck: all checks passed');
}

main().catch(async (err) => {
    console.error('feedback selfcheck failed:', err);
    await closeScratchDb().catch(() => undefined);
    process.exit(1);
});
