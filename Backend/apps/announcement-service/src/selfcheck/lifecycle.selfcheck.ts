import {
    ARCHIVE_MONTHS,
    Announcement,
    Event,
    UserRole,
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

    // Spec §6.4: WhatsApp auto-sends on publish. Week 4 reads this flag; nothing else sets it.
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
    console.log('✓ compare-and-swap, and the hook bypass is handled');

    /* ---- 6b. concurrent HTTP transitions emit one event apiece ---------- */
    console.log('6b. Transition races...');
    resetBus();

    let publishedEvents = 0;
    subscribe('AnnouncementPublished', () => {
        publishedEvents += 1;
    });

    // A double-clicked Publish button. Read-then-write lets both requests through, and each emits
    // its own AnnouncementPublished — which Week 4's Broadcast Service turns into two WhatsApp
    // sends to every mapped group, the exact thing Spec §9.4's rate limit exists to stop.
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

    await closeScratchDb();
    console.log('\n✅ All lifecycle selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
