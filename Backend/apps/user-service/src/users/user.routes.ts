import { Router, raw } from 'express';
import { IMAGE_MAX_BYTES } from '../storage/storage';
import * as c from './user.controller';
import {
    UserRole,
    requireAuth,
    requireActiveUser,
    validate,
} from '@bgsc/shared';
import {
    UpdateProfileSchema,
    UpdateSettingsSchema,
    ChangeRoleSchema,
    ChangeStatusSchema,
    ListUsersQuery,
    SearchQuery,
    RefParams,
    DeleteAccountSchema,
} from './user.schemas';

/**
 * ORDER MATTERS. `/users/me`, `/users/search` and `/users/:ref` are the same shape to Express,
 * which matches in declaration order. Literal paths must come before the parameterised one or
 * `/users/search` resolves as a lookup for a user named "search".
 *
 * Order: me/* -> search -> collection root -> :ref/* -> :ref
 */

export const userRoutes = Router();

// ---- self -----------------------------------------------------------------
userRoutes.get('/me', requireAuth, c.getMe);
userRoutes.patch('/me', requireAuth, validate({ body: UpdateProfileSchema }), c.updateMe);
userRoutes.patch('/me/settings', requireAuth, validate({ body: UpdateSettingsSchema }), c.updateMySettings);
userRoutes.get('/me/deletion-preview', requireAuth, c.deletionPreview);
userRoutes.delete('/me', requireAuth, validate({ body: DeleteAccountSchema }), c.deleteMe);
// No POST /me/restore. Restoring is Auth Service's POST /account/reactivate: a soft-deleted user
// holds no token (login returns a status, not tokens), so a route behind requireAuth here was
// unreachable the moment their last access token expired. Auth authenticates by password instead.

// Raw image body instead of multipart: one file, no form fields, no new dependency.
// express.raw enforces the Spec §15.1 size cap before the buffer reaches the handler.
userRoutes.post(
    '/me/avatar',
    requireAuth,
    raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: IMAGE_MAX_BYTES }),
    c.uploadAvatar
);

// ---- literal paths, before /:ref -------------------------------------------
// requireActiveUser on every route that resolves PII scope: the scope and the serializer's
// elevation rank the LIVE role, not a token claim that outlives a demotion (audit #2).
userRoutes.get('/search', requireAuth, requireActiveUser(), validate({ query: SearchQuery }), c.searchUsers);
userRoutes.get('/', requireAuth, requireActiveUser(UserRole.COORDINATOR), validate({ query: ListUsersQuery }), c.listUsers);

// ---- by reference (uuid or username) ---------------------------------------
// requireAuth on both profile reads ("any authed"). optionalAuth made every public
// profile and card an anonymous, scrapeable directory.
userRoutes.get('/:ref/player-card', requireAuth, requireActiveUser(), validate({ params: RefParams }), c.getPlayerCard);

userRoutes.get(
    '/:ref/audit',
    requireAuth,
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: RefParams }),
    c.auditForUser
);

// `requireActiveUser`, not `requireRole`: changing somebody's role is the most consequential write
// on the platform, and a token outlives a demotion or a suspension by up to fifteen minutes. The
// live document decides (adding-a-service.md §6.2; whole-backend audit, Sep 27).
userRoutes.patch(
    '/:ref/role',
    requireAuth,
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: RefParams, body: ChangeRoleSchema }),
    c.changeRole
);

// Same reasoning: suspending an account is not a write to hand to a suspended administrator.
userRoutes.patch(
    '/:ref/status',
    requireAuth,
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: RefParams, body: ChangeStatusSchema }),
    c.changeStatus
);

userRoutes.get('/:ref', requireAuth, requireActiveUser(), validate({ params: RefParams }), c.getUser);

// No /internal routes: the snapshot endpoint had no caller (every service reads `users` directly,
// relationships.md §1) and reported soft-deleted users as `deleted: false`. Removed Sep 26.
