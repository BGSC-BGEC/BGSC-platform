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

    // 8. GDPR User Profile, Deletion, and Restoration Lifecycle
    await handlers.onUserProfileUpdated({
        user_id: testUserId,
        changed_fields: ['profile.full_name'],
    });
    // Update user profile in DB first to simulate rename
    await User.updateOne({ _id: testUserId }, { $set: { 'profile.full_name': 'Legendary Champion' } });
    await handlers.onUserProfileUpdated({
        user_id: testUserId,
        changed_fields: ['profile.full_name'],
    });
    const renamedEntry = await HallOfFameEntry.findById(legendEntry._id);
    assert(renamedEntry?.honoree.display_name === 'Legendary Champion', 'UserProfileUpdated failed to sync HoF snapshot');

    await handlers.onUserDeleted({ user_id: testUserId });
    const deletedEntry = await HallOfFameEntry.findById(legendEntry._id);
    assert(deletedEntry?.honoree.display_name === 'Deleted User', 'UserDeleted failed to anonymize HoF honoree');
    assert(deletedEntry?.honoree.avatar_url === null, 'UserDeleted failed to null avatar');

    await handlers.onUserRestored({ user_id: testUserId });
    const restoredEntry = await HallOfFameEntry.findById(legendEntry._id);
    assert(restoredEntry?.honoree.display_name === 'Legendary Champion', 'UserRestored failed to rehydrate HoF honoree');

    // Cleanup test documents
    await HallOfFameEntry.deleteMany({});
    await User.deleteOne({ _id: testUserId });
    await Challenge.deleteOne({ _id: testChallengeId });

    console.log('[selfcheck] HallOfFame selfcheck passed.');
}
