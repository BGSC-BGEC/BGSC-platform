import { Router, raw } from 'express';
import { requireAuth, optionalAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { requireServiceToken } from '../middleware/requireServiceToken';
import { validate } from '../middleware/validate';
import { UserRole } from '../models/User';
import { IMAGE_MAX_BYTES } from '../storage/storage';
import * as c from './user.controller';
import {
    UpdateProfileSchema,
    UpdateSettingsSchema,
    ChangeRoleSchema,
    ChangeStatusSchema,
    ListUsersQuery,
    SearchQuery,
    SnapshotQuery,
    RefParams,
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
userRoutes.delete('/me', requireAuth, c.deleteMe);

// Raw image body instead of multipart: one file, no form fields, no new dependency.
// express.raw enforces the Spec §15.1 size cap before the buffer reaches the handler.
userRoutes.post(
    '/me/avatar',
    requireAuth,
    raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: IMAGE_MAX_BYTES }),
    c.uploadAvatar
);

// ---- literal paths, before /:ref -------------------------------------------
userRoutes.get('/search', requireAuth, validate({ query: SearchQuery }), c.searchUsers);
userRoutes.get('/', requireAuth, requireRole(UserRole.COORDINATOR), validate({ query: ListUsersQuery }), c.listUsers);

// ---- by reference (uuid or username) ---------------------------------------
userRoutes.get('/:ref/player-card', optionalAuth, validate({ params: RefParams }), c.getPlayerCard);

userRoutes.get(
    '/:ref/audit',
    requireAuth,
    requireRole(UserRole.COORDINATOR),
    validate({ params: RefParams }),
    c.auditForUser
);

userRoutes.patch(
    '/:ref/role',
    requireAuth,
    requireRole(UserRole.COORDINATOR),
    validate({ params: RefParams, body: ChangeRoleSchema }),
    c.changeRole
);

userRoutes.patch(
    '/:ref/status',
    requireAuth,
    requireRole(UserRole.COORDINATOR),
    validate({ params: RefParams, body: ChangeStatusSchema }),
    c.changeStatus
);

// optionalAuth, not requireAuth: the response differs for a signed-in viewer (field masking, §11.2).
userRoutes.get('/:ref', optionalAuth, validate({ params: RefParams }), c.getUser);

/**
 * Internal snapshot refresh for the other six BE-2 services (relationships.md §4).
 *
 * Guarded by a shared service token, not by network placement. Left open this returns every
 * user's real name and avatar to anyone who can reach the port, regardless of profile privacy.
 */
export const internalRoutes = Router();
internalRoutes.use(requireServiceToken);
internalRoutes.get('/users/snapshot', validate({ query: SnapshotQuery }), c.getSnapshots);
