import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

export const HALL_OF_FAME_CATEGORY = ['event_winner', 'challenge_legend', 'sponsor_champion', 'custom'] as const;
export type HallOfFameCategory = (typeof HALL_OF_FAME_CATEGORY)[number];

export interface IHallOfFameEntry extends Document<string> {
    _id: string;
    slug: string;
    category: HallOfFameCategory;
    title: string;
    description?: string | null;
    quote?: string | null;
    
    honoree: {
        type: 'user' | 'team';
        id: string;
        display_name: string;
        avatar_url?: string | null;
        deleted?: boolean;
    };
    
    members?: Array<{
        user_id: string;
        display_name: string;
        avatar_url?: string | null;
        deleted?: boolean;
    }>;
    
    source: {
        type: 'event' | 'challenge' | 'manual';
        id?: string | null;
        title?: string | null;
    };
    
    achievement: {
        domain?: string;
        season?: string;
        year: number;
        difficulty?: string;
        award_points?: number;
    };
    
    media_url?: string | null;
    cover_url?: string | null;
    tags?: string[];
    
    featured: boolean;
    featured_order?: number | null;
    
    created_by: string;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date | null;
}

const HonoreeSchema = new Schema({
    type: { type: String, enum: ['user', 'team'], required: true },
    id: { type: String, required: true },
    display_name: { type: String, required: true },
    avatar_url: { type: String, default: null },
    // Raised by `anonymizedSnapshot()` when the account behind the snapshot is deleted.
    deleted: { type: Boolean, default: false }
}, { _id: false });

const MemberSchema = new Schema({
    user_id: { type: String, required: true },
    display_name: { type: String, required: true },
    avatar_url: { type: String, default: null },
    // Raised by `anonymizedSnapshot()` when the account behind the snapshot is deleted.
    deleted: { type: Boolean, default: false }
}, { _id: false });

const SourceSchema = new Schema({
    type: { type: String, enum: ['event', 'challenge', 'manual'], required: true },
    id: { type: String, default: null },
    title: { type: String, default: null }
}, { _id: false });

const AchievementSchema = new Schema({
    domain: { type: String },
    season: { type: String },
    year: { type: Number, required: true },
    difficulty: { type: String },
    award_points: { type: Number }
}, { _id: false });

export const HallOfFameEntrySchema: Schema<IHallOfFameEntry> = new Schema<IHallOfFameEntry>({
    _id: uuidId,
    slug: { type: String, required: true },
    category: { type: String, enum: HALL_OF_FAME_CATEGORY, required: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    quote: { type: String, default: null },
    
    honoree: { type: HonoreeSchema, required: true },
    members: { type: [MemberSchema], default: undefined },
    source: { type: SourceSchema, required: true },
    achievement: { type: AchievementSchema, required: true },
    
    media_url: { type: String, default: null },
    cover_url: { type: String, default: null },
    tags: { type: [String], default: [] },
    
    featured: { type: Boolean, default: false },
    featured_order: { type: Number, default: null },
    
    created_by: { type: String, required: true },
    deleted_at: { type: Date, default: null }
}, {
    collection: 'hall_of_fame_entries',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

HallOfFameEntrySchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
HallOfFameEntrySchema.index({ category: 1, 'achievement.year': -1 });
HallOfFameEntrySchema.index({ featured: 1, featured_order: 1 });
// One live entry per (category, honoree, source): what makes the ChallengeLegendAchieved consumer
// idempotent across N instances, where a read-then-insert let two of them both create one.
HallOfFameEntrySchema.index(
    { category: 1, 'honoree.id': 1, 'source.id': 1 },
    { unique: true, partialFilterExpression: { deleted_at: null, 'source.id': { $type: 'string' } } }
);

export const HallOfFameEntry = model<IHallOfFameEntry>('HallOfFameEntry', HallOfFameEntrySchema);
