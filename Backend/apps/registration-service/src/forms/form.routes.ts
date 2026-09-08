import { UserRole, requireAuth, requireRole, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as controller from './form.controller';
import {
    CreateFormSchema,
    UpdateFormSchema,
    FormIdParams,
    FormVersionParams,
    ListFormsQuery,
} from './form.schemas';

export const formRoutes = Router();

// POST /forms - create form (core+)
formRoutes.post('/', requireAuth, requireRole(UserRole.CORE), validate({ body: CreateFormSchema }), controller.createFormHandler);

// GET /forms - list forms (any authed, with filters)
formRoutes.get('/', requireAuth, validate({ query: ListFormsQuery }), controller.listFormsHandler);

// GET /forms/:id/versions/:version - the field set a past submission was validated against.
// Declared before /:id so Express does not try to match "versions" as a form id.
formRoutes.get(
    '/:id/versions/:version',
    requireAuth,
    validate({ params: FormVersionParams }),
    controller.getFormVersionHandler
);

// GET /forms/:id - read form (any authed; admin-only fields stripped for non-admins)
formRoutes.get('/:id', requireAuth, validate({ params: FormIdParams }), controller.getFormHandler);

// PATCH /forms/:id - update form (core+)
formRoutes.patch('/:id', requireAuth, requireRole(UserRole.CORE), validate({ params: FormIdParams, body: UpdateFormSchema }), controller.updateFormHandler);

// POST /forms/:id/publish - publish form (core+)
formRoutes.post('/:id/publish', requireAuth, requireRole(UserRole.CORE), validate({ params: FormIdParams }), controller.publishFormHandler);

// DELETE /forms/:id - archive form (coordinator+)
formRoutes.delete('/:id', requireAuth, requireRole(UserRole.COORDINATOR), validate({ params: FormIdParams }), controller.archiveFormHandler);
