import { HallOfFameEntry } from '@bgsc/shared';
import * as service from '../hall-of-fame/hallOfFame.service';
import assert from 'assert';

export async function runSelfcheck() {
    console.log('[selfcheck] Starting HallOfFame selfcheck...');
    await HallOfFameEntry.deleteMany({});

    // 1. Create Entry
    const created = await service.createEntry({
        category: 'event_winner',
        title: 'Spring Open Winner',
        honoree: {
            type: 'user',
            id: '12345678-1234-1234-1234-123456789012',
            display_name: 'Jane Doe'
        },
        source: {
            type: 'event',
            id: '87654321-4321-4321-4321-210987654321',
            title: 'Spring Open'
        },
        achievement: {
            year: 2026
        },
        featured: true,
        featured_order: 1
    }, 'system');

    assert(created.slug === 'spring-open-winner-2026', 'Slug generation failed');

    // 2. Read Entry
    const fetched = await service.getEntryBySlugOrId(created.slug);
    assert(fetched._id === created._id, 'Fetch by slug failed');

    const fetchedById = await service.getEntryBySlugOrId(created._id);
    assert(fetchedById._id === created._id, 'Fetch by ID failed');

    // 3. Featured Entries
    const featured = await service.getFeaturedEntries();
    assert(featured.length === 1 && featured[0]._id === created._id, 'Featured entries query failed');

    // 4. List Entries with Filters
    const list = await service.listEntries({ category: 'event_winner', year: 2026, limit: 10, page: 1 });
    assert(list.items.length === 1 && list.total === 1, 'List entries with filters failed');

    // 5. Update Entry
    const updated = await service.updateEntry(created._id, { title: 'Spring Open Grand Winner' }, 'system');
    assert(updated.title === 'Spring Open Grand Winner', 'Update failed');
    assert(updated.slug === 'spring-open-grand-winner-2026', 'Slug update failed');

    // 6. Delete Entry
    await service.deleteEntry(created._id, 'system');
    const afterDelete = await service.listEntries({ limit: 10, page: 1 });
    assert(afterDelete.total === 0, 'Soft delete failed');

    // 7. ChallengeLegendAchieved consumer integration & idempotency
    const { handlers } = await import('../events/consumers');
    const testUserId = '11111111-2222-3333-4444-555555555555';
    const testChallengeId = '66666666-7777-8888-9999-000000000000';
    const { User, Challenge } = await import('@bgsc/shared');
    await User.create({
        _id: testUserId,
        email: 'legend@bgsc.in',
        username: 'legend_runner',
        password_hash: 'x',
        profile: { full_name: 'Legend Runner', avatar_url: 'https://cdn.bgsc.in/legend.jpg' },
    });
    await Challenge.create({
        _id: testChallengeId,
        slug: 'legend-ironman-2026',
        title: 'Legend Ironman Triathlon',
        description: 'Elite physical endurance challenge',
        domain: 'sports',
        kind: 'physical',
        location: { name: 'Campus Sports Complex' },
        difficulty: 'legend',
        award_points: 500,
        grants_hall_of_fame: true,
        counts: { accepted: 1 },
        created_by: 'system',
    });

    const { subscribe, resetBus, ChallengeParticipation } = await import('@bgsc/shared');
    const announced: unknown[] = [];
    resetBus();
    subscribe('HallOfFameEntryCreated', (e) => void announced.push(e.payload));
    await handlers.onChallengeLegendAchieved({
        challenge_id: testChallengeId,
        participant_id: testUserId,
        participant_type: 'user',
    });

    const legendEntry = await HallOfFameEntry.findOne({
        category: 'challenge_legend',
        'honoree.id': testUserId,
        'source.id': testChallengeId,
        deleted_at: null,
    });
    assert(legendEntry != null, 'ChallengeLegendAchieved failed to auto-create HoF entry');
    assert(legendEntry.honoree.display_name === 'Legend Runner', 'Honoree display name mismatch');
    assert(legendEntry.achievement.difficulty === 'legend', 'Achievement difficulty mismatch');

    // Replay idempotency test
    await handlers.onChallengeLegendAchieved({
        challenge_id: testChallengeId,
        participant_id: testUserId,
        participant_type: 'user',
    });
    const countAfterReplay = await HallOfFameEntry.countDocuments({
        category: 'challenge_legend',
        'honoree.id': testUserId,
        'source.id': testChallengeId,
        deleted_at: null,
    });
    assert(countAfterReplay === 1, 'ChallengeLegendAchieved duplicate created on replay');
    resetBus();
    // A replay re-announces the SAME entry (the first announcement may have been lost on the bus);
    // the challenge-side consumer is an idempotent $set.
    assert(announced.length === 2, 'the replay re-announces the existing entry');
    assert((announced[0] as any).entry_id === (announced[1] as any).entry_id, 'both announcements name the one entry');
    assert((await ChallengeParticipation.countDocuments({})) === 0, "challenge_participations is not this service's to write");

    // Two creates of one title race to one slug: the loser takes the next slug, not a 500.
    const racers = await Promise.all(
        ['aaaaaaaa-1111-1111-1111-111111111111', 'bbbbbbbb-1111-1111-1111-111111111111'].map((id) =>
            service.createEntry(
                {
                    category: 'custom',
                    title: 'Same Title',
                    honoree: { type: 'user', id, display_name: 'Racer' },
                    source: { type: 'manual' },
                    achievement: { year: 2026 },
                } as never,
                'system'
            )
        )
    );
    assert(racers[0].slug !== racers[1].slug, 'distinct slugs under a race');
    const dupe = await service
        .createEntry(
            {
                category: 'challenge_legend',
                title: 'Again',
                honoree: { type: 'user', id: testUserId, display_name: 'Legend Runner' },
                source: { type: 'challenge', id: testChallengeId },
                achievement: { year: 2026 },
            } as never,
            'system'
        )
        .then(() => 'created', (e: { code?: string }) => e.code);
    assert(dupe === 'entry_exists', 'one live entry per (category, honoree, source)');

    // 8. GDPR User Profile, Deletion, and Restoration Lifecycle
    await handlers.onUserProfileUpdated({
        user_id: testUserId,
        changed_fields: ['full_name'],
    });
    // Update user profile in DB first to simulate rename
    await User.updateOne({ _id: testUserId }, { $set: { 'profile.full_name': 'Legendary Champion' } });
    await handlers.onUserProfileUpdated({
        user_id: testUserId,
        changed_fields: ['full_name'],
    });
    const renamedEntry = await HallOfFameEntry.findById(legendEntry._id);
    assert(renamedEntry?.honoree.display_name === 'Legendary Champion', 'UserProfileUpdated failed to sync HoF snapshot');

    await handlers.onUserDeleted({ user_id: testUserId });
    const deletedEntry = await HallOfFameEntry.findById(legendEntry._id);
    assert(deletedEntry?.honoree.display_name === 'Deleted user' && deletedEntry?.honoree.deleted === true, 'UserDeleted failed to anonymize HoF honoree');
    assert(deletedEntry?.honoree.avatar_url === null, 'UserDeleted failed to null avatar');

    await handlers.onUserRestored({ user_id: testUserId });
    const restoredEntry = await HallOfFameEntry.findById(legendEntry._id);
    assert(restoredEntry?.honoree.display_name === 'Legendary Champion', 'UserRestored failed to rehydrate HoF honoree');

    // 9. Audit #2: PATCH merges nested groups and never un-anonymizes; schemas; deleted snapshots; search.
    await User.updateOne({ _id: testUserId }, { $set: { deleted_at: new Date() } });
    await handlers.onUserDeleted({ user_id: testUserId });
    const patched = await service.updateEntry(legendEntry._id, { achievement: { season: 'Monsoon' } } as never, 'system');
    assert(patched.achievement.year === legendEntry.achievement.year, 'a nested PATCH keeps the fields it does not name');
    assert(patched.achievement.season === 'Monsoon');
    const renamed = await service.updateEntry(
        legendEntry._id,
        { honoree: { display_name: 'Real Name Again' }, members: [{ user_id: testUserId, display_name: 'Typed Member' }] } as never,
        'system'
    );
    assert(
        renamed.honoree.deleted === true &&
            renamed.honoree.display_name === 'Deleted user' &&
            renamed.members?.[0]?.display_name === 'Deleted user',
        'a PATCH stores no typed name for a deleted honoree or member'
    );

    const schemas = await import('../hall-of-fame/hallOfFame.schemas');
    const base = {
        category: 'custom',
        title: 'T',
        honoree: { type: 'user', id: '9b2f7a44-1c3d-4e5f-8a6b-7c8d9e0f1a2b', display_name: 'X' },
        source: { type: 'manual' },
        achievement: { year: 2026 },
    };
    assert(!schemas.CreateHallOfFameEntrySchema.safeParse({ ...base, media_url: 'javascript:alert(1)' }).success, 'javascript: refused');
    assert(!schemas.CreateHallOfFameEntrySchema.safeParse({ ...base, cover_url: 'data:text/html,x' }).success, 'data: refused');
    assert(schemas.CreateHallOfFameEntrySchema.safeParse({ ...base, cover_url: '/uploads/media/a.png' }).success, '/uploads/ accepted');
    assert(!schemas.CreateHallOfFameEntrySchema.safeParse({ ...base, title: 'x'.repeat(201) }).success, 'lengths are capped');

    const anon = await service.createEntry(
        {
            category: 'custom',
            title: 'Searchable Feat',
            honoree: { type: 'user', id: testUserId, display_name: 'Should Not Be Stored' },
            source: { type: 'manual' },
            achievement: { year: 2026, domain: 'sports' },
        } as never,
        'system'
    );
    assert(anon.honoree.display_name === 'Deleted user' && anon.honoree.deleted === true, 'a new snapshot of a deleted user is anonymized');
    const found = await service.listEntries({ search: 'searchable', domain: 'sports', limit: 10, page: 1 });
    assert(found.total === 1, 'search and domain filters');

    // Cleanup test documents
    await HallOfFameEntry.deleteMany({});
    await User.deleteOne({ _id: testUserId });
    await Challenge.deleteOne({ _id: testChallengeId });

    console.log('[selfcheck] HallOfFame selfcheck passed.');
}
