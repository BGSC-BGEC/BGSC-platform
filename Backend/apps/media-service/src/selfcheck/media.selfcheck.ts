import { SCRATCH_UPLOADS } from './env'; // FIRST: points config.uploadDir at a scratch directory
import assert from 'assert';
import { promises as fs } from 'fs';
import path from 'path';
import { Server, request } from 'http';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { gzipSync } from 'zlib';
import jwt from 'jsonwebtoken';
import { Event, IUser, Media, MediaAlbum, MediaLike, ServiceError, User, UserRole, config, resetBus } from '@bgsc/shared';
import {
    PENDING_DIR,
    UPLOAD_DIR,
    IMAGE_MAX_BYTES,
    deleteMediaObject,
    keyOf,
    putMediaObject,
    sniffMedia,
} from '../storage/storage';
import { MAX_PENDING_ITEMS, mediaService } from '../media/media.service';
import { declaredSize } from '../media/media.controller';
import { ListMediaQuerySchema, UploadMediaQuerySchema } from '../media/media.schemas';
import { handlers } from '../events/consumers';
import { app } from '../index';

const uuid = (): string => randomUUID();
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

async function seedUser(fullName: string, role: UserRole): Promise<IUser> {
    const id = uuid();
    return User.create({ _id: id, email: `${id}@selfcheck.local`, username: `sc_${id.slice(0, 8)}`, role, profile: { full_name: fullName } });
}

async function seedEvent(title: string, created_by = uuid(), status: 'ongoing' | 'draft' = 'ongoing'): Promise<string> {
    const id = uuid();
    await Event.create({
        _id: id,
        slug: `sc-${id.slice(0, 12)}`,
        title,
        category: 'bgec',
        type: 'DE',
        domain: 'sports',
        status,
        start_at: new Date(Date.now() + 86_400_000),
        end_at: new Date(Date.now() + 172_800_000),
        registration: { closes_at: new Date(Date.now() + 43_200_000), form_id: null },
        teaming: { is_teamed: false },
        leaderboard: null,
        created_by,
    });
    return id;
}

/** The invariant every moderation race must end in: the file is where the row's status says. */
async function fileMatchesRow(id: string, url: string): Promise<boolean> {
    const row = await Media.findById(id).lean();
    const [pub, held] = [await onDisk(UPLOAD_DIR, url), await onDisk(PENDING_DIR, url)];
    if (!row || row.status === 'rejected') return !pub && !held;
    return row.status === 'approved' ? pub && !held : held && !pub;
}

const onDisk = (root: string, url: string) => fs.access(path.join(root, keyOf(url))).then(() => true, () => false);

async function expectError(fn: () => Promise<unknown>, code: string, what: string): Promise<void> {
    await assert.rejects(fn, (err: ServiceError) => {
        assert.strictEqual(err.code, code, `${what}: expected ${code}, got ${err.code}`);
        return true;
    }, what);
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
    assert.strictEqual(UPLOAD_DIR, SCRATCH_UPLOADS, 'storage writes under config.uploadDir (here: a scratch dir)');

    /* ---------------- 1. Magic-byte sniffing ---------------- */
    assert.strictEqual(sniffMedia(DUMMY_JPEG)?.mime, 'image/jpeg');
    assert.strictEqual(sniffMedia(DUMMY_PNG)?.mime, 'image/png');
    assert.strictEqual(sniffMedia(DUMMY_WEBP)?.mime, 'image/webp');
    assert.strictEqual(sniffMedia(DUMMY_MP4)?.mime, 'video/mp4');
    assert.strictEqual(sniffMedia(DUMMY_WEBM)?.mime, 'video/webm');
    assert.strictEqual(sniffMedia(DUMMY_GARBAGE), null, 'garbage/HTML input sniff returns null');
    const ftyp = (brand: string) => Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp' + brand, 'latin1'), Buffer.alloc(4)]);
    assert.strictEqual(sniffMedia(ftyp('mp42'))?.mime, 'video/mp4', 'an mp42 brand is an MP4');
    assert.strictEqual(sniffMedia(ftyp('M4V '))?.mime, 'video/mp4', 'and M4V');
    assert.strictEqual(sniffMedia(ftyp('heic')), null, 'a HEIC image is an ftyp box too, and not an MP4');
    assert.strictEqual(sniffMedia(ftyp('qt  ')), null, 'nor is QuickTime');
    // A full ftyp box: size, 'ftyp', major brand, minor version, compatible brands.
    const box = (major: string, ...compat: string[]) => {
        const b = Buffer.from(`\0\0\0\0ftyp${major}\0\0\0\0${compat.join('')}`, 'latin1');
        b.writeUInt32BE(b.length, 0);
        return b;
    };
    assert.strictEqual(sniffMedia(box('mmp4', 'mmp4'))?.mime, 'video/mp4', 'a phone mmp4 is an MP4');
    assert.strictEqual(sniffMedia(box('XAVC', 'XAVC', 'mp42', 'iso2'))?.mime, 'video/mp4', 'and a camera XAVC');
    assert.strictEqual(sniffMedia(box('3gp4', '3gp4', 'isom'))?.mime, 'video/mp4', 'an unknown major brand counts by its compatible ones');
    assert.strictEqual(sniffMedia(box('heic', 'mif1', 'heic')), null, 'a real HEIC lists no MP4 brand');
    assert.strictEqual(sniffMedia(box('avis', 'avis', 'msf1', 'iso8', 'miaf')), null, 'an AVIF sequence is not a video, iso8 or not');
    assert.strictEqual(sniffMedia(box('M4A ', 'M4A ', 'mp42', 'isom')), null, 'nor is iTunes audio');
    assert.strictEqual(sniffMedia(box('qt  ', 'qt  ')), null, 'nor a QuickTime file');
    const truncated = box('qt  ', 'qt  ', 'isom');
    truncated.writeUInt32BE(20, 0);
    assert.strictEqual(sniffMedia(truncated), null, 'a brand past the box end does not count');
    console.log('✓ Magic-byte sniffing for JPEG, PNG, WebP, MP4, WebM verified');

    /* ---------------- 2. Storage: two trees, traversal ---------------- */
    const pngSniff = sniffMedia(DUMMY_PNG)!;
    const stored = await putMediaObject('test/safe', DUMMY_PNG, pngSniff);
    assert.ok(stored.url.startsWith('/uploads/test/safe/'), 'stored URL starts with /uploads/test/safe/');
    assert.ok(await onDisk(UPLOAD_DIR, stored.url), 'a public write lands in the served tree');
    const held = await putMediaObject('test/safe', DUMMY_PNG, pngSniff, true);
    assert.ok(await onDisk(PENDING_DIR, held.url) && !(await onDisk(UPLOAD_DIR, held.url)), 'a pending write does not');
    await deleteMediaObject('/' + stored.key);
    await deleteMediaObject(held.key);
    assert.ok(!(await onDisk(UPLOAD_DIR, stored.url)) && !(await onDisk(PENDING_DIR, held.url)), 'delete clears either tree');

    await assert.rejects(
        putMediaObject('../../../outside', DUMMY_PNG, pngSniff),
        /refusing to write outside upload directory/,
        'traversal attempt outside upload directory is rejected'
    );
    console.log('✓ Storage trees and path traversal defense verified');

    /* ---------------- 3. Request validation (an escaped .parse() was a 500) ---------------- */
    assert.ok(!ListMediaQuerySchema.safeParse({ limit: '51' }).success, 'limit over 50 is a 422, not a 500');
    assert.ok(!UploadMediaQuerySchema.safeParse({ event_id: '../../x' }).success, 'event_id must be a uuid (it names a directory)');
    assert.ok(
        !UploadMediaQuerySchema.safeParse({ tags: Array.from({ length: 21 }, (_, i) => `t${i}`).join(',') }).success,
        'at most 20 tags'
    );

    const sized = (headers: Record<string, string>) => {
        let status = 200;
        let passed = false;
        declaredSize(
            { headers } as never,
            { status: (s: number) => ((status = s), { json: () => undefined }) } as never,
            () => (passed = true)
        );
        return { status, passed };
    };
    assert.strictEqual(sized({ 'content-type': 'image/png', 'content-length': String(IMAGE_MAX_BYTES + 1) }).status, 413, 'an 11MB image is refused before buffering');
    assert.ok(sized({ 'content-type': 'video/mp4', 'content-length': String(IMAGE_MAX_BYTES + 1) }).passed, 'the same size of video is fine');
    assert.strictEqual(sized({ 'content-type': 'image/png' }).status, 411, 'no Content-Length, no upload');
    assert.strictEqual(sized({ 'content-type': 'image/gif', 'content-length': '10' }).status, 415, 'an unaccepted type is a 415, not an empty-body 422');
    console.log('✓ Validation, tag caps and the declared-size gate verified');

    /* ---------------- 4. Upload and moderation ---------------- */
    await openScratchDb();
    resetBus();

    const member = await seedUser('Rahul Dravid', UserRole.MEMBER);
    const other = await seedUser('Someone Else', UserRole.MEMBER);
    const core = await seedUser('Admin Coach', UserRole.CORE);
    const outsiderCore = await seedUser('Other Core', UserRole.CORE);
    const asViewer = (u: IUser) => ({ id: u._id, role: u.role });
    const eventId = await seedEvent('Spring League 2026 Finals!', core._id);

    // A draft event is a 404 to anyone who does not run it — upload included.
    const draftId = await seedEvent('Unannounced', core._id, 'draft');
    await expectError(() => mediaService.uploadMedia(member, DUMMY_PNG, { category: 'event', event_id: draftId }), 'event_not_found', 'upload against a hidden draft');
    const draftUpload = await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'event', event_id: draftId });
    assert.strictEqual(draftUpload.event_id, draftId, "the draft's own admin may");

    const oversizedImage = Buffer.alloc(IMAGE_MAX_BYTES + 10);
    oversizedImage[0] = 0xff;
    oversizedImage[1] = 0xd8;
    oversizedImage[2] = 0xff;
    await expectError(() => mediaService.uploadMedia(member, oversizedImage, { category: 'general' }), 'image_payload_too_large', 'Oversized image rejected with 413');
    await expectError(() => mediaService.uploadMedia(member, DUMMY_GARBAGE, { category: 'general' }), 'unsupported_media_type', 'Garbage rejected with 415');
    await expectError(
        () => mediaService.uploadMedia(core, DUMMY_PNG, { category: 'event', event_id: uuid() }),
        'event_not_found',
        'an upload against an event that does not exist'
    );

    const memberUpload = await mediaService.uploadMedia(member, DUMMY_JPEG, {
        category: 'community',
        caption: 'Great match today!',
        tags: ['football', 'finals'],
    });
    assert.strictEqual(memberUpload.status, 'pending', 'Member upload defaults to pending');
    assert.strictEqual(memberUpload.uploader.display_name, 'Rahul Dravid', 'the uploader snapshot is the user, not their id');
    assert.ok(await onDisk(PENDING_DIR, memberUpload.url), 'a pending file sits in the unserved tree');
    assert.ok(!(await onDisk(UPLOAD_DIR, memberUpload.url)), 'and is NOT publicly served');

    const coreUpload = await mediaService.uploadMedia(core, DUMMY_PNG, {
        category: 'event',
        event_id: eventId,
        caption: 'Official Event Banner',
    });
    assert.strictEqual(coreUpload.status, 'approved', 'Core upload defaults to approved');
    assert.strictEqual(coreUpload.approved_by, core._id);
    assert.ok(coreUpload.url.startsWith(`/uploads/media/event/${eventId}/`), 'media writes under its own media/ prefix');
    assert.ok(await onDisk(UPLOAD_DIR, coreUpload.url), 'an approved file is served');
    console.log('✓ Tiered moderation defaults, live uploader snapshot, and pending storage verified');

    const publicGallery = await mediaService.listMedia({ page: 1, limit: 10 });
    assert.ok(!publicGallery.items.some((i) => i._id === memberUpload._id), 'Pending member upload is hidden from public gallery');
    assert.ok(publicGallery.items.some((i) => i._id === coreUpload._id), 'Approved core upload is present in public gallery');

    await expectError(() => mediaService.getMediaById(memberUpload._id, null), 'media_not_found', 'a pending item is a 404 to a guest');
    await expectError(() => mediaService.getMediaById(memberUpload._id, asViewer(other)), 'media_not_found', 'and to another member');
    assert.strictEqual((await mediaService.getMediaById(memberUpload._id, asViewer(member)))._id, memberUpload._id, 'its uploader sees it');

    const pendingList = await mediaService.listPendingModeration({ page: 1, limit: 10 }, asViewer(core));
    assert.deepStrictEqual(pendingList.items.map((i) => i._id), [memberUpload._id]);
    assert.strictEqual(pendingList.items[0].preview_url, `/media/${memberUpload._id}/file`, 'each queue item says where to look at it');

    const approved = await mediaService.moderateMedia(memberUpload._id, core, { status: 'approved' });
    assert.strictEqual(approved.status, 'approved');
    assert.ok(await onDisk(UPLOAD_DIR, memberUpload.url) && !(await onDisk(PENDING_DIR, memberUpload.url)), 'approval moves the file into /uploads');
    await expectError(() => mediaService.moderateMedia(memberUpload._id, core, { status: 'approved' }), 'media_not_pending', 'approving twice');

    const spam = await mediaService.uploadMedia(member, DUMMY_JPEG, { category: 'community', caption: 'Spam picture' });
    const rejected = await mediaService.moderateMedia(spam._id, core, { status: 'rejected', rejection_reason: 'Inappropriate content' });
    assert.strictEqual(rejected.rejection_reason, 'Inappropriate content');
    assert.ok(!(await onDisk(PENDING_DIR, spam.url)) && !(await onDisk(UPLOAD_DIR, spam.url)), 'a rejected file is deleted');
    await expectError(() => mediaService.moderateMedia(spam._id, core, { status: 'approved' }), 'media_not_pending', 'and cannot be approved after');
    console.log('✓ Moderation moves, deletes, and refuses out-of-order decisions');

    // An uploader's edit to an approved item goes back to review and out of /uploads.
    const edited = await mediaService.updateMedia(memberUpload._id, member, { caption: 'Now something else' });
    assert.strictEqual(edited.status, 'pending', 'a member edit re-enters moderation');
    assert.ok(await onDisk(PENDING_DIR, memberUpload.url) && !(await onDisk(UPLOAD_DIR, memberUpload.url)), 'and its file is withdrawn');
    const coreEdit = await mediaService.updateMedia(coreUpload._id, core, { tags: ['official'] });
    assert.strictEqual(coreEdit.status, 'approved', 'a core edit does not');
    await mediaService.moderateMedia(memberUpload._id, core, { status: 'approved' });
    console.log('✓ Non-core edits are re-moderated');

    /* ---------------- 4b. Moderation races and missing files ---------------- */
    const legacy = await mediaService.uploadMedia(member, DUMMY_PNG, { category: 'community' });
    await deleteMediaObject(keyOf(legacy.url)); // a row whose file never reached this upload root
    await expectError(() => mediaService.moderateMedia(legacy._id, core, { status: 'approved' }), 'file_missing', 'approving a row with no file');
    assert.strictEqual((await Media.findById(legacy._id).lean())!.status, 'pending', 'and nothing was written');
    await mediaService.moderateMedia(legacy._id, core, { status: 'rejected' }); // rejecting it is fine

    for (let i = 0; i < 3; i++) {
        const racy = await mediaService.uploadMedia(member, DUMMY_PNG, { category: 'community' });
        await Promise.allSettled([
            mediaService.moderateMedia(racy._id, core, { status: 'approved' }),
            mediaService.deleteMedia(racy._id, member),
        ]);
        assert.ok(await fileMatchesRow(racy._id, racy.url), `approve vs delete #${i}: no orphaned or hidden file`);

        const edity = await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'community' });
        await Media.updateOne({ _id: edity._id }, { $set: { 'uploader.user_id': member._id } }); // the member's, already approved
        await Promise.allSettled([
            mediaService.updateMedia(edity._id, member, { caption: 'changed' }),
            mediaService.moderateMedia(edity._id, core, { status: 'approved' }),
        ]);
        assert.ok(await fileMatchesRow(edity._id, edity.url), `edit vs approve #${i}: the file follows the final status`);
    }

    // Per-uploader quota on what waits for a moderator.
    const eager = await seedUser('Eager Uploader', UserRole.MEMBER);
    for (let i = 0; i < MAX_PENDING_ITEMS; i++) await mediaService.uploadMedia(eager, DUMMY_PNG, { category: 'community' });
    await expectError(() => mediaService.uploadMedia(eager, DUMMY_PNG, { category: 'community' }), 'pending_quota_exceeded', `the ${MAX_PENDING_ITEMS + 1}th pending upload`);
    assert.ok(await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'community' }), 'core is not capped');
    console.log('✓ Moderation races converge, missing files refuse, and pending uploads are capped');

    /* ---------------- 5. Albums ---------------- */
    const album = await mediaService.createAlbum(core, { title: 'Spring League 2026 Finals!', category: 'event', event_id: eventId });
    assert.strictEqual(album.slug, 'spring-league-2026-finals', 'Slug derived cleanly');
    const twin = await mediaService.createAlbum(core, { title: 'Spring League 2026 Finals!' });
    assert.ok(twin.slug.startsWith('spring-league-2026-finals-'), 'a derived slug collision gets a suffix, not a 500');
    await expectError(() => mediaService.createAlbum(core, { title: 'x', slug: album.slug }), 'album_slug_already_exists', 'a chosen slug collision is a 409');
    await expectError(() => mediaService.createAlbum(core, { title: '🎉🎉' }), 'album_slug_required', 'a title with nothing to slugify is a 422');
    // Owner decision: many manual albums per event; the event's admins make them, not any core.
    const dayTwo = await mediaService.createAlbum(core, { title: 'Spring League Day Two', event_id: eventId });
    assert.strictEqual(dayTwo.event_id, eventId, 'a second manual album for one event is allowed');
    await expectError(() => mediaService.createAlbum(outsiderCore, { title: 'Not Mine', event_id: eventId }), 'forbidden', 'a core member who does not run the event');
    await expectError(() => mediaService.createAlbum(outsiderCore, { title: 'Hidden', event_id: draftId }), 'event_not_found', 'and a draft is a 404 to them');

    const privateAlbum = await mediaService.createAlbum(core, { title: 'Committee Only', is_public: false });
    await expectError(() => mediaService.getAlbumById(privateAlbum.slug, null), 'album_not_found', 'a private album is a 404 to a guest');
    assert.ok(await mediaService.getAlbumById(privateAlbum._id, asViewer(core)), 'core can open it');
    await expectError(
        () => mediaService.uploadMedia(member, DUMMY_PNG, { category: 'general', album_id: privateAlbum._id }),
        'album_not_found',
        'a member cannot upload into a private album'
    );

    const albumUpload = await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'event', event_id: eventId, album_id: album._id });
    const memberInAlbum = await mediaService.uploadMedia(member, DUMMY_PNG, { category: 'event', album_id: album._id });
    assert.strictEqual((await MediaAlbum.findById(album._id))!.media_count, 1, 'media_count counts approved items only');
    await mediaService.moderateMedia(memberInAlbum._id, core, { status: 'approved' });
    assert.strictEqual((await MediaAlbum.findById(album._id))!.media_count, 2, 'and moves on approval');
    const refreshedAlbum = await mediaService.getAlbumById(album.slug, null);
    assert.strictEqual(refreshedAlbum.media.length, 2, 'Album constituent media populated');

    // The general gallery is not a side door into a private album.
    const secretShot = await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'general', album_id: privateAlbum._id });
    const guestPage = await mediaService.listMedia({ page: 1, limit: 50 }, null);
    assert.ok(!guestPage.items.some((i) => i._id === secretShot._id), 'private-album media is not in a guest gallery');
    assert.ok((await mediaService.listMedia({ page: 1, limit: 50 }, asViewer(core))).items.some((i) => i._id === secretShot._id), 'core sees it');
    console.log('✓ Albums: slugs, event-admin scope, privacy, and approved-only counts');

    /* ---------------- 5b. An event's gallery is its admins' ---------------- */
    const boss = await seedUser('The Coordinator', UserRole.COORDINATOR);
    const intruder = await mediaService.uploadMedia(outsiderCore, DUMMY_PNG, { category: 'event', event_id: eventId });
    assert.strictEqual(intruder.status, 'pending', "a core member who does not run the event waits for moderation there");
    const viaAlbum = await mediaService.uploadMedia(outsiderCore, DUMMY_PNG, { category: 'general', album_id: album._id });
    assert.strictEqual(viaAlbum.status, 'pending', 'and through its album too');
    assert.strictEqual(
        (await mediaService.uploadMedia(outsiderCore, DUMMY_PNG, { category: 'general' })).status,
        'approved',
        'the general gallery is still any core member\'s'
    );
    await expectError(() => mediaService.moderateMedia(intruder._id, outsiderCore, { status: 'approved' }), 'forbidden', 'moderating another event\'s item');
    await expectError(() => mediaService.moderateMedia(memberInAlbum._id, outsiderCore, { status: 'rejected' }), 'forbidden', 'rejecting from its album');
    await expectError(() => mediaService.deleteMedia(memberInAlbum._id, outsiderCore), 'forbidden_not_owner', 'or deleting from it');
    await mediaService.moderateMedia(viaAlbum._id, boss, { status: 'rejected' }); // coordinator+ moderates any event
    assert.strictEqual((await mediaService.moderateMedia(intruder._id, core, { status: 'approved' })).status, 'approved', "the event's admin moderates it");
    console.log('✓ Event media: only its admins or coordinator+ publish, moderate or delete it');

    /* ---------------- 5c. A draft event's gallery is not public ---------------- */
    const draftAlbum = await mediaService.createAlbum(core, { title: 'Unannounced Album', event_id: draftId });
    const inDraftAlbum = await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'general', album_id: draftAlbum._id });
    for (const [who, label] of [[null, 'a guest'], [asViewer(other), 'a member'], [asViewer(outsiderCore), 'a core member who does not run it']] as const) {
        const albums = await mediaService.listAlbums({ page: 1, limit: 50 }, who);
        assert.ok(!albums.items.some((a) => a._id === draftAlbum._id), `${label}: a draft's album is not listed`);
        await expectError(() => mediaService.getAlbumById(draftAlbum.slug, who), 'album_not_found', `${label}: nor opened`);
        await expectError(() => mediaService.listAlbums({ event_id: draftId, page: 1, limit: 20 }, who), 'event_not_found', `${label}: nor filtered to`);
        const gallery = await mediaService.listMedia({ page: 1, limit: 50 }, who);
        assert.ok(!gallery.items.some((i) => i._id === draftUpload._id || i._id === inDraftAlbum._id), `${label}: nor its photos in the gallery`);
        await expectError(() => mediaService.listMedia({ event_id: draftId, page: 1, limit: 20 }, who), 'event_not_found', `${label}: a gallery filter on it`);
        await expectError(() => mediaService.listMedia({ album_id: draftAlbum._id, page: 1, limit: 20 }, who), 'album_not_found', `${label}: its album filter`);
        await expectError(() => mediaService.getMediaById(draftUpload._id, who), 'media_not_found', `${label}: one of its photos`);
        await expectError(() => mediaService.getMediaById(inDraftAlbum._id, who), 'media_not_found', `${label}: one in its album`);
    }
    await expectError(() => mediaService.uploadMedia(outsiderCore, DUMMY_PNG, { category: 'general', album_id: draftAlbum._id }), 'album_not_found', 'uploading into it');
    // A pending item filed only through the draft's album stays out of an outsider's queue too.
    const pendingInDraftAlbum = await mediaService.uploadMedia(core, DUMMY_PNG, { category: 'general', album_id: draftAlbum._id });
    await Media.updateOne({ _id: pendingInDraftAlbum._id }, { $set: { status: 'pending' } });
    const queued = async (who: IUser) =>
        (await mediaService.listPendingModeration({ page: 1, limit: 50 }, asViewer(who))).items.some((i) => i._id === pendingInDraftAlbum._id);
    assert.ok(!(await queued(outsiderCore)), "a draft album's pending item is not in an outsider's queue");
    assert.ok(await queued(core), "but is in its admin's");
    await Media.deleteOne({ _id: pendingInDraftAlbum._id });
    assert.ok((await mediaService.listAlbums({ event_id: draftId, page: 1, limit: 20 }, asViewer(core))).items.length === 1, 'its admin sees its album');
    assert.strictEqual((await mediaService.getAlbumById(draftAlbum._id, asViewer(boss))).media.length, 1, 'and a coordinator its photos');
    console.log('✓ A draft event hides its albums and photos from everyone who does not run it');

    /* ---------------- 6. Likes ---------------- */
    const liked = await mediaService.toggleLike(albumUpload._id, asViewer(member));
    assert.deepStrictEqual([liked.liked, liked.likes_count], [true, 1], 'a like');
    const unliked = await mediaService.toggleLike(albumUpload._id, asViewer(member));
    assert.deepStrictEqual([unliked.liked, unliked.likes_count], [false, 0], 'the same user again is an unlike, not a second like');
    await mediaService.toggleLike(albumUpload._id, asViewer(member));
    const second = await mediaService.toggleLike(albumUpload._id, asViewer(other));
    assert.strictEqual(second.likes_count, 2, 'one like per user');
    assert.strictEqual(await MediaLike.countDocuments({ media_id: albumUpload._id }), 2);
    const hidden = await mediaService.uploadMedia(member, DUMMY_PNG, { category: 'general' });
    await expectError(() => mediaService.toggleLike(hidden._id, asViewer(other)), 'media_not_found', 'nobody likes what they cannot see');
    console.log('✓ Likes are a per-user toggle');

    /* ---------------- 7. Delete ---------------- */
    await MediaAlbum.updateOne({ _id: album._id }, { $set: { cover_media_id: albumUpload._id } });
    await expectError(() => mediaService.deleteMedia(hidden._id, other), 'media_not_found', 'a stranger cannot even see a pending item to delete');
    const delRes = await mediaService.deleteMedia(albumUpload._id, core);
    assert.deepStrictEqual(delRes, { id: albumUpload._id, deleted: true }, 'no hand-written success key');
    const albumAfterDel = await MediaAlbum.findById(album._id);
    assert.strictEqual(albumAfterDel!.media_count, 1, 'Album media_count decremented upon media deletion');
    assert.strictEqual(albumAfterDel!.cover_media_id, null, 'Album cover_media_id unset upon media deletion');
    assert.strictEqual(await MediaLike.countDocuments({ media_id: albumUpload._id }), 0, 'and its likes go with it');
    console.log('✓ Media deletion, album count rollback, and cover_media_id unsetting verified');

    /* ---------------- 8. Consumers ---------------- */
    await User.updateOne({ _id: member._id }, { $set: { 'profile.full_name': 'Rahul The Wall Dravid', 'profile.avatar_url': '/uploads/avatars/rahul.png' } });
    await handlers.handleUserProfileUpdated({ user_id: member._id, changed_fields: ['full_name', 'avatar_url'] });
    let snap = (await Media.findById(memberUpload._id))!.uploader;
    assert.strictEqual(snap.display_name, 'Rahul The Wall Dravid', 'Uploader snapshot updated after UserProfileUpdated');
    assert.strictEqual(snap.avatar_url, '/uploads/avatars/rahul.png');

    await User.updateOne({ _id: member._id }, { $set: { deleted_at: new Date() } });
    await handlers.handleUserDeleted({ user_id: member._id });
    snap = (await Media.findById(memberUpload._id))!.uploader;
    assert.deepStrictEqual([snap.display_name, snap.avatar_url, snap.deleted], ['Deleted user', null, true], 'the shared anonymized snapshot');

    // A deleted account never reappears through a late event.
    await handlers.handleUserProfileUpdated({ user_id: member._id, changed_fields: ['full_name'] });
    await handlers.handleUserRestored({ user_id: member._id });
    assert.strictEqual((await Media.findById(memberUpload._id))!.uploader.display_name, 'Deleted user', 'late rename/restore events are no-ops');
    await User.updateOne({ _id: member._id }, { $set: { deleted_at: null } });

    await handlers.handleUserRestored({ user_id: member._id });
    snap = (await Media.findById(memberUpload._id))!.uploader;
    assert.deepStrictEqual([snap.display_name, snap.deleted], ['Rahul The Wall Dravid', false], 'UserRestored re-snapshots');
    await handlers.handleUserDeleted({ user_id: member._id });
    assert.strictEqual((await Media.findById(memberUpload._id))!.uploader.display_name, 'Rahul The Wall Dravid', 'a replayed UserDeleted after a restore is a no-op');

    const endedId = await seedEvent('Summer Cup 2026');
    await Promise.all([
        handlers.handleEventCompleted({ event_id: endedId, title: 'stale payload title' }),
        handlers.handleEventCompleted({ event_id: endedId }),
    ]);
    const autoAlbums = await MediaAlbum.find({ event_id: endedId, created_by: 'system' }).lean();
    assert.strictEqual(autoAlbums.length, 1, 'EventCompleted twice is still one system album');
    await handlers.handleEventCompleted({ event_id: eventId }); // an event that already has manual albums
    assert.strictEqual(await MediaAlbum.countDocuments({ event_id: eventId, created_by: 'system' }), 1, 'manual albums do not block the system one');
    assert.strictEqual(autoAlbums[0].title, 'Summer Cup 2026 Album', 'titled from the Event, not the payload');
    console.log('✓ Consumers: profile, delete, restore, and an idempotent event album');

    /* ---------------- 9. Over HTTP: /uploads, the upload pipeline, previews ---------------- */
    const server: Server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}`;
    const token = (u: IUser) => jwt.sign({ sub: u._id, role: u.role }, config.jwt.accessSecret, { expiresIn: '5m' });
    /** Raw `http.request`: fetch always declares a length and never lets a test send a gzip body as-is. */
    const send = (method: string, path: string, headers: Record<string, string>, body?: Buffer) =>
        new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve, reject) => {
            const req = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (c: Buffer) => chunks.push(c));
                res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks) }));
            });
            req.on('error', reject);
            req.end(body);
        });
    const json = (b: Buffer) => JSON.parse(b.toString());
    try {
        const served = await fetch(base + coreUpload.url);
        assert.strictEqual(served.status, 200, 'an approved file is served');
        assert.strictEqual(served.headers.get('cache-control'), 'public, max-age=300', 'with a short cache: moderation can withdraw it');
        assert.strictEqual((await fetch(base + hidden.url)).status, 404, 'a pending file is not, at its future URL');
        assert.strictEqual((await fetch(`${base}/uploads/.pending/${keyOf(hidden.url)}`)).status, 404, 'nor from the pending tree');
        assert.strictEqual((await fetch(`${base}/uploads/%2Epending/${keyOf(hidden.url)}`)).status, 404, 'nor with the dot encoded');
        await fs.mkdir(path.join(UPLOAD_DIR, '.private', 'registrations'), { recursive: true });
        await fs.writeFile(path.join(UPLOAD_DIR, '.private', 'registrations', 'x.png'), DUMMY_PNG);
        assert.strictEqual((await fetch(`${base}/uploads/.private/registrations/x.png`)).status, 404, 'nor a private registration file');
        const dir = await fetch(`${base}/uploads/media`, { redirect: 'manual' });
        assert.strictEqual(dir.status, 404, 'a directory is a 404 like anything else — no redirect confirming it exists');
        console.log('✓ /uploads serves approved files only, and no directory or dot-tree');

        const uploader = await seedUser('Http Uploader', UserRole.MEMBER);
        const snoop = await seedUser('Http Snoop', UserRole.MEMBER);
        const up = (headers: Record<string, string>, body?: Buffer, query = 'category=community') =>
            send('POST', `/media/upload?${query}`, { authorization: `Bearer ${token(uploader)}`, ...headers }, body);

        const created = await up({ 'content-type': 'application/octet-stream', 'content-length': String(DUMMY_PNG.length) }, DUMMY_PNG);
        assert.strictEqual(created.status, 201, 'an octet-stream body is sniffed and stored');
        const item = json(created.body).data;
        assert.deepStrictEqual([item.status, item.mime_type], ['pending', 'image/png'], 'as what its bytes are, waiting for moderation');

        assert.strictEqual((await up({ 'content-type': 'image/png', 'transfer-encoding': 'chunked' }, DUMMY_PNG)).status, 411, 'a chunked body declares no length: 411');
        assert.strictEqual((await up({ 'content-type': 'image/gif', 'content-length': String(DUMMY_PNG.length) }, DUMMY_PNG)).status, 415, 'an unaccepted type: 415');
        const html = await up({ 'content-type': 'image/png', 'content-length': String(DUMMY_GARBAGE.length) }, DUMMY_GARBAGE);
        assert.strictEqual(html.status, 415, 'bytes that are not media: 415, whatever the header says');
        assert.strictEqual((await up({ 'content-type': 'image/png', 'content-length': String(DUMMY_PNG.length) }, DUMMY_PNG, 'event_id=../x')).status, 422, 'a bad query is refused before the body is read');

        const bomb = gzipSync(Buffer.concat([DUMMY_PNG, Buffer.alloc(1024 * 1024)]));
        const before = await Media.countDocuments({ 'uploader.user_id': uploader._id });
        const gz = await up({ 'content-type': 'image/png', 'content-encoding': 'gzip', 'content-length': String(bomb.length) }, bomb);
        assert.strictEqual(gz.status, 415, 'a gzip-encoded body is refused, not inflated');
        assert.strictEqual(await Media.countDocuments({ 'uploader.user_id': uploader._id }), before, 'and stores nothing');
        console.log('✓ Upload pipeline over HTTP: validate → declared size → raw → handler');

        const file = (u: IUser | null, id = item._id) =>
            send('GET', `/media/${id}/file`, u ? { authorization: `Bearer ${token(u)}` } : {});
        const preview = await file(core);
        assert.strictEqual(preview.status, 200, 'a moderator can look at a pending file');
        assert.ok(preview.body.equals(DUMMY_PNG), 'the bytes that were uploaded');
        assert.strictEqual(preview.headers['content-type'], 'image/png', 'as the stored type');
        assert.strictEqual(preview.headers['cache-control'], 'private, no-store', 'never cached');
        assert.strictEqual(preview.headers['x-content-type-options'], 'nosniff');
        assert.strictEqual((await file(uploader)).status, 200, 'so can its uploader');
        assert.strictEqual((await file(snoop)).status, 404, 'nobody else');
        assert.strictEqual((await file(null)).status, 401, 'and not anonymously');
        assert.strictEqual((await file(outsiderCore, draftUpload._id)).status, 404, "nor a hidden draft's file to core who does not run it");
        assert.strictEqual((await file(snoop, coreUpload._id)).status, 200, 'an approved file is there for anyone signed in');
        console.log('✓ GET /media/:id/file: previews for moderators and uploaders only');
    } finally {
        server.close();
    }

    await closeScratchDb();
    await fs.rm(SCRATCH_UPLOADS, { recursive: true, force: true });
    console.log('\n[media-service selfcheck] ALL ASSERTIONS PASSED SUCCESSFULLY!');
}

main().catch(async (err) => {
    console.error('[media-service selfcheck] FAILED:', err);
    await closeScratchDb().catch(() => undefined);
    await fs.rm(SCRATCH_UPLOADS, { recursive: true, force: true }).catch(() => undefined);
    process.exit(1);
});
