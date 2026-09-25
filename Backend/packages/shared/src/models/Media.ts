import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

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
    uploader: {
        user_id: string;
        display_name: string;
        avatar_url: string | null;
    };
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

const UploaderSchema = new Schema(
    {
        user_id: { type: String, required: true },
        display_name: { type: String, required: true },
        avatar_url: { type: String, default: null },
    },
    { _id: false }
);

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
        uploader: { type: UploaderSchema, required: true },
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
        event_id: { type: String, default: null, index: true },
        created_by: { type: String, required: true },
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

export const MediaAlbum = model<IMediaAlbum>('MediaAlbum', MediaAlbumSchema, 'media_albums');
