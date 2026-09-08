import { ServiceError, UserRole, rankOf } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
import * as registrationService from './registration.service';
import {
    SubmitRegistrationInput,
    UpdateRegistrationInput,
    UpdateCaptainApplicationInput,
    UpdateStatusInput,
    CancelRegistrationInput,
} from './registration.schemas';

/**
 * May act on someone else's registration. Ranked against the shared ladder rather than a literal
 * list of role names, so inserting a role below `core` cannot silently widen this.
 */
const isAdmin = (req: Request) => rankOf(req.user!.role) >= rankOf(UserRole.CORE);

export async function submitRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body as SubmitRegistrationInput;
        const registration = await registrationService.submitRegistration({
            ...body,
            user_id: req.user!.id,
            is_admin: isAdmin(req),
        });
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
            return res.status(404).json({ error: 'not_registered' });
        }
        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function getRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const registrationId = typeof req.params.id === 'string' ? req.params.id : '';
        const registration = await registrationService.getRegistration(registrationId);

        // Check access: self or admin
        const isOwner = registration.user.user_id === req.user!.id;

        if (!isOwner && !isAdmin(req)) {
            throw new ServiceError(403, 'forbidden');
        }

        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function listRegistrationsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const filter: {
            owner_id?: string;
            status?: string;
            user_id?: string;
        } = {};

        if (req.query.owner_id && typeof req.query.owner_id === 'string') {
            filter.owner_id = req.query.owner_id;
        }
        if (req.query.status && typeof req.query.status === 'string') {
            filter.status = req.query.status;
        }

        // Non-admin can only see their own
        if (!isAdmin(req)) {
            filter.user_id = req.user!.id;
        } else if (req.query.user_id && typeof req.query.user_id === 'string') {
            filter.user_id = req.query.user_id;
        }

        const registrations = await registrationService.listRegistrations(filter);
        res.json(registrations);
    } catch (err) {
        next(err);
    }
}

export async function updateRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const registrationId = typeof req.params.id === 'string' ? req.params.id : '';
        const registration = await registrationService.updateRegistration(
            registrationId,
            req.user!.id,
            req.body as UpdateRegistrationInput
        );
        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function cancelRegistrationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const registrationId = typeof req.params.id === 'string' ? req.params.id : '';
        const { reason } = req.body as CancelRegistrationInput;
        const registration = await registrationService.cancelRegistration(
            registrationId,
            req.user!.id,
            isAdmin(req),
            reason
        );
        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function updateCaptainApplicationHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const registrationId = typeof req.params.id === 'string' ? req.params.id : '';
        const body = req.body as UpdateCaptainApplicationInput;
        const registration = await registrationService.updateCaptainApplication(
            registrationId,
            req.user!.id,
            body.status,
            body.note
        );
        res.json(registration);
    } catch (err) {
        next(err);
    }
}

export async function updateStatusHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const registrationId = typeof req.params.id === 'string' ? req.params.id : '';
        const body = req.body as UpdateStatusInput;
        const registration = await registrationService.updateRegistrationStatus(
            registrationId,
            req.user!.id,
            body.status,
            body.reason
        );
        res.json(registration);
    } catch (err) {
        next(err);
    }
}
