import { UserRole, requireAuth, requireRole, validate } from '@bgsc/shared';
import { Router, raw } from 'express';
import { ACCEPTED_MIMES, FILE_MAX_BYTES } from '../storage/storage';
import { uploadFileHandler } from './upload';
import * as controller from './registration.controller';
import {
    SubmitRegistrationSchema,
    UpdateRegistrationSchema,
    UpdateCaptainApplicationSchema,
    UpdateStatusSchema,
    CancelRegistrationSchema,
    IdParams,
    ListRegistrationsQuery,
    MyRegistrationQuery,
} from './registration.schemas';

/**
 * ORDER MATTERS: `/me` is the same shape as `/:id` to Express and must be declared first, or it
 * resolves as a lookup for a registration whose id is "me".
 *
 * Every route validates through the shared `validate()` middleware rather than calling
 * `schema.parse()` in the handler: a thrown ZodError is not a ServiceError, so the shared error
 * handler turned every malformed request into a 500 instead of a 422.
 */

export const registrationRoutes = Router();

// POST /registrations - submit registration (user+)
registrationRoutes.post('/', requireAuth, validate({ body: SubmitRegistrationSchema }), controller.submitRegistrationHandler);

// POST /registrations/upload-file - upload one file answer, before submitting (plan §D2).
// express.raw enforces the hard size ceiling before the body reaches the handler.
registrationRoutes.post(
    '/upload-file',
    requireAuth,
    raw({ type: ACCEPTED_MIMES, limit: FILE_MAX_BYTES }),
    uploadFileHandler
);

// GET /registrations/me?owner_id=:id - check if I'm registered (user+)
registrationRoutes.get('/me', requireAuth, validate({ query: MyRegistrationQuery }), controller.getMyRegistrationHandler);

// GET /registrations - list registrations (own; core+ sees all)
registrationRoutes.get('/', requireAuth, validate({ query: ListRegistrationsQuery }), controller.listRegistrationsHandler);

// GET /registrations/:id - read one submission (self or core+)
registrationRoutes.get('/:id', requireAuth, validate({ params: IdParams }), controller.getRegistrationHandler);

// PATCH /registrations/:id/captain-application - approve/decline captain (core+)
registrationRoutes.patch(
    '/:id/captain-application',
    requireAuth,
    requireRole(UserRole.CORE),
    validate({ params: IdParams, body: UpdateCaptainApplicationSchema }),
    controller.updateCaptainApplicationHandler
);

// PATCH /registrations/:id/status - admin override status (core+)
registrationRoutes.patch(
    '/:id/status',
    requireAuth,
    requireRole(UserRole.CORE),
    validate({ params: IdParams, body: UpdateStatusSchema }),
    controller.updateStatusHandler
);

// PATCH /registrations/:id - edit answers (self, within the form's edit window)
registrationRoutes.patch('/:id', requireAuth, validate({ params: IdParams, body: UpdateRegistrationSchema }), controller.updateRegistrationHandler);

// DELETE /registrations/:id - cancel registration (self or core+)
registrationRoutes.delete('/:id', requireAuth, validate({ params: IdParams, body: CancelRegistrationSchema }), controller.cancelRegistrationHandler);
