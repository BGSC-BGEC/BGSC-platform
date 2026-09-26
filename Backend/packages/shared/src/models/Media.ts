import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps, UserSnapshot, UserSnapshotSchema } from './shared';

/**
 * Media Service (:3009). See docs/modeldocs/media-model.md and Spec §5.11.1.
 * Collections: `media`, `media_albums`
 */

export const MEDIA_CATEGORIES = ['event', 'community', 'memories', 'sponsor', 'hall_of_fame', 'general'] as const;
export type MediaCategory = typeof MEDIA_CATEGORIES[number];

export const MEDIA_TYPES = ['image', 'video'] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export const MEDIA_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type MediaStatus = typeof MEDIA_STATUSES[number];

export interface IMedia extends Document<string> {
    _id: string;
    /** The standard display snapshot, so `UserDeleted` can raise `deleted` like everywhere else. */
    uploader: UserSnapshot;
    /**
     * The public URL. For a `pending` item the file is NOT there yet — it sits in the service's
     * unserved pending tree and is moved here on approval (media-service storage.ts).
     */
    url: string;
    thumbnail_url?: string | null;
    original_filename: string;
    mime_type: string;
    media_type: MediaType;
    size_bytes: number;
    category: MediaCategory;
    event_id?: string | null;
    album_id?: string | null;
    caption?: string | null;
    tags: string[];
    status: MediaStatus;
    approved_by?: string | null;
    approved_at?: Date | null;
    rejection_reason?: string | null;
    metadata?: {
        width?: number;
        height?: number;
        duration_seconds?: number;
    };
    views_count: number;
    likes_count: number;
    created_at: Date;
    updated_at: Date;
}

const MetadataSchema = new Schema(
    {
        width: { type: Number },
        height: { type: Number },
        duration_seconds: { type: Number },
    },
    { _id: false }
);

export const MediaSchema: Schema<IMedia> = new Schema<IMedia>(
    {
        _id: uuidId,
        uploader: { type: UserSnapshotSchema, required: true },
        url: { type: String, required: true },
        thumbnail_url: { type: String, default: null },
        original_filename: { type: String, required: true },
        mime_type: { type: String, required: true },
        media_type: { type: String, enum: MEDIA_TYPES, required: true },
        size_bytes: { type: Number, required: true, min: 0 },
        category: { type: String, enum: MEDIA_CATEGORIES, default: 'general', index: true },
        event_id: { type: String, default: null, index: true },
        album_id: { type: String, default: null, index: true },
        caption: { type: String, default: null, maxlength: 500 },
        tags: [{ type: String, trim: true, lowercase: true }],
        // ponytail: the default is never used — media-service, the one writer, always decides the
        // status (and where the file lives) explicitly. models.selfcheck pins 'approved'.
        status: { type: String, enum: MEDIA_STATUSES, default: 'approved', index: true },
        approved_by: { type: String, default: null },
        approved_at: { type: Date, default: null },
        rejection_reason: { type: String, default: null },
        metadata: { type: MetadataSchema, default: null },
        views_count: { type: Number, default: 0 },
        likes_count: { type: Number, default: 0 },
    },
    timestamps
);

MediaSchema.index({ category: 1, status: 1, created_at: -1 });
MediaSchema.index({ event_id: 1, status: 1, created_at: -1 });
MediaSchema.index({ tags: 1, status: 1 });
/** The per-uploader quota, and the profile consumers' `updateMany`. */
MediaSchema.index({ 'uploader.user_id': 1, status: 1, created_at: -1 });

export const Media = model<IMedia>('Media', MediaSchema, 'media');

export interface IMediaAlbum extends Document<string> {
    _id: string;
    title: string;
    slug: string;
    description?: string | null;
    category: MediaCategory;
    cover_media_id?: string | null;
    event_id?: string | null;
    created_by: string;
    media_count: number;
    is_public: boolean;
    created_at: Date;
    updated_at: Date;
}

export const MediaAlbumSchema: Schema<IMediaAlbum> = new Schema<IMediaAlbum>(
    {
        _id: uuidId,
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        description: { type: String, default: null },
        category: { type: String, enum: MEDIA_CATEGORIES, default: 'general', index: true },
        cover_media_id: { type: String, default: null },
        event_id: { type: String, default: null },
        created_by: { type: String, required: true },
        /** APPROVED items only — the number a visitor can actually see. */
        media_count: { type: Number, default: 0, min: 0 },
        is_public: { type: Boolean, default: true },
    },
    timestamps
);

MediaAlbumSchema.pre('validate', function (this: IMediaAlbum) {
    if (!this.slug && this.title) {
        this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
});

/**
 * One SYSTEM album per event (owner decision: organisers may make as many manual albums for an
 * event as they like). `EventCompleted` can arrive twice, and a find-then-create let both copies
 * through; the index makes the second one a duplicate key the consumer ignores.
 *
 * Named, and a new name: an older dev database may hold `event_id_1` or the earlier all-albums
 * `event_id_unique`, and reusing either name with new options is a boot-time IndexOptionsConflict.
 * `npm run migrate:audit2` drops `event_id_unique` — left in place it would still refuse a second manual album.
 */
MediaAlbumSchema.index(
    { event_id: 1 },
    {
        unique: true,
        partialFilterExpression: { event_id: { $type: 'string' }, created_by: 'system' },
        name: 'event_id_system_unique',
    }
);
/** "Albums of this event", now that there can be several. */
MediaAlbumSchema.index({ event_id: 1, created_at: -1 });

export const MediaAlbum = model<IMediaAlbum>('MediaAlbum', MediaAlbumSchema, 'media_albums');

/**
 * `media_likes` — one row per (media, user), so a like is a toggle rather than a counter anybody
 * can spin. `media.likes_count` is the denormalized total, moved only when a row is inserted or
 * removed.
 */
export interface IMediaLike extends Document<string> {
    _id: string;
    media_id: string;
    user_id: string;
    created_at: Date;
    updated_at: Date;
}

const MediaLikeSchema = new Schema<IMediaLike>(
    {
        _id: uuidId,
        media_id: { type: String, required: true },
        user_id: { type: String, required: true },
    },
    timestamps
);

MediaLikeSchema.index({ media_id: 1, user_id: 1 }, { unique: true });

export const MediaLike = model<IMediaLike>('MediaLike', MediaLikeSchema, 'media_likes');
