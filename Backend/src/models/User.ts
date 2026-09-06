import { Schema, model, Document } from 'mongoose';

export enum UserRole {
    GUEST = 'guest',
    USER = 'user',
    MEMBER = 'member',
    CORE = 'core',
    COORDINATOR = 'coordinator',
    FOUNDER = 'founder'
}

export enum UserStatus {
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    PENDING_VERIFICATION = 'pending_verification',
    DELETED = 'deleted'
}
// key:value
export interface IUser extends Document {
    email: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    status: UserStatus;
    isEmailVerified: boolean;
    refreshTokenHash?: string;
    lastLoginAt?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;

    profile: {
        fullName: string;
        avatar?: string;
        phoneNumber?: string;
        bio?: string;
        interests?: string[];
        socialLinks?: {
            staraId?: string;
            instagram?: string;
            linkedin?: string;
            steamId?: string;
        };
    };

    playerCard: {
        cardTier?: string;
        stats: Record<string, unknown>;
    };

    pointsBalance?: number;

    settings: {
        notifications: {
            email: boolean;
            whatsapp: boolean;
        };
        privacy: {
            isProfilePublic: boolean;
        };
        theme: 'light' | 'dark' | 'system';
    };

    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        // Auth                                                                                                                           
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
        status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
        isEmailVerified: { type: Boolean, default: false },
        refreshTokenHash: { type: String, default: null },
        lastLoginAt: { type: Date, default: null },
        passwordResetToken: { type: String, default: null },
        passwordResetExpires: { type: Date, default: null },

        // Profile                                                                                                                        
        profile: {
            fullName: { type: String, required: true, trim: true },
            avatarUrl: { type: String, default: null },
            phoneNumber: { type: String, default: null },
            bio: { type: String, maxlength: 250, default: '' },
            interests: { type: [String], default: [] },
            socialLinks: {
                stravaId: { type: String, default: null },
                instagram: { type: String, default: null },
                linkedin: { type: String, default: null },
            },
        },

        // Player Card & Points                                                                                                           
        playerCard: {
            cardTier: { type: String, default: 'Rookie' },
            stats: { type: Schema.Types.Mixed, default: {} },
        },
        pointsBalance: { type: Number, default: 0 },

        // Settings
        settings: {
            notifications: {
                email: { type: Boolean, default: true },
                whatsapp: { type: Boolean, default: true },
            },
            privacy: {
                isProfilePublic: { type: Boolean, default: true },
            },
            theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        },
    },
    { timestamps: true }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ pointsBalance: -1 }); // Fast leaderboard querying
UserSchema.index({ createdAt: -1 });

export const User = model<IUser>('User', UserSchema);