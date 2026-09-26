import { requireActiveUser, requireAuth, validate } from '@bgsc/shared';
import { Router, raw } from 'express';
import { ACCEPTED_MIMES, FILE_MAX_BYTES } from '../storage/storage';
import { uploadFileHandler, uploadPrecheck } from './upload';
import { perUserRateLimit } from './rate-limit';
import * as controller from './registration.controller';
import {
    AdminAnswersSchema,
    SubmitRegistrationSchema,
    UpdateRegistrationSchema,
    UpdateCaptainApplicationSchema,
    UpdateStatusSchema,
    CancelRegistrationSchema,
    FileParams,
    IdParams,
    ListRegistrationsQuery,
    MyRegistrationQuery,
    UploadFileQuery,
} from './registration.schemas';

/**
 * ORDER MATTERS: `/me` is the same shape as `/:id` to Express and must be declared first, or it
 * resolves as a lookup for a registration whose id is "me".
 *
 * Every route validates through the shared `validate()` middleware (422 on a bad shape), and every
 * route that may act as an admin mounts `requireActiveUser`: who administers a registration is
 * decided against its owner on the LIVE actor, not the token's role claim.
 *
 * Submit and edit run the form's admin-written patterns, and a 422 costs the caller nothing — so
 * both are rate limited per user.
 */

export const registrationRoutes = Router();

const answersLimit = perUserRateLimit(20, 60_000);

// POST /registrations - submit registration (user+)
registrationRoutes.post(
    '/',
    requireAuth,
    requireActiveUser(),
    answersLimit,
    validate({ body: SubmitRegistrationSchema }),
    controller.submitRegistrationHandler
);

// POST /registrations/upload-file - upload one file answer, before submitting.
// The precheck refuses an over-quota caller or an oversized declared body BEFORE express.raw
// buffers it; express.raw then enforces the hard ceiling on what actually arrives.
registrationRoutes.post(
    '/upload-file',
    requireAuth,
    requireActiveUser(),
    validate({ query: UploadFileQuery }),
    uploadPrecheck,
    raw({ type: ACCEPTED_MIMES, limit: FILE_MAX_BYTES }),
    uploadFileHandler
);

// GET /registrations/me?owner_id=:id - check if I'm registered (user+)
registrationRoutes.get('/me', requireAuth, validate({ query: MyRegistrationQuery }), controller.getMyRegistrationHandler);

// GET /registrations - own registrations; with owner_id/form_id, the whole list for its admins. Paged.
registrationRoutes.get(
    '/',
    requireAuth,
    requireActiveUser(),
    validate({ query: ListRegistrationsQuery }),
    controller.listRegistrationsHandler
);

// GET /registrations/:id/files/:field_key - download a file answer (owner, or admin of the owner)
registrationRoutes.get(
    '/:id/files/:field_key',
    requireAuth,
    requireActiveUser(),
    validate({ params: FileParams }),
    controller.downloadFileHandler
);

// GET /registrations/:id - read one submission (owner or owner-admin; 404 otherwise)
registrationRoutes.get('/:id', requireAuth, requireActiveUser(), validate({ params: IdParams }), controller.getRegistrationHandler);

// PATCH /registrations/:id/captain-application - approve/decline captain (event admin)
registrationRoutes.patch(
    '/:id/captain-application',
    requireAuth,
    requireActiveUser(),
    validate({ params: IdParams, body: UpdateCaptainApplicationSchema }),
    controller.updateCaptainApplicationHandler
);

// PATCH /registrations/:id/status - admin override status (owner-admin)
registrationRoutes.patch(
    '/:id/status',
    requireAuth,
    requireActiveUser(),
    validate({ params: IdParams, body: UpdateStatusSchema }),
    controller.updateStatusHandler
);

// PATCH /registrations/:id/admin-answers - fill admin_only fields on someone else's row (owner-admin)
registrationRoutes.patch(
    '/:id/admin-answers',
    requireAuth,
    requireActiveUser(),
    validate({ params: IdParams, body: AdminAnswersSchema }),
    controller.updateAdminAnswersHandler
);

// PATCH /registrations/:id - edit answers (self, within the form's edit window)
registrationRoutes.patch(
    '/:id',
    requireAuth,
    requireActiveUser(),
    answersLimit,
    validate({ params: IdParams, body: UpdateRegistrationSchema }),
    controller.updateRegistrationHandler
);

// DELETE /registrations/:id - cancel registration (self or owner-admin)
registrationRoutes.delete(
    '/:id',
    requireAuth,
    requireActiveUser(),
    validate({ params: IdParams, body: CancelRegistrationSchema }),
    controller.cancelRegistrationHandler
);
