import { STUB_PORT } from './stub-env'; // must stay first: sets env before @bgsc/shared loads
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { AuctionLot, Event, FormDefinition, FormSubmission, Team, User, UserRole, IEvent, InternalCallError, ServiceError, config, subscribe } from '@bgsc/shared';
import * as ev from '../events/event.service';
import * as auction from '../auction/auction.service';
import { handleCaptainApproved, handleRegistrationCancelled, handleUserDeleted, resnapshotUser } from '../events/consumers';
import * as evc from '../events/event.controller';
import { asServiceError } from '../clients/registration-client';
import { reconcileSeats, startDueEvents } from '../events/scheduler';
import { settleExpiredLots } from '../auction/auction.service';
import { CreateEventSchema, QueryEventsSchema, UpdateEventSchema } from '../events/event.schemas';
import { putObject } from '../storage/storage';
import { promises as fs } from 'fs';
import path from 'path';
import { Actor } from '../events/access';

/**
 * Regression checks against a real MongoDB (scratch database `bgsc_selfcheck_event`, dropped at
 * start and end) and a stub Registration Service on STUB_PORT. Every block pins one regression.
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
    // Idempotent per registration id — a retry holds the same seat, never a second one.
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r1'), { reserved: true });
    assert.deepStrictEqual(await ev.reserveSeat(e._id, 'r1'), { reserved: true }, 'retried reserve is idempotent');
    let fresh = (await Event.findById(e._id))!;
    assert.strictEqual(fresh.counts.registrations_confirmed, 1, 'retry did not double-count');
    assert.deepStrictEqual([...fresh.seat_holders], ['r1']);
    assert.strictEqual(fresh.updated_at.getTime(), e.updated_at.getTime(), 'a seat write leaves the PATCH version (updated_at) alone');

    // Full + waitlist → capacity_full (registration waitlists); full, no waitlist → waitlist_disabled.
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

    // A partial PATCH changes exactly what it names.
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
    // Eligibility never says "eligible" without a usable form.
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
    await rejects(auction.placeBid(c._id, { id: 'cap-2' }, 500, 0), 409, 'lot_not_on_block', 'no bid on a settling lot');
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

async function lifecycleAndBidGuards() {
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
    assert.strictEqual((same as { name?: string }).name, 'Seeded', 'the replay answers the full team, as the first call did');

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

const confirmedReg = (eventId: string, userId: string, over: Record<string, unknown> = {}) =>
    FormSubmission.create({
        form_id: 'form-1',
        form_version: 1,
        owner: { type: 'event', id: eventId },
        user: { user_id: userId, display_name: userId, avatar_url: null },
        context: { event: { role: 'captain' } },
        status: 'confirmed',
        ...over,
    });

const seedTeam = (eventId: string, captain: string, auctionBlock: Record<string, unknown> | null) =>
    Team.create({
        owner: { type: 'event', id: eventId },
        name: `Team ${captain} ${randomUUID().slice(0, 6)}`,
        captain_user_id: captain,
        members: [{ user_id: captain, display_name: captain, registration_id: `reg-${captain}`, acquired_via: 'created' }],
        invite_code: randomUUID().replace(/-/g, '').slice(0, 8),
        size_min: 1,
        size_max: 5,
        auction: auctionBlock,
    });

async function bidding() {
    const e = await allLeague({ captain_user_ids: ['cap-a', 'cap-b'], purse_per_team: 1000 });
    const lot = await seedLot(e._id, { status: 'on_block', timer_ends_at: at(1) }); // floor 100, increment 10
    await seedTeam(e._id, 'cap-a', { purse_total: 1000 });
    await seedTeam(e._id, 'cap-b', null); // formed after the start: missed the start's purse run
    await confirmedReg(e._id, 'cap-a');
    await confirmedReg(e._id, 'cap-b');

    await rejects(auction.placeBid(lot._id, { id: 'cap-a' }, 50, 0), 422, 'bid_below_minimum', 'opening bid under the floor');
    await rejects(auction.placeBid(lot._id, { id: 'cap-a' }, 1001, 0), 422, 'insufficient_purse', 'bid over the purse');

    const first = await auction.placeBid(lot._id, { id: 'cap-a' }, 100, 0);
    assert.deepStrictEqual([first.current_bid, first.version, first.bids.length], [100, 1, 1], 'a valid bid lands');
    await rejects(auction.placeBid(lot._id, { id: 'cap-b' }, 105, 1), 422, 'bid_below_minimum', 'raise under the increment');

    // A captain whose team has no purse is given the default one (idempotent upstream), not a 422.
    calls.length = 0;
    const second = await auction.placeBid(lot._id, { id: 'cap-b' }, 110, 1);
    assert.strictEqual(second.current_bid, 110, 'late team bids from the default purse');
    assert.deepStrictEqual(
        calls.map((x) => [x.op, x.body.purse_total]),
        [['auction-purses', 1000]],
        'late team gets the start-time default purse'
    );

    // Two bids read the same version: the first wins, the other misses the CAS.
    await rejects(auction.placeBid(lot._id, { id: 'cap-a' }, 200, 1), 409, 'conflict_concurrent_bid', 'stale version refused');

    // The server timer is the deadline, whatever the client thinks.
    await AuctionLot.updateOne({ _id: lot._id }, { $set: { timer_ends_at: at(-1) } });
    await rejects(auction.placeBid(lot._id, { id: 'cap-a' }, 200, 2), 409, 'conflict_concurrent_bid', 'bid after timer_ends_at');

    // Pause moves the lot version, so a bid read before the pause cannot land after it.
    const p = await allLeague();
    const pLot = await seedLot(p._id, { status: 'on_block', timer_ends_at: at(1) });
    await auction.pauseAuction(p._id, ADMIN);
    assert.strictEqual((await AuctionLot.findById(pLot._id))!.version, pLot.version + 1, 'pause bumps the lot version');
    await rejects(auction.placeBid(pLot._id, { id: 'cap-1' }, 100, 0), 409, 'auction_not_live', 'no bid on a paused auction');

    // A route miss or a body Registration cannot parse is version skew, not a refusal: the lot stays
    // settling (503) instead of going unsold for good.
    const s = await allLeague();
    const sLot = await seedLot(s._id, {
        status: 'on_block',
        current_bid: 150,
        current_bidder: { user_id: 'cap-1', team_id: 'team-s' },
        timer_ends_at: at(-1),
    });
    reply('debit-purse', { status: 404, body: { error: 'not_found' } }, { status: 422, body: { error: 'validation_failed' } });
    await rejects(auction.advanceLot(sLot._id, ADMIN), 503, 'registration_service_unavailable', 'route-miss 404 is not a refusal');
    await rejects(auction.advanceLot(sLot._id, ADMIN), 503, 'registration_service_unavailable', 'validation_failed is not a refusal');
    assert.strictEqual((await AuctionLot.findById(sLot._id))!.status, 'settling', 'lot still settling after skew');
    assert.strictEqual((await auction.advanceLot(sLot._id, ADMIN)).settled_lot.status, 'sold', 'the replay sells');

    // Not an auction league: 422 on the auction routes, as on the captain routes.
    const le = await seedEvent();
    await rejects(auction.getAuctionLiveState(le._id), 422, 'event_is_not_an_auction_league', 'auction read on LE');

    // A deleted account goes on the block anonymized.
    const lotsEvent = await allLeague({ status: 'not_started' });
    const gone = randomUUID();
    await User.create({ _id: gone, email: `${gone}@sc.local`, username: `sc_${gone.slice(0, 8)}`, role: UserRole.USER, profile: { full_name: 'Real Name' }, deleted_at: new Date() });
    const goneReg = await confirmedReg(lotsEvent._id, gone, { context: { event: { role: 'solo' } } });
    const [goneLot] = await auction.createLots(lotsEvent._id, ADMIN, { lots: [{ registration_id: goneReg._id, user_id: gone, base_price: 1, order: 1 }] });
    assert.deepStrictEqual([goneLot.player.display_name, goneLot.player.deleted], ['Deleted user', true], 'deleted player anonymized');
}

async function eventWrites() {
    // A league does not complete under a live auction; a finished or never-started one does.
    const live = await allLeague({}, { status: 'ongoing' });
    await rejects(ev.updateEvent(live._id, ADMIN, { status: 'past' }), 409, 'auction_not_finished', 'past with a live auction');
    await Event.updateOne({ _id: live._id }, { $set: { 'auction.status': 'finished' } });
    assert.strictEqual((await ev.updateEvent(live._id, ADMIN, { status: 'past' })).status, 'past', 'finished auction completes');
    const unstarted = await allLeague({ status: 'not_started' }, { status: 'ongoing' });
    assert.strictEqual((await ev.updateEvent(unstarted._id, ADMIN, { status: 'past' })).status, 'past', 'never-started auction completes');

    // A PATCH validated against a read that another write has since moved past is a 409.
    const e = await seedEvent();
    const cas = Event.findOneAndUpdate;
    Event.findOneAndUpdate = (async (...args: unknown[]) => {
        Event.findOneAndUpdate = cas;
        await Event.collection.updateOne({ _id: e._id as never }, { $set: { updated_at: new Date(Date.now() + 60_000) } });
        return (cas as (...a: unknown[]) => unknown).apply(Event, args);
    }) as never;
    await rejects(ev.updateEvent(e._id, ADMIN, { title: 'Stale' }), 409, 'event_changed_concurrently', 'stale PATCH refused');
    assert.notStrictEqual((await Event.findById(e._id))!.title, 'Stale');

    // Delete a draft: Core+ who administers it (a core creator may); anyone else may not.
    const draft = await seedEvent({ status: 'draft' });
    await rejects(ev.deleteEvent(draft._id, OUTSIDER), 404, 'not_found', 'non-admin core: a draft is hidden');
    assert.deepStrictEqual(await ev.deleteEvent(draft._id, ADMIN), { deleted: true }, 'core creator deletes their draft');
    const published = await seedEvent();
    await rejects(ev.deleteEvent(published._id, OUTSIDER), 403, 'forbidden', 'non-admin core cannot delete');
    await rejects(ev.deleteEvent(published._id, ADMIN), 409, 'cannot_delete_published_event', 'published is never deleted');

    // Promotion goes through Registration; only this event's admins, only this event's rows.
    const wl = await seedEvent();
    const row = await confirmedReg(wl._id, 'u-wl', { status: 'waitlisted', waitlist_position: 1 });
    calls.length = 0;
    await ev.promoteWaitlistedParticipant(wl._id, row._id, ADMIN);
    assert.deepStrictEqual(calls.map((x) => [x.op, x.body.by]), [['promote', ADMIN.id]], 'promote delegated with the actor');
    await rejects(ev.promoteWaitlistedParticipant(wl._id, row._id, OUTSIDER), 403, 'forbidden', 'non-admin cannot promote');
    await rejects(ev.promoteWaitlistedParticipant(wl._id, randomUUID(), ADMIN), 404, 'registration_not_found', 'foreign row');
    const own = await confirmedReg(wl._id, ADMIN.id, { status: 'waitlisted', waitlist_position: 2 });
    await rejects(ev.promoteWaitlistedParticipant(wl._id, own._id, ADMIN), 403, 'cannot_review_own_registration', 'no self-promotion');
}

/** Drives the media controller the way Express would; resolves with the response or the error passed to next(). */
function upload(ref: string, actor: Actor, body: Buffer): Promise<{ status: number; body: Record<string, unknown> } | unknown> {
    return new Promise((resolve) => {
        const res = {
            statusCode: 200,
            status(code: number) {
                this.statusCode = code;
                return this;
            },
            json(b: Record<string, unknown>) {
                resolve({ status: this.statusCode, body: b });
            },
        };
        evc.uploadMedia({ actor: { _id: actor.id, role: actor.role }, params: { ref }, query: {}, body } as never, res as never, resolve);
    });
}

async function participantsAndMedia() {
    // The public reads confirmed and waitlist counts only; the event's admins read the breakdown.
    const e = await seedEvent({ registration: { closes_at: at(5), form_id: 'form-1', max_participants: 5, waitlist_enabled: true } });
    await confirmedReg(e._id, 'u-ok', { context: { event: { role: 'solo' } } });
    await confirmedReg(e._id, 'u-no', { status: 'rejected', context: { event: { role: 'solo' } } });
    const pub = await ev.getEventParticipantStats(e._id);
    assert.deepStrictEqual(pub.counts, { confirmed: 1, waitlisted: 0 }, 'public stats: confirmed and waitlist only');
    const adm = await ev.getEventParticipantStats(e._id, ADMIN);
    assert.strictEqual((adm.counts as Record<string, number>).rejected, 1, 'admin stats keep the breakdown');

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const draft = await seedEvent({ status: 'draft' });
    const hidden = (await upload(draft._id, OUTSIDER, jpeg)) as ServiceError;
    assert.strictEqual(`${hidden.status} ${hidden.code}`, '404 not_found', 'draft media: 404 to a non-admin');
    const denied = (await upload(e._id, OUTSIDER, jpeg)) as ServiceError;
    assert.strictEqual(`${denied.status} ${denied.code}`, '403 forbidden', 'media: non-admin core refused');

    const one = (await upload(e._id, ADMIN, jpeg)) as { status: number; body: { url: string } };
    assert.strictEqual(one.status, 201, 'admin uploads a cover');
    const onDisk = (url: string) => path.join(config.uploadDir, url.slice('/uploads/'.length));
    await fs.access(onDisk(one.body.url));
    const two = (await upload(e._id, ADMIN, jpeg)) as { status: number; body: { url: string } };
    assert.strictEqual((await Event.findById(e._id))!.cover_media_url, two.body.url);
    await assert.rejects(fs.access(onDisk(one.body.url)), 'the replaced cover is deleted');
    await fs.access(onDisk(two.body.url));
    await Event.updateOne({ _id: e._id }, { $set: { logo_url: two.body.url } });
    assert.strictEqual(((await upload(e._id, ADMIN, jpeg)) as { status: number }).status, 201);
    await fs.access(onDisk(two.body.url)); // a replaced cover still shown as the logo is kept

    const past = await seedEvent({ status: 'past' });
    const frozen = (await upload(past._id, ADMIN, jpeg)) as ServiceError;
    assert.strictEqual(`${frozen.status} ${frozen.code}`, '409 event_is_terminal', 'no media on a past event');
}

async function cursorPaging() {
    // Five events, two sharing a start time: every page boundary, tie included, is walked once.
    const starts = [12, 13, 13, 14, 15];
    const seeded = await Promise.all(starts.map((d) => seedEvent({ title: 'Cursor Walk', start_at: at(d), end_at: at(d + 1) })));
    for (const sort of ['date_asc', 'date_desc'] as const) {
        const seen: string[] = [];
        let cursor: string | undefined;
        let pages = 0;
        do {
            const page = await ev.listEvents(QueryEventsSchema.parse({ search: 'Cursor Walk', sort, limit: 2, cursor }));
            seen.push(...page.events.map((x) => x._id));
            cursor = page.next_cursor ?? undefined;
            pages++;
        } while (cursor);
        const dir = sort === 'date_asc' ? 1 : -1;
        const expected = [...seeded]
            .sort((a, b) => dir * (a.start_at.getTime() - b.start_at.getTime()) || (a._id < b._id ? -1 : 1))
            .map((x) => x._id);
        assert.strictEqual(pages, 3, `${sort}: three pages of two`);
        assert.deepStrictEqual(seen, expected, `${sort}: no event skipped or repeated across pages`);
    }
}

async function seatRepair() {
    // A cancellation that already freed the seat never strips a fresh one (an admin re-confirm
    // reserves before it flips the row).
    const e = await seedEvent({ registration: { closes_at: at(5), form_id: 'form-1', max_participants: 10 } });
    await FormSubmission.collection.insertOne({ _id: 'reconfirm' as never, status: 'submitted' });
    await ev.reserveSeat(e._id, 'reconfirm');
    await handleRegistrationCancelled({
        registration_id: 'reconfirm',
        owner: { type: 'event', id: e._id },
        previous_status: 'confirmed',
        freed_seat: true,
    });
    assert.ok((await Event.findById(e._id))!.seat_holders.includes('reconfirm'), 'fresh seat survives a late cancel');
    await handleRegistrationCancelled({
        registration_id: 'reconfirm',
        owner: { type: 'event', id: e._id },
        previous_status: 'waitlisted',
        freed_seat: false,
    });
    assert.ok((await Event.findById(e._id))!.seat_holders.includes('reconfirm'), 'a waitlist exit frees nothing');

    // Past the first hundred capped events: every one is reached, not just a first batch.
    await Event.collection.insertMany(
        Array.from({ length: 100 }, () => randomUUID()).map((id) => ({
            _id: id as never, slug: `sc-${id}`, status: 'upcoming', deleted_at: null, registration: { max_participants: 10 }, seat_holders: ['keep-confirmed'],
        }))
    );

    // The sweep gives back seats held by rows gone or long cancelled/rejected/waitlisted; confirmed,
    // submitted and freshly changed rows keep theirs.
    const old = at(-1);
    const rowsOf: [string, string, Date][] = [
        ['keep-confirmed', 'confirmed', old],
        ['keep-submitted', 'submitted', old],
        ['keep-fresh-cancel', 'cancelled', new Date()],
        ['drop-cancelled', 'cancelled', old],
        ['drop-rejected', 'rejected', old],
        ['drop-waitlisted', 'waitlisted', old],
    ];
    await FormSubmission.collection.insertMany(
        rowsOf.map(([id, status, updated_at]) => ({ _id: id as never, form_id: 'f-seat', user: { user_id: id }, status, updated_at }))
    );
    const holders = ['keep-confirmed', 'keep-submitted', 'keep-fresh-cancel', 'drop-cancelled', 'drop-rejected', 'drop-waitlisted', 'drop-missing'];
    const capped = await seedEvent({ registration: { closes_at: at(5), form_id: 'form-1', max_participants: 10 } });
    await Event.updateOne({ _id: capped._id }, { $set: { seat_holders: holders, 'counts.registrations_confirmed': holders.length } });
    const closed = await seedEvent({ status: 'past', registration: { closes_at: at(5), form_id: 'form-1', max_participants: 10 } });
    await Event.updateOne({ _id: closed._id }, { $set: { seat_holders: ['drop-cancelled'], 'counts.registrations_confirmed': 1 } });

    await reconcileSeats();
    let fresh = (await Event.findById(capped._id))!;
    assert.deepStrictEqual([...fresh.seat_holders], ['keep-confirmed', 'keep-submitted', 'keep-fresh-cancel'], 'stale seats released');
    assert.strictEqual(fresh.counts.registrations_confirmed, 3, 'counter moved with the ledger');
    await reconcileSeats();
    fresh = (await Event.findById(capped._id))!;
    assert.strictEqual(fresh.counts.registrations_confirmed, 3, 'a second run decrements nothing');
    assert.deepStrictEqual([...(await Event.findById(closed._id))!.seat_holders], ['drop-cancelled'], 'past events untouched');

    // A row promoted after the sweep's batch read (reserve first, row flip after) keeps its seat:
    // the row is read again right before its release.
    await FormSubmission.collection.insertOne({ _id: 'race-promoted' as never, form_id: 'f-seat', user: { user_id: 'rp' }, status: 'waitlisted', updated_at: old });
    const racing = await seedEvent({ registration: { closes_at: at(5), form_id: 'form-1', max_participants: 10 } });
    await Event.updateOne({ _id: racing._id }, { $set: { seat_holders: ['race-promoted'], 'counts.registrations_confirmed': 1 } });
    const reread = FormSubmission.findById;
    FormSubmission.findById = function (...args: unknown[]) {
        FormSubmission.findById = reread;
        const q = (reread as (...a: unknown[]) => { exec: (...a: unknown[]) => Promise<unknown> }).apply(FormSubmission, args);
        const exec = q.exec.bind(q);
        q.exec = async (...a: unknown[]) => {
            await FormSubmission.collection.updateOne({ _id: 'race-promoted' as never }, { $set: { status: 'confirmed', updated_at: new Date() } });
            return exec(...a);
        };
        return q;
    } as never;
    try {
        await reconcileSeats();
    } finally {
        FormSubmission.findById = reread;
    }
    assert.deepStrictEqual([...(await Event.findById(racing._id))!.seat_holders], ['race-promoted'], 'a row confirmed mid-sweep keeps its seat');
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
        await lifecycleAndBidGuards();
        await storage();
        await bidding();
        await eventWrites();
        await participantsAndMedia();
        await cursorPaging();
        await seatRepair();
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
