import { STUB_PORT } from './stub-env'; // must stay first: sets env before @bgsc/shared loads
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { AuctionLot, Event, FormDefinition, FormSubmission, Team, User, UserRole, IEvent, InternalCallError, ServiceError, config, subscribe } from '@bgsc/shared';
import * as ev from '../events/event.service';
import * as auction from '../auction/auction.service';
import { handleCaptainApproved, handleRegistrationCancelled, handleUserDeleted, resnapshotUser } from '../events/consumers';
import { asServiceError } from '../clients/registration-client';
import { startDueEvents } from '../events/scheduler';
import { settleExpiredLots } from '../auction/auction.service';
import { CreateEventSchema, QueryEventsSchema, UpdateEventSchema } from '../events/event.schemas';
import { putObject } from '../storage/storage';
import { Actor } from '../events/access';

/**
 * Regression checks against a real MongoDB (scratch database `bgsc_selfcheck_event`, dropped at
 * start and end) and a stub Registration Service on STUB_PORT. Every block pins one audit finding.
 */

const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_event$2');

/* ---------------- Registration Service stub ---------------- */

type Reply = { status: number; body: unknown };
const calls: { op: string; body: Record<string, unknown> }[] = [];
const plan = new Map<string, Reply[]>(); // op -> queued replies (default: 200)
const reply = (op: string, ...replies: Reply[]) => plan.set(op, replies);

const stub = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
        const op = (req.url ?? '').split('/').filter(Boolean).pop()!;
        calls.push({ op, body: raw ? JSON.parse(raw) : {} });
        const next = plan.get(op)?.shift() ?? { status: 200, body: { success: true, data: { ok: true } } };
        res.writeHead(next.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(next.body));
    });
});

/* ---------------- fixtures ---------------- */

const day = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * day);
const ADMIN: Actor = { id: 'admin-1', role: 'core' };
const COORD: Actor = { id: 'coord-1', role: 'coordinator' };
const OUTSIDER: Actor = { id: 'core-2', role: 'core' };
const CO_ADMIN: Actor = { id: 'admin-2', role: 'core' };

async function seedEvent(over: Record<string, unknown> = {}): Promise<IEvent> {
    const id = randomUUID();
    return Event.create({
        _id: id,
        slug: `sc-${id}`,
        title: 'Selfcheck Cup',
        category: 'leagues',
        type: 'LE',
        domain: 'sports',
        status: 'upcoming',
        start_at: at(10),
        end_at: at(11),
        registration: { closes_at: at(5), form_id: 'form-1', max_participants: 1, waitlist_enabled: true },
        leaderboard: { format: 'points_table' },
        created_by: ADMIN.id,
        core_admins: [ADMIN.id],
        ...over,
    });
}

const allLeague = (auctionOver: Record<string, unknown> = {}, over: Record<string, unknown> = {}) =>
    seedEvent({
        type: 'ALL',
        teaming: { is_teamed: true, team_size_min: 1, team_size_max: 5 },
        registration: { closes_at: at(5), form_id: 'form-1', max_participants: null },
        auction: {
            k_multiplier: 1,
            min_bid_increment: 10,
            bid_timer_seconds: 5,
            status: 'live',
            captain_user_ids: ['cap-1'],
            ...auctionOver,
        },
        ...over,
    });

async function seedLot(eventId: string, over: Record<string, unknown> = {}) {
    const userId = randomUUID();
    return AuctionLot.create({
        event_id: eventId,
        player: { user_id: userId, display_name: 'Player', avatar_url: null },
        registration_id: `reg-${userId}`,
        base_price: 100,
        order: Math.floor(Math.random() * 1e6),
        status: 'queued',
        ...over,
    });
}

async function rejects(p: Promise<unknown>, status: number, code: string, label: string): Promise<void> {
    try {
        await p;
    } catch (err) {
        assert.ok(err instanceof ServiceError, `${label}: expected ServiceError, got ${err}`);
        assert.strictEqual(`${err.status} ${err.code}`, `${status} ${code}`, label);
        return;
    }
    assert.fail(`${label}: expected ${status} ${code}, resolved`);
}

/* ---------------- checks ---------------- */

async function seatContract() {
    const e = await seedEvent();
    // C4: idempotent per registration id — a retry holds the same seat, never a second one.
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r1'), { reserved: true });
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r1'), { reserved: true }, 'retried reserve is idempotent');
    let fresh = (await Event.findById(e._id))!;
    assert.strictEqual(fresh.counts.registrations_confirmed, 1, 'retry did not double-count');
    assert.deepStrictEqual([...fresh.seat_holders], ['r1']);

    // C4: full + waitlist → capacity_full (registration waitlists); full, no waitlist → waitlist_disabled.
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r2'), { reserved: false, reason: 'capacity_full' });
    await Event.updateOne({ _id: e._id }, { $set: { 'registration.waitlist_enabled': false } });
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r2'), { reserved: false, reason: 'waitlist_disabled' });

    // Release only frees a seat its holder has; a retry frees nothing.
    assert.deepStrictEqual(await ev.releaseSeat(e._id, 'r2'), { released: false }, 'non-holder release is a no-op');
    assert.deepStrictEqual(await ev.releaseSeat(e._id, 'r1'), { released: true });
    assert.deepStrictEqual(await ev.releaseSeat(e._id, 'r1'), { released: false }, 'retried release is a no-op');
    fresh = (await Event.findById(e._id))!;
    assert.strictEqual(fresh.counts.registrations_confirmed, 0);

    // A late RegistrationCancelled must not strip the seat of a row that is confirmed again by now.
    await FormSubmission.collection.insertOne({ _id: 'r3' as never, status: 'confirmed' });
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r3'), { reserved: true });
    await handleRegistrationCancelled({ owner: { type: 'event', id: e._id }, registration_id: 'r3' } as never);
    assert.deepStrictEqual([...(await Event.findById(e._id))!.seat_holders], ['r3'], 'confirmed row keeps its seat');
    await FormSubmission.collection.updateOne({ _id: 'r3' as never }, { $set: { status: 'cancelled' } });
    await handleRegistrationCancelled({ owner: { type: 'event', id: e._id }, registration_id: 'r3' } as never);
    assert.deepStrictEqual([...(await Event.findById(e._id))!.seat_holders], [], 'cancelled row releases');

    // Our service token refused upstream is a deployment fault, not the member's session.
    const mapped = asServiceError(new InternalCallError(401, 'unauthorized')) as ServiceError;
    assert.strictEqual(mapped.status, 503, 'upstream 401 maps to 503, not a logout');

    // Refusals: draft, before opens_at, after closes_at, unknown event.
    const draft = await seedEvent({ status: 'draft' });
    assert.deepStrictEqual(await ev.reserveSeat(draft._id, 'r3'), { reserved: false, reason: 'event_closed' });
    const early = await seedEvent({ registration: { opens_at: at(1), closes_at: at(5), form_id: 'form-1', max_participants: 5 } });
    assert.deepStrictEqual(await ev.reserveSeat(early._id, 'r4'), { reserved: false, reason: 'not_open' });
    const closed = await seedEvent({ registration: { closes_at: at(-1), form_id: 'form-1', max_participants: 5, waitlist_enabled: true } });
    assert.deepStrictEqual(await ev.reserveSeat(closed._id, 'r5'), { reserved: false, reason: 'event_closed' });
    assert.deepStrictEqual(await ev.reserveSeat(randomUUID(), 'r6'), { reserved: false, reason: 'event_not_found' });

    // ...but a waitlist PROMOTION may take a seat after registration closes.
    const waitlisted = await FormSubmission.create({
        form_id: 'form-1',
        form_version: 1,
        owner: { type: 'event', id: closed._id },
        user: { user_id: 'u-wait', display_name: 'Wait', avatar_url: null },
        context: { event: { role: 'solo' } },
        status: 'waitlisted',
        waitlist_position: 1,
        submitted_at: at(-2),
    });
    assert.deepStrictEqual(await ev.reserveSeat(closed._id, waitlisted._id), { reserved: true }, 'promotion after closes_at');
    // Any row submitted before close may take a seat after it (a captain approved late)...
    const lateCaptain = await FormSubmission.create({
        form_id: 'form-1',
        form_version: 1,
        owner: { type: 'event', id: closed._id },
        user: { user_id: 'u-cap', display_name: 'Cap', avatar_url: null },
        context: { event: { role: 'captain' } },
        status: 'submitted',
        submitted_at: at(-2),
    });
    assert.deepStrictEqual(await ev.reserveSeat(closed._id, lateCaptain._id), { reserved: true }, 'late captain approval');
    // ...but not one submitted after it.
    const tooLate = await FormSubmission.create({
        form_id: 'form-1',
        form_version: 1,
        owner: { type: 'event', id: closed._id },
        user: { user_id: 'u-late', display_name: 'Late', avatar_url: null },
        context: { event: { role: 'solo' } },
        status: 'submitted',
        submitted_at: new Date(),
    });
    assert.deepStrictEqual(await ev.reserveSeat(closed._id, tooLate._id), { reserved: false, reason: 'event_closed' });
}

async function patchSemantics() {
    const e = await allLeague({ status: 'not_started' }, { core_admins: [ADMIN.id, CO_ADMIN.id] });

    // C2: a partial PATCH changes exactly what it names.
    const renamed = await ev.updateEvent(e._id, ADMIN, UpdateEventSchema.parse({ title: 'Renamed' }) as never);
    assert.strictEqual(renamed.title, 'Renamed');
    assert.strictEqual(renamed.type, 'ALL', 'type survives a title PATCH');
    assert.ok(renamed.auction, 'auction survives a title PATCH');
    assert.deepStrictEqual([...renamed.auction!.captain_user_ids], ['cap-1'], 'captains survive');
    assert.strictEqual(renamed.teaming.is_teamed, true, 'teaming survives');
    assert.ok(renamed.core_admins.includes(ADMIN.id), 'core_admins survive');

    // Nested objects merge: max_participants changes, form_id stays.
    const merged = await ev.updateEvent(e._id, ADMIN, UpdateEventSchema.parse({ registration: { max_participants: 50 } }) as never);
    assert.strictEqual(merged.registration.max_participants, 50);
    assert.strictEqual(merged.registration.form_id, 'form-1', 'nested PATCH keeps sibling fields');

    // `type` is not patchable (stripped), so it cannot re-shape the event.
    assert.strictEqual((UpdateEventSchema.parse({ type: 'DE' }) as Record<string, unknown>).type, undefined);

    // Transition map + roles.
    await rejects(ev.updateEvent(e._id, ADMIN, { status: 'past' }), 409, 'invalid_status_transition', 'upcoming → past refused');
    await rejects(ev.updateEvent(e._id, ADMIN, { status: 'cancelled' }), 403, 'coordinator_required', 'core admin cannot cancel');
    await rejects(ev.updateEvent(e._id, OUTSIDER, { title: 'x' }), 403, 'forbidden', 'non-admin core cannot edit');
    await rejects(ev.updateEvent(e._id, CO_ADMIN, { core_admins: [OUTSIDER.id] }), 403, 'core_admins_owner_only', 'only owner edits admins');
    await rejects(ev.updateEvent(e._id, ADMIN, { core_admins: ['no-such-user'] }), 422, 'invalid_core_admin', 'admins must be core+');

    const started: unknown[] = [];
    const completed: unknown[] = [];
    const offS = subscribe('EventStarted', (x) => void started.push(x.payload));
    const offC = subscribe('EventCompleted', (x) => void completed.push(x.payload));
    await ev.updateEvent(e._id, ADMIN, { status: 'ongoing' });
    await ev.updateEvent(e._id, ADMIN, { status: 'past' });
    const stamped = (await Event.findById(e._id))!;
    assert.ok(stamped.started_at && stamped.completed_at, 'lifecycle timestamps written by the transition CAS');
    offS();
    offC();
    assert.strictEqual(started.length, 1);
    assert.deepStrictEqual(completed, [{ event_id: e._id, title: 'Renamed' }], 'EventCompleted carries title, once');
    await rejects(ev.updateEvent(e._id, ADMIN, { title: 'late' }), 409, 'event_is_terminal', 'past is read-only');

    // An invariant the specific checks miss is a 422, not the hook's 500.
    const de = await seedEvent({ type: 'DE', leaderboard: null, registration: { closes_at: at(5), form_id: null, max_participants: null } });
    await rejects(
        ev.updateEvent(de._id, ADMIN, { registration: { max_participants: 10 } } as never),
        422,
        'invalid_event',
        'uncapped-without-form rule surfaces as 422'
    );
}

async function createAndList() {
    const input = CreateEventSchema.parse({
        title: 'Slug Cup',
        category: 'general',
        type: 'DE',
        start_at: at(10).toISOString(),
        end_at: at(11).toISOString(),
        registration: { closes_at: at(5).toISOString() },
    });
    const first = await ev.createEvent(ADMIN, input);
    await Event.updateOne({ _id: first._id }, { $set: { deleted_at: new Date() } });
    const second = await ev.createEvent(ADMIN, input);
    assert.notStrictEqual(second.slug, first.slug, 'a soft-deleted slug is not reused (no 11000 → 500)');

    // A draft may exist before its form (the form needs the event's id first)...
    const formless = await ev.createEvent(ADMIN, CreateEventSchema.parse({ ...input, type: 'LE' }));
    assert.strictEqual(formless.registration.form_id, null, 'LE draft without a form is fine');
    // ...and may be cancelled without ever getting one.
    const abandoned = await ev.createEvent(ADMIN, CreateEventSchema.parse({ ...input, type: 'LE' }));
    assert.strictEqual((await ev.updateEvent(abandoned._id, COORD, { status: 'cancelled' })).status, 'cancelled', 'formless draft cancels');
    // ...a published one may not.
    await rejects(
        ev.createEvent(ADMIN, CreateEventSchema.parse({ ...input, type: 'LE', status: 'upcoming' })),
        422,
        'invalid_event',
        'LE published without a form is a 422'
    );
    // Leaving draft needs a PUBLISHED form owned by THIS event.
    const foreign = await FormDefinition.create({
        owner: { type: 'event', id: randomUUID() },
        title: 'Other event form',
        status: 'draft',
        created_by: ADMIN.id,
    });
    await ev.updateEvent(formless._id, ADMIN, { registration: { form_id: foreign._id } } as never); // a draft may point anywhere
    await rejects(ev.updateEvent(formless._id, ADMIN, { status: 'upcoming' }), 422, 'registration_form_invalid', 'foreign form');
    const own = await FormDefinition.create({
        owner: { type: 'event', id: formless._id },
        title: 'Own form',
        status: 'draft',
        created_by: ADMIN.id,
    });
    await ev.updateEvent(formless._id, ADMIN, { registration: { form_id: own._id } } as never);
    await rejects(ev.updateEvent(formless._id, ADMIN, { status: 'upcoming' }), 422, 'registration_form_invalid', 'unpublished form');
    await FormDefinition.collection.updateOne({ _id: own._id as never }, { $set: { status: 'published' } });
    const published = await ev.updateEvent(formless._id, ADMIN, { status: 'upcoming' });
    assert.strictEqual(published.status, 'upcoming', 'owned published form lets the event leave draft');
    // ...and changing the form of a published event is held to the same rule.
    await rejects(
        ev.updateEvent(formless._id, ADMIN, { registration: { form_id: foreign._id } } as never),
        422,
        'registration_form_invalid',
        'form swap on a published event'
    );
    // Eligibility never says "eligible" without a usable form (H1).
    const drafty = await seedEvent({ registration: { closes_at: at(5), form_id: 'form-missing', max_participants: 5 } });
    const elig = await ev.getEventEligibility(drafty._id, 'someone');
    assert.deepStrictEqual([elig.eligible, elig.reason], [false, 'registration_form_unavailable']);
    await rejects(
        ev.createEvent(ADMIN, CreateEventSchema.parse({ ...input, core_admins: ['nobody'] })),
        422,
        'invalid_core_admin',
        'core_admins must be real core+ accounts'
    );
    const league = await ev.createEvent(
        ADMIN,
        CreateEventSchema.parse({
            ...input,
            type: 'ALL',
            teaming: { is_teamed: true, team_size_min: 1, team_size_max: 4 },
            registration: { closes_at: at(5).toISOString(), form_id: 'f' },
        })
    );
    assert.strictEqual(league.auction?.status, 'not_started', 'ALL without auction gets the default block');

    // Lists: escaped search, unlisted hidden from the public, bad cursor is a 422.
    await ev.listEvents(QueryEventsSchema.parse({ search: '(' }));
    const hidden = await seedEvent({ visibility: 'unlisted', title: 'Hidden Unlisted' });
    const pub = await ev.listEvents(QueryEventsSchema.parse({ search: 'Hidden Unlisted' }));
    assert.ok(!pub.events.some((x) => x._id === hidden._id), 'unlisted not in public list');
    const coord = await ev.listEvents(QueryEventsSchema.parse({ search: 'Hidden Unlisted' }), COORD);
    assert.ok(coord.events.some((x) => x._id === hidden._id), 'coordinator sees unlisted');
    await rejects(ev.listEvents(QueryEventsSchema.parse({ cursor: 'Z2FyYmFnZQ==' })), 422, 'invalid_cursor', 'garbage cursor');
    await rejects(
        ev.listEvents(QueryEventsSchema.parse({ cursor: 'eA==', sort: 'title' })),
        422,
        'cursor_requires_date_sort',
        'cursor on a non-date sort'
    );
}

async function captainsAndConsumers() {
    const le = await seedEvent();
    await handleCaptainApproved({ event_id: le._id, user_id: 'cap-x' });
    assert.strictEqual((await Event.findById(le._id))!.auction, null, 'CaptainApproved never adds an auction to LE');
    await rejects(ev.addEventCaptain(le._id, 'cap-x', ADMIN), 422, 'event_is_not_an_auction_league', 'addEventCaptain on LE');

    const paused = await allLeague({ status: 'paused' });
    await handleCaptainApproved({ event_id: paused._id, user_id: 'cap-late' });
    assert.ok((await Event.findById(paused._id))!.auction!.captain_user_ids.includes('cap-late'), 'paused auction takes captains');

    // Scheduler: a due `upcoming` event starts, once.
    const due = await seedEvent({ start_at: at(-1), end_at: at(1), registration: { closes_at: at(-2), form_id: 'form-1' } });
    await startDueEvents();
    assert.strictEqual((await Event.findById(due._id))!.status, 'ongoing', 'scheduler starts due events');

    const withContact = await seedEvent({ contacts: [{ user_id: 'gone', display_name: 'Gone', role_label: 'Lead', contact: '+91 99' }] });
    await handleUserDeleted({ user_id: 'gone' });
    const c = (await Event.findById(withContact._id))!.contacts[0];
    assert.strictEqual(c.contact, null, 'UserDeleted drops the contact detail');
    assert.notStrictEqual(c.display_name, 'Gone');
}

async function auctionEngine() {
    // Timer: the hammer does not fall early.
    const e = await allLeague();
    const a = await seedLot(e._id, { status: 'on_block', timer_ends_at: at(1), order: 1 });
    const b = await seedLot(e._id, { order: 2 });
    await rejects(auction.advanceLot(a._id, ADMIN), 409, 'timer_running', 'advance before the timer');
    await rejects(auction.advanceLot(a._id, OUTSIDER), 403, 'forbidden', 'non-admin core cannot advance');

    // One lot on the block per event (unique partial index).
    await assert.rejects(seedLot(e._id, { status: 'on_block', order: 3 }), /E11000/, 'second on_block lot refused by index');

    await AuctionLot.updateOne({ _id: a._id }, { $set: { timer_ends_at: at(-1) } });
    const settledA = await auction.advanceLot(a._id, ADMIN);
    assert.strictEqual(settledA.settled_lot.status, 'unsold');
    assert.strictEqual(settledA.next_lot?._id, b._id, 'next lot raised');

    // Debit refused → the lot goes unsold instead of wedging; empty queue finishes the auction.
    await AuctionLot.updateOne(
        { _id: b._id },
        { $set: { current_bid: 150, current_bidder: { user_id: 'cap-1', team_id: 'team-1' }, timer_ends_at: at(-1) } }
    );
    reply('debit-purse', { status: 409, body: { error: 'insufficient_purse' } });
    const settledB = await auction.advanceLot(b._id, ADMIN);
    assert.strictEqual(settledB.settled_lot.status, 'unsold');
    assert.strictEqual(settledB.settlement_refused, 'insufficient_purse');
    assert.strictEqual((await Event.findById(e._id))!.auction!.status, 'finished', 'queue ran dry → finished');

    // Outcome unknown → the lot stays `settling` (holds the block, takes no bids), 503; the retry
    // replays the SAME per-team keys and sells once.
    const e2 = await allLeague();
    const c = await seedLot(e2._id, {
        status: 'on_block',
        current_bid: 200,
        current_bidder: { user_id: 'cap-1', team_id: 'team-2' },
        timer_ends_at: at(-1),
    });
    calls.length = 0;
    reply('debit-purse', { status: 500, body: { error: 'internal_error' } }, { status: 401, body: { error: 'unauthorized' } });
    await rejects(auction.advanceLot(c._id, ADMIN), 503, 'registration_service_unavailable', 'unknown outcome is a 503');
    assert.strictEqual((await AuctionLot.findById(c._id))!.status, 'settling', 'lot held in settling, not re-opened');
    await rejects(auction.placeBid(c._id, { id: 'cap-2' }, 500, 0), 400, 'lot_not_on_block', 'no bid on a settling lot');
    // 401 from Registration is outcome-unknown too, never a refusal that unsells.
    await rejects(auction.advanceLot(c._id, ADMIN), 503, 'registration_service_unavailable', '401 is not a refusal');
    assert.strictEqual((await AuctionLot.findById(c._id))!.status, 'settling', '401 left the lot settling');
    const sold: unknown[] = [];
    const offSold = subscribe('PlayerSold', (x) => void sold.push(x.payload));
    const soldLot = await auction.advanceLot(c._id, ADMIN);
    offSold();
    assert.strictEqual(soldLot.settled_lot.status, 'sold');
    assert.strictEqual(soldLot.settled_lot.sold_to_team_id, 'team-2');
    const debits = calls.filter((x) => x.op === 'debit-purse').map((x) => x.body.request_id);
    assert.deepStrictEqual(debits, Array(3).fill(`${c._id}:team-2:debit`), 'every replay reuses the per-team debit key');
    assert.deepStrictEqual(
        calls.filter((x) => x.op === 'add-member').map((x) => x.body.request_id),
        [`${c._id}:team-2:add`],
        'add-member carries its per-team key'
    );
    assert.deepStrictEqual(
        sold,
        [{ event_id: e2._id, lot_id: c._id, player_user_id: c.player.user_id, team_id: 'team-2', captain_user_id: 'cap-1', amount: 200 }],
        'PlayerSold carries exactly the notification fields'
    );

    // Player cannot join → the debit is refunded under the lot's refund key, lot unsold.
    const e3 = await allLeague();
    const d = await seedLot(e3._id, {
        status: 'on_block',
        current_bid: 120,
        current_bidder: { user_id: 'cap-1', team_id: 'team-3' },
        timer_ends_at: at(-1),
    });
    calls.length = 0;
    reply('add-member', { status: 409, body: { error: 'team_full' } });
    const refused = await auction.advanceLot(d._id, ADMIN);
    assert.strictEqual(refused.settled_lot.status, 'unsold');
    assert.deepStrictEqual(
        calls.filter((x) => x.op === 'refund-purse').map((x) => x.body.request_id),
        [`${d._id}:team-3:refund`],
        'refund keyed by lot'
    );

    // Resume raises the next lot when a lot was settled while paused (wedge fix).
    const e4 = await allLeague({ status: 'paused' });
    const q = await seedLot(e4._id, { order: 1 });
    await auction.resumeAuction(e4._id, ADMIN);
    assert.strictEqual((await AuctionLot.findById(q._id))!.status, 'on_block', 'resume raised the queued lot');

    // Close settles the active lot without raising another, and publishes AuctionClosed once.
    const e5 = await allLeague();
    const active = await seedLot(e5._id, { status: 'on_block', timer_ends_at: at(1), order: 1 });
    const waiting = await seedLot(e5._id, { order: 2 });
    const closedEvents: unknown[] = [];
    const off = subscribe('AuctionClosed', (x) => void closedEvents.push(x.payload));
    await auction.closeAuction(e5.slug, ADMIN);
    off();
    assert.strictEqual((await AuctionLot.findById(active._id))!.status, 'unsold');
    assert.strictEqual((await AuctionLot.findById(waiting._id))!.status, 'queued', 'no lot stranded on the block');
    assert.strictEqual(closedEvents.length, 1, 'AuctionClosed once');

    // A close or cancel landing between the raise's live check and the raise itself: the lot goes
    // back to the queue instead of sitting on the block of a finished auction.
    const raced = await allLeague({ status: 'paused' });
    const racedLot = await seedLot(raced._id, { order: 1 });
    const raise = AuctionLot.findOneAndUpdate;
    AuctionLot.findOneAndUpdate = (async (...args: unknown[]) => {
        AuctionLot.findOneAndUpdate = raise;
        await Event.updateOne({ _id: raced._id }, { $set: { 'auction.status': 'finished' } });
        return (raise as (...a: unknown[]) => unknown).apply(AuctionLot, args);
    }) as never;
    await auction.resumeAuction(raced._id, ADMIN);
    assert.strictEqual((await AuctionLot.findById(racedLot._id))!.status, 'queued', 'raise lost to a close is undone');

    // Start: purses go through Registration Service, CAS on not_started, first lot up.
    const e6 = await allLeague({ status: 'not_started' });
    const first = await seedLot(e6._id, { order: 1 });
    calls.length = 0;
    await auction.startAuction(e6._id, ADMIN);
    assert.deepStrictEqual(calls.map((x) => x.op), ['auction-purses']);
    assert.strictEqual((await AuctionLot.findById(first._id))!.status, 'on_block');
    await rejects(auction.startAuction(e6._id, ADMIN), 409, 'auction_already_started', 'second start');

    // Config frozen once live; quota 0 means no overrides; override only while queued.
    await rejects(auction.updateAuctionConfig(e6._id, ADMIN, { min_bid_increment: 5 }), 409, 'auction_config_frozen', 'frozen');
    const e7 = await allLeague({ status: 'not_started', oc_override_quota: 0 });
    const lot7 = await seedLot(e7._id);
    await rejects(auction.overrideLotPrice(lot7._id, ADMIN, { oc_adjusted_price: 1 }), 422, 'oc_override_quota_exceeded', 'quota 0');
    await rejects(auction.updateAuctionConfig(e7._id, ADMIN, { k_multiplier: 2 }), 403, 'coordinator_required', 'K is admin-tier');
    await rejects(auction.overrideLotPrice(first._id, COORD, { oc_adjusted_price: 1 }), 409, 'lot_not_queued', 'no re-price on block');

    // Cache: a mutation through the slug answers fresh state.
    await auction.getAuctionLiveState(e6.slug);
    const paused = await auction.pauseAuction(e6.slug, ADMIN);
    assert.strictEqual(paused.status, 'paused', 'slug-keyed cache invalidated');

    // Drafts are invisible to the public auction reads.
    const draft = await allLeague({ status: 'not_started' }, { status: 'draft' });
    await rejects(auction.getAuctionLiveState(draft._id), 404, 'event_not_found', 'draft live state hidden');

    // Lots: must be confirmed registrations of this event; players unique across batches.
    const e8 = await allLeague({ status: 'not_started' });
    await rejects(
        auction.createLots(e8._id, ADMIN, { lots: [{ registration_id: 'nope', user_id: 'u', base_price: 1, order: 1 }] }),
        422,
        'invalid_lot_registration',
        'unregistered player'
    );
    const reg = await FormSubmission.create({
        form_id: 'form-1',
        form_version: 1,
        owner: { type: 'event', id: e8._id },
        user: { user_id: 'player-8', display_name: 'P8', avatar_url: null },
        context: { event: { role: 'solo' } },
        status: 'confirmed',
    });
    const lot = { registration_id: reg._id, user_id: 'player-8', base_price: 1, order: 1 };
    await auction.createLots(e8._id, ADMIN, { lots: [lot] });
    await rejects(auction.createLots(e8._id, ADMIN, { lots: [{ ...lot, order: 2 }] }), 409, 'lot_conflict', 'repeat player');
}

async function auditTwoChecks() {
    // Scheduler: an event that already ended is NOT started (no EventStarted storm).
    const ended = await seedEvent({ start_at: at(-3), end_at: at(-2), registration: { closes_at: at(-4), form_id: 'form-1' } });
    await startDueEvents();
    assert.strictEqual((await Event.findById(ended._id))!.status, 'upcoming', 'ended upcoming event left alone');

    // Attendance window: ongoing AND before end_at, else 409 (owner decision).
    const upcoming = await seedEvent();
    const mark = [{ registration_id: randomUUID(), attended: true }];
    await rejects(ev.recordEventAttendance(upcoming._id, mark, ADMIN), 409, 'attendance_window_closed', 'before start');
    const overran = await seedEvent({ status: 'ongoing', start_at: at(-3), end_at: at(-1), registration: { closes_at: at(-4), form_id: 'form-1' } });
    await rejects(ev.recordEventAttendance(overran._id, mark, ADMIN), 409, 'attendance_window_closed', 'after end_at');

    // A creator demoted to `user` reads the participant list as the public does.
    const roster = await seedEvent();
    await FormSubmission.create({
        form_id: 'form-1',
        form_version: 1,
        owner: { type: 'event', id: roster._id },
        user: { user_id: 'u-pending', display_name: 'Pending', avatar_url: null },
        context: { event: { role: 'solo' } },
        status: 'submitted',
    });
    const demoted = await ev.getEventParticipants(roster._id, { page: 1, limit: 20 }, { id: ADMIN.id, role: UserRole.USER });
    assert.strictEqual(demoted.total, 0, 'demoted creator sees confirmed rows only');

    // Cancel: cancelled_at stamped, the lot on the block closes unsold and cannot be sold after.
    const doomed = await allLeague();
    const blockLot = await seedLot(doomed._id, { status: 'on_block', timer_ends_at: at(-1) });
    await ev.updateEvent(doomed._id, COORD, { status: 'cancelled' });
    assert.ok((await Event.findById(doomed._id))!.cancelled_at, 'cancelled_at stamped');
    assert.strictEqual((await AuctionLot.findById(blockLot._id))!.status, 'unsold', 'cancel closes the lot on the block');

    // Bids: a locked team is refused; so is a captain whose registration is not confirmed.
    const league = await allLeague();
    const lot = await seedLot(league._id, { status: 'on_block', timer_ends_at: at(1) });
    const team = await Team.create({
        owner: { type: 'event', id: league._id },
        name: 'Locked XI',
        captain_user_id: 'cap-1',
        members: [{ user_id: 'cap-1', display_name: 'Cap', registration_id: 'reg-cap-1', acquired_via: 'created' }],
        invite_code: 'LOCKED01',
        size_min: 1,
        size_max: 5,
        status: 'locked',
        auction: { purse_total: 1000 },
    });
    await rejects(auction.placeBid(lot._id, { id: 'cap-1' }, 100, 0), 409, 'team_locked', 'locked team cannot bid');
    await Team.updateOne({ _id: team._id }, { $set: { status: 'forming' } });
    await rejects(auction.placeBid(lot._id, { id: 'cap-1' }, 100, 0), 403, 'captain_not_confirmed', 'unconfirmed captain');

    // Budget override retried with the same amount is a 200, not a 409.
    const notStarted = await allLeague({ status: 'not_started' });
    const seeded = await Team.create({
        owner: { type: 'event', id: notStarted._id },
        name: 'Seeded',
        captain_user_id: 'cap-9',
        members: [{ user_id: 'cap-9', display_name: 'Cap', registration_id: 'reg-cap-9', acquired_via: 'created' }],
        invite_code: 'SEEDED01',
        size_min: 1,
        size_max: 5,
        auction: { purse_total: 700, is_overridden: true },
    });
    calls.length = 0;
    const same = await auction.overrideCaptainBudget(notStarted._id, seeded._id, COORD, { purse_total: 700 });
    assert.ok(same && calls.length === 0, 'idempotent override needs no downstream call');

    // Auto-settle: an expired lot in a live auction settles without an admin.
    const auto = await allLeague();
    const expired = await seedLot(auto._id, { status: 'on_block', timer_ends_at: at(-1) });
    await settleExpiredLots();
    assert.strictEqual((await AuctionLot.findById(expired._id))!.status, 'unsold', 'tick settled the expired lot');

    // A draft's lot is a 404 to a non-admin, not a 403 that confirms it exists.
    const draftLeague = await allLeague({ status: 'not_started' }, { status: 'draft' });
    const draftLot = await seedLot(draftLeague._id);
    await rejects(auction.advanceLot(draftLot._id, OUTSIDER), 404, 'lot_not_found', 'draft lot hidden (advance)');
    await rejects(auction.overrideLotPrice(draftLot._id, OUTSIDER, { oc_adjusted_price: 1 }), 404, 'lot_not_found', 'draft lot hidden (price)');

    // Lot order is unique per event.
    await assert.rejects(seedLot(draftLeague._id, { order: draftLot.order }), /E11000/, 'duplicate order refused by index');

    // A cancelled confirmed captain leaves the captain list.
    const capEvent = await allLeague();
    await handleRegistrationCancelled({
        registration_id: randomUUID(),
        owner: { type: 'event', id: capEvent._id },
        user_id: 'cap-1',
        role: 'captain',
        previous_status: 'confirmed',
    } as never);
    assert.ok(!(await Event.findById(capEvent._id))!.auction!.captain_user_ids.includes('cap-1'), 'captain pulled');

    // Deleted users: never re-named by a profile refresh, and shown anonymized in the captain list.
    const uid = randomUUID();
    await User.create({ _id: uid, email: `${uid}@sc.local`, username: `sc_${uid.slice(0, 8)}`, role: UserRole.USER, profile: { full_name: 'Real Name' } });
    await Event.updateOne({ _id: capEvent._id }, { $addToSet: { 'auction.captain_user_ids': uid } });
    const anonLot = await seedLot(capEvent._id, { player: { user_id: uid, display_name: 'Deleted user', avatar_url: null, deleted: true } });
    await resnapshotUser(uid); // a profile refresh: the copy is marked deleted → untouched
    assert.strictEqual((await AuctionLot.findById(anonLot._id))!.player.display_name, 'Deleted user', 'deleted copy stays deleted');
    await User.updateOne({ _id: uid }, { $set: { deleted_at: new Date() } });
    const listed = await ev.listEventCaptains(capEvent._id);
    assert.ok(listed.captains.every((c) => c.display_name !== 'Real Name'), 'deleted captain not shown by name');
}

async function storage() {
    const stored = await putObject('event-x', Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'image/jpeg');
    assert.ok(stored.url.startsWith('/uploads/events/event-x/'), 'event images live under the shared root, events/ prefix');
}

async function main() {
    await new Promise<void>((resolve) => stub.listen(STUB_PORT, '127.0.0.1', resolve));
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(['Event', 'AuctionLot', 'FormSubmission', 'Team'].map((m) => mongoose.model(m).syncIndexes()));

    try {
        await seatContract();
        await patchSemantics();
        await createAndList();
        await captainsAndConsumers();
        await auctionEngine();
        await auditTwoChecks();
        await storage();
        console.log('event service db selfcheck: all assertions passed');
    } finally {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        stub.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
