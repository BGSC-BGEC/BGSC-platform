import { Announcement, User, UserRole } from '@bgsc/shared';
import assert from 'assert';
import { v4 as uuid } from 'uuid';
import { Viewer } from '../announcements/audience';
import { READ_IDS_CAP, markAllRead, markRead, unreadCount, withUnread } from '../announcements/reads';
import { closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * Read / unread selfcheck.
 *
 * All three writes go to the User document, which this service owns exclusively
 * (relationships.md §1) — so the cap, the replay guard and the audience-aware count are only
 * verifiable here.
 *
 * Run: npx ts-node apps/announcement-service/src/selfcheck/reads.selfcheck.ts
 */

async function main(): Promise<void> {
    await openScratchDb();

    const author = await seedUser('Selfcheck Coordinator', UserRole.COORDINATOR);
    const reader = await seedUser('Selfcheck Reader');

    const viewer: Viewer = { id: reader._id, role: 'user', confirmed_event_ids: [] };

    const post = (over: Record<string, unknown> = {}) =>
        Announcement.create({
            _id: uuid(),
            title: 'Selfcheck',
            body: 'body',
            categories: ['bgec'],
            author: { user_id: author._id, display_name: 'C', role_label: 'Coordinator' },
            status: 'published',
            published_at: new Date(),
            ...over,
        });

    const clear = () => Announcement.deleteMany({ 'author.user_id': author._id });

    /**
     * `unreadCount` counts every announcement the viewer can see, so each step clears the previous
     * step's fixtures and anchors `last_seen_at` a few seconds back: everything older is "seen",
     * and only that step's fixtures are newer.
     */
    const setSeen = (at: Date) =>
        User.updateOne({ _id: reader._id }, { $set: { 'announcements.last_seen_at': at } });

    /* ---- 1. the count follows last_seen_at ------------------------------ */
    console.log('1. Unread count...');
    await clear();
    const t = Date.now();
    await setSeen(new Date(t - 5000));
    assert.strictEqual(await unreadCount(viewer), 0, 'nothing published since last_seen_at is unread');

    await post({ published_at: new Date(t - 3000) });
    assert.strictEqual(await unreadCount(viewer), 1, 'an announcement published since then is unread');

    // Real `now`, which is strictly after the fixture above — no same-millisecond race.
    await markAllRead(reader._id);
    assert.strictEqual(await unreadCount(viewer), 0, 'read-all clears the count');
    console.log('✓ the count tracks last_seen_at');

    /* ---- 2. invisible announcements are not unread ---------------------- */
    console.log('2. Audience-aware count...');
    await clear();
    const t2 = Date.now();
    await setSeen(new Date(t2 - 5000));
    await post({
        published_at: new Date(t2 - 3000),
        audience: { min_role: 'core', event_id: null },
    });
    assert.strictEqual(
        await unreadCount(viewer),
        0,
        'an announcement the viewer may not see never counts as unread'
    );
    console.log('✓ the unread count uses the same audience filter as the feed');

    /* ---- 3. the replay guard -------------------------------------------- */
    console.log('3. Replayed mark-read...');
    await clear();
    const card = await post();
    await markRead(reader._id, card._id);
    await markRead(reader._id, card._id);

    const [opened] = await withUnread(reader._id, [card]);
    assert.strictEqual(opened.unread, false, 'the announcement is marked read');
    const stored = (await User.findById(reader._id))!.announcements.read_ids;
    assert.strictEqual(
        stored.filter((id) => id === card._id).length,
        1,
        '$addToSet cannot take $slice, so the $ne guard is what makes a replay a no-op'
    );
    console.log('✓ marking twice leaves one entry');

    /* ---- 3b. the dot honours the watermark ------------------------------ */
    console.log('3b. Dots after read-all...');
    await clear();
    await User.updateOne({ _id: reader._id }, { $set: { 'announcements.read_ids': [] } });
    const older = await post({ published_at: new Date(Date.now() - 2000) });
    await markAllRead(reader._id);
    const newer = await post({ published_at: new Date(Date.now() + 1000) });
    const draftCard = { _id: uuid(), published_at: null };

    const dots = await withUnread(reader._id, [older, newer, draftCard]);
    assert.strictEqual(dots[0].unread, false, 'read-all clears the dot on every card it covers');
    assert.strictEqual(dots[1].unread, true, 'a card published after it is still unread');
    assert.strictEqual(dots[2].unread, false, 'an unpublished card is never unread');
    console.log('✓ the per-card dot uses last_seen_at as well as read_ids');

    /* ---- 4. the cap, enforced by Mongo ---------------------------------- */
    console.log('4. read_ids cap...');
    await User.updateOne({ _id: reader._id }, { $set: { 'announcements.read_ids': [] } });

    const marked: string[] = [];
    for (let i = 0; i < READ_IDS_CAP + 50; i++) {
        const id = uuid();
        marked.push(id);
        await markRead(reader._id, id);
    }

    const capped = (await User.findById(reader._id))!.announcements.read_ids;
    assert.strictEqual(capped.length, READ_IDS_CAP, `read_ids stays at ${READ_IDS_CAP}`);
    assert.deepStrictEqual(
        capped,
        marked.slice(-READ_IDS_CAP),
        'and holds the most recent, evicting from the front'
    );
    console.log('✓ $slice caps the array server-side');

    await closeScratchDb();
    console.log('\n✅ All reads selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
