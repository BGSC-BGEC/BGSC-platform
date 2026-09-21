import assert from 'assert';
import { Notification, NotificationPreference, ServiceError, UserRole } from '@bgsc/shared';
import * as prefs from '../notifications/preferences';
import * as svc from '../notifications/notification.service';
import { closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * The inbox a client reads, and the preferences that shape it
 * (be2-broadcast-service-plan.md §7, §12).
 *
 * Pagination is tested against a deliberate timestamp TIE, because that is the case a keyset gets
 * wrong: rows sharing a `created_at` straddle the page boundary and one of them disappears.
 */

const ids = (rows: { _id: string }[]) => rows.map((r) => r._id);

async function seedNotification(
    userId: string,
    dedupeKey: string,
    over: Partial<{ created_at: Date; category: 'announcement' | 'event'; read_at: Date | null }> = {}
): Promise<string> {
    await svc.createOne({
        user_id: userId,
        category: over.category ?? 'announcement',
        type: 'announcement.published',
        title: dedupeKey,
        body: 'body',
        dedupe_key: dedupeKey,
    });
    const row = await Notification.findOne({ user_id: userId, dedupe_key: dedupeKey });
    if (over.created_at || over.read_at !== undefined) {
        await Notification.updateOne(
            { _id: row!._id },
            { $set: { ...(over.created_at ? { created_at: over.created_at } : {}), ...(over.read_at !== undefined ? { read_at: over.read_at } : {}) } }
        );
    }
    return row!._id;
}

async function main(): Promise<void> {
    await openScratchDb();

    const me = await seedUser('Me', UserRole.USER);
    const other = await seedUser('Other', UserRole.USER);

    /* ---- isolation ------------------------------------------------------ */

    const theirs = await seedNotification(other._id, 'announcement:theirs');
    const mine = await seedNotification(me._id, 'announcement:mine');

    const myList = await svc.list(me._id, { limit: 20 });
    assert.deepStrictEqual(ids(myList.notifications), [mine], "my inbox holds only my rows");

    await assert.rejects(
        () => svc.markRead(me._id, theirs),
        (err: ServiceError) => err.status === 404 && err.code === 'notification_not_found',
        'another user\'s notification is 404, not 403 — a stranger learns nothing from the answer'
    );
    await assert.rejects(() => svc.dismiss(me._id, theirs), (err: ServiceError) => err.status === 404);
    assert.ok(await Notification.exists({ _id: theirs }), 'and it is still there');
    console.log('✓ the inbox is scoped to its owner, and a miss is indistinguishable from absent');

    /* ---- idempotent creation --------------------------------------------- */

    assert.strictEqual(await svc.createOne({
        user_id: me._id,
        category: 'announcement',
        type: 'announcement.published',
        title: 'again',
        body: 'body',
        dedupe_key: 'announcement:mine',
    }), false, 'a second notification for the same cause is refused by the index, not by a read');
    assert.strictEqual(await Notification.countDocuments({ user_id: me._id }), 1, 'leaving one row');

    const bulk = await svc.createMany([
        { user_id: me._id, category: 'event', type: 'event.cancelled', title: 'a', body: 'b', dedupe_key: 'event.cancelled:e1' },
        { user_id: other._id, category: 'event', type: 'event.cancelled', title: 'a', body: 'b', dedupe_key: 'event.cancelled:e1' },
        { user_id: me._id, category: 'announcement', type: 'announcement.published', title: 'c', body: 'd', dedupe_key: 'announcement:mine' },
    ]);
    assert.strictEqual(bulk, 2, 'an unordered batch inserts the new rows and skips the duplicate');
    console.log('✓ creation is idempotent per (cause, user), one row at a time or in bulk');

    /* ---- keyset pagination across a tie ----------------------------------- */

    await Notification.deleteMany({ user_id: me._id });
    const tie = new Date('2026-09-26T10:00:00.000Z');
    const paged: string[] = [];
    for (let i = 0; i < 5; i++) {
        paged.push(await seedNotification(me._id, `announcement:p${i}`, { created_at: tie }));
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
        const res = await svc.list(me._id, { limit: 2, cursor });
        seen.push(...ids(res.notifications));
        if (!res.next_cursor) break;
        cursor = res.next_cursor;
    }
    assert.strictEqual(new Set(seen).size, seen.length, 'no row is returned twice across pages');
    assert.deepStrictEqual(new Set(seen), new Set(paged), 'and none is skipped, even with identical timestamps');
    console.log('✓ keyset pagination survives a timestamp tie, which is the only case it can fail');

    await assert.rejects(
        () => svc.list(me._id, { limit: 20, cursor: 'not-base64-json' }),
        (err: ServiceError) => err.status === 422 && err.code === 'invalid_cursor',
        'a malformed cursor is a 422, never a filter'
    );
    // `{ v: { $ne: null } }` would otherwise become `{ created_at: { $ne: null } }` — the whole
    // collection, for any user who can craft a cursor.
    const operatorCursor = Buffer.from(JSON.stringify({ v: { $ne: null }, id: 'x' })).toString('base64url');
    await assert.rejects(
        () => svc.list(me._id, { limit: 20, cursor: operatorCursor }),
        (err: ServiceError) => err.code === 'invalid_cursor',
        'an operator document smuggled into a cursor is refused'
    );
    console.log('✓ cursors are validated as data, not trusted as filters');

    /* ---- filters, combined ------------------------------------------------ */

    await Notification.deleteMany({ user_id: me._id });
    const oldest = await seedNotification(me._id, 'announcement:a1', { created_at: new Date('2026-09-01T00:00:00Z') });
    const middle = await seedNotification(me._id, 'event.cancelled:e2', { created_at: new Date('2026-09-02T00:00:00Z'), category: 'event' });
    const newest = await seedNotification(me._id, 'announcement:a2', { created_at: new Date('2026-09-03T00:00:00Z') });

    const announcementsOnly = await svc.list(me._id, { limit: 20, category: 'announcement' });
    assert.deepStrictEqual(ids(announcementsOnly.notifications), [newest, oldest], 'category filters, newest first');

    // A filter plus a cursor is where `$and` matters: spread together, one of them is dropped.
    const firstPage = await svc.list(me._id, { limit: 1, category: 'announcement' });
    const secondPage = await svc.list(me._id, { limit: 1, category: 'announcement', cursor: firstPage.next_cursor! });
    assert.deepStrictEqual(ids(secondPage.notifications), [oldest], 'the cursor and the filter both survive');
    assert.ok(!ids(secondPage.notifications).includes(middle), 'the event row never leaks into a category page');
    console.log('✓ a cursor combined with a filter keeps both conditions');

    /* ---- read state -------------------------------------------------------- */

    assert.strictEqual(await svc.unreadCount(me._id), 3, 'everything starts unread');

    const readAt = await svc.markRead(me._id, newest);
    assert.ok(readAt instanceof Date, 'marking read returns when');
    assert.strictEqual(await svc.unreadCount(me._id), 2, 'and lowers the badge');

    const again = await svc.markRead(me._id, newest);
    assert.strictEqual(again.getTime(), readAt.getTime(), 'a double tap does not move the original read time');

    const unread = await svc.list(me._id, { limit: 20, unread: true });
    assert.ok(!ids(unread.notifications).includes(newest), 'unread=true excludes it');
    const read = await svc.list(me._id, { limit: 20, unread: false });
    assert.deepStrictEqual(ids(read.notifications), [newest], 'unread=false is the complement, not everything');

    assert.strictEqual(await svc.markAllRead(me._id), 2, 'read-all clears the rest');
    assert.strictEqual(await svc.unreadCount(me._id), 0, 'badge at zero');

    await seedNotification(me._id, 'announcement:after');
    assert.strictEqual(await svc.unreadCount(me._id), 1, 'and a notification that arrives after it is unread again');

    await svc.dismiss(me._id, oldest);
    assert.strictEqual(await Notification.exists({ _id: oldest }), null, 'dismissing deletes the row');
    console.log('✓ read, read-all, unread filtering and dismiss all behave');

    /* ---- preferences -------------------------------------------------------- */

    const defaults = await prefs.get(me._id);
    assert.deepStrictEqual(
        defaults.in_app,
        { announcement: true, event: true, challenge: true, system: true },
        'no document means every default, so nothing has to be created at signup'
    );
    assert.strictEqual(await NotificationPreference.countDocuments({ _id: me._id }), 0, 'and reading creates nothing');

    const afterPatch = await prefs.update(me._id, { in_app: { announcement: false } });
    assert.strictEqual(afterPatch.in_app.announcement, false, 'the named leaf is written');
    assert.strictEqual(afterPatch.in_app.event, true, 'and the others keep their value — a merge, not a replace');

    const afterSecond = await prefs.update(me._id, { in_app: { event: false } });
    assert.strictEqual(afterSecond.in_app.announcement, false, 'the first toggle is not reset by the second');
    assert.strictEqual(afterSecond.in_app.event, false, 'and the second lands');

    const muted = await prefs.mutedUserIds('announcement');
    assert.ok(muted.has(me._id), 'the muted set is what the fan-out subtracts');
    assert.ok(!muted.has(other._id), 'and holds nobody who did not mute');
    console.log('✓ preferences default open, merge on patch, and drive the fan-out');

    await closeScratchDb();
    console.log('\ninbox selfcheck: all checks passed');
}

main().catch(async (err) => {
    console.error('inbox selfcheck failed:', err);
    await closeScratchDb().catch(() => undefined);
    process.exit(1);
});
