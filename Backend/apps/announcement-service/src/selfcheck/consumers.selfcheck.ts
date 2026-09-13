import { Announcement, User, UserRole, publish, resetBus } from '@bgsc/shared';
import assert from 'assert';
import { v4 as uuid } from 'uuid';
import { Viewer } from '../announcements/audience';
import * as svc from '../announcements/announcement.service';
import { initializeConsumers } from '../events/consumers';
import { closeScratchDb, openScratchDb, seedUser } from './seed';

/**
 * Consumer and Heads selfcheck.
 *
 * Both cover code that no other check reaches: the event consumer is wired in `onReady` and never
 * runs in a unit path, and the Heads strip's empty slot — the one Spec §5.2 fills with a meme —
 * only appears for a coordinator who has never posted.
 *
 * Run: npx ts-node apps/announcement-service/src/selfcheck/consumers.selfcheck.ts
 */

const guest: Viewer = { id: null, role: 'guest', confirmed_event_ids: [] };

/** The bus is fire-and-forget by contract, so a consumer's write lands after the publish returns. */
const settle = () => new Promise((r) => setTimeout(r, 300));

async function main(): Promise<void> {
    await openScratchDb();
    resetBus();
    initializeConsumers();

    const author = await seedUser('Original Name', UserRole.COORDINATOR);
    const lonely = await seedUser('Lonely Coordinator', UserRole.COORDINATOR);

    const a = await Announcement.create({
        _id: uuid(),
        title: 'Snapshot test',
        body: 'b',
        categories: ['bgec'],
        author: {
            user_id: author._id,
            display_name: 'Original Name',
            role_label: 'Coordinator',
            avatar_url: null,
        },
        status: 'published',
        published_at: new Date(),
    });

    /* ---- 1. the author snapshot follows a rename ------------------------ */
    console.log('1. Snapshot refresh...');
    await User.updateOne(
        { _id: author._id },
        { $set: { 'profile.full_name': 'Renamed Coordinator', 'profile.avatar_url': '/uploads/x.png' } }
    );
    publish('UserProfileUpdated', 'user-service', { user_id: author._id, changed_fields: ['full_name'] });
    await settle();

    const renamed = await Announcement.findById(a._id);
    assert.strictEqual(renamed!.author.display_name, 'Renamed Coordinator', 'the author name is rewritten');
    assert.strictEqual(renamed!.author.avatar_url, '/uploads/x.png', 'and so is the avatar');
    // Spec §5.2 makes attribution historical: an announcement stays signed by the role its author
    // held when they wrote it, so this one field must NOT follow the user.
    assert.strictEqual(renamed!.author.role_label, 'Coordinator', 'role_label stays historical');
    console.log('✓ a rename reaches every announcement the author wrote');

    /* ---- 2. an unrelated profile edit is skipped ------------------------ */
    console.log('2. changed_fields gate...');
    await User.updateOne({ _id: author._id }, { $set: { 'profile.full_name': 'Third Name' } });
    publish('UserProfileUpdated', 'user-service', { user_id: author._id, changed_fields: ['bio'] });
    await settle();

    const unchanged = await Announcement.findById(a._id);
    assert.strictEqual(
        unchanged!.author.display_name,
        'Renamed Coordinator',
        'a bio edit does not trigger a collection-wide update'
    );
    console.log('✓ changed_fields keeps a bio edit from rewriting every row');

    /* ---- 2b. an avatar-only change still refreshes ------------------------ */
    console.log('2b. Avatar-only change...');
    await User.updateOne({ _id: author._id }, { $set: { 'profile.avatar_url': '/uploads/y.webp' } });
    publish('UserProfileUpdated', 'user-service', { user_id: author._id, changed_fields: ['avatar_url'] });
    await settle();
    assert.strictEqual((await Announcement.findById(a._id))!.author.avatar_url, '/uploads/y.webp', 'avatar follows');
    console.log('✓ avatar_url alone triggers the refresh');

    /* ---- 3. the Heads strip's empty slot (Spec §5.2 meme fallback) ------ */
    console.log('3. Heads empty slot...');
    const heads = await svc.heads(guest);

    const posted = heads.find((h) => h.coordinator.user_id === author._id);
    assert(posted?.announcement, 'a coordinator who has posted carries their latest announcement');

    const empty = heads.find((h) => h.coordinator.user_id === lonely._id);
    assert(empty, 'a coordinator who has never posted still gets a row');
    assert.strictEqual(empty!.announcement, null, 'with announcement: null, which is the meme slot');
    assert.strictEqual(empty!.coordinator.role_label, 'Coordinator', 'and a role label to render');

    // A newer announcement scoped to an event the viewer is not registered for must not become
    // this coordinator's "latest" for that viewer.
    await Announcement.create({
        _id: uuid(), title: 'Scoped latest', body: 'b', categories: ['bgec'],
        author: { user_id: author._id, display_name: 'x', role_label: 'Coordinator' },
        status: 'published', published_at: new Date(Date.now() + 1000),
        audience: { min_role: 'guest', event_id: uuid() },
    });
    const scopedHeads = await svc.heads(guest);
    const latestForGuest = scopedHeads.find((h) => h.coordinator.user_id === author._id)!.announcement;
    assert.strictEqual(latestForGuest?._id, a._id, 'an event-scoped post never surfaces in the strip for outsiders');

    await User.updateOne({ _id: lonely._id }, { $set: { status: 'suspended' } });
    const afterSuspend = await svc.heads(guest);
    assert(!afterSuspend.some((h) => h.coordinator.user_id === lonely._id), 'a suspended coordinator leaves the strip');
    console.log('✓ every current coordinator gets a slot, posted or not');

    await closeScratchDb();
    console.log('\n✅ All consumer selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
