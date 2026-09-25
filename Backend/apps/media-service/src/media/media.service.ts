import {
    Media,
    IMedia,
    MediaAlbum,
    IMediaAlbum,
    User,
    UserRole,
    AuthUser,
    ServiceError,
    publish,
} from '@bgsc/shared';
import {
    UploadMediaQuery,
    ListMediaQuery,
    CreateAlbumInput,
    UpdateMediaInput,
    ModerateMediaInput,
} from './media.schemas';
import {
    sniffMedia,
    putMediaObject,
    deleteMediaObject,
    IMAGE_MAX_BYTES,
    VIDEO_MAX_BYTES,
} from '../storage/storage';

export class MediaService {
    private isCoreRole(role: string): boolean {
        return [
            UserRole.CORE,
            UserRole.COORDINATOR,
            UserRole.FOUNDER,
        ].includes(role as UserRole);
    }

    async uploadMedia(
        actor: AuthUser,
        buffer: Buffer,
        query: UploadMediaQuery
    ): Promise<IMedia> {
        if (!buffer || buffer.length === 0) {
            throw new ServiceError(400, 'media_payload_empty');
        }

        const sniffed = sniffMedia(buffer);
        if (!sniffed) {
            throw new ServiceError(415, 'unsupported_media_type');
        }

        if (sniffed.type === 'image' && buffer.length > IMAGE_MAX_BYTES) {
            throw new ServiceError(413, 'image_payload_too_large');
        }
        if (sniffed.type === 'video' && buffer.length > VIDEO_MAX_BYTES) {
            throw new ServiceError(413, 'video_payload_too_large');
        }

        let album: IMediaAlbum | null = null;
        if (query.album_id) {
            album = await MediaAlbum.findById(query.album_id);
            if (!album) {
                throw new ServiceError(404, 'album_not_found');
            }
        }

        const isCore = this.isCoreRole(actor.role);
        const status = isCore ? 'approved' : 'pending';

        const prefix =
            query.category === 'event' && query.event_id
                ? `events/${query.event_id}`
                : `media/${query.category}`;

        const stored = await putMediaObject(prefix, buffer, sniffed);

        if (album) {
            await MediaAlbum.updateOne({ _id: album._id }, { $inc: { media_count: 1 } });
        }

        const uploaderName =
            (actor as any).name || (actor as any).display_name || actor.id;
        const uploaderAvatar = (actor as any).avatar_url || null;

        const media = await Media.create({
            uploader: {
                user_id: actor.id,
                display_name: uploaderName,
                avatar_url: uploaderAvatar,
            },
            url: stored.url,
            thumbnail_url: null,
            original_filename: query.filename || `${stored.key}`,
            mime_type: stored.mime,
            media_type: stored.media_type,
            size_bytes: stored.bytes,
            category: query.category,
            event_id: query.event_id || null,
            album_id: query.album_id || null,
            caption: query.caption || null,
            tags: query.tags || [],
            status,
            approved_by: status === 'approved' ? actor.id : null,
            approved_at: status === 'approved' ? new Date() : null,
        });

        publish('MediaUploaded', 'media-service', {
            media_id: media._id,
            uploader_user_id: actor.id,
            category: media.category,
            event_id: media.event_id,
            status: media.status,
        });

        return media;
    }

    async listMedia(query: ListMediaQuery, actor?: AuthUser | null) {
        const isCore = actor ? this.isCoreRole(actor.role) : false;
        const filter: Record<string, any> = {};

        if (query.category) filter.category = query.category;
        if (query.event_id) filter.event_id = query.event_id;
        if (query.album_id) filter.album_id = query.album_id;
        if (query.media_type) filter.media_type = query.media_type;
        if (query.tag) filter.tags = query.tag.toLowerCase();

        if (isCore) {
            if (query.status) {
                filter.status = query.status;
            }
        } else {
            filter.status = 'approved';
        }

        const skip = (query.page - 1) * query.limit;

        const [items, total] = await Promise.all([
            Media.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(query.limit)
                .lean(),
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

    async getMediaById(id: string): Promise<IMedia> {
        const media = await Media.findById(id).lean();
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        // Fire-and-forget view count increment for 2 vCPU efficiency
        Media.updateOne({ _id: id }, { $inc: { views_count: 1 } }).exec().catch(() => {});

        return media as IMedia;
    }

    async updateMedia(
        id: string,
        actor: AuthUser,
        input: UpdateMediaInput
    ): Promise<IMedia> {
        const media = await Media.findById(id);
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        const isCore = this.isCoreRole(actor.role);
        if (media.uploader.user_id !== actor.id && !isCore) {
            throw new ServiceError(403, 'forbidden_not_owner');
        }

        if (input.caption !== undefined) {
            media.caption = input.caption;
        }
        if (input.tags !== undefined) {
            media.tags = input.tags;
        }

        await media.save();
        return media;
    }

    async deleteMedia(id: string, actor: AuthUser): Promise<{ success: boolean; id: string }> {
        const media = await Media.findById(id);
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        const isCore = this.isCoreRole(actor.role);
        if (media.uploader.user_id !== actor.id && !isCore) {
            throw new ServiceError(403, 'forbidden_not_owner');
        }

        const key = media.url.replace(/^\/uploads\//, '');
        await deleteMediaObject(key);

        if (media.album_id) {
            await MediaAlbum.updateOne(
                { _id: media.album_id, media_count: { $gt: 0 } },
                { $inc: { media_count: -1 } }
            );
        }

        // Unset cover_media_id on any album referencing this media
        await MediaAlbum.updateMany(
            { cover_media_id: id },
            { $set: { cover_media_id: null } }
        );

        await media.deleteOne();

        publish('MediaDeleted', 'media-service', { media_id: id, url: media.url });

        return { success: true, id };
    }

    async createAlbum(creatorId: string, input: CreateAlbumInput): Promise<IMediaAlbum> {
        const slug =
            input.slug ||
            input.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

        const existing = await MediaAlbum.findOne({ slug });
        if (existing) {
            throw new ServiceError(409, 'album_slug_already_exists');
        }

        const album = await MediaAlbum.create({
            title: input.title,
            slug,
            description: input.description || null,
            category: input.category,
            cover_media_id: input.cover_media_id || null,
            event_id: input.event_id || null,
            created_by: creatorId,
            is_public: input.is_public ?? true,
        });

        return album;
    }

    async listAlbums(
        query: { category?: string; event_id?: string; page?: number; limit?: number },
        actor?: AuthUser | null
    ) {
        const isCore = actor ? this.isCoreRole(actor.role) : false;
        const filter: Record<string, any> = {};

        if (query.category) filter.category = query.category;
        if (query.event_id) filter.event_id = query.event_id;
        if (!isCore) filter.is_public = true;

        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 20;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            MediaAlbum.find(filter)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MediaAlbum.countDocuments(filter),
        ]);

        return {
            items,
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
        };
    }

    async getAlbumById(idOrSlug: string) {
        const album = await MediaAlbum.findOne({
            $or: [{ _id: idOrSlug }, { slug: idOrSlug }],
        }).lean();

        if (!album) {
            throw new ServiceError(404, 'album_not_found');
        }

        const media = await Media.find({ album_id: album._id, status: 'approved' })
            .sort({ created_at: -1 })
            .limit(50)
            .lean();

        return { ...album, media };
    }

    async listPendingModeration(query: { page?: number; limit?: number }) {
        const page = query.page && query.page > 0 ? query.page : 1;
        const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 20;
        const skip = (page - 1) * limit;

        const filter: Record<string, any> = { status: 'pending' };
        const [items, total] = await Promise.all([
            Media.find(filter as any)
                .sort({ created_at: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Media.countDocuments(filter as any),
        ]);

        return {
            items,
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit),
        };
    }

    async moderateMedia(
        id: string,
        actor: AuthUser,
        input: ModerateMediaInput
    ): Promise<IMedia> {
        const media = await Media.findById(id);
        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        media.status = input.status;
        media.approved_by = actor.id;
        media.approved_at = new Date();
        media.rejection_reason =
            input.status === 'rejected' ? input.rejection_reason || null : null;

        await media.save();

        if (input.status === 'approved') {
            publish('MediaApproved', 'media-service', {
                media_id: id,
                approved_by: actor.id,
            });
        } else {
            publish('MediaRejected', 'media-service', {
                media_id: id,
                reason: input.rejection_reason,
                rejected_by: actor.id,
            });
        }

        return media;
    }

    async toggleLike(id: string): Promise<{ media_id: string; likes_count: number }> {
        const media = await Media.findOneAndUpdate(
            { _id: id },
            { $inc: { likes_count: 1 } },
            { returnDocument: 'after' }
        ).lean();

        if (!media) {
            throw new ServiceError(404, 'media_not_found');
        }

        return { media_id: id, likes_count: media.likes_count };
    }
}

export const mediaService = new MediaService();
