import { Request, Response, NextFunction } from 'express';
import * as formService from './form.service';
import { CreateFormInput, UpdateFormInput, ListFormsInput } from './form.schemas';
import { UserRole, rankOf } from '@bgsc/shared';

/** Sees admin_only fields. Ranked against the shared ladder, not a name list. */
const isAdmin = (req: Request) => rankOf(req.user!.role) >= rankOf(UserRole.CORE);

export async function createFormHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const form = await formService.createForm({
            ...(req.body as CreateFormInput),
            created_by: req.user!.id,
        });
        res.status(201).json(form);
    } catch (err) {
        next(err);
    }
}

export async function getFormHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const formId = req.params.id as string;
        const form = await formService.getForm(formId);

        // `admin_only` fields are the ones a user must not fill in — so they are also the ones a
        // user has no business seeing on the form they are about to render.
        if (!isAdmin(req)) {
            const visible = form.toObject();
            visible.fields = visible.fields.filter((f: { admin_only: boolean }) => !f.admin_only);
            res.json(visible);
            return;
        }

        res.json(form);
    } catch (err) {
        next(err);
    }
}

export async function listFormsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const forms = await formService.listForms(req.query as ListFormsInput);
        res.json(forms);
    } catch (err) {
        next(err);
    }
}

export async function updateFormHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const formId = req.params.id as string;
        const form = await formService.updateForm(formId, req.body as UpdateFormInput);
        res.json(form);
    } catch (err) {
        next(err);
    }
}

export async function publishFormHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const formId = req.params.id as string;
        const form = await formService.publishForm(formId);
        res.json(form);
    } catch (err) {
        next(err);
    }
}

export async function archiveFormHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const formId = req.params.id as string;
        const form = await formService.archiveForm(formId);
        res.json(form);
    } catch (err) {
        next(err);
    }
}
