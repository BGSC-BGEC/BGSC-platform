import {
    IUser,
    ROLE_RANK,
    RoleName,
    UserRole,
} from '@bgsc/shared';

/**
 * The single field-masking boundary (Spec §11.2, §7.2 "Field-Level").
 *
 * Every user-shaped response goes through here. Masking per-route instead would mean the one route
 * that forgets leaks every email address on the platform.
 *
 * Friends are out of MVP, so §11.2's "visible to friends or admin roles" collapses to:
 * self or admin sees full, everyone else sees masked.
 */

/**
 * Coordinator+ sees PII unconditionally — that is the rank the admin user table is gated to
 * (Spec §5.15.5). Core sees it only for participants of events they actually administer; the
 * caller resolves that with `piiScopeFor()` and passes the result in as `elevated`.
 */
export const PII_MIN_ROLE = UserRole.COORDINATOR;

export interface Viewer {
    id: string;
    role: UserRole;
}

export type Visibility = 'full' | 'public' | 'minimal';

/** `ana@gmail.com` -> `a***@gmail.com`. Never reveals length: the mask is fixed-width. */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    if (at <= 0) return '***';
    return `${email[0]}***${email.slice(at)}`;
}

/** `+919876543210` -> `+91******3210`. Last four only, the convention people already expect. */
export function maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    const tail = digits.slice(-4);
    const head = phone.startsWith('+') ? phone.slice(0, phone.length - digits.length + 2) : '';
    return `${head}******${tail}`;
}

/**
 * @param elevated the viewer is a Core admin of an event this user is registered for.
 *                 Resolved by `piiScopeFor()` — never inferred from the role alone.
 */
export function visibilityFor(
    user: Pick<IUser, '_id' | 'settings'>,
    viewer?: Viewer,
    elevated = false
): Visibility {
    if (viewer && viewer.id === user._id) return 'full';
    if (viewer && ROLE_RANK.indexOf(viewer.role as RoleName) >= ROLE_RANK.indexOf(PII_MIN_ROLE as RoleName)) {
        return 'full';
    }
    if (viewer && elevated) return 'full';
    // D9: a private profile still answers 200 with a card stub, so deep links keep working.
    if (user.settings?.privacy?.is_profile_public === false) return 'minimal';
    return 'public';
}

export interface SerializedUser {
    id: string;
    username: string;
    role?: UserRole;
    status?: string;
    email?: string;
    is_email_verified?: boolean;
    profile: {
        full_name?: string;
        avatar_url: string | null;
        bio?: string;
        interests?: string[];
        phone_number?: string | null;
        social_links?: Record<string, string | null>;
    };
    player_card: {
        card_tier?: string;
        stats?: Record<string, unknown>;
    };
    points_balance?: number;
    settings?: IUser['settings'];
    announcements?: IUser['announcements'];
    last_active_at?: Date | null;
    created_at?: Date;
    private?: true;
}

/**
 * Secrets are `select: false` on the schema, so they are normally absent here. Deleting them anyway
 * costs nothing and means an explicit `.select('+password_hash')` upstream cannot leak by accident.
 */
export function serializeUser(user: IUser, viewer?: Viewer, elevated = false): SerializedUser {
    const level = visibilityFor(user, viewer, elevated);
    const p = user.profile ?? ({} as IUser['profile']);

    if (level === 'minimal') {
        return {
            id: user._id,
            username: user.username,
            profile: { avatar_url: p.avatar_url ?? null },
            player_card: { card_tier: user.player_card?.card_tier },
            private: true,
        };
    }

    const base: SerializedUser = {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
        profile: {
            full_name: p.full_name,
            avatar_url: p.avatar_url ?? null,
            bio: p.bio,
            interests: p.interests ?? [],
        },
        player_card: {
            card_tier: user.player_card?.card_tier,
            stats: user.player_card?.stats ?? {},
        },
        points_balance: user.points_balance ?? 0,
        created_at: user.created_at,
    };

    if (level === 'full') {
        base.email = user.email;
        base.is_email_verified = user.is_email_verified;
        base.profile.phone_number = p.phone_number ?? null;
        base.profile.social_links = (p.social_links ?? {}) as Record<string, string | null>;
        base.settings = user.settings;
        base.announcements = user.announcements;
        base.last_active_at = user.last_active_at ?? null;
        return base;
    }

    // 'public'
    base.email = maskEmail(user.email);
    base.profile.phone_number = p.phone_number ? maskPhone(p.phone_number) : null;
    base.profile.social_links = (p.social_links ?? {}) as Record<string, string | null>;
    return base;
}

/** `{ user_id, display_name, avatar_url }` — the shape six BE-2 collections embed. */
export interface UserSnapshotDTO {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
}

export function snapshotOf(user: IUser): UserSnapshotDTO {
    return {
        user_id: user._id,
        display_name: user.profile?.full_name ?? user.username,
        avatar_url: user.profile?.avatar_url ?? null,
    };
}
