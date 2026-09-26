import {
    ARCHIVE_MONTHS,
    Announcement,
    Event,
    UserRole,
    addMonthsUTC,
    expiryFor,
    resetBus,
    subscribe,
} from '@bgsc/shared';
import assert from 'assert';
import { v4 as uuid } from 'uuid';
import { Viewer } from '../announcements/audience';
import * as svc from '../announcements/announcement.service';
import type { Editor } from '../announcements/announcement.service';
import { tick } from '../scheduler/tick';
import { closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * Lifecycle selfcheck — publish, schedule, the invariant traps, and the scheduler.
 *
 * Every case here is one the model's own selfcheck cannot reach: they all involve a service-layer
 * refusal that has to happen *before* .save(), or a query update that bypasses the invariant hook.
 *
 * Run: npx ts-node apps/announcement-service/src/selfcheck/lifecycle.selfcheck.ts
 */

const MONTH_MS = 31 * 86_400_000;
const viewerOf = (role: string): Viewer => ({ id: null, role, confirmed_event_ids: [] } as Viewer);

async function main(): Promise<void> {
    await openScratchDb();

    const author = await seedUser('Selfcheck Coordinator', UserRole.COORDINATOR);
    const ACTOR: Editor = { id: author._id, ip: null, role: 'coordinator' };

    const draft = (over: Record<string, unknown> = {}) =>
        svc.create(
            {
                title: 'Selfcheck',
                body: 'body',
                categories: ['bgec'],
                ...over,
            } as never,
            author,
            ACTOR
        );

    const raw = (over: Record<string, unknown>) =>
        Announcement.create({
            _id: uuid(),
            title: 'Selfcheck',
            body: 'body',
            categories: ['bgec'],
            author: { user_id: author._id, display_name: 'C', role_label: 'Coordinator' },
            ...over,
        });

    /* ---- 1. publish derives, and refuses a past schedule ---------------- */
    console.log('1. Publish and schedule...');
    const published = await svc.publishOrSchedule((await draft())._id, undefined, ACTOR);
    assert.strictEqual(published.status, 'published');
    assert(published.published_at, 'publish sets published_at');
    assert.strictEqual(
        published.expires_at!.getTime(),
        expiryFor(published.published_at!).getTime(),
        'and expires_at is derived as published_at + 4 months'
    );

    // Spec §6.4: WhatsApp auto-sends on publish. The broadcast reads this flag; nothing else sets it.
    assert.strictEqual(published.delivery.whatsapp.requested, true, 'publish asks for WhatsApp delivery');
    assert.strictEqual(published.delivery.push.requested, true, 'and push');

    await assert.rejects(
        () => svc.publishOrSchedule(published._id, undefined, ACTOR),
        /already_published/,
        'a second publish is refused'
    );

    const forSchedule = await draft();
    await assert.rejects(
        () => svc.publishOrSchedule(forSchedule._id, new Date(Date.now() - 1000), ACTOR),
        /scheduled_for_must_be_future/,
        'a past scheduled_for is refused rather than published a minute later'
    );
    console.log('✓ publish derives and a past schedule is refused');

    /* ---- 2. the unschedule invariant trap ------------------------------- */
    console.log('2. Unschedule...');
    const scheduled = await svc.publishOrSchedule(forSchedule._id, new Date(Date.now() + 86_400_000), ACTOR);
    assert.strictEqual(scheduled.status, 'scheduled');

    const neverScheduled = await draft();
    await assert.rejects(
        () => svc.unschedule(neverScheduled._id, ACTOR),
        /not_scheduled/,
        'unscheduling something that was never scheduled is refused'
    );

    const unscheduled = await svc.unschedule(scheduled._id, ACTOR);
    assert.strictEqual(unscheduled.status, 'draft');
    assert.strictEqual(unscheduled.scheduled_for, null, 'unschedule must null scheduled_for');

    // The trap: leaving scheduled_for behind makes every later save throw, as a 500.
    unscheduled.title = 'Edited after unschedule';
    await unscheduled.save();
    console.log('✓ an unscheduled draft still saves');

    /* ---- 2a. reschedule without an unschedule round-trip ---------------- */
    console.log('2a. Reschedule...');
    const later = new Date(Date.now() + 2 * 86_400_000);
    const rescheduled = await svc.publishOrSchedule(
        (await svc.publishOrSchedule(unscheduled._id, new Date(Date.now() + 86_400_000), ACTOR))._id,
        later,
        ACTOR
    );
    assert.strictEqual(rescheduled.status, 'scheduled', 'a scheduled announcement can be moved');
    assert.strictEqual(rescheduled.scheduled_for!.getTime(), later.getTime(), 'to the new time');
    await svc.unschedule(rescheduled._id, ACTOR);
    console.log('✓ scheduled → scheduled is a reschedule, not a 409');

    /* ---- 2b. an announcement cannot be scoped to an event that does not exist ---- */
    console.log('2b. Event scoping guard...');
    await assert.rejects(
        () =>
            svc.create(
                { title: 'x', body: 'y', categories: ['bgec'], audience: { event_id: uuid() } } as never,
                author,
                ACTOR
            ),
        /event_not_found/,
        'an unknown event_id is refused at create'
    );
    console.log('✓ audience.event_id is validated against events');

    /* ---- 3. categories freeze after publish ----------------------------- */
    console.log('3. Edit freeze...');
    await assert.rejects(
        () => svc.update(published._id, { categories: ['fitsoc'] }, ACTOR),
        /categories_frozen_after_publish/,
        'categories are frozen once published'
    );
    const retitled = await svc.update(published._id, { title: 'New title' }, ACTOR);
    assert.strictEqual(retitled.title, 'New title', 'but the title is still editable');
    console.log('✓ categories freeze, copy does not');

    /* ---- 3b. an edit checked against 'draft' cannot land on a published doc ---- */
    console.log('3b. Update vs publish race...');
    const racing = await draft();
    const eventId = uuid();
    // Deterministic interleave: update() checks the freeze, then awaits the event lookup. Publishing
    // inside that await is exactly a Publish click landing mid-edit.
    const realExists = Event.exists.bind(Event);
    (Event as unknown as { exists: () => Promise<unknown> }).exists = async () => {
        await svc.publishOrSchedule(racing._id, undefined, ACTOR);
        return { _id: eventId };
    };
    try {
        await assert.rejects(
            () => svc.update(racing._id, { categories: ['fitsoc'], audience: { event_id: eventId } }, ACTOR),
            /announcement_changed/,
            'the save is conditional on the status the guards saw'
        );
    } finally {
        (Event as unknown as { exists: typeof realExists }).exists = realExists;
    }
    const afterRace = await Announcement.findById(racing._id);
    assert.deepStrictEqual([...afterRace!.categories], ['bgec'], 'the published categories are untouched');
    console.log('✓ a mid-edit publish turns the edit into a 409, not a post-publish category change');

    /* ---- 4. pinned_until: null expires_at hides it until publish -------- */
    console.log('4. Pinned window...');
    const pinned = await draft({ pinned_until: new Date(Date.now() + 365 * 86_400_000) });
    await assert.rejects(
        () => svc.publishOrSchedule(pinned._id, undefined, ACTOR),
        /pinned_until_after_expiry/,
        'a pin outlasting the derived expiry is refused 422 at publish, not 500'
    );
    // The scheduler publishes through findOneAndUpdate, which runs no validation at all — so a
    // pin edited onto a scheduled announcement has to be refused here or never.
    const laterPinned = await draft();
    await svc.publishOrSchedule(laterPinned._id, new Date(Date.now() + 86_400_000), ACTOR);
    await assert.rejects(
        () => svc.update(laterPinned._id, { pinned_until: new Date(Date.now() + 3650 * 86_400_000) }, ACTOR),
        /pinned_until_after_expiry/,
        'a pin edited onto a scheduled announcement is bounded by its scheduled publish time'
    );
    console.log('✓ the pin window is checked where it first becomes checkable');

    /* ---- 5. admin sees its own draft, a user does not ------------------- */
    console.log('5. Draft visibility...');
    const hidden = await draft();
    const asAdmin = await svc.get(hidden._id, viewerOf('coordinator'), true);
    assert.strictEqual(asAdmin._id, hidden._id, 'core+ can open its own draft');
    await assert.rejects(
        () => svc.get(hidden._id, viewerOf('user'), false),
        /announcement_not_found/,
        'a user gets 404 on the same id'
    );
    console.log('✓ the composer can read its drafts, nobody else can');

    /* ---- 6. the scheduler claims exactly once --------------------------- */
    console.log('6. Scheduler claim...');
    const due = await raw({ status: 'scheduled', scheduled_for: new Date(Date.now() - 1000) });
    const [a, b] = await Promise.all([tick(), tick()]);
    assert.strictEqual(a.published + b.published, 1, 'two concurrent ticks publish it exactly once');

    const claimed = await Announcement.findById(due._id);
    assert.strictEqual(claimed!.status, 'published');
    assert.strictEqual(
        claimed!.expires_at!.getTime(),
        expiryFor(claimed!.published_at!).getTime(),
        'and the CAS path wrote expires_at itself — pre(validate) never ran'
    );
    assert.strictEqual(claimed!.delivery.whatsapp.requested, true, 'the tick asks for delivery too');
    assert.strictEqual(claimed!.pinned_until, null, 'and an unpinned announcement stays unpinned');
    console.log('✓ compare-and-swap, and the hook bypass is handled');

    /* ---- 6a. month arithmetic and the scheduler's pin cap ---------------- */
    console.log('6a. Month ends...');
    const utc = (iso: string) => new Date(iso).getTime();
    assert.strictEqual(expiryFor(new Date('2026-10-31T23:59:00Z')).getTime(), utc('2027-02-28T23:59:00Z'), 'Oct 31 + 4 months clamps to Feb 28, not Mar 3');
    assert.strictEqual(expiryFor(new Date('2027-10-31T12:00:00Z')).getTime(), utc('2028-02-29T12:00:00Z'), 'and to Feb 29 in a leap year');
    assert.strictEqual(expiryFor(new Date('2026-11-01T00:00:00Z')).getTime(), utc('2027-03-01T00:00:00Z'), 'Nov 1 is Mar 1');
    assert.ok(
        expiryFor(new Date('2026-10-31T23:59:00Z')) < expiryFor(new Date('2026-11-01T00:00:00Z')),
        'so a later publish across a month end no longer expires earlier'
    );
    assert.strictEqual(addMonthsUTC(new Date('2026-03-31T05:00:00Z'), -1).getTime(), utc('2026-02-28T05:00:00Z'), 'backwards clamps too');
    // The same instant must expire at the same instant on an IST host and in a UTC container.
    const tzBefore = process.env.TZ;
    const edge = new Date('2026-10-31T20:00:00Z'); // already Nov 1 in IST
    process.env.TZ = 'Asia/Kolkata';
    const inIst = expiryFor(edge).getTime();
    process.env.TZ = 'UTC';
    const inUtc = expiryFor(edge).getTime();
    if (tzBefore === undefined) delete process.env.TZ;
    else process.env.TZ = tzBefore;
    assert.strictEqual(inIst, inUtc, 'expiry does not depend on the host time zone');

    // Scheduled at Oct 30 23:00 with a pin at that schedule's expiry; the tick only gets to it at
    // Oct 31 01:00, whose clamped expiry is earlier. The claim is a query update — no hook — so the
    // pipeline has to cap the pin, or pinned_until > expires_at lands on disk.
    const lateNow = new Date('2026-10-31T01:00:00Z');
    const lateDue = await raw({
        status: 'scheduled',
        scheduled_for: new Date('2026-10-30T23:00:00Z'),
        pinned_until: expiryFor(new Date('2026-10-30T23:00:00Z')),
    });
    await tick(lateNow);
    const capped = await Announcement.findById(lateDue._id);
    assert.strictEqual(capped!.status, 'published');
    assert.strictEqual(capped!.expires_at!.getTime(), expiryFor(lateNow).getTime());
    assert.strictEqual(capped!.pinned_until!.getTime(), capped!.expires_at!.getTime(), 'the pin is capped at the new expiry');
    capped!.title = 'Still saves';
    await capped!.save();
    console.log('✓ months are UTC and clamped; the scheduler cannot store a pin past expiry');

    /* ---- 6b. concurrent HTTP transitions emit one event apiece ---------- */
    console.log('6b. Transition races...');
    resetBus();

    let publishedEvents = 0;
    subscribe('AnnouncementPublished', () => {
        publishedEvents += 1;
    });

    // A double-clicked Publish button. Read-then-write lets both requests through, and each emits
    // its own AnnouncementPublished — which the broadcast turns into two WhatsApp sends to every
    // mapped group, the exact thing Spec §9.4's rate limit exists to stop.
    const racedPublish = await draft();
    const publishResults = await Promise.allSettled([
        svc.publishOrSchedule(racedPublish._id, undefined, ACTOR),
        svc.publishOrSchedule(racedPublish._id, undefined, ACTOR),
    ]);
    assert.strictEqual(
        publishResults.filter((r) => r.status === 'fulfilled').length,
        1,
        'only one of two concurrent publishes succeeds'
    );
    assert.strictEqual(publishedEvents, 1, 'and exactly one AnnouncementPublished is emitted');

    let deletedEvents = 0;
    subscribe('AnnouncementDeleted', () => {
        deletedEvents += 1;
    });

    const racedDelete = await draft();
    await Promise.allSettled([
        svc.remove(racedDelete._id, ACTOR),
        svc.remove(racedDelete._id, ACTOR),
    ]);
    assert.strictEqual(deletedEvents, 1, 'a doubled delete emits one AnnouncementDeleted');
    console.log('✓ publish and delete are compare-and-swap, not read-then-write');

    /* ---- 7. archive and purge ------------------------------------------- */
    console.log('7. Retention...');
    const stale = await raw({ status: 'published', published_at: new Date(Date.now() - 5 * MONTH_MS) });
    const ancient = await raw({
        status: 'archived',
        published_at: new Date(Date.now() - (4 + ARCHIVE_MONTHS + 2) * MONTH_MS),
    });

    const result = await tick();
    assert(result.archived >= 1, 'a published announcement past expires_at is archived');
    assert.strictEqual((await Announcement.findById(stale._id))!.status, 'archived');

    assert(result.purged >= 1, 'an archived announcement past its year is deleted');
    assert.strictEqual(await Announcement.findById(ancient._id), null);

    // A deleted draft never gets an expires_at, so only the deleted_at horizon can reach it.
    const deletedLongAgo = await raw({ deleted_at: new Date(Date.now() - (4 + ARCHIVE_MONTHS + 1) * MONTH_MS) });
    const deletedRecently = await raw({ deleted_at: new Date(Date.now() - MONTH_MS) });
    await tick();
    assert.strictEqual(await Announcement.findById(deletedLongAgo._id), null, 'a year-old deleted draft is purged');
    assert(await Announcement.findById(deletedRecently._id), 'a recently deleted one is kept');
    console.log('✓ 4 months to archived, a year to gone');

    /* ---- 8. tags, and the pin race -------------------------------------- */
    console.log('8. Tags and the pin race...');
    const tagged = await draft({ tags: ['Finals', ' MIXED '] });
    assert.deepStrictEqual([...tagged.tags], ['finals', 'mixed'], 'tags are stored lowercased and trimmed');

    // A PATCH of pinned_until landing between publish's load and its claim. Simulated by moving the
    // pin the moment the load resolves: the load passes the assert, the claim must still refuse.
    const racy = await draft();
    const far = new Date(Date.now() + 12 * MONTH_MS);
    const realFindOne = Announcement.findOne.bind(Announcement);
    (Announcement as unknown as { findOne: unknown }).findOne = (...args: Parameters<typeof realFindOne>) => {
        (Announcement as unknown as { findOne: unknown }).findOne = realFindOne;
        return realFindOne(...args).then(async (doc) => {
            await Announcement.updateOne({ _id: racy._id }, { $set: { pinned_until: far } });
            return doc;
        });
    };
    await assert.rejects(
        () => svc.publishOrSchedule(racy._id, undefined, ACTOR),
        /pinned_until_after_expiry/,
        'the claim re-checks the pin, so the race is a 422, not a silently invalid document'
    );
    assert.strictEqual((await Announcement.findById(racy._id))!.status, 'draft', 'and nothing was published');
    console.log('✓ tags lowercase; a pin moved mid-publish is refused by the claim');

    /* ---- 9. edit authority: the author, or someone strictly above them ---- */
    console.log('9. Edit authority...');
    const peer = await seedUser('Peer Coordinator', UserRole.COORDINATOR);
    const junior = await seedUser('Junior Core', UserRole.CORE);
    const founder = await seedUser('Founder', UserRole.FOUNDER);
    const as = (u: { _id: string; role: string }): Editor => ({ id: u._id, ip: null, role: u.role as never });

    const mine = await draft(); // written by the coordinator `author`
    for (const [who, label] of [[peer, 'an equal-rank peer'], [junior, 'a lower rank']] as const) {
        await assert.rejects(() => svc.update(mine._id, { title: 'Hijacked' }, as(who)), /not_author_or_senior/, `${label} may not edit`);
        await assert.rejects(() => svc.publishOrSchedule(mine._id, undefined, as(who)), /not_author_or_senior/, `nor publish`);
        await assert.rejects(() => svc.remove(mine._id, as(who)), /not_author_or_senior/, `nor delete`);
    }
    assert.strictEqual((await svc.update(mine._id, { title: 'Founder fix' }, as(founder))).title, 'Founder fix', 'a strictly higher rank may');
    assert.strictEqual((await svc.update(mine._id, { title: 'Own fix' }, ACTOR)).title, 'Own fix', 'and so may the author');
    console.log('✓ only the author or a strictly higher rank changes an announcement');

    /* ---- 10. delivery receipts ----------------------------------------- */
    console.log('10. Delivery receipts...');
    const broadcastDoc = await raw({ status: 'published', published_at: new Date() });
    const receipt = await svc.recordDelivery(broadcastDoc._id, {
        whatsapp: [{ category: 'bgec', group_id: '+911234567890', status: 'sent', revision: 5 }],
    });
    assert.strictEqual(
        receipt.delivery.whatsapp.per_category[0].group_id,
        '••••7890',
        'a raw destination in a receipt is masked on arrival'
    );

    // Two writebacks racing to append the same category's first row: one appends, the other must
    // not stop there — the newer revision has to win whichever request landed first.
    const racedReceipt = await raw({ status: 'published', published_at: new Date() });
    const row = (revision: number, status: 'pending' | 'sent') => ({
        whatsapp: [{ category: 'bgec' as const, group_id: '••••0001', status, revision }],
    });
    await Promise.all([svc.recordDelivery(racedReceipt._id, row(1, 'pending')), svc.recordDelivery(racedReceipt._id, row(2, 'sent'))]);
    const racedRows = (await Announcement.findById(racedReceipt._id))!.delivery.whatsapp.per_category;
    assert.strictEqual(racedRows.length, 1, 'one row per category, however the appends interleave');
    assert.strictEqual(racedRows[0].revision, 2, 'and it holds the newer receipt');
    assert.strictEqual(racedRows[0].status, 'sent');
    console.log('✓ receipts are masked, and concurrent first receipts settle on the newest');

    await closeScratchDb();
    console.log('\n✅ All lifecycle selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
