import { Router } from 'express';
import { requireAuth, requireActiveUser, requireRole, UserRole, validate, wrap } from '@bgsc/shared';
import * as controller from './hallOfFame.controller';
import * as schemas from './hallOfFame.schemas';

export const hallOfFameRouter = Router();

// Public routes
hallOfFameRouter.get('/', validate({ query: schemas.HallOfFameQuerySchema }), wrap(controller.listEntries));
hallOfFameRouter.get('/featured', wrap(controller.getFeaturedEntries));
hallOfFameRouter.get('/:slugOrId', validate({ params: schemas.HallOfFameSlugOrIdParamSchema }), wrap(controller.getEntryBySlugOrId));

// Protected routes
hallOfFameRouter.post(
    '/',
    requireAuth,
    requireActiveUser,
    requireRole(UserRole.CORE),
    validate({ body: schemas.CreateHallOfFameEntrySchema }),
    wrap(controller.createEntry)
);

hallOfFameRouter.patch(
    '/:id',
    requireAuth,
    requireActiveUser,
    requireRole(UserRole.CORE),
    validate({ params: schemas.HallOfFameIdParamSchema, body: schemas.UpdateHallOfFameEntrySchema }),
    wrap(controller.updateEntry)
);

hallOfFameRouter.delete(
    '/:id',
    requireAuth,
    requireActiveUser,
    requireRole(UserRole.COORDINATOR),
    validate({ params: schemas.HallOfFameIdParamSchema }),
    wrap(controller.deleteEntry)
);
