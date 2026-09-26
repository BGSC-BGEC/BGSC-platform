import { randomBytes } from 'crypto';
import {
    Event,
    IEvent,
    IMedia,
    IMediaAlbum,
    IUser,
    Media,
    MediaAlbum,
    MediaLike,
    ServiceError,
    UserRole,
    isEventAdmin,
    publish,
    rankOf,
    requireEventAdmin,
    userSnapshotOf,
} from '@bgsc/shared';
import {
    CreateAlbumInput,
    ListAlbumsQuery,
    ListMediaQuery,
    ModerateMediaInput,
    PageQuery,
    UpdateMediaInput,
    UploadMediaQuery,
} from './media.schemas';
import {
    IMAGE_MAX_BYTES,
    deleteMediaObject,
    keyOf,
    locateMediaObject,
    publishMediaObject,
    putMediaObject,
    sniffMedia,
    withdrawMediaObject,
} from '../storage/storage';

/**
 * Who is looking. Reads take the token's claim (`optionalAuth`); every WRITE takes the live user
 * document loaded by `requireActiveUser`, so a demotion or suspension bites immediately rather than
 * fifteen minutes later — auto-approval and moderation are decided by it.
 */
export interface Viewer {
    id: string;
    role: string;
}

/** Per-uploader ceilings on what waits for moderation (members only; see `assertUnderQuota`). */
export const MAX_PENDING_ITEMS = 20;
export const MAX_PENDING_BYTES = 200 * 1024 * 1024;
export const UPLOADS_PER_HOUR = 30;
const atLeast = (who: { role: string } | null | undefined, floor: UserRole): boolean =>
    !!who && rankOf(who.role as UserRole) >= rankOf(floor);
const isCore = (who: { role: string } | null | undefined): boolean => atLeast(who, UserRole.CORE);

/**
 * The draft events this viewer does not run, as a filter on `events` — or null for coordinator+,
 * who see every draft. A draft exists only for its admins (`isEventAdmin`), and so does every
 * album and photo filed under it.
 */
const hiddenDrafts = (viewer: Viewer | null | undefined): Record<string, unknown> | null => {
    if (atLeast(viewer, UserRole.COORDINATOR)) return null;
    return viewer
        ? { status: 'draft', created_by: { $ne: viewer.id }, core_admins: { $ne: viewer.id } }
        : { status: 'draft' };
};

/** Ids of the drafts `hiddenDrafts` describes. ponytail: drafts are a handful at a time; a `$nin` over them is fine. */
const hiddenEventIds = async (viewer: Viewer | null | undefined): Promise<string[]> => {
    const filter = hiddenDrafts(viewer);
    return filter ? Event.distinct('_id', filter) : [];
};

const isDuplicateKey = (err: unknown): err is { code: number; keyPattern?: Record<string, unknown> } =>
    (err as { code?: number }).code === 11000;

/** Lower-case, dash-separated, latin only. May come back empty for a title in another script. */
const slugify = (title: string): string =>
    title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80)
        .replace(/-$/, '');

export class MediaService {
    /* ------------------------------------------------------------------ *
     * Visibility
     * ------------------------------------------------------------------ */

    /**
     * An item is public once approved; before that, and after a rejection, it exists only for its
     * uploader and for core. A private album hides its items from everyone else as well, and a
     * draft event hides everything filed under it — directly or through its album — from anyone
     * who does not run it, core and uploader included. Anything a viewer may not see is a 404 —
     * they should not learn it exists.
     */
    private async assertVisible(media: IMedia, viewer: Viewer | null): Promise<void> {
        const privileged = isCore(viewer) || (!!viewer && viewer.id === media.uploader.user_id);
        if (!privileged && media.status !== 'approved') throw new ServiceError(404, 'media_not_found');
        const album = media.album_id
            ? await MediaAlbum.findById(media.album_id).select('is_public event_id').lean<IMediaAlbum>()
            : null;
        if (!privileged && album && !album.is_public) throw new ServiceError(404, 'media_not_found');
        const events = [media.event_id, album?.event_id].filter((id): id is string => !!id);
        const drafts = hiddenDrafts(viewer);
        if (events.length > 0 && drafts && (await Event.exists({ _id: { $in: events }, ...drafts }))) {
            throw new ServiceError(404, 'media_not_found');
        }
    }

    /**
     * Who may publish, moderate, and override the owner of an item: core for the general gallery;
     * for anything filed under an event — directly or through its album — only that event's admins
     * (creator, listed core admins, coordinator+), the same rule `createAlbum` applies. Any core
     * member publishing into, or deleting from, every event's gallery was the gap. An event that
     * no longer exists leaves its media to coordinator+.
     */
    private async moderates(actor: IUser, item: { event_id?: string | null; album_id?: string | null }): Promise<boolean> {
        if (!isCore(actor)) return false;
        const album = item.album_id ? await MediaAlbum.findById(item.album_id).select('event_id').lean<IMediaAlbum>() : null;
        const ids = [...new Set([item.event_id, album?.event_id].filter((id): id is string => !!id))];
        if (ids.length === 0 || atLeast(actor, UserRole.COORDINATOR)) return true;
        const events = await Event.find({ _id: { $in: ids } }).select('created_by core_admins').lean<IEvent[]>();
        const who = { id: actor._id, role: actor.role };
        return events.length === ids.length && events.every((e) => isEventAdmin(e, who));
    }

    /**
     * Approved items only are counted, so the number matches what a visitor can open. Recounted
     * rather than `$inc`ed: two moderators, an edit and a delete racing each other drifted an
     * incremented counter, and a recount converges whoever runs last.
     */
    private async recountAlbum(albumId: string | null | undefined): Promise<void> {
        if (!albumId) return;
        const media_count = await Media.countDocuments({ album_id: albumId, status: 'approved' });
        await MediaAlbum.updateOne({ _id: albumId }, { $set: { media_count } });
    }

    /**
     * Put an item's file in the tree its CURRENT status says it belongs in: approved → served,
     * pending → unserved, rejected or gone → deleted. Every status change runs this after its own
     * compare-and-swap, re-reading the status rather than trusting the one it wrote — so an edit
     * that withdraws a file just after a moderator approved it is corrected by whichever of the two
     * finishes last, instead of leaving an approved row with a hidden file.
     *
     * ponytail: two reconciles can still interleave read→move; the window is one rename wide. The
     * upgrade is a per-item lock document if it is ever seen.
     */
    private async reconcileFile(id: string, key: string): Promise<void> {
        const now = await Media.findById(id).select('status').lean<{ status: string }>();
        try {
            if (!now || now.status === 'rejected') await deleteMediaObject(key);
            else if (now.status === 'approved') await publishMediaObject(key);
            else await withdrawMediaObject(key);
        } catch (err) {
            // Nothing to move is not an error here: the file is already wherever it can be.
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
    }

    /* ------------------------------------------------------------------ *
     * Upload
     * ------------------------------------------------------------------ */

    /**
     * A member's uploads wait for a human, so they are capped where the human's queue is: items and
     * bytes still pending, plus an hourly rate. Uploads that publish on arrival (core, or an
     * event's own admins for that event) are not capped — bulk event photos are their job.
     *
     * ponytail: count-then-write, so a parallel burst can overshoot by its width; the gateway's
     * 100/min per user bounds that. A per-uploader counter document is the upgrade.
     */
    private async assertUnderQuota(userId: string, incoming: number): Promise<void> {
        const [pending] = await Media.aggregate<{ n: number; bytes: number }>([
            { $match: { 'uploader.user_id': userId, status: 'pending' } },
            { $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: '$size_bytes' } } },
        ]);
        if (pending && (pending.n >= MAX_PENDING_ITEMS || pending.bytes + incoming > MAX_PENDING_BYTES)) {
            throw new ServiceError(429, 'pending_quota_exceeded', { max_items: MAX_PENDING_ITEMS, max_bytes: MAX_PENDING_BYTES });
        }
        const lastHour = await Media.countDocuments({
            'uploader.user_id': userId,
            created_at: { $gte: new Date(Date.now() - 3_600_000) },
        });
        if (lastHour >= UPLOADS_PER_HOUR) {
            throw new ServiceError(429, 'upload_rate_exceeded', { retry_after_minutes: 60 });
        }
    }

    /**
     * The controller refuses an empty body and `raw()` anything over the video ceiling, so the
     * only size left to check is an image that arrived declared as something bigger.
     */
    async uploadMedia(actor: IUser, buffer: Buffer, query: UploadMediaQuery): Promise<IMedia> {
        const sniffed = sniffMedia(buffer);
        if (!sniffed) {
            throw new ServiceError(415, 'unsupported_media_type');
        }

        if (sniffed.type === 'image' && buffer.length > IMAGE_MAX_BYTES) {
            throw new ServiceError(413, 'image_payload_too_large');
        }

        const core = isCore(actor);

        if (query.event_id) {
            const event = await Event.findOne({ _id: query.event_id, deleted_at: null })
                .select('status created_by core_admins')
                .lean<IEvent>();
            // A draft is invisible to everyone but its admins, so it is a 404 to anyone else here too.
            if (!event || (event.status === 'draft' && !isEventAdmin(event, { id: actor._id, role: actor.role }))) {
                throw new ServiceError(404, 'event_not_found');
            }
        }

        if (query.album_id) {
            const album = await MediaAlbum.findById(query.album_id).select('is_public event_id').lean<IMediaAlbum>();
            const drafts = hiddenDrafts({ id: actor._id, role: actor.role });
            // A private album is core's to fill, and to a member it does not exist; nor does the
            // album of a draft they do not run.
            if (
                !album ||
                (!album.is_public && !core) ||
                (album.event_id && drafts && (await Event.exists({ _id: album.event_id, ...drafts })))
            ) {
                throw new ServiceError(404, 'album_not_found');
            }
        }

        const status = (await this.moderates(actor, query)) ? 'approved' : 'pending';
        if (status === 'pending') await this.assertUnderQuota(actor._id, buffer.length);

        const prefix =
            query.category === 'event' && query.event_id
                ? `media/event/${query.event_id}`
                : `media/${query.category}`;

        // A pending file is written where nothing serves it; approval moves it into /uploads.
        const stored = await putMediaObject(prefix, buffer, sniffed, status === 'pending');

        let media: IMedia;
        try {
            media = await Media.create({
                uploader: userSnapshotOf(actor),
                url: stored.url,
                thumbnail_url: null,
                original_filename: query.filename || stored.key,
                mime_type: stored.mime,
                media_type: stored.media_type,
                size_bytes: stored.bytes,
                category: query.category,
                event_id: query.event_id ?? null,
                album_id: query.album_id ?? null,
                caption: query.caption || null,
                tags: query.tags ?? [],
                status,
                approved_by: status === 'approved' ? actor._id : null,
                approved_at: status === 'approved' ? new Date() : null,
            });
        } catch (err) {
            // A file with no row is a file nothing will ever delete.
            await deleteMediaObject(stored.key).catch(() => undefined);
            throw err;
        }

        if (status === 'approved') await this.recountAlbum(media.album_id);

        publish('MediaUploaded', 'media-service', {
            media_id: media._id,
            uploader_user_id: actor._id,
            category: media.category,
            event_id: media.event_id,
            status: media.status,
        });

        return media;
    }

    /* ------------------------------------------------------------------ *
     * Reads
     * ------------------------------------------------------------------ */

    async listMedia(query: ListMediaQuery, viewer?: Viewer | null) {
        const core = isCore(viewer);
        const filter: Record<string, unknown> = {};
        const drafts = await hiddenEventIds(viewer);

        if (query.category) filter.category = query.category;
        if (query.event_id) {
            if (drafts.includes(query.event_id)) throw new ServiceError(404, 'event_not_found');
            filter.event_id = query.event_id;
        } else if (drafts.length > 0) {
            filter.event_id = { $nin: drafts };
        }
        if (query.media_type) filter.media_type = query.media_type;
        if (query.tag) filter.tags = query.tag;

        if (core) {
            if (query.status) filter.status = query.status;
        } else {
            filter.status = 'approved';
        }

        // The general gallery must not be a side door into an album the viewer cannot open: a
        // private one (unless core), or one filed under a hidden draft.
        // ponytail: private albums are a handful of committee sets; a $nin over their ids is
        // fine until there are thousands, then denormalize `album_public` onto media.
        const hiddenAlbum = [
            ...(core ? [] : [{ is_public: false }]),
            ...(drafts.length > 0 ? [{ event_id: { $in: drafts } }] : []),
        ];
        if (query.album_id) {
            if (hiddenAlbum.length > 0 && (await MediaAlbum.exists({ _id: query.album_id, $or: hiddenAlbum }))) {
                throw new ServiceError(404, 'album_not_found');
            }
            filter.album_id = query.album_id;
        } else if (hiddenAlbum.length > 0) {
            const hidden = await MediaAlbum.distinct('_id', { $or: hiddenAlbum });
            if (hidden.length > 0) filter.album_id = { $nin: hidden };
        }

        const skip = (query.page - 1) * query.limit;

        const [items, total] = await Promise.all([
            Media.find(filter).sort({ created_at: -1 }).skip(skip).limit(query.limit).lean(),
            Media.countDocuments(filter),
        ]);

        return {
            items,
            total,
            page: query.page,
            limit: query.limit,
            total_pages: Math.ceil(total / query.limit),
        };
    }

    async getMediaById(id: string, viewer?: Viewer | null): Promise<IMedia> {
        const media = await Media.findById(id).lean<IMedia>();
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }
        await this.assertVisible(media, viewer ?? null);

        // Fire-and-forget view count increment for 2 vCPU efficiency. Public views only.
        if (media.status === 'approved') {
            Media.updateOne({ _id: id }, { $inc: { views_count: 1 } }).exec().catch(() => {});
        }

        return media;
    }

    /** Where the item's file is right now, for whoever may see the item. The path is the row's, never the request's. */
    async getMediaFile(id: string, viewer: Viewer | null): Promise<{ path: string; mime: string }> {
        const media = await Media.findById(id).lean<IMedia>();
        if (!media) throw new ServiceError(404, 'media_not_found');
        await this.assertVisible(media, viewer);
        const path = await locateMediaObject(keyOf(media.url));
        if (!path) throw new ServiceError(404, 'media_not_found');
        return { path, mime: media.mime_type };
    }

    /* ------------------------------------------------------------------ *
     * Owner edits
     * ------------------------------------------------------------------ */

    /**
     * The uploader or a moderator of the item may edit caption and tags. Anyone else's edit to an
     * APPROVED item — the uploader's included, unless they moderate it — puts it back in the queue
     * (otherwise approval would be of a caption that no longer exists) and pulls its file out of
     * /uploads until a moderator looks again.
     */
    async updateMedia(id: string, actor: IUser, input: UpdateMediaInput): Promise<IMedia> {
        const media = await Media.findById(id);
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        // Not visible to them → 404 first; visible but not theirs → 403.
        await this.assertVisible(media, { id: actor._id, role: actor.role });
        const moderator = await this.moderates(actor, media);
        if (media.uploader.user_id !== actor._id && !moderator) {
            throw new ServiceError(403, 'forbidden_not_owner');
        }

        const set: Record<string, unknown> = {};
        if (input.caption !== undefined) set.caption = input.caption;
        if (input.tags !== undefined) set.tags = input.tags;

        const remoderate = !moderator && media.status === 'approved' && Object.keys(set).length > 0;
        if (remoderate) Object.assign(set, { status: 'pending', approved_by: null, approved_at: null });

        // Compare-and-swap on the status we read: a moderator acting at the same moment wins, and
        // this edit is told so rather than silently undoing their decision.
        const updated = await Media.findOneAndUpdate(
            { _id: id, status: media.status },
            { $set: set },
            { returnDocument: 'after', runValidators: true }
        );
        if (!updated) throw new ServiceError(409, 'media_changed');

        if (remoderate) {
            await this.reconcileFile(id, keyOf(updated.url));
            await this.recountAlbum(updated.album_id);
        }
        return updated;
    }

    async deleteMedia(id: string, actor: IUser): Promise<{ id: string; deleted: true }> {
        const media = await Media.findById(id);
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        await this.assertVisible(media, { id: actor._id, role: actor.role });
        if (media.uploader.user_id !== actor._id && !(await this.moderates(actor, media))) {
            throw new ServiceError(403, 'forbidden_not_owner');
        }

        // The row goes FIRST, atomically: a moderator's swap on it then finds nothing and moves no
        // file, and two deletes produce one. File-first let an approve rename the file into
        // /uploads after it was "deleted", orphaning it there.
        const claimed = await Media.findOneAndDelete({ _id: id });
        if (!claimed) throw new ServiceError(404, 'media_not_found');

        await deleteMediaObject(keyOf(claimed.url));
        await this.recountAlbum(claimed.album_id);

        // Unset cover_media_id on any album referencing this media
        await MediaAlbum.updateMany({ cover_media_id: id }, { $set: { cover_media_id: null } });

        await MediaLike.deleteMany({ media_id: id });

        publish('MediaDeleted', 'media-service', { media_id: id, url: claimed.url });

        return { id, deleted: true };
    }

    /* ------------------------------------------------------------------ *
     * Albums
     * ------------------------------------------------------------------ */

    /**
     * Insert an album, resolving a slug collision. A slug the caller CHOSE is theirs to fix (409);
     * a derived one gets a short random suffix. An event may have many manual albums but one
     * SYSTEM album (owner decision); a second system album is 409 `event_album_exists`, which the
     * `EventCompleted` consumer treats as "already there".
     */
    private async insertAlbum(fields: Record<string, unknown>, slug: string, chosen: boolean): Promise<IMediaAlbum> {
        let candidate = slug;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                return await MediaAlbum.create({ ...fields, slug: candidate });
            } catch (err) {
                if (!isDuplicateKey(err)) throw err;
                if (err.keyPattern && 'event_id' in err.keyPattern) throw new ServiceError(409, 'event_album_exists');
                if (chosen) throw new ServiceError(409, 'album_slug_already_exists');
                candidate = `${slug}-${randomBytes(3).toString('hex')}`;
            }
        }
        throw new ServiceError(409, 'album_slug_already_exists');
    }

    async createAlbum(actor: IUser, input: CreateAlbumInput): Promise<IMediaAlbum> {
        const slug = input.slug || slugify(input.title);
        // A title with no latin letters or digits ("संगीत", "🎉") slugifies to nothing.
        if (!slug) throw new ServiceError(422, 'album_slug_required');

        // An album under an event is that event's content: its admins' to make, not any core
        // member's. Drafts included — `requireEventAdmin` hides them as 404.
        if (input.event_id) await requireEventAdmin(input.event_id, { id: actor._id, role: actor.role });

        return this.insertAlbum(
            {
                title: input.title,
                description: input.description || null,
                category: input.category ?? 'general',
                cover_media_id: input.cover_media_id || null,
                event_id: input.event_id || null,
                created_by: actor._id,
                is_public: input.is_public ?? true,
            },
            slug,
            !!input.slug
        );
    }

    /**
     * The album an event gets when it ends (`EventCompleted`). Titled from the event itself —
     * the payload's copy is the fallback — and idempotent: a second delivery hits the unique
     * `event_id` index and is ignored.
     */
    async ensureEventAlbum(eventId: string, fallbackTitle?: string): Promise<IMediaAlbum | null> {
        const event = await Event.findById(eventId).select('title').lean<{ title: string }>();
        const title = event?.title ?? fallbackTitle ?? `Event ${eventId}`;
        try {
            return await this.insertAlbum(
                { title: `${title} Album`, category: 'event', event_id: eventId, created_by: 'system', is_public: true },
                slugify(title) || `event-${eventId.slice(0, 8)}`,
                false
            );
        } catch (err) {
            if (err instanceof ServiceError && err.code === 'event_album_exists') return null;
            throw err;
        }
    }

    async listAlbums(query: ListAlbumsQuery, viewer?: Viewer | null) {
        const filter: Record<string, unknown> = {};

        const drafts = await hiddenEventIds(viewer);

        if (query.category) filter.category = query.category;
        if (query.event_id) {
            if (drafts.includes(query.event_id)) throw new ServiceError(404, 'event_not_found');
            filter.event_id = query.event_id;
        } else if (drafts.length > 0) {
            filter.event_id = { $nin: drafts };
        }
        if (!isCore(viewer)) filter.is_public = true;

        const skip = (query.page - 1) * query.limit;

        const [items, total] = await Promise.all([
            MediaAlbum.find(filter).sort({ created_at: -1 }).skip(skip).limit(query.limit).lean(),
            MediaAlbum.countDocuments(filter),
        ]);

        return {
            items,
            total,
            page: query.page,
            limit: query.limit,
            total_pages: Math.ceil(total / query.limit),
        };
    }

    async getAlbumById(idOrSlug: string, viewer?: Viewer | null) {
        const album = await MediaAlbum.findOne({
            $or: [{ _id: idOrSlug }, { slug: idOrSlug }],
        }).lean<IMediaAlbum>();

        // A private album, or one under a draft the viewer does not run, is a 404 to anyone who
        // could not list it.
        const drafts = await hiddenEventIds(viewer);
        if (!album || (!album.is_public && !isCore(viewer)) || (album.event_id && drafts.includes(album.event_id))) {
            throw new ServiceError(404, 'album_not_found');
        }

        // ponytail: the first 50 items; the paged view is `GET /media?album_id=`.
        const media = await Media.find({ album_id: album._id, status: 'approved', event_id: { $nin: drafts } })
            .sort({ created_at: -1 })
            .limit(50)
            .lean();

        return { ...album, media };
    }

    /* ------------------------------------------------------------------ *
     * Moderation
     * ------------------------------------------------------------------ */

    /**
     * Pending items, oldest first, each with `preview_url` — the file is not at its public URL
     * until approved, so a moderator looks at it there. A hidden draft's items are left out, whether
     * filed under it directly or through its album (as `assertVisible` hides them).
     */
    async listPendingModeration(query: PageQuery, viewer: Viewer) {
        const skip = (query.page - 1) * query.limit;

        const drafts = await hiddenEventIds(viewer);
        const filter: Record<string, unknown> = { status: 'pending', event_id: { $nin: drafts } };
        if (drafts.length > 0) {
            const hidden = await MediaAlbum.distinct('_id', { event_id: { $in: drafts } });
            if (hidden.length > 0) filter.album_id = { $nin: hidden };
        }
        const [items, total] = await Promise.all([
            Media.find(filter).sort({ created_at: 1 }).skip(skip).limit(query.limit).lean(),
            Media.countDocuments(filter),
        ]);

        return {
            items: items.map((m) => ({ ...m, preview_url: `/media/${m._id}/file` })),
            total,
            page: query.page,
            limit: query.limit,
            total_pages: Math.ceil(total / query.limit),
        };
    }

    /**
     * pending → approved moves the file into /uploads; pending|approved → rejected deletes it. A
     * rejected item has no file left, so it cannot be approved afterwards — the uploader re-uploads.
     */
    async moderateMedia(id: string, actor: IUser, input: ModerateMediaInput): Promise<IMedia> {
        const media = await Media.findById(id);
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }
        // Visibility before permission: a hidden draft's item is a 404, another event's a 403.
        await this.assertVisible(media, { id: actor._id, role: actor.role });
        if (!(await this.moderates(actor, media))) throw new ServiceError(403, 'forbidden');

        const from = media.status;
        if (input.status === 'approved' && from !== 'pending') {
            throw new ServiceError(409, 'media_not_pending', { status: from });
        }
        if (input.status === 'rejected' && from === 'rejected') {
            throw new ServiceError(409, 'media_already_rejected');
        }
        // Checked BEFORE any write: a legacy row whose file never made it to this upload root
        // would otherwise flip to "approved" and serve a 404.
        const key = keyOf(media.url);
        if (input.status === 'approved' && !(await locateMediaObject(key))) {
            throw new ServiceError(409, 'file_missing');
        }

        const updated = await Media.findOneAndUpdate(
            { _id: id, status: from },
            {
                $set: {
                    status: input.status,
                    approved_by: actor._id,
                    approved_at: new Date(),
                    rejection_reason: input.status === 'rejected' ? input.rejection_reason || null : null,
                },
            },
            { returnDocument: 'after' }
        );
        if (!updated) throw new ServiceError(409, 'media_changed');

        if (input.status === 'approved') {
            try {
                await this.reconcileFile(id, key);
            } catch (err) {
                // The row must not say "approved" for a file nobody can fetch.
                await Media.updateOne({ _id: id, status: 'approved' }, { $set: { status: from, approved_by: null, approved_at: null } });
                throw err;
            }
            await this.recountAlbum(updated.album_id);
            publish('MediaApproved', 'media-service', {
                media_id: id,
                approved_by: actor._id,
            });
        } else {
            await this.reconcileFile(id, key);
            await this.recountAlbum(updated.album_id);
            publish('MediaRejected', 'media-service', {
                media_id: id,
                reason: input.rejection_reason,
                rejected_by: actor._id,
            });
        }

        return updated;
    }

    /* ------------------------------------------------------------------ *
     * Likes
     * ------------------------------------------------------------------ */

    /**
     * A real toggle: one `media_likes` row per (media, user), enforced by the unique index. The
     * counter is then RECOUNTED from those rows rather than `$inc`ed — an increment raced against
     * a concurrent toggle drifted, a recount is right whoever writes last.
     */
    async toggleLike(id: string, viewer: Viewer): Promise<{ media_id: string; liked: boolean; likes_count: number }> {
        const media = await Media.findById(id).lean<IMedia>();
        if (!media) throw new ServiceError(404, 'media_not_found');
        await this.assertVisible(media, viewer);

        let liked: boolean;
        try {
            await MediaLike.create({ media_id: id, user_id: viewer.id });
            liked = true;
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
            await MediaLike.deleteOne({ media_id: id, user_id: viewer.id });
            liked = false;
        }

        const likes_count = await MediaLike.countDocuments({ media_id: id });
        await Media.updateOne({ _id: id }, { $set: { likes_count } });

        return { media_id: id, liked, likes_count };
    }
}

export const mediaService = new MediaService();
