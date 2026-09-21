/**
 * End-to-end check for the Feedback Service: real Express app, real Mongo, real JWTs.
 * Scratch database, dropped on exit.
 *
 *   npx ts-node apps/feedback-service/src/feedback/feedback.e2e.ts
 *
 * The selfcheck covers the rules; this covers the wiring — routing order, the public front door,
 * the role ladder, the envelope, and what zod strips on the way in.
 */
import assert from 'assert';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { FeedbackThrottle, FeedbackTicket, User, UserRole, config } from '@bgsc/shared';
import { app } from '../index';

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_feedback$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole) => jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res { status: number; body: any; headers: Headers }

async function call(method: string, path: string, opts: { as?: string; body?: unknown } = {}): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(base + path, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await r.text();
    const parsed = text ? JSON.parse(text) : null;
    const body = parsed && typeof parsed === 'object' && parsed.success === true && 'data' in parsed ? parsed.data : parsed;
    return { status: r.status, body, headers: r.headers };
}

const pass = (what: string) => console.log(`  ok  ${what}`);

async function seedUser(role: UserRole = UserRole.USER): Promise<string> {
    const id = uuid();
    await User.create({
        _id: id,
        email: `${id}@e2e.local`,
        username: `e2e_${id.slice(0, 8)}`,
        role,
        profile: { full_name: 'E2E User' },
    });
    return id;
}

const submission = (over: Record<string, unknown> = {}) => ({
    subject: 'Scoreboard is wrong',
    description: 'It added ten points nobody scored.',
    category: 'bug',
    ...over,
});

async function main(): Promise<void> {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));

    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const reporter = await seedUser();
    const stranger = await seedUser();
    const core = await seedUser(UserRole.CORE);
    const reporterT = token(reporter, UserRole.USER);
    const strangerT = token(stranger, UserRole.USER);
    const coreT = token(core, UserRole.CORE);

    console.log('\n-- health --');
    const health = await call('GET', '/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.service, 'feedback-service');
    assert.strictEqual(health.headers.get('x-content-type-options'), 'nosniff');
    pass('/health is fail-closed and the security headers are on');

    console.log('\n-- the public front door --');
    const anonymous = await call('POST', '/feedback', {
        body: submission({ is_anonymous: true, contact_email: 'tipster@example.org' }),
    });
    assert.strictEqual(anonymous.status, 201, 'a bug report needs no login (Spec §5.12)');
    assert.ok(anonymous.body.ticket_no.startsWith('BG-'), 'and answers with the ticket number');
    assert.strictEqual(anonymous.body.status, 'submitted');
    // The response is the receipt and nothing more: no id, no reporter, nothing to correlate.
    assert.deepStrictEqual(Object.keys(anonymous.body).sort(), ['created_at', 'status', 'ticket_no']);

    const noEmail = await call('POST', '/feedback', { body: submission({ is_anonymous: true }) });
    assert.strictEqual(noEmail.status, 422, 'an anonymous ticket needs a reply address');
    assert.strictEqual(noEmail.body.error, 'contact_email_required');

    const contact = await call('POST', '/contact', {
        body: { subject: 'Where is the club?', description: 'Asking for a friend.', contact_email: 'a@b.co' },
    });
    assert.strictEqual(contact.status, 201, 'contact-us is its own front door');
    pass('anonymous submission works without a token, and refuses without a reply address');

    console.log('\n-- what a client may not set --');
    const attributed = await call('POST', '/feedback', {
        as: reporterT,
        body: submission({
            status: 'resolved',
            ticket_no: 'BG-FORGED1',
            severity: 'critical',
            reporter: { user_id: stranger, display_name: 'Someone else' },
            response: { body: 'already fixed' },
        }),
    });
    assert.strictEqual(attributed.status, 201);
    assert.notStrictEqual(attributed.body.ticket_no, 'BG-FORGED1', 'the number is the server\'s');
    assert.strictEqual(attributed.body.status, 'submitted', 'and so is the status');
    const stored = await FeedbackTicket.findOne({ ticket_no: attributed.body.ticket_no }).lean();
    assert.strictEqual(stored!.reporter!.user_id, reporter, 'the reporter is the caller, not the body');
    assert.strictEqual(stored!.response, null, 'a client cannot answer their own ticket');
    assert.strictEqual(stored!.severity, 'critical', 'severity IS theirs to claim — staff re-triage it');
    pass('zod strips status, ticket_no, reporter and response');

    console.log('\n-- reading --');
    const ticketNo = attributed.body.ticket_no as string;
    assert.strictEqual((await call('GET', `/feedback/${ticketNo}`, { as: reporterT })).status, 200, 'mine');
    assert.strictEqual((await call('GET', `/feedback/${ticketNo}`, { as: strangerT })).status, 404, "not mine → 404");
    const asStaff = await call('GET', `/feedback/${ticketNo}`, { as: coreT });
    assert.strictEqual(asStaff.status, 200, 'staff read anything');
    assert.ok('contact_email' in asStaff.body, 'and see the reply address');

    const asBearer = await call('GET', `/feedback/${anonymous.body.ticket_no}`, { as: strangerT });
    assert.strictEqual(asBearer.status, 200, 'an anonymous number is its own credential');
    assert.ok(!('contact_email' in asBearer.body), 'but the address is not handed to whoever holds it');

    assert.strictEqual((await call('GET', '/feedback/not-a-number', { as: coreT })).status, 422, 'junk is refused');
    assert.strictEqual((await call('GET', '/feedback/me')).status, 401, '/me needs a session');
    const mine = await call('GET', '/feedback/me', { as: reporterT });
    assert.strictEqual(mine.status, 200, "and resolves as the literal path, not as a ticket called 'me'");
    assert.strictEqual(mine.body.tickets.length, 1, 'holding only my attributed ticket');
    pass('mine, staff, bearer, and a 404 for everything else');

    console.log('\n-- the staff inbox --');
    assert.strictEqual((await call('GET', '/feedback')).status, 401, 'anon');
    assert.strictEqual((await call('GET', '/feedback', { as: reporterT })).status, 403, 'a member is not staff');
    const inbox = await call('GET', '/feedback', { as: coreT });
    assert.strictEqual(inbox.status, 200);
    assert.ok(inbox.body.tickets.length >= 3, 'core sees every ticket');
    assert.strictEqual(inbox.body.next_cursor, null, 'a short page ends the pagination');

    const badStatus = await call('PATCH', `/feedback/${ticketNo}/status`, { as: reporterT, body: { status: 'closed' } });
    assert.strictEqual(badStatus.status, 403, 'a reporter cannot close their own ticket');

    const moved = await call('PATCH', `/feedback/${ticketNo}/status`, {
        as: coreT,
        body: { status: 'under_review', response: 'Looking at it.' },
    });
    assert.strictEqual(moved.status, 200);
    assert.strictEqual(moved.body.status, 'under_review');
    assert.strictEqual(moved.body.status_history.length, 1);

    const illegal = await call('PATCH', `/feedback/${ticketNo}/status`, { as: coreT, body: { status: 'submitted' } });
    assert.strictEqual(illegal.status, 422, 'the ladder does not go backwards to the bottom');
    assert.strictEqual(illegal.body.error, 'illegal_transition');

    const triaged = await call('PATCH', `/feedback/${ticketNo}/severity`, { as: coreT, body: { severity: 'low' } });
    assert.strictEqual(triaged.body.severity, 'low', 'staff re-triage');
    pass('the inbox and the ladder are core+, and refuse illegal moves');

    console.log('\n-- the rate limit is real over HTTP --');
    await FeedbackThrottle.deleteMany({});
    let last = 0;
    for (let i = 0; i < 7; i++) {
        last = (await call('POST', '/feedback', { as: strangerT, body: submission() })).status;
    }
    assert.strictEqual(last, 429, 'a flood from one account is throttled');
    pass('the seventh submission in an hour is a 429');

    console.log('\nfeedback e2e: all checks passed');
}

main()
    .catch((err) => {
        console.error('\nfeedback e2e failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.dropDatabase().catch(() => undefined);
        server?.close();
        await mongoose.disconnect().catch(() => undefined);
    });
