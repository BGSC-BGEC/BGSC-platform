import { Announcement, UserRole } from '@bgsc/shared';
import assert from 'assert';
import { v4 as uuid } from 'uuid';
import { Viewer, confirmedEventIds } from '../announcements/audience';
import { ListAnnouncementsQuery } from '../announcements/announcement.schemas';
import * as svc from '../announcements/announcement.service';
import type { Editor } from '../announcements/announcement.service';
import { closeScratchDb, openScratchDb, seedConfirmedRegistration, seedEvent, seedUser } from './seed';

/**
 * Audience selfcheck — the authorization surface as a *query*, not as a predicate.
 *
 * models.selfcheck.ts already covers the model's invariants and every isVisibleTo() case in
 * memory. None of that catches a filter that is correct on page one and leaks on page two, or a
 * soft-deleted document that no read path excludes. That is what this file is for.
 *
 * Run: npx ts-node apps/announcement-service/src/selfcheck/audience.selfcheck.ts
 */

const query = (over: Record<string, unknown> = {}) => ({
    ...ListAnnouncementsQuery.parse({}),
    ...over,
});

const viewerOf = (role: string, ids: string[] = []): Viewer =>
    ({ id: null, role, confirmed_event_ids: ids } as Viewer);

const ids = (r: { announcements: { _id: string }[] }) => r.announcements.map((a) => a._id);

async function main(): Promise<void> {
    await openScratchDb();

    const author = await seedUser('Selfcheck Coordinator', UserRole.COORDINATOR);
    const registrant = await seedUser('Selfcheck Registrant');
    const eventId = await seedEvent('Selfcheck Cup');
    const ACTOR: Editor = { id: author._id, ip: null, role: 'coordinator' };

    const post = (over: Record<string, unknown>) =>
        Announcement.create({
            _id: uuid(),
            title: 'Selfcheck',
            body: 'body',
            categories: ['bgec'],
            author: {
                user_id: author._id,
                display_name: 'Selfcheck Coordinator',
                role_label: 'Coordinator',
            },
            ...over,
        });

    const guest = viewerOf('guest');

    /* ---- 1. the role gate, as a query ---------------------------------- */
    console.log('1. Role gate...');
    const publicPost = await post({ status: 'published', published_at: new Date() });
    const corePost = await post({
        status: 'published',
        published_at: new Date(),
        audience: { min_role: 'core', event_id: null },
    });

    let page = await svc.list(guest, query(), false);
    assert(ids(page).includes(publicPost._id), 'a guest sees a public announcement');
    assert(!ids(page).includes(corePost._id), 'a guest does not see a core-only announcement');

    page = await svc.list(viewerOf('core'), query(), false);
    assert(ids(page).includes(corePost._id), 'core sees the core-only announcement');
    console.log('✓ min_role filters in the query');

    /* ---- 2. 'teams' raises min_role, and the raise is enforced ---------- */
    console.log('2. Teams tag...');
    const teamsPost = await post({
        status: 'published',
        published_at: new Date(),
        categories: ['teams'],
        audience: { min_role: 'guest', event_id: null },
    });
    assert.strictEqual(teamsPost.audience.min_role, 'core', "the model raises 'teams' to core");

    page = await svc.list(viewerOf('member'), query(), false);
    assert(!ids(page).includes(teamsPost._id), 'a member does not see a teams announcement');
    console.log('✓ the teams tag is role-gated end to end');

    /* ---- 3. event scoping reads real registrations ---------------------- */
    console.log('3. Event scoping...');
    const scoped = await post({
        status: 'published',
        published_at: new Date(),
        audience: { min_role: 'guest', event_id: eventId },
    });

    const before = viewerOf('user', await confirmedEventIds(registrant._id));
    assert(!ids(await svc.list(before, query(), false)).includes(scoped._id),
        'an event-scoped announcement is hidden from a non-registrant');

    const regId = await seedConfirmedRegistration(registrant._id, eventId);
    const after = viewerOf('user', await confirmedEventIds(registrant._id));
    assert(ids(await svc.list(after, query(), false)).includes(scoped._id),
        'and visible once the registration is confirmed');

    const { FormSubmission } = await import('@bgsc/shared');
    await FormSubmission.updateOne({ _id: regId }, { $set: { status: 'cancelled' } });
    const cancelled = viewerOf('user', await confirmedEventIds(registrant._id));
    assert(!ids(await svc.list(cancelled, query(), false)).includes(scoped._id),
        'and hidden again after it is cancelled');
    console.log('✓ event scoping follows the real registration');

    /* ---- 4. soft delete (plan §3.3 — no index mentions deleted_at) ------ */
    console.log('4. Soft delete...');
    const deleted = await post({ status: 'published', published_at: new Date() });
    await svc.remove(deleted._id, ACTOR);

    assert(!ids(await svc.list(guest, query(), false)).includes(deleted._id),
        'a soft-deleted announcement is in no feed');
    await assert.rejects(
        () => svc.get(deleted._id, guest, false),
        /announcement_not_found/,
        'and 404s on a direct read'
    );
    await assert.rejects(
        () => svc.get(deleted._id, viewerOf('coordinator'), true),
        /announcement_not_found/,
        'even for an admin — deleted is deleted'
    );
    console.log('✓ soft-deleted announcements are excluded everywhere');

    /* ---- 5. the ?status= bypass ----------------------------------------- */
    console.log('5. Status bypass...');
    const draft = await post({});
    const scheduled = await post({ status: 'scheduled', scheduled_for: new Date(Date.now() + 86_400_000) });

    const asUser = await svc.list(guest, query({ status: 'draft' }), false);
    assert(!ids(asUser).includes(draft._id), 'a non-admin asking for drafts still gets published only');
    assert(!ids(asUser).includes(scheduled._id), 'and no scheduled items either');

    const asAdmin = await svc.list(viewerOf('core'), query({ status: 'draft' }), true);
    assert(ids(asAdmin).includes(draft._id), 'core+ does see its drafts');
    console.log('✓ ?status= is honoured only for core+');

    // A composer is not a reader: core+ lists every published announcement, including one scoped
    // to an event it is not registered for, because GET /:id already shows it that one.
    const asComposer = await svc.list(viewerOf('core'), query(), true);
    assert(ids(asComposer).includes(scoped._id), 'core+ lists an event-scoped announcement without a registration');
    console.log('✓ the list is not audience-filtered for core+');

    /* ---- 6. the $or collision (plan §0.7) — page two is where it shows --- */
    console.log('6. Paginated audience gate...');
    const base = Date.now() - 10_000_000;
    const publicIds: string[] = [];
    const gatedIds: string[] = [];
    for (let i = 0; i < 8; i++) {
        const gated = i % 2 === 1;
        const doc = await post({
            status: 'published',
            published_at: new Date(base + i * 1000),
            title: `Page ${i}`,
            audience: { min_role: gated ? 'core' : 'guest', event_id: null },
        });
        (gated ? gatedIds : publicIds).push(doc._id);
    }

    const seen: string[] = [];
    let cursor: string | null | undefined;
    for (let guard = 0; guard < 10; guard++) {
        const r: svc.ListResult = await svc.list(guest, query({ limit: 2, cursor }), false);
        seen.push(...ids(r));
        cursor = r.next_cursor;
        if (!cursor) break;
    }

    assert.strictEqual(new Set(seen).size, seen.length, 'a walked cursor never repeats a row');
    for (const gatedId of gatedIds) {
        assert(!seen.includes(gatedId), 'a role-gated announcement never appears on any page');
    }
    for (const publicId of publicIds) {
        assert(seen.includes(publicId), 'and every public announcement is reachable by walking');
    }
    console.log('✓ the audience gate survives pagination');

    /* ---- 7. the banner is ordered by priority, not recency --------------- */
    console.log('7. Pinned banner order...');
    const pinUntil = new Date(Date.now() + 30 * 86_400_000);
    const tb = Date.now();
    await post({ title: 'URGENT-oldest', priority: 'urgent', pinned_until: pinUntil,
        status: 'published', published_at: new Date(tb - 30_000) });
    await post({ title: 'normal-mid', priority: 'normal', pinned_until: pinUntil,
        status: 'published', published_at: new Date(tb - 20_000) });
    await post({ title: 'normal-newest', priority: 'normal', pinned_until: pinUntil,
        status: 'published', published_at: new Date(tb - 10_000) });

    // limit=1 is the banner's real question. Ordering the page instead of the set answers it
    // with whatever is newest, which is the one thing the banner must not do.
    const banner = await svc.list(guest, query({ pinned: true, limit: 1 }), false);
    assert.strictEqual(
        banner.announcements[0]?.title,
        'URGENT-oldest',
        'the banner returns the highest-priority pin, not the most recent one'
    );
    console.log('✓ the pinned set is ordered before the limit is applied');

    /* ---- 8. the query filters ------------------------------------------- */
    console.log('8. Query filters...');
    const tf = Date.now() - 20_000_000;
    await post({ title: 'F-fitsoc', categories: ['fitsoc'], priority: 'urgent',
        status: 'published', published_at: new Date(tf) });
    await post({ title: 'F-scoped', status: 'published', published_at: new Date(tf + 1000),
        audience: { min_role: 'guest', event_id: eventId } });
    await post({ title: 'F-keyword', body: 'contains capybara somewhere',
        status: 'published', published_at: new Date(tf + 2000) });

    // Asserted as inclusion/exclusion, not as an exact array: earlier steps in this file publish
    // their own fixtures, and an exact-match assertion here fails the moment one of them happens
    // to share a category or priority — which says nothing about whether the filter works.
    const only = (r: svc.ListResult) => r.announcements.map((a) => a.title);
    const has = (r: svc.ListResult, t: string) => only(r).includes(t);

    const byCategory = await svc.list(guest, query({ category: 'fitsoc' }), false);
    assert(has(byCategory, 'F-fitsoc'), 'category filter returns the matching announcement');
    assert(!has(byCategory, 'F-keyword'), 'and excludes a bgec one');

    const byPriority = await svc.list(guest, query({ priority: 'urgent' }), false);
    assert(has(byPriority, 'F-fitsoc'), 'priority filter returns the matching announcement');
    assert(!has(byPriority, 'F-keyword'), 'and excludes a normal-priority one');

    const registered = viewerOf('user', [eventId]);
    const byEvent = await svc.list(registered, query({ event_id: eventId }), false);
    assert(has(byEvent, 'F-scoped'), 'event_id returns announcements scoped to that event');
    assert(!has(byEvent, 'F-keyword'), 'and excludes unscoped ones');

    // `$text` has to stay a top-level sibling of the `$and`: MongoDB refuses it inside `$or`, and
    // the audience filter is built from one. Never exercised until this case existed.
    const byText = await svc.list(guest, query({ q: 'capybara' }), false);
    assert.deepStrictEqual(only(byText), ['F-keyword'], 'full-text search runs alongside the audience gate');

    const byTextAndChip = await svc.list(guest, query({ q: 'capybara', category: 'bgec' }), false);
    assert.deepStrictEqual(only(byTextAndChip), ['F-keyword'], 'and combines with a chip filter');

    console.log('✓ category, priority, event_id and q all filter correctly');

    /* ---- 8b. a cursor walk over identical timestamps ---------------------- */
    console.log('8b. Cursor ties...');
    const sameInstant = new Date(Date.now() - 60_000);
    for (const t of ['T-a', 'T-b', 'T-c', 'T-d']) {
        await post({ title: t, status: 'published', published_at: sameInstant });
    }

    // Every announcement published in the same second is a real case (a bulk import, a scheduler
    // tick draining a queue). Without the `_id` tiebreaker in the cursor, rows sharing a timestamp
    // straddle the page boundary: some repeat, some vanish.
    const walked: string[] = [];
    let tieCursor: string | null | undefined;
    for (let guard = 0; guard < 12; guard++) {
        const r: svc.ListResult = await svc.list(guest, query({ limit: 1, cursor: tieCursor ?? undefined }), false);
        walked.push(...r.announcements.map((a) => a.title));
        tieCursor = r.next_cursor;
        if (!tieCursor) break;
    }
    const tied = walked.filter((t) => t.startsWith('T-'));
    assert.strictEqual(tied.length, 4, 'all four same-timestamp rows are reached');
    assert.strictEqual(new Set(tied).size, 4, 'and none is served twice');
    console.log('✓ the _id tiebreaker survives identical published_at');

    /* ---- 8c. author filter, and the scheduled queue order ------------------ */
    console.log('8c. Composer lists...');
    const other = await seedUser('Other Coordinator', UserRole.COORDINATOR);
    await Announcement.create({
        _id: uuid(), title: 'By other', body: 'b', categories: ['bgec'], status: 'published', published_at: new Date(),
        author: { user_id: other._id, display_name: 'Other', role_label: 'Coordinator' },
    });
    const mine = await svc.list(guest, query({ author_id: author._id, limit: 50 }), false);
    assert(mine.announcements.length > 0, 'author_id returns that author');
    assert(mine.announcements.every((a) => a.author.user_id === author._id), 'and only that author');

    const hour = 3_600_000;
    const soon = await post({ title: 'Q-soon', status: 'scheduled', scheduled_for: new Date(Date.now() + 1 * hour) });
    const later = await post({ title: 'Q-later', status: 'scheduled', scheduled_for: new Date(Date.now() + 3 * hour) });
    const mid = await post({ title: 'Q-mid', status: 'scheduled', scheduled_for: new Date(Date.now() + 2 * hour) });
    const queue: string[] = [];
    let qc: string | null | undefined;
    for (let guard = 0; guard < 10; guard++) {
        const r: svc.ListResult = await svc.list(viewerOf('core'), query({ status: 'scheduled', limit: 1, cursor: qc ?? undefined }), true);
        queue.push(...ids(r));
        qc = r.next_cursor;
        if (!qc) break;
    }
    const ours = queue.filter((id) => [soon._id, mid._id, later._id].includes(id));
    assert.deepStrictEqual(ours, [soon._id, mid._id, later._id], 'scheduled items list soonest first, across pages');
    console.log('✓ author_id filters; the scheduled list is a queue');

    /* ---- 9. an unrecognised role fails closed ---------------------------- */
    console.log('9. Unknown role...');
    const unknown = await svc.list(viewerOf('sysadmin'), query(), false);
    assert.strictEqual(unknown.announcements.length, 0, 'an unknown role sees nothing, not everything');
    console.log('✓ roleRank() === -1 fails closed');

    await closeScratchDb();
    console.log('\n✅ All audience selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
