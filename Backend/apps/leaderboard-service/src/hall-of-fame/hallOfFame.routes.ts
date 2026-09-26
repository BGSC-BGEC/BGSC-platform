import { Router } from 'express';
import { requireAuth, requireActiveUser, UserRole, validate, wrap } from '@bgsc/shared';
import * as controller from './hallOfFame.controller';
import * as schemas from './hallOfFame.schemas';

export const hallOfFameRouter = Router();

// Public routes
hallOfFameRouter.get('/', validate({ query: schemas.HallOfFameQuerySchema }), wrap(controller.listEntries));
hallOfFameRouter.get('/featured', wrap(controller.getFeaturedEntries));
hallOfFameRouter.get('/:slugOrId', validate({ params: schemas.HallOfFameSlugOrIdParamSchema }), wrap(controller.getEntryBySlugOrId));

// Protected routes. `requireActiveUser(floor)` is a factory: passed uncalled it takes the request
// as its role and throws, so every write here would be a 500.
hallOfFameRouter.post(
    '/',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ body: schemas.CreateHallOfFameEntrySchema }),
    wrap(controller.createEntry)
);

hallOfFameRouter.patch(
    '/:id',
    requireAuth,
    requireActiveUser(UserRole.CORE),
    validate({ params: schemas.HallOfFameIdParamSchema, body: schemas.UpdateHallOfFameEntrySchema }),
    wrap(controller.updateEntry)
);

hallOfFameRouter.delete(
    '/:id',
    requireAuth,
    requireActiveUser(UserRole.COORDINATOR),
    validate({ params: schemas.HallOfFameIdParamSchema }),
    wrap(controller.deleteEntry)
);
