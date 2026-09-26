import { requireActiveUser, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as controller from './form.controller';
import {
    CreateFormSchema,
    UpdateFormSchema,
    FormIdParams,
    FormVersionParams,
    ListFormsQuery,
} from './form.schemas';

/**
 * Every route mounts `requireActiveUser`: writes are scoped to the form's OWNER on the live actor
 * (an event's admins, core+ for challenge/generic — checked in the controller), and reads decide
 * whether drafts and admin_only fields are shown the same way.
 */

export const formRoutes = Router();

// POST /forms - create form (event admin for an event form; core+ otherwise)
formRoutes.post('/', requireAuth, requireActiveUser(), validate({ body: CreateFormSchema }), controller.createFormHandler);

// GET /forms - list forms (published for everyone; drafts for the owner's admins)
formRoutes.get('/', requireAuth, requireActiveUser(), validate({ query: ListFormsQuery }), controller.listFormsHandler);

// GET /forms/:id/versions/:version - the field set a past submission was validated against.
// Declared before /:id so Express does not try to match "versions" as a form id.
formRoutes.get(
    '/:id/versions/:version',
    requireAuth,
    requireActiveUser(),
    validate({ params: FormVersionParams }),
    controller.getFormVersionHandler
);

// GET /forms/:id - read form (admin-only fields stripped unless the caller administers the owner)
formRoutes.get('/:id', requireAuth, requireActiveUser(), validate({ params: FormIdParams }), controller.getFormHandler);

// PATCH /forms/:id - update form (owner admin)
formRoutes.patch('/:id', requireAuth, requireActiveUser(), validate({ params: FormIdParams, body: UpdateFormSchema }), controller.updateFormHandler);

// POST /forms/:id/publish - publish form (owner admin)
formRoutes.post('/:id/publish', requireAuth, requireActiveUser(), validate({ params: FormIdParams }), controller.publishFormHandler);

// DELETE /forms/:id - archive form (event admin; coordinator+ for challenge/generic)
formRoutes.delete('/:id', requireAuth, requireActiveUser(), validate({ params: FormIdParams }), controller.archiveFormHandler);
