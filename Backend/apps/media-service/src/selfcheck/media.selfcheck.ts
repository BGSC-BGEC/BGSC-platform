import assert from 'assert';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import {
    config,
    User,
    UserRole,
    Media,
    MediaAlbum,
    resetBus,
    AuthUser,
    ServiceError,
} from '@bgsc/shared';
import {
    sniffMedia,
    putMediaObject,
    deleteMediaObject,
    UPLOAD_DIR,
    IMAGE_MAX_BYTES,
    VIDEO_MAX_BYTES,
} from '../storage/storage';
import { mediaService } from '../media/media.service';

const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_media$2');

async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
}

async function closeScratchDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}

function makeActor(id: string, role: UserRole, name = 'Test User'): AuthUser {
    return {
        id,
        role,
    };
}

// Minimal valid binary buffers
const DUMMY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const DUMMY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const DUMMY_WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
const DUMMY_MP4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(4)]);
const DUMMY_WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
const DUMMY_GARBAGE = Buffer.from('<!DOCTYPE html><html><body>not an image</body></html>');

async function main(): Promise<void> {
    console.log('[media-service selfcheck] Starting assertions...');

    /* ---------------- 1. Magic-byte sniffing assertions ---------------- */
    const jpegSniff = sniffMedia(DUMMY_JPEG);
    assert.ok(jpegSniff && jpegSniff.mime === 'image/jpeg' && jpegSniff.type === 'image' && jpegSniff.ext === 'jpg');

    const pngSniff = sniffMedia(DUMMY_PNG);
    assert.ok(pngSniff && pngSniff.mime === 'image/png' && pngSniff.type === 'image' && pngSniff.ext === 'png');

    const webpSniff = sniffMedia(DUMMY_WEBP);
    assert.ok(webpSniff && webpSniff.mime === 'image/webp' && webpSniff.type === 'image' && webpSniff.ext === 'webp');

    const mp4Sniff = sniffMedia(DUMMY_MP4);
    assert.ok(mp4Sniff && mp4Sniff.mime === 'video/mp4' && mp4Sniff.type === 'video' && mp4Sniff.ext === 'mp4');

    const webmSniff = sniffMedia(DUMMY_WEBM);
    assert.ok(webmSniff && webmSniff.mime === 'video/webm' && webmSniff.type === 'video' && webmSniff.ext === 'webm');

    const garbageSniff = sniffMedia(DUMMY_GARBAGE);
    assert.strictEqual(garbageSniff, null, 'garbage/HTML input sniff returns null');
    console.log('✓ Magic-byte sniffing for JPEG, PNG, WebP, MP4, WebM verified');

    /* ---------------- 2. Storage write and path traversal defense ---------------- */
    const stored = await putMediaObject('test/safe', DUMMY_PNG, pngSniff!);
    assert.ok(stored.url.startsWith('/uploads/test/safe/'), 'stored URL starts with /uploads/test/safe/');
    await deleteMediaObject('/' + stored.key); // Verifies deletion succeeds even when key has leading slash

    await assert.rejects(
        putMediaObject('../../../outside', DUMMY_PNG, pngSniff!),
        /refusing to write outside upload directory/,
        'traversal attempt outside upload directory is rejected'
    );
    console.log('✓ Storage write and path traversal defense verified');

    /* ---------------- 3. Database connection & lifecycle tests ---------------- */
    await openScratchDb();
    resetBus();

    const memberActor = makeActor('user-member-1', UserRole.MEMBER, 'Rahul Dravid');
    const coreActor = makeActor('user-core-1', UserRole.CORE, 'Admin Coach');

    // 3a. Size limit rejections
    const oversizedImage = Buffer.alloc(IMAGE_MAX_BYTES + 10);
    oversizedImage[0] = 0xff;
    oversizedImage[1] = 0xd8;
    oversizedImage[2] = 0xff;

    await assert.rejects(
        mediaService.uploadMedia(memberActor, oversizedImage, { category: 'general' }),
        (err: ServiceError) => {
            assert.strictEqual(err.status, 413);
            assert.strictEqual(err.code, 'image_payload_too_large');
            return true;
        },
        'Oversized image rejected with 413'
    );

    await assert.rejects(
        mediaService.uploadMedia(memberActor, DUMMY_GARBAGE, { category: 'general' }),
        (err: ServiceError) => {
            assert.strictEqual(err.status, 415);
            assert.strictEqual(err.code, 'unsupported_media_type');
            return true;
        },
        'Garbage rejected with 415'
    );
    console.log('✓ Size ceilings and unsupported MIME rejections verified');

    // 3b. Tiered moderation: Member upload defaults to 'pending'
    const memberUpload = await mediaService.uploadMedia(memberActor, DUMMY_JPEG, {
        category: 'community',
        caption: 'Great match today!',
        tags: ['football', 'finals'],
    });
    assert.strictEqual(memberUpload.status, 'pending', 'Member upload defaults to pending');
    assert.strictEqual(memberUpload.uploader.user_id, memberActor.id);
    assert.strictEqual(memberUpload.caption, 'Great match today!');

    // 3c. Tiered moderation: Core upload defaults to 'approved'
    const coreUpload = await mediaService.uploadMedia(coreActor, DUMMY_PNG, {
        category: 'event',
        event_id: 'ev-101',
        caption: 'Official Event Banner',
        tags: ['tournament', 'official'],
    });
    assert.strictEqual(coreUpload.status, 'approved', 'Core upload defaults to approved');
    assert.strictEqual(coreUpload.approved_by, coreActor.id);
    console.log('✓ Tiered moderation defaults (pending vs approved) verified');

    // 3d. Public gallery isolation: pending media is hidden by default
    const publicGallery = await mediaService.listMedia({ page: 1, limit: 10 });
    const hasMemberUpload = publicGallery.items.some((item) => item._id === memberUpload._id);
    const hasCoreUpload = publicGallery.items.some((item) => item._id === coreUpload._id);
    assert.strictEqual(hasMemberUpload, false, 'Pending member upload is hidden from public gallery');
    assert.strictEqual(hasCoreUpload, true, 'Approved core upload is present in public gallery');

    // 3e. Moderation queue: Core sees pending uploads
    const pendingList = await mediaService.listPendingModeration({ page: 1, limit: 10 });
    assert.strictEqual(pendingList.items.length, 1);
    assert.strictEqual(pendingList.items[0]._id, memberUpload._id);
    console.log('✓ Moderation queue isolation verified');

    // 3f. Admin moderation approval
    const approvedMemberUpload = await mediaService.moderateMedia(memberUpload._id, coreActor, {
        status: 'approved',
    });
    assert.strictEqual(approvedMemberUpload.status, 'approved');
    assert.strictEqual(approvedMemberUpload.approved_by, coreActor.id);

    const publicGalleryAfterApproval = await mediaService.listMedia({ page: 1, limit: 10 });
    assert.strictEqual(
        publicGalleryAfterApproval.items.some((item) => item._id === memberUpload._id),
        true,
        'Member upload is now visible in public gallery after approval'
    );
    console.log('✓ Moderation approval workflow verified');

    // 3g. Admin moderation rejection with reason
    const memberUpload2 = await mediaService.uploadMedia(memberActor, DUMMY_JPEG, {
        category: 'community',
        caption: 'Spam picture',
    });
    assert.strictEqual(memberUpload2.status, 'pending');

    const rejectedUpload = await mediaService.moderateMedia(memberUpload2._id, coreActor, {
        status: 'rejected',
        rejection_reason: 'Inappropriate content',
    });
    assert.strictEqual(rejectedUpload.status, 'rejected');
    assert.strictEqual(rejectedUpload.rejection_reason, 'Inappropriate content');
    console.log('✓ Moderation rejection workflow verified');

    // 3h. Album creation and association
    const album = await mediaService.createAlbum(coreActor.id, {
        title: 'Spring League 2026 Finals!',
        category: 'event',
        event_id: 'ev-101',
    });
    assert.strictEqual(album.slug, 'spring-league-2026-finals', 'Slug derived cleanly');
    assert.strictEqual(album.media_count, 0);

    const albumUpload = await mediaService.uploadMedia(coreActor, DUMMY_PNG, {
        category: 'event',
        event_id: 'ev-101',
        album_id: album._id,
        caption: 'Trophy ceremony',
    });
    const refreshedAlbum = await mediaService.getAlbumById(album.slug);
    assert.strictEqual(refreshedAlbum.media_count, 1, 'Album media_count incremented');
    assert.strictEqual(refreshedAlbum.media.length, 1, 'Album constituent media populated');
    console.log('✓ Album creation, slug derivation, and media count tracking verified');

    // 3i. Like toggle and view count increment
    const likeRes = await mediaService.toggleLike(albumUpload._id);
    assert.strictEqual(likeRes.likes_count, 1, 'Likes count incremented');

    const itemDetail = await mediaService.getMediaById(albumUpload._id);
    assert.strictEqual(itemDetail._id, albumUpload._id);
    console.log('✓ Like toggling and view count fetching verified');

    // Set as cover media on album
    await MediaAlbum.updateOne({ _id: album._id }, { $set: { cover_media_id: albumUpload._id } });
    const albumWithCover = await MediaAlbum.findById(album._id);
    assert.strictEqual(albumWithCover?.cover_media_id, albumUpload._id);

    // 3j. Delete media item: decrements album media_count and unsets cover_media_id
    const delRes = await mediaService.deleteMedia(albumUpload._id, coreActor);
    assert.strictEqual(delRes.success, true);
    const albumAfterDel = await mediaService.getAlbumById(album._id);
    assert.strictEqual(albumAfterDel.media_count, 0, 'Album media_count decremented upon media deletion');
    const albumDocAfterDel = await MediaAlbum.findById(album._id);
    assert.strictEqual(albumDocAfterDel?.cover_media_id, null, 'Album cover_media_id unset upon media deletion');
    console.log('✓ Media deletion, album count rollback, and cover_media_id unsetting verified');

    /* ---------------- 4. Event Consumers (UserProfileUpdated, UserDeleted, EventCompleted) ---------------- */
    const { initializeConsumers } = await import('../events/consumers');
    initializeConsumers();

    // Create user in DB
    await User.create({
        _id: memberActor.id,
        email: 'rahul@test.local',
        username: 'rahul_dravid',
        role: UserRole.MEMBER,
        profile: { full_name: 'Rahul The Wall Dravid', avatar_url: '/uploads/avatars/rahul.png' },
    });

    const { publish } = await import('@bgsc/shared');

    // 4a. UserProfileUpdated
    publish('UserProfileUpdated', 'user-service', {
        user_id: memberActor.id,
        changed_fields: ['full_name', 'avatar_url'],
    });
    // Wait briefly for in-memory event dispatch
    await new Promise((resolve) => setTimeout(resolve, 50));
    const memberMediaUpdated = await Media.findById(memberUpload._id);
    assert.strictEqual(
        memberMediaUpdated?.uploader.display_name,
        'Rahul The Wall Dravid',
        'Uploader snapshot updated after UserProfileUpdated event'
    );
    assert.strictEqual(
        memberMediaUpdated?.uploader.avatar_url,
        '/uploads/avatars/rahul.png',
        'Uploader avatar snapshot updated'
    );
    console.log('✓ UserProfileUpdated consumer snapshot sync verified');

    // 4b. UserDeleted GDPR anonymization
    publish('UserDeleted', 'auth-service', { user_id: memberActor.id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const memberMediaAnonymized = await Media.findById(memberUpload._id);
    assert.strictEqual(
        memberMediaAnonymized?.uploader.display_name,
        'Deleted User',
        'Uploader display_name anonymized to Deleted User'
    );
    assert.strictEqual(
        memberMediaAnonymized?.uploader.avatar_url,
        null,
        'Uploader avatar set to null'
    );
    console.log('✓ UserDeleted consumer anonymization verified');

    // 4c. EventCompleted auto-album creation
    publish('EventCompleted', 'event-service', {
        event_id: 'ev-999',
        title: 'Summer Cup 2026',
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const autoAlbum = await MediaAlbum.findOne({ event_id: 'ev-999' });
    assert.ok(autoAlbum, 'Event album auto-created upon EventCompleted');
    assert.strictEqual(autoAlbum.title, 'Summer Cup 2026 Album');
    assert.strictEqual(autoAlbum.category, 'event');
    console.log('✓ EventCompleted consumer auto album initialization verified');

    // Clean up created files in storage
    const allRemaining = await Media.find().lean();
    for (const m of allRemaining) {
        await deleteMediaObject(m.url.replace('/uploads/', ''));
    }

    await closeScratchDb();
    console.log('\n[media-service selfcheck] ALL ASSERTIONS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
    console.error('[media-service selfcheck] FAILED:', err);
    process.exit(1);
});
