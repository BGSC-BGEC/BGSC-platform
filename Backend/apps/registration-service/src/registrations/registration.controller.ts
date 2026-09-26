import { ServiceError, wrap } from '@bgsc/shared';
import * as registrationService from './registration.service';
import {
    AdminAnswersInput,
    SubmitRegistrationInput,
    UpdateRegistrationInput,
    UpdateCaptainApplicationInput,
    UpdateStatusInput,
    CancelRegistrationInput,
    ListRegistrationsInput,
} from './registration.schemas';
import { actorOf } from '../access';

/**
 * Every route here mounts `requireActiveUser`, so `actorOf(req)` is the live document. Whether the
 * actor administers a registration is decided by the service against its OWNER (the event's
 * admins, core+ for challenge/generic) — never "is core" on the token.
 */

export const submitRegistrationHandler = wrap(async (req, res) => {
    const body = req.body as SubmitRegistrationInput;
    res.status(201).json(await registrationService.submitRegistration({ ...body, user_id: req.user!.id }));
});

/** `owner_id` is required by the route's query schema. */
export const getMyRegistrationHandler = wrap(async (req, res) => {
    const registration = await registrationService.getMyRegistration(req.query.owner_id as string, req.user!.id);
    if (!registration) throw new ServiceError(404, 'not_registered');
    res.json(registration);
});

export const getRegistrationHandler = wrap(async (req, res) => {
    res.json(await registrationService.getOwnRegistration(req.params.id as string, actorOf(req)));
});

export const listRegistrationsHandler = wrap(async (req, res) => {
    res.json(await registrationService.listRegistrations(req.query as unknown as ListRegistrationsInput, actorOf(req)));
});

/** `GET /registrations/:id/files/:field_key` — the only way a registration file leaves the disk. */
export const downloadFileHandler = wrap(async (req, res) => {
    const file = await registrationService.registrationFile(req.params.id as string, req.params.field_key as string, actorOf(req));
    // attachment() sets Content-Type from the (user-chosen) filename's extension, so the stored
    // mime is written after it — `x.html` must not come back as text/html.
    res.attachment(file.name);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    // `send` ignores dotfile segments by default, and the store is `.private/`; the path is
    // already confined to it by `privatePathOf`.
    await new Promise<void>((resolve, reject) =>
        res.sendFile(file.path, { dotfiles: 'allow' }, (err) =>
            err && !res.headersSent ? reject(new ServiceError(404, 'file_not_found')) : resolve()
        )
    );
});

export const updateRegistrationHandler = wrap(async (req, res) => {
    res.json(await registrationService.updateRegistration(req.params.id as string, req.user!.id, req.body as UpdateRegistrationInput));
});

export const updateAdminAnswersHandler = wrap(async (req, res) => {
    const { answers } = req.body as AdminAnswersInput;
    res.json(await registrationService.updateAdminAnswers(req.params.id as string, actorOf(req), answers));
});

export const cancelRegistrationHandler = wrap(async (req, res) => {
    const { reason } = req.body as CancelRegistrationInput;
    res.json(await registrationService.cancelRegistration(req.params.id as string, actorOf(req), reason));
});

export const updateCaptainApplicationHandler = wrap(async (req, res) => {
    const body = req.body as UpdateCaptainApplicationInput;
    res.json(await registrationService.updateCaptainApplication(req.params.id as string, actorOf(req), body.status, body.note));
});

export const updateStatusHandler = wrap(async (req, res) => {
    const body = req.body as UpdateStatusInput;
    res.json(await registrationService.updateRegistrationStatus(req.params.id as string, actorOf(req), body.status, body.reason));
});
