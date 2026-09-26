/**
 * End-to-end check for the Announcement Service: real Express app, real Mongo, real JWTs.
 * Scratch database dropped on exit. Pattern copied from apps/user-service/src/users/user.e2e.ts.
 *
 *   npx ts-node apps/announcement-service/src/announcements/announcement.e2e.ts
 */
import assert from 'assert';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'http';
import { v4 as uuid } from 'uuid';
import { app } from '../index';
import {
    Announcement,
    AuditLog,
    User,
    UserRole,
    UserStatus,
    config,
    resetBus,
    subscribe,
} from '@bgsc/shared';

// Its own scratch DB: the shared `bgsc_e2e` was also user-service's, so the two e2e runs dropped
// each other's fixtures when they overlapped.
const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_announcement$2');

let server: Server;
let base: string;

const token = (id: string, role: UserRole) =>
    jwt.sign({ sub: id, role }, config.jwt.accessSecret, { expiresIn: '5m' });

interface Res { status: number; body: any }

async function call(
    method: string,
    path: string,
    opts: { as?: string; body?: unknown; service?: boolean; badService?: boolean } = {}
): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.as) headers.authorization = `Bearer ${opts.as}`;
    // The internal delivery writeback carries a service token, never a user session.
    if (opts.service) headers['x-internal-token'] = config.internalToken;
    if (opts.badService) headers['x-internal-token'] = 'not-the-token';
    // fetch() sets text/plain for string bodies; express.json() needs application/json to parse.
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(base + path, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await r.text();
    const parsed = text ? JSON.parse(text) : null;
    const body =
        parsed && typeof parsed === 'object' && parsed.success === true && 'data' in parsed
            ? parsed.data
            : parsed;
    return { status: r.status, body };
}

async function main(): Promise<void> {
    try {
        await mongoose.connect(TEST_DB);
        await mongoose.connection.dropDatabase();
        await User.syncIndexes();
        await Announcement.syncIndexes();
        await AuditLog.syncIndexes();

        server = app.listen(0);
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

        resetBus();

        // ---- fixtures ---------------------------------------------------------
        const coord = await User.create({
            _id: uuid(),
            email: `${uuid()}@e2e.local`,
            username: `e2e_coord_${Date.now()}`,
            role: UserRole.COORDINATOR,
            status: UserStatus.ACTIVE,
            profile: { full_name: 'E2E Coord' },
        });
        const member = await User.create({
            _id: uuid(),
            email: `${uuid()}@e2e.local`,
            username: `e2e_member_${Date.now()}`,
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
            profile: { full_name: 'E2E Member' },
        });
        const founder = await User.create({
            _id: uuid(),
            email: `${uuid()}@e2e.local`,
            username: `e2e_founder_${Date.now()}`,
            role: UserRole.FOUNDER,
            status: UserStatus.ACTIVE,
            profile: { full_name: 'E2E Founder' },
        });
        const coordTok = token(coord._id, UserRole.COORDINATOR);
        const memberTok = token(member._id, UserRole.USER);
        const founderTok = token(founder._id, UserRole.FOUNDER);

        // ---- 1. /health + security header ------------------------------------
        console.log('1. Health + security headers...');
        const health = await fetch(`${base}/health`);
        assert.strictEqual(health.status, 200);
        assert.strictEqual(health.headers.get('x-content-type-options'), 'nosniff');
        const healthBody = (await health.json()) as { db: string };
        assert.strictEqual(healthBody.db, 'connected');
        console.log('✓ /health 200, db connected, nosniff header');

        // ---- 2. anon feed returns envelope + applies audience filter ----------
        console.log('2. Anon feed...');
        const publicDoc = await Announcement.create({
            _id: uuid(),
            title: 'Public',
            body: 'b',
            categories: ['bgec'],
            author: { user_id: coord._id, display_name: 'C', role_label: 'Coordinator' },
            status: 'published',
            published_at: new Date(),
            audience: { min_role: 'guest', event_id: null },
        });
        const gatedDoc = await Announcement.create({
            _id: uuid(),
            title: 'Gated',
            body: 'b',
            categories: ['bgec'],
            author: { user_id: coord._id, display_name: 'C', role_label: 'Coordinator' },
            status: 'published',
            published_at: new Date(),
            audience: { min_role: 'core', event_id: null },
        });
        const feed = await call('GET', '/announcements?limit=10');
        assert.strictEqual(feed.status, 200);
        const feedIds = feed.body.announcements.map((a: { _id: string }) => a._id);
        assert(feedIds.includes(publicDoc._id), 'guest sees public announcement');
        assert(!feedIds.includes(gatedDoc._id), 'guest does not see core-gated announcement');
        console.log('✓ anon feed filters by audience');

        // ---- 2b. response shape ------------------------------------------------
        console.log('2b. Serializer...');
        const publicCard = feed.body.announcements.find((a: { _id: string }) => a._id === publicDoc._id);
        assert(!('delivery' in publicCard), 'a reader never sees the delivery block');
        assert(!('__v' in publicCard), 'nor Mongoose bookkeeping');
        const composerView = await call('GET', `/announcements/${publicDoc._id}`, { as: coordTok });
        assert('delivery' in composerView.body, 'the composer does');
        assert(!('__v' in composerView.body));
        console.log('✓ delivery is core+ only, __v never leaves');

        // ---- 3. anon GET on role-gated doc → 404 (not 403) --------------------
        console.log('3. Scope-leak guard...');
        const hidden = await call('GET', `/announcements/${gatedDoc._id}`);
        assert.strictEqual(hidden.status, 404, 'guest gets 404, not 403');
        console.log('✓ role-gated doc 404s for unauthorized viewer');

        // ---- 4. POST without core rank → 403 --------------------------------
        console.log('4. Role gate on POST...');
        const denied = await call('POST', '/announcements', {
            as: memberTok,
            body: { title: 't', body: 'b', categories: ['bgec'] },
        });
        assert.strictEqual(denied.status, 403);
        console.log('✓ user role is refused at composer');

        // ---- 5. POST strips {status:'published'} → draft ---------------------
        console.log('5. Mass-assignment guard...');
        const created = await call('POST', '/announcements', {
            as: coordTok,
            body: {
                title: 'New',
                body: 'b',
                categories: ['bgec'],
                status: 'published',  // client trying to skip the draft gate
                published_at: new Date().toISOString(),
            },
        });
        assert.strictEqual(created.status, 201, JSON.stringify(created));
        assert.strictEqual(created.body.status, 'draft', 'zod stripped status, response shows draft');
        assert.strictEqual(created.body.published_at, null, 'published_at ignored too');
        console.log('✓ unknown fields stripped by validate()');

        // ---- 6. POST empty categories → 422 ----------------------------------
        console.log('6. Empty categories rejected...');
        const noCats = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 't', body: 'b', categories: [] },
        });
        assert.strictEqual(noCats.status, 422);
        console.log('✓ categories empty → 422');

        // ---- 7. POST oversize body → 422 -------------------------------------
        console.log('7. Oversize body rejected...');
        const huge = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 't', body: 'x'.repeat(5001), categories: ['bgec'] },
        });
        assert.strictEqual(huge.status, 422);
        console.log('✓ body > 5000 → 422');

        // ---- 7b. media_url and body hardening --------------------------------
        console.log('7b. media_url / body...');
        const withMedia = (media_url: string, body = 'b') =>
            call('POST', '/announcements', { as: coordTok, body: { title: 't', body, categories: ['bgec'], media_url } });
        for (const bad of [
            'javascript:alert(1)',
            'data:text/html,<script>1</script>',
            'https://cdn.example/x.svg',
            'https://cdn.example/x.svg#frag',
            'https://cdn.example/x.SVGZ?v=2',
            '/uploads/../secrets.png',
        ]) {
            assert.strictEqual((await withMedia(bad)).status, 422, `refused: ${bad}`);
        }
        assert.strictEqual((await withMedia('https://cdn.example/banner.png?w=1600')).status, 201);
        assert.strictEqual((await withMedia('/uploads/announcements/banner.webp')).status, 201);
        assert.strictEqual((await withMedia('https://cdn.example/x.png', '   ')).status, 422, 'whitespace body refused');
        console.log('✓ script/data/SVG/traversal refused, real media accepted, blank body refused');

        // ---- 8. double-click publish race → exactly one 200 ------------------
        console.log('8. Double-click publish race...');
        let publishedEvents = 0;
        subscribe('AnnouncementPublished', () => { publishedEvents += 1; });

        const toPublish = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 'Race', body: 'b', categories: ['bgec'] },
        });
        const publishResults = await Promise.allSettled([
            call('POST', `/announcements/${toPublish.body._id}/publish`, { as: coordTok, body: {} }),
            call('POST', `/announcements/${toPublish.body._id}/publish`, { as: coordTok, body: {} }),
        ]);
        const fulfilled = publishResults.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<Res>[];
        assert.strictEqual(fulfilled.length, 2, 'both HTTP calls resolve');
        const statuses = fulfilled.map((r) => r.value.status).sort();
        assert.deepStrictEqual(statuses, [200, 409], 'exactly one 200 and one 409');
        assert.strictEqual(publishedEvents, 1, 'exactly one AnnouncementPublished emitted');
        const auditPublished = await AuditLog.countDocuments({
            target_type: 'announcement',
            target_id: toPublish.body._id,
            action: 'announcement.published',
        });
        assert.strictEqual(auditPublished, 1, 'exactly one audit row for publish');
        console.log('✓ 200 + 409 + one event + one audit row');

        // ---- 9. scheduled_for in the past → 422 ------------------------------
        console.log('9. Past schedule rejected...');
        const forSched = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 'Sched', body: 'b', categories: ['bgec'] },
        });
        const past = await call('POST', `/announcements/${forSched.body._id}/publish`, {
            as: coordTok,
            body: { scheduled_for: new Date(Date.now() - 1000).toISOString() },
        });
        assert.strictEqual(past.status, 422);
        assert.strictEqual(past.body.error, 'scheduled_for_must_be_future');
        // `z.coerce.date()` read `true` as 1 ms past the epoch and a number as a timestamp.
        for (const bad of [true, 1_900_000_000_000, '2030-01-01T10:00']) {
            const r = await call('POST', `/announcements/${forSched.body._id}/publish`, {
                as: coordTok,
                body: { scheduled_for: bad },
            });
            assert.strictEqual(r.status, 422, `scheduled_for ${JSON.stringify(bad)} is not a zoned ISO date`);
            assert.strictEqual(r.body.error, 'validation_failed');
        }
        console.log('✓ past scheduled_for → 422, and only a zoned ISO timestamp is a date');

        // ---- 10. unschedule writes audit + nulls scheduled_for --------------
        console.log('10. Unschedule...');
        const future = new Date(Date.now() + 86_400_000).toISOString();
        await call('POST', `/announcements/${forSched.body._id}/publish`, {
            as: coordTok,
            body: { scheduled_for: future },
        });
        const unsched = await call('POST', `/announcements/${forSched.body._id}/unschedule`, { as: coordTok, body: {} });
        assert.strictEqual(unsched.status, 200);
        assert.strictEqual(unsched.body.status, 'draft');
        assert.strictEqual(unsched.body.scheduled_for, null, 'scheduled_for was nulled');

        const afterUnsched = await Announcement.findById(forSched.body._id);
        // The invariant trap: if scheduled_for were left set, every later save would throw.
        afterUnsched!.title = 'Edited after unschedule';
        await afterUnsched!.save();
        const auditUnsched = await AuditLog.countDocuments({
            target_type: 'announcement',
            target_id: forSched.body._id,
            action: 'announcement.unscheduled',
        });
        assert.strictEqual(auditUnsched, 1, 'audit row for unschedule');
        console.log('✓ unschedule nulls scheduled_for, edit still saves, audit written');

        // ---- 11. mark-read is idempotent (3× calls → 1 entry) ----------------
        console.log('11. Replayed mark-read...');
        const readTarget = await Announcement.create({
            _id: uuid(),
            title: 'r',
            body: 'b',
            categories: ['bgec'],
            author: { user_id: coord._id, display_name: 'C', role_label: 'Coordinator' },
            status: 'published',
            published_at: new Date(),
            audience: { min_role: 'guest', event_id: null },
        });
        const readTok = token(member._id, UserRole.USER);
        const r1 = await call('POST', `/announcements/${readTarget._id}/read`, { as: readTok });
        const r2 = await call('POST', `/announcements/${readTarget._id}/read`, { as: readTok });
        const r3 = await call('POST', `/announcements/${readTarget._id}/read`, { as: readTok });
        assert.ok([r1.status, r2.status, r3.status].every((s) => s === 204));
        const stored = (await User.findById(member._id))!.announcements.read_ids;
        assert.strictEqual(stored.filter((id) => id === readTarget._id).length, 1, 'one entry after 3 calls');
        console.log('✓ mark-read is idempotent');

        // ---- 12. read-all advances last_seen_at -----------------------------
        console.log('12. read-all...');
        const ra = await call('POST', '/announcements/read-all', { as: readTok, body: {} });
        assert.strictEqual(ra.status, 200);
        assert(ra.body.last_seen_at, 'last_seen_at returned');
        const afterReadAll = await call('GET', '/announcements?limit=50', { as: readTok });
        assert(
            afterReadAll.body.announcements.every((a: { unread: boolean }) => a.unread === false),
            'read-all clears every per-card dot, not just the badge'
        );
        const badge = await call('GET', '/announcements/unread-count', { as: readTok });
        assert.strictEqual(badge.status, 200);
        assert.strictEqual(badge.body.count, 0, 'and the badge');
        console.log('✓ last_seen_at = now, dots and badge cleared');

        // ---- 13. heads strip excludes role-gated announcements --------------
        console.log('13. Heads audience gate...');
        const heads = await call('GET', '/announcements/heads');
        assert.strictEqual(heads.status, 200);
        const headIds = heads.body.flatMap((row: { announcement: { _id: string } | null }) =>
            row.announcement ? [row.announcement._id] : []
        );
        assert(!headIds.includes(gatedDoc._id), 'role-gated doc never appears in heads');
        console.log('✓ heads strips do not leak role-gated content');

        // ---- 14. /:id/audit returns rows created by writes ------------------
        console.log('14. Audit read endpoint...');
        // Founder-only gate: a coordinator must get 403, the founder must get the rows.
        const coordAudit = await call('GET', `/announcements/${toPublish.body._id}/audit`, { as: coordTok });
        assert.strictEqual(coordAudit.status, 403, 'coordinator is refused at /audit');
        const auditView = await call('GET', `/announcements/${toPublish.body._id}/audit`, { as: founderTok });
        assert.strictEqual(auditView.status, 200);
        const actions = auditView.body.entries.map((e: { action: string }) => e.action);
        assert(actions.includes('announcement.created'), 'has created row');
        assert(actions.includes('announcement.published'), 'has published row');
        console.log('✓ audit endpoint returns the rows (founder only)');

        // ---- 15. no Authorization → 401 ------------------------------------
        console.log('15. No auth header → 401...');
        const noAuth = await call('POST', '/announcements', {
            body: { title: 't', body: 'b', categories: ['bgec'] },
        });
        assert.strictEqual(noAuth.status, 401);
        console.log('✓ anon POST → 401');

        // ---- 15b. PATCH: no-op, freeze, audit ---------------------------------
        console.log('15b. PATCH semantics...');
        let updatedEvents = 0;
        subscribe('AnnouncementUpdated', () => { updatedEvents += 1; });
        const pid = toPublish.body._id; // published in case 8
        const rowsFor = (action: string) =>
            AuditLog.countDocuments({ target_type: 'announcement', target_id: pid, action });

        const noop = await call('PATCH', `/announcements/${pid}`, { as: coordTok, body: { title: 'Race' } });
        assert.strictEqual(noop.status, 200);
        assert.strictEqual(updatedEvents, 0, 'restating the current title emits nothing');
        assert.strictEqual(await rowsFor('announcement.updated'), 0, 'and writes no audit row');

        const frozen = await call('PATCH', `/announcements/${pid}`, {
            as: coordTok,
            body: { audience: { min_role: 'member' } },
        });
        assert.strictEqual(frozen.status, 409, 'audience is frozen once published');
        assert.strictEqual(frozen.body.error, 'categories_frozen_after_publish');

        const retitled = await call('PATCH', `/announcements/${pid}`, { as: coordTok, body: { title: 'Renamed' } });
        assert.strictEqual(retitled.status, 200);
        assert.strictEqual(retitled.body.title, 'Renamed');
        assert.strictEqual(updatedEvents, 1, 'a real change emits once');
        const row = await AuditLog.findOne({ target_id: pid, action: 'announcement.updated' }).lean();
        assert.deepStrictEqual(Object.keys(row!.new_value as object), ['title'], 'the row holds only what moved');
        console.log('✓ no-op PATCH is silent, audience frozen, real change audited once');

        // ---- 15c. unschedule answers 404 and 409 apart ------------------------
        console.log('15c. Unschedule codes...');
        assert.strictEqual((await call('POST', `/announcements/${uuid()}/unschedule`, { as: coordTok })).status, 404);
        const notSched = await call('POST', `/announcements/${pid}/unschedule`, { as: coordTok });
        assert.strictEqual(notSched.status, 409);
        assert.strictEqual(notSched.body.error, 'not_scheduled');
        console.log('✓ missing → 404, wrong state → 409');

        // ---- 15d. DELETE rank, and the trail survives the delete ---------------
        console.log('15d. Delete + audit trail...');
        const doomed = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 'Doomed', body: 'b', categories: ['bgec'] },
        });
        const coreForDelete = await User.create({
            _id: uuid(),
            email: `${uuid()}@e2e.local`,
            username: `e2e_core_del_${Date.now()}`,
            role: UserRole.CORE,
            status: UserStatus.ACTIVE,
            profile: { full_name: 'E2E Core Deleter' },
        });
        const coreDel = await call('DELETE', `/announcements/${doomed.body._id}`, {
            as: token(coreForDelete._id, UserRole.CORE),
        });
        assert.strictEqual(coreDel.status, 403, 'delete needs coordinator');
        assert.strictEqual((await call('DELETE', `/announcements/${doomed.body._id}`, { as: coordTok })).status, 204);
        assert.strictEqual((await call('DELETE', `/announcements/${doomed.body._id}`, { as: coordTok })).status, 404);

        const trail = await call('GET', `/announcements/${doomed.body._id}/audit`, { as: founderTok });
        assert.strictEqual(trail.status, 200, 'the trail of a deleted announcement is still readable');
        assert(trail.body.entries.some((e: { action: string }) => e.action === 'announcement.deleted'), 'including who deleted it');
        console.log('✓ core 403, coordinator 204 then 404, trail kept');

        // ---- 16. audit-failure policy ---------------------------------------
        console.log('16. Audit-failure policy...');
        let failingPublishEvents = 0;
        subscribe('AnnouncementPublished', () => { failingPublishEvents += 1; });
        // Created before the stub goes in, so only the publish meets the failing audit.
        const toPublishUnaudited = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 'Publish unaudited', body: 'b', categories: ['bgec'] },
        });
        const before = AuditLog.create;
        (AuditLog as unknown as { create: () => Promise<unknown> }).create = () => {
            throw new Error('audit store down');
        };
        try {
            const failing = await call('POST', '/announcements', {
                as: coordTok,
                body: { title: 'Fails', body: 'b', categories: ['bgec'] },
            });
            assert.strictEqual(failing.status, 500, 'create rejects when audit throws');
            assert.strictEqual(await Announcement.countDocuments({ title: 'Fails' }), 0, 'and nothing was written');

            const published = await call('POST', `/announcements/${toPublishUnaudited.body._id}/publish`, {
                as: coordTok,
                body: {},
            });
            assert.strictEqual(published.status, 200, 'a committed publish is not reported as a failure');
            assert.strictEqual(failingPublishEvents, 1, 'and its event still goes out');
        } finally {
            AuditLog.create = before;
        }
        console.log('✓ create: audit-first, fails closed; publish: committed, event sent, audit failure logged');

        // ---- 17. stale JWT (suspended user) → 401 on write -----------------
        console.log('17. Stale token from suspended user...');
        await User.updateOne({ _id: coord._id }, { $set: { status: UserStatus.SUSPENDED } });
        const stale = await call('POST', '/announcements', {
            as: coordTok,
            body: { title: 'Stale', body: 'b', categories: ['bgec'] },
        });
        assert.strictEqual(stale.status, 401, 'suspended user with valid token is refused at write');
        // Read still works — revoke does not block reads.
        const stillReads = await call('GET', `/announcements/${toPublish.body._id}`);
        assert.strictEqual(stillReads.status, 200, 'reads still work for suspended user');
        // Read state is the caller's own document and needs no live-user lookup: requireAuth only.
        const ownRead = await call('POST', `/announcements/${toPublish.body._id}/read`, { as: coordTok });
        assert.strictEqual(ownRead.status, 204, 'marking read is not a privileged write');
        console.log('✓ suspended user 401 on write, 200 on read');

        // ---- 18. the composer bypass never crosses the rank gate ------------
        console.log('18. Rank gate survives the admin bypass...');
        const core = await User.create({
            _id: uuid(),
            email: `${uuid()}@e2e.local`,
            username: `e2e_core_${Date.now()}`,
            role: UserRole.CORE,
            status: UserStatus.ACTIVE,
            profile: { full_name: 'E2E Core' },
        });
        const coreTok = token(core._id, UserRole.CORE);

        const founderOnly = await call('POST', '/announcements', {
            as: founderTok,
            body: { title: 'Founders only', body: 'b', categories: ['bgec'], audience: { min_role: 'founder' } },
        });
        assert.strictEqual(founderOnly.status, 201, JSON.stringify(founderOnly));
        const fid = founderOnly.body._id;
        assert.strictEqual(
            (await call('POST', `/announcements/${fid}/publish`, { as: founderTok, body: {} })).status,
            200
        );

        const coreFeed = await call('GET', '/announcements?limit=50', { as: coreTok });
        assert(!coreFeed.body.announcements.some((a: { _id: string }) => a._id === fid), 'core does not list it');
        const coreDrafts = await call('GET', '/announcements?status=published&limit=50', { as: coreTok });
        assert(!coreDrafts.body.announcements.some((a: { _id: string }) => a._id === fid), 'not via ?status either');
        assert.strictEqual((await call('GET', `/announcements/${fid}`, { as: coreTok })).status, 404, 'core 404s on it');
        assert.strictEqual((await call('GET', `/announcements/${fid}`, { as: founderTok })).status, 200, 'founder reads it');
        console.log('✓ core+ sees drafts and every event scope, never a higher min_role');

        // ---- 19. a composer cannot target a rank above their own -------------
        console.log('19. min_role ceiling...');
        const tooHigh = await call('POST', '/announcements', {
            as: coreTok,
            body: { title: 't', body: 'b', categories: ['bgec'], audience: { min_role: 'coordinator' } },
        });
        assert.strictEqual(tooHigh.status, 422);
        assert.strictEqual(tooHigh.body.error, 'min_role_above_own_rank');
        console.log('✓ min_role above the author → 422');

        // ---- 20. a demotion lands before the token expires ------------------
        console.log('20. Stale role claim...');
        await User.updateOne({ _id: core._id }, { $set: { role: UserRole.MEMBER } });
        const demoted = await call('POST', '/announcements', {
            as: coreTok, // still says core
            body: { title: 'Demoted', body: 'b', categories: ['bgec'] },
        });
        assert.strictEqual(demoted.status, 403, 'the live role is ranked, not the token claim');
        console.log('✓ demoted user with a core token → 403');

        // ---- 21. the delivery writeback from the broadcast ----------
        console.log('21. Internal delivery writeback...');
        const pub = await call('POST', '/announcements', {
            as: founderTok,
            body: { title: 'Broadcast me', body: 'body', categories: ['bgec'] },
        });
        const pubId = pub.body._id as string;
        // `body: {}` and not an absent body: without a content-type express leaves `req.body`
        // undefined, and the publish schema is an object — the route 422s before the service runs.
        const published = await call('POST', `/announcements/${pubId}/publish`, { as: founderTok, body: {} });
        assert.strictEqual(published.status, 200, `publish failed: ${JSON.stringify(published.body)}`);

        const deliveryBody = {
            whatsapp: [{ category: 'bgec', group_id: '••••st-1', status: 'sent', message_id: 'wamid.1', revision: 2 }],
            push: { status: 'skipped', sent_count: null, revision: 1 },
        };

        assert.strictEqual(
            (await call('PATCH', `/internal/announcements/${pubId}/delivery`, { body: deliveryBody })).status,
            401,
            'no service token → 401'
        );
        assert.strictEqual(
            (await call('PATCH', `/internal/announcements/${pubId}/delivery`, { body: deliveryBody, badService: true }))
                .status,
            401,
            'a wrong service token → 401'
        );
        assert.strictEqual(
            (await call('PATCH', `/internal/announcements/${pubId}/delivery`, { body: deliveryBody, as: founderTok }))
                .status,
            401,
            'and a founder session is not a service token either'
        );

        const delivered: string[] = [];
        subscribe('AnnouncementDelivered', (e) => delivered.push((e.payload as { channel: string }).channel));

        const wrote = await call('PATCH', `/internal/announcements/${pubId}/delivery`, {
            body: deliveryBody,
            service: true,
        });
        assert.strictEqual(wrote.status, 200, 'with the token it writes');
        assert.strictEqual(wrote.body.delivery.whatsapp.per_category.length, 1, 'one row per category');
        assert.strictEqual(wrote.body.delivery.whatsapp.per_category[0].status, 'sent', 'carrying the outcome');
        assert.strictEqual(wrote.body.delivery.push.status, 'skipped', 'and the push resolution');
        assert.deepStrictEqual(delivered, ['whatsapp', 'push'], 'AnnouncementDelivered is emitted per channel');

        // A second writeback for the same category updates in place: the composer must never see
        // the same tag twice, and a retried writeback is the normal case, not an error.
        const again = await call('PATCH', `/internal/announcements/${pubId}/delivery`, {
            body: {
                whatsapp: [{ category: 'bgec', group_id: '••••st-1', status: 'failed', error: 'http 500', revision: 3 }],
            },
            service: true,
        });
        assert.strictEqual(again.body.delivery.whatsapp.per_category.length, 1, 'still one row');
        assert.strictEqual(again.body.delivery.whatsapp.per_category[0].status, 'failed', 'updated in place');

        // Out of order: the sweep's older snapshot arrives after the newer one. It must not put the
        // composer's view back in time.
        const staleReceipt = await call('PATCH', `/internal/announcements/${pubId}/delivery`, {
            body: { whatsapp: [{ category: 'bgec', group_id: '••••st-1', status: 'pending', revision: 1 }] },
            service: true,
        });
        const kept = staleReceipt.body.delivery.whatsapp.per_category[0];
        assert.strictEqual(staleReceipt.status, 200, 'a stale receipt is accepted, not an error');
        assert.strictEqual(kept.status, 'failed', 'but changes nothing');
        assert.strictEqual(kept.revision, 3, 'the newest revision stays');

        const wrongCategory = await call('PATCH', `/internal/announcements/${pubId}/delivery`, {
            body: { whatsapp: [{ category: 'deuce', group_id: 'x', status: 'sent', revision: 1 }] },
            service: true,
        });
        assert.strictEqual(wrongCategory.status, 422, 'a category not on the announcement is a 422');
        assert.strictEqual(wrongCategory.body.error, 'category_not_on_announcement', 'not a 500 from the model hook');

        const stillOne = await Announcement.findById(pubId).lean();
        assert.strictEqual(
            stillOne!.delivery.whatsapp.per_category.length,
            1,
            'and the refusal wrote nothing at all'
        );

        const draftForDelivery = await call('POST', '/announcements', {
            as: founderTok,
            body: { title: 'Unpublished', body: 'body', categories: ['bgec'] },
        });
        const draftDelivery = await call('PATCH', `/internal/announcements/${draftForDelivery.body._id}/delivery`, {
            body: deliveryBody,
            service: true,
        });
        assert.strictEqual(draftDelivery.status, 409, 'a draft has had no broadcast to report');
        assert.strictEqual(draftDelivery.body.error, 'not_published');

        assert.strictEqual(
            (await call('PATCH', `/internal/announcements/${uuid()}/delivery`, { body: deliveryBody, service: true }))
                .status,
            404,
            'and an unknown announcement is a 404'
        );

        const emptyDelivery = await call('PATCH', `/internal/announcements/${pubId}/delivery`, {
            body: {},
            service: true,
        });
        assert.strictEqual(emptyDelivery.status, 422, 'a body with nothing to record is refused');
        console.log('✓ delivery writeback: token-gated, idempotent per category, refuses cleanly');

        console.log('\n✅ All announcement e2e cases passed!');
    } finally {
        await mongoose.connection.dropDatabase().catch(() => undefined);
        server?.close();
        await mongoose.disconnect().catch(() => undefined);
    }
}

main().catch((err) => {
    console.error('❌ e2e failed:', err);
    process.exit(1);
});
