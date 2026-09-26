import { ServiceError } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
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

export async function submitRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body as SubmitRegistrationInput;
        const registration = await registrationService.submitRegistration({ ...body, user_id: req.user!.id });
        res.status(201).json(registration);
    } catch (err) {
        next(err);
    }
}

export async function getMyRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const ownerId = typeof req.query.owner_id === 'string' ? req.query.owner_id : '';
        if (!ownerId) {
            throw new ServiceError(400, 'owner_id_required');
        }
        const registration = await registrationService.getMyRegistration(ownerId, req.user!.id);
        if (!registration) {
            throw new ServiceError(404, 'not_registered');
        }
        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function getRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await registrationService.getOwnRegistration(req.params.id as string, actorOf(req)));
    } catch (err) {
        next(err);
    }
}

export async function listRegistrationsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await registrationService.listRegistrations(req.query as unknown as ListRegistrationsInput, actorOf(req)));
    } catch (err) {
        next(err);
    }
}

/** `GET /registrations/:id/files/:field_key` — the only way a registration file leaves the disk. */
export async function downloadFileHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const file = await registrationService.registrationFile(req.params.id as string, req.params.field_key as string, actorOf(req));
        // attachment() sets Content-Type from the (user-chosen) filename's extension, so the stored
        // mime is written after it — `x.html` must not come back as text/html.
        res.attachment(file.name);
        res.setHeader('Content-Type', file.mime);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        // `send` ignores dotfile segments by default, and the store is `.private/`; the path is
        // already confined to it by `privatePathOf`.
        res.sendFile(file.path, { dotfiles: 'allow' }, (err) => {
            if (err && !res.headersSent) next(new ServiceError(404, 'file_not_found'));
        });
    } catch (err) {
        next(err);
    }
}

export async function updateRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const registration = await registrationService.updateRegistration(
            req.params.id as string,
            req.user!.id,
            req.body as UpdateRegistrationInput
        );
        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function updateAdminAnswersHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { answers } = req.body as AdminAnswersInput;
        res.json(await registrationService.updateAdminAnswers(req.params.id as string, actorOf(req), answers));
    } catch (err) {
        next(err);
    }
}

export async function cancelRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { reason } = req.body as CancelRegistrationInput;
        res.json(await registrationService.cancelRegistration(req.params.id as string, actorOf(req), reason));
    } catch (err) {
        next(err);
    }
}

export async function updateCaptainApplicationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body as UpdateCaptainApplicationInput;
        res.json(await registrationService.updateCaptainApplication(req.params.id as string, actorOf(req), body.status, body.note));
    } catch (err) {
        next(err);
    }
}

export async function updateStatusHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body as UpdateStatusInput;
        res.json(await registrationService.updateRegistrationStatus(req.params.id as string, actorOf(req), body.status, body.reason));
    } catch (err) {
        next(err);
    }
}
