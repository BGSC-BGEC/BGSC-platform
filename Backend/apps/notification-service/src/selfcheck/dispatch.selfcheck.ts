import assert from 'assert';
import {
    Announcement,
    DISPATCH_MAX_ATTEMPTS,
    DISPATCH_RETRYABLE,
    INotificationDispatch,
    NotificationDispatch,
    NotificationRateSlot,
    UserRole,
    config,
    isTerminalDispatch,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { deliverAnnouncement } from '../broadcast/broadcast';
import { attempt, audienceGate, claim, dispatchAnnouncement, nextRetryAt, writeback } from '../broadcast/dispatch';
import { RECONCILE_GRACE_MS, reconcile, retryDue, retryWritebacks, settleAbandoned } from '../scheduler/tick';
import { closeScratchDb, openScratchDb, seedAnnouncement, seedEvent, seedUser } from './seed';

/**
 * Outbound dispatch: the audience gate, the claim, the rate limit, the backoff and the
 * reconciliation sweep.
 *
 * The first block is the one that must never be deleted: a role-gated announcement broadcast to a
 * public WhatsApp group is the worst thing this service can do, and it is one forgotten condition
 * away at all times.
 */

/* ---- provider stub --------------------------------------------------- */

interface SentMessage {
    to: string;
    body: string;
}

const sent: SentMessage[] = [];
/** Status the stubbed provider fails the NEXT send with; 0 = succeed. */
let failNext = 0;
/** Status the stubbed writeback endpoint answers with. 200 unless a case says otherwise. */
let writebackStatus = 200;
/** When set, the stub mutates this dispatch row mid-call — a settle landing during the writeback. */
let raceRowId: string | null = null;
/** The raw body of the most recent writeback, for the PII assertion. */
let lastWriteback = '';

const realFetch = globalThis.fetch;

function stubProvider(): void {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        // The delivery writeback goes to the Announcement Service, which is not running here.
        if (url.includes('/internal/announcements/')) {
            lastWriteback = String(init?.body ?? '');
            // A concurrent `settle` landing while the writeback is in flight: the state the
            // announcement is about to receive is already out of date by the time it arrives.
            if (raceRowId) {
                // Exactly what `settle()` writes, revision bump included — a concurrent settle
                // landing while the writeback is in flight.
                await NotificationDispatch.updateOne(
                    { _id: raceRowId },
                    {
                        $set: { status: 'sent', error: null, next_attempt_at: null, writeback_at: null },
                        $inc: { revision: 1 },
                    }
                );
            }
            return new Response(JSON.stringify({ success: writebackStatus === 200 }), { status: writebackStatus });
        }
        if (failNext) {
            const status = failNext;
            failNext = 0;
            return new Response(JSON.stringify({ error: { message: 'nope' } }), { status });
        }
        const body = JSON.parse(String(init?.body ?? '{}')) as { to: string; text?: { body: string } };
        sent.push({ to: body.to, body: body.text?.body ?? '' });
        return new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }), { status: 200 });
    }) as typeof fetch;
}

function configureWhatsApp(map: Record<string, string>): void {
    config.whatsapp.accessToken = 'test-token';
    config.whatsapp.phoneNumberId = '123456';
    config.whatsapp.groupMap = map;
}

function unconfigureWhatsApp(): void {
    config.whatsapp.accessToken = '';
    config.whatsapp.phoneNumberId = '';
    config.whatsapp.groupMap = {};
}

/** A sweep time past the reconcile grace for anything published now. */
const afterGrace = () => new Date(Date.now() + RECONCILE_GRACE_MS + 1000);

const rowsFor = (announcementId: string) =>
    NotificationDispatch.find({ 'source.id': announcementId }).lean<INotificationDispatch[]>();

async function main(): Promise<void> {
    await openScratchDb();
    stubProvider();

    const author = await seedUser('Author', UserRole.CORE);

    /* ---- the audience gate ---------------------------- */

    configureWhatsApp({ bgec: 'dest-bgec', teams: 'dest-teams' });

    const gated = await seedAnnouncement(author, 'Core only', { categories: ['teams'], min_role: 'core' });
    assert.strictEqual(audienceGate(gated), 'audience_restricted', 'a core-floored announcement is not public');
    await dispatchAnnouncement(gated);

    const gatedRows = (await rowsFor(gated._id)).filter((r) => r.channel === 'whatsapp');
    assert.strictEqual(gatedRows.length, 1, 'a row exists, so the refusal is visible to the composer');
    assert.strictEqual(gatedRows[0].status, 'skipped', 'and it is skipped');
    assert.strictEqual(gatedRows[0].error, 'audience_restricted', 'saying why');
    assert.strictEqual(sent.length, 0, 'NOTHING was sent to a public group');
    console.log('✓ a role-gated announcement is never broadcast to a community group');

    const eventId = await seedEvent('Scoped Event');
    const scoped = await seedAnnouncement(author, 'Registrants only', { event_id: eventId });
    assert.strictEqual(audienceGate(scoped), 'audience_scoped', 'an event-scoped one is not public either');
    await dispatchAnnouncement(scoped);
    assert.strictEqual(sent.length, 0, 'still nothing sent');
    console.log('✓ an event-scoped announcement is never broadcast either');

    // A `user` floor hides the announcement from logged-out readers in the app, so it is not public.
    const signedIn = await seedAnnouncement(author, 'Signed-in only', { min_role: 'user' });
    assert.strictEqual(audienceGate(signedIn), 'audience_restricted', "a 'user' floor is not public");
    const open = await seedAnnouncement(author, 'Public', { min_role: 'guest' });
    assert.strictEqual(audienceGate(open), null, "only a 'guest' floor is public");
    console.log('✓ the gate stops exactly at the first non-public rank');

    /* ---- the claim ------------------------------------------------------ */

    const first = await claim(open._id, 'whatsapp', 'bgec', 'dest-bgec');
    assert.ok(first, 'the first claim wins');
    const second = await claim(open._id, 'whatsapp', 'bgec', 'dest-bgec');
    assert.strictEqual(second, null, 'the second collides on the unique index and does nothing');
    assert.strictEqual(first!.status, 'pending', 'a fresh claim is pending');
    assert.ok(first!.next_attempt_at !== null, 'and carries a retry date, or the sweep would never see it');
    console.log('✓ a send is claimed exactly once, whoever asks');

    /* ---- unmapped and unconfigured ------------------------------------- */

    const unmapped = await seedAnnouncement(author, 'Unmapped tag', { categories: ['deuce'] });
    await dispatchAnnouncement(unmapped);
    const unmappedRow = (await rowsFor(unmapped._id)).find((r) => r.channel === 'whatsapp')!;
    assert.strictEqual(unmappedRow.status, 'skipped', 'an unmapped category is skipped');
    assert.strictEqual(unmappedRow.error, 'no_group_mapped', 'and says so, which is the actionable part');

    const before = sent.length;
    unconfigureWhatsApp();
    const unconfigured = await seedAnnouncement(author, 'No credentials');
    await dispatchAnnouncement(unconfigured);
    const unconfiguredRow = (await rowsFor(unconfigured._id)).find((r) => r.channel === 'whatsapp')!;
    assert.strictEqual(unconfiguredRow.status, 'skipped', 'no credentials means skipped');
    assert.strictEqual(unconfiguredRow.error, 'not_configured', 'with the reason');
    assert.strictEqual(sent.length, before, 'and no HTTP call was attempted at all');
    console.log('✓ unmapped and unconfigured degrade to skipped without touching the network');

    /* ---- push ------------------------------------------------------------ */

    const pushRow = (await rowsFor(unconfigured._id)).find((r) => r.channel === 'push')!;
    assert.strictEqual(pushRow.status, 'skipped', 'push resolves rather than staying pending forever');
    assert.strictEqual(pushRow.error, 'push_not_configured', 'honestly');
    assert.strictEqual(pushRow.next_attempt_at, null, 'and terminal rows carry no retry date');
    console.log('✓ push resolves to skipped instead of reading as "still trying"');

    /* ---- a real send ----------------------------------------------------- */

    configureWhatsApp({ bgec: 'dest-bgec', fitsoc: 'dest-fitsoc', airball: 'dest-airball' });

    const live = await seedAnnouncement(author, 'Go time', { body: 'Body of it.' });
    await dispatchAnnouncement(live);
    const liveRow = (await rowsFor(live._id)).find((r) => r.channel === 'whatsapp')!;
    assert.strictEqual(liveRow.status, 'sent', 'a configured, mapped, public announcement is sent');
    assert.strictEqual(liveRow.destination, 'dest-bgec', 'to the mapped destination');
    assert.ok(liveRow.provider_message_id?.startsWith('wamid.'), 'recording the provider message id');
    assert.ok(liveRow.attempted_at !== null, 'and when it happened, which the rate limiter reads');
    assert.strictEqual(liveRow.next_attempt_at, null, 'terminal, so no retry date');
    assert.ok(sent[sent.length - 1].body.includes('Go time'), 'the message carries the title');
    assert.ok(sent[sent.length - 1].body.includes('Body of it.'), 'and the body');
    assert.ok(!lastWriteback.includes('dest-bgec'), 'the destination (PII) never reaches the announcement');
    assert.ok(lastWriteback.includes('••••bgec'), 'only a masked label does');
    assert.ok(/"revision":\d+/.test(lastWriteback), 'with the row revision, so a stale receipt can be refused');
    console.log('✓ a public announcement reaches its mapped destination, once');

    /* ---- the rate limit (Spec §9.4) -------------------------------------- */

    const sentBefore = sent.length;
    const second_bgec = await seedAnnouncement(author, 'Too soon');
    await dispatchAnnouncement(second_bgec);
    const limited = (await rowsFor(second_bgec._id)).find((r) => r.channel === 'whatsapp')!;
    assert.strictEqual(limited.status, 'rate_limited', 'a second send in the same tag inside the hour is held');
    assert.strictEqual(sent.length, sentBefore, 'and nothing went out');
    assert.ok(limited.next_attempt_at !== null, 'it is retryable');
    const waitMs = limited.next_attempt_at!.getTime() - Date.now();
    assert.ok(waitMs > 3_500_000 && waitMs <= 3_600_000, 'waiting for the hour to clear, not the backoff');
    assert.strictEqual(limited.attempts, 0, 'and the attempt it did not spend is given back');
    console.log('✓ one message per tag per hour, without burning the retry budget');

    // Two announcements in one tag dispatched AT ONCE (two scheduled for the same minute): the old
    // check counted `sent` rows, saw zero twice, and sent twice.
    const burstSent = sent.length;
    const [burstA, burstB] = await Promise.all([
        seedAnnouncement(author, 'Burst A', { categories: ['airball'] }),
        seedAnnouncement(author, 'Burst B', { categories: ['airball'] }),
    ]);
    await Promise.all([dispatchAnnouncement(burstA), dispatchAnnouncement(burstB)]);
    assert.strictEqual(sent.length - burstSent, 1, 'concurrent sends in one tag still produce ONE message');
    const burstStatuses = [
        ...(await rowsFor(burstA._id)),
        ...(await rowsFor(burstB._id)),
    ].filter((r) => r.channel === 'whatsapp').map((r) => r.status).sort();
    assert.deepStrictEqual(burstStatuses, ['rate_limited', 'sent'], 'the other one waits for the hour');
    console.log('✓ the per-tag limit is atomic under concurrency');

    // A different tag is a different bucket.
    const otherTag = await seedAnnouncement(author, 'Other tag', { categories: ['fitsoc'] });
    await dispatchAnnouncement(otherTag);
    const otherRow = (await rowsFor(otherTag._id)).find((r) => r.channel === 'whatsapp')!;
    assert.strictEqual(otherRow.status, 'sent', 'a different category is not rate limited');
    console.log('✓ the limit is per tag, not global');

    /* ---- failure, backoff and the attempt cap ---------------------------- */

    assert.ok(
        nextRetryAt(1, new Date(0)).getTime() === 120_000 && nextRetryAt(2, new Date(0)).getTime() === 240_000,
        'backoff doubles: 2, 4, 8, 16, 32 minutes'
    );

    const failing = await seedAnnouncement(author, 'Provider is down', { categories: ['fitsoc'] });
    const failRow = await claim(failing._id, 'whatsapp', 'fitsoc', 'dest-fitsoc');
    // A 4xx is the provider refusing: certainly not sent, so it is retryable.
    failNext = 400;
    // Clear the fitsoc rate-limit window so the failure is the provider's, not the limiter's.
    await NotificationRateSlot.deleteOne({ _id: 'whatsapp:fitsoc' });
    await attempt(failRow!);
    const failed = await NotificationDispatch.findById(failRow!._id).lean<INotificationDispatch>();
    assert.strictEqual(failed!.status, 'failed', 'a provider refusal is a failure');
    const fitsocSlot = await NotificationRateSlot.findById('whatsapp:fitsoc').lean<{ sends: Date[] }>();
    assert.strictEqual(fitsocSlot?.sends.length ?? 0, 0, 'and a send that never happened gives its slot back');
    assert.strictEqual(failed!.attempts, 1, 'which spent an attempt');
    assert.ok(failed!.error?.includes('400'), 'recording the status');
    assert.ok(!failed!.error?.includes('test-token'), 'and never the access token');
    assert.ok(failed!.next_attempt_at !== null, 'retryable, with a date the sweep can see');

    // A 5xx (or a timeout) says nothing about whether the message went out. Retrying could post it
    // to the group twice, so the row closes as outcome_unknown and the slot stays spent.
    const maybeSent = await seedAnnouncement(author, 'Maybe sent', { categories: ['fitsoc'] });
    const maybeRow = await claim(maybeSent._id, 'whatsapp', 'fitsoc', 'dest-fitsoc');
    await NotificationRateSlot.deleteOne({ _id: 'whatsapp:fitsoc' });
    failNext = 500;
    await attempt(maybeRow!);
    const unknown = await NotificationDispatch.findById(maybeRow!._id).lean<INotificationDispatch>();
    assert.strictEqual(unknown!.status, 'outcome_unknown', 'a 5xx is an unknown outcome, not a failure');
    assert.strictEqual(unknown!.next_attempt_at, null, 'terminal: never retried');
    const keptSlot = await NotificationRateSlot.findById('whatsapp:fitsoc').lean<{ sends: Date[] }>();
    assert.strictEqual(keptSlot?.sends.length, 1, 'and the slot stays spent — it may be in the group');

    // Died between the provider call and the settle: `sending_at` is set, the lease lapses. The
    // retry claim refuses it and the abandon sweep closes it — it is never sent a second time.
    const midSend = await seedAnnouncement(author, 'Died mid-send', { categories: ['deuce'] });
    const midRow = await claim(midSend._id, 'whatsapp', 'deuce', 'dest-x');
    await NotificationDispatch.updateOne(
        { _id: midRow!._id },
        { $set: { sending_at: new Date(), attempts: 1, next_attempt_at: new Date(0) } }
    );
    const beforeMid = sent.length;
    await attempt((await NotificationDispatch.findById(midRow!._id))!);
    assert.strictEqual(sent.length, beforeMid, 'a row marked in flight is never re-attempted');
    await settleAbandoned();
    const closedMid = await NotificationDispatch.findById(midRow!._id).lean<INotificationDispatch>();
    assert.strictEqual(closedMid!.status, 'outcome_unknown', 'it is closed as outcome_unknown');
    assert.strictEqual(closedMid!.sending_at, null, 'and the in-flight mark is cleared');
    await NotificationRateSlot.deleteOne({ _id: 'whatsapp:fitsoc' });

    await NotificationDispatch.updateOne(
        { _id: failRow!._id },
        { $set: { attempts: DISPATCH_MAX_ATTEMPTS, next_attempt_at: new Date(0) } }
    );
    const exhausted = await NotificationDispatch.findById(failRow!._id);
    await attempt(exhausted!);
    const stillFailed = await NotificationDispatch.findById(failRow!._id).lean<INotificationDispatch>();
    assert.strictEqual(stillFailed!.attempts, DISPATCH_MAX_ATTEMPTS, 'an exhausted row is left alone');

    // Asserted as the sweep's own query rather than as "the sweep did nothing": other rows are
    // legitimately due (a claim that was never attempted is exactly what the sweep exists for), so
    // a count of zero would be testing the fixture, not the cap.
    const due = await NotificationDispatch.distinct('_id', {
        status: { $in: DISPATCH_RETRYABLE },
        attempts: { $lt: DISPATCH_MAX_ATTEMPTS },
        next_attempt_at: { $lte: new Date() },
    });
    assert.ok(!due.includes(failRow!._id), 'and the sweep never picks it up again');
    // A claim that crashed before its first attempt IS due, and must be: that is the row the sweep
    // was written for.
    assert.ok(due.includes(first!._id), 'while an unattempted claim is still due');

    // A FIFTH attempt that died mid-flight: `pending`, out of attempts, lease lapsed. The retry sweep
    // stops at the cap, so without settleAbandoned it would read "still trying" forever.
    const crashedOn = await seedAnnouncement(author, 'Crashed on the fifth', { categories: ['deuce'] });
    const crashed = await claim(crashedOn._id, 'whatsapp', 'deuce', null);
    await NotificationDispatch.updateOne(
        { _id: crashed!._id },
        { $set: { attempts: DISPATCH_MAX_ATTEMPTS, next_attempt_at: new Date(0) } }
    );
    assert.ok((await settleAbandoned()) >= 1, 'the abandoned final attempt is found');
    const closed = await NotificationDispatch.findById(crashed!._id).lean<INotificationDispatch>();
    assert.strictEqual(closed!.status, 'failed', 'and closed out as failed, not left pending');
    assert.strictEqual(closed!.writeback_at, null, 'queued so the composer hears about it');

    // One attempt that throws must not abandon the rest of the sweep.
    const throwsOnce = await seedAnnouncement(author, 'Throws once', { categories: ['deuce', 'highlight'] });
    const [t1, t2] = await Promise.all([
        claim(throwsOnce._id, 'whatsapp', 'deuce', null),
        claim(throwsOnce._id, 'whatsapp', 'highlight', null),
    ]);
    await NotificationDispatch.updateMany({ _id: { $in: [t1!._id, t2!._id] } }, { $set: { next_attempt_at: new Date(0) } });
    const realFindById = Announcement.findById.bind(Announcement);
    (Announcement as unknown as { findById: unknown }).findById = () => {
        (Announcement as unknown as { findById: unknown }).findById = realFindById;
        return Promise.reject(new Error('transient'));
    };
    await retryDue();
    const afterThrow = await NotificationDispatch.find({ _id: { $in: [t1!._id, t2!._id] } }).lean<INotificationDispatch[]>();
    assert.ok(afterThrow.some((r) => r.status === 'skipped'), 'the row after the one that threw was still attempted');
    console.log('✓ failures back off, and stop after five attempts');

    /* ---- the invariant every sweep depends on ---------------------------- */

    const all = await NotificationDispatch.find().lean<INotificationDispatch[]>();
    for (const row of all) {
        const terminal = isTerminalDispatch(row.status);
        assert.strictEqual(
            row.next_attempt_at === null,
            terminal,
            `next_attempt_at must be null exactly when terminal (row ${row._id}, status ${row.status})`
        );
    }
    console.log('✓ every row in the ledger holds the terminal/retryable invariant');

    /* ---- reconciliation --------------------------------------- */

    const missed = await seedAnnouncement(author, 'Published during an outage', { categories: ['fitsoc'] });
    assert.strictEqual((await rowsFor(missed._id)).length, 0, 'nobody heard the event');

    assert.strictEqual(await reconcile(new Date()), 0, 'a publish whose fan-out may still be running is left alone');
    const reconciled = await reconcile(afterGrace());
    assert.ok(reconciled >= 1, 'the sweep notices an announcement with no dispatch rows');
    assert.ok((await rowsFor(missed._id)).length > 0, 'and delivers it');

    const again = await reconcile(afterGrace());
    assert.strictEqual(again, 0, 'and a second pass finds nothing to do');
    console.log('✓ a broadcast lost to a bus outage still goes out, exactly once');

    // A crash PART WAY through dispatch leaves rows behind, so "has any rows" would call this one
    // done and the second community group would never hear about it.
    const halfDone = await seedAnnouncement(author, 'Crashed mid-dispatch', { categories: ['bgec', 'fitsoc'] });
    await claim(halfDone._id, 'whatsapp', 'bgec', 'dest-bgec');
    assert.strictEqual((await rowsFor(halfDone._id)).length, 1, 'one category claimed, then the process died');

    assert.strictEqual(await reconcile(afterGrace()), 1, 'reconciliation notices the missing rows');
    const repaired = await rowsFor(halfDone._id);
    assert.strictEqual(repaired.length, 3, 'and fills in the second category and the push row');
    assert.deepStrictEqual(
        repaired
            .filter((r) => r.channel === 'whatsapp')
            .map((r) => r.category)
            .sort(),
        ['bgec', 'fitsoc'],
        'one row per tagged category, no duplicates'
    );
    console.log('✓ a dispatch that died half way through is completed, not counted as done');

    // More complete publishes in the window than one sweep page: they must not crowd out a lost
    // one. The first version capped the candidate page (unsorted) before checking completeness.
    for (let i = 0; i < 55; i += 1) {
        const done = await seedAnnouncement(author, `Complete ${i}`, { categories: ['deuce'] });
        await NotificationDispatch.insertMany(
            (['whatsapp', 'push'] as const).map((channel) => ({
                _id: uuid(),
                channel,
                source: { type: 'announcement', id: done._id },
                category: channel === 'whatsapp' ? 'deuce' : null,
                status: 'skipped',
                next_attempt_at: null,
                writeback_at: new Date(),
            }))
        );
    }
    const lostInCrowd = await seedAnnouncement(author, 'Lost behind a full page', { categories: ['deuce'] });
    assert.strictEqual(await reconcile(afterGrace()), 1, 'exactly the incomplete one is delivered');
    assert.ok((await rowsFor(lostInCrowd._id)).length > 0, 'even behind more than a page of complete ones');
    console.log('✓ reconciliation pages past complete announcements');

    /* ---- writeback: retryable vs permanent ------------------------------- */

    const retryable = await seedAnnouncement(author, 'Writeback retryable', { categories: ['deuce'] });
    await dispatchAnnouncement(retryable);
    assert.ok(
        (await rowsFor(retryable._id)).every((r) => r.writeback_at !== null),
        'a 200 writeback stamps every row'
    );

    writebackStatus = 503;
    await NotificationDispatch.updateMany({ 'source.id': retryable._id }, { $set: { writeback_at: null } });
    assert.strictEqual(await writeback(retryable._id), false, 'a 5xx writeback does not succeed');
    assert.ok(
        (await rowsFor(retryable._id)).every((r) => r.writeback_at === null),
        'and leaves the rows for the next tick — the service may simply be restarting'
    );

    // A wrong token (401) or a contract drift (422) is fixed by a deploy; stamping those rows would
    // lose the receipt for good. Retried.
    for (const status of [401, 422]) {
        writebackStatus = status;
        await writeback(retryable._id);
        assert.ok(
            (await rowsFor(retryable._id)).every((r) => r.writeback_at === null),
            `a ${status} writeback is retried, not given up on`
        );
    }

    // 404/409 can never land: the announcement is gone or unpublished. Without this, the bounded
    // writeback sweep re-reads the same doomed rows every 60 seconds forever and starves the rows
    // that could still be written.
    writebackStatus = 404;
    assert.strictEqual(await writeback(retryable._id), false, 'a 404 writeback still reports failure');
    assert.ok(
        (await rowsFor(retryable._id)).every((r) => r.writeback_at !== null),
        'but stamps the rows so the sweep gives up on them'
    );
    const stillStale = await NotificationDispatch.countDocuments({
        'source.id': retryable._id,
        writeback_at: null,
    });
    assert.strictEqual(stillStale, 0, 'nothing doomed is left in the sweep queue');
    writebackStatus = 200;
    console.log('✓ writeback retries what may recover and gives up on what cannot');

    /* ---- a row that moves during the writeback is not marked written ------- */

    const raced = await seedAnnouncement(author, 'Writeback race', { categories: ['deuce'] });
    await dispatchAnnouncement(raced);
    const racedRow = (await rowsFor(raced._id)).find((r) => r.channel === 'whatsapp')!;

    await NotificationDispatch.updateMany({ 'source.id': raced._id }, { $set: { writeback_at: null } });
    raceRowId = racedRow._id;
    await writeback(raced._id);
    raceRowId = null;

    const after = await rowsFor(raced._id);
    const racedAfter = after.find((r) => r._id === racedRow._id)!;
    assert.strictEqual(racedAfter.status, 'sent', 'the row moved on while the writeback was in flight');
    assert.strictEqual(
        racedAfter.writeback_at,
        null,
        'so it is NOT marked written back — what reached the announcement was its previous state'
    );
    assert.ok(
        after.filter((r) => r._id !== racedRow._id).every((r) => r.writeback_at !== null),
        'while every row that did not move is stamped normally'
    );
    console.log('✓ a writeback only stamps the rows whose state it actually reported');

    /* ---- the writeback sweep rotates past rows that keep failing ---------- */

    // More stuck rows than one sweep page, all answering `retry`. Unsorted, the same page came back
    // every tick; least-recently-tried first, the second tick reaches the rest.
    await NotificationDispatch.updateMany({}, { $set: { writeback_at: new Date() } });
    const stuck: string[] = [];
    for (let i = 0; i < 60; i += 1) {
        const a = await seedAnnouncement(author, `Stuck ${i}`, { categories: ['deuce'] });
        await NotificationDispatch.create({
            _id: uuid(),
            channel: 'push',
            source: { type: 'announcement', id: a._id },
            status: 'skipped',
            next_attempt_at: null,
            writeback_at: null,
        });
        stuck.push(a._id);
    }
    writebackStatus = 503;
    await retryWritebacks(new Date('2026-09-26T10:00:00Z'));
    await retryWritebacks(new Date('2026-09-26T10:01:00Z'));
    writebackStatus = 200;
    assert.strictEqual(
        await NotificationDispatch.countDocuments({ 'source.id': { $in: stuck }, writeback_tried_at: null }),
        0,
        'two ticks of a 50-row page have tried all 60 rows'
    );
    assert.strictEqual(await retryWritebacks(), 50, 'and once the receiver is back, a page lands per tick');
    assert.strictEqual(await retryWritebacks(), 10, 'the rest on the next');
    console.log('✓ the writeback sweep rotates instead of retrying the same page forever');

    /* ---- delivered announcements are never re-broadcast ------------------- */

    const sentCount = sent.length;
    await deliverAnnouncement(live._id);
    assert.strictEqual(sent.length, sentCount, 'replaying a delivered announcement sends nothing more');
    console.log('✓ a replay never sends a second message');

    globalThis.fetch = realFetch;
    await closeScratchDb();
    console.log('\ndispatch selfcheck: all checks passed');
}

main().catch(async (err) => {
    globalThis.fetch = realFetch;
    console.error('dispatch selfcheck failed:', err);
    await closeScratchDb().catch(() => undefined);
    process.exit(1);
});
