import { Request } from 'express';
import * as formService from './form.service';
import { CreateFormInput, UpdateFormInput, ListFormsInput } from './form.schemas';
import { ServiceError, wrap } from '@bgsc/shared';
import { actorOf, isOwnerAdmin, ownerAdminCache, ownerOfId, requireOwnerAdmin } from '../access';

/**
 * A form belongs to its owner, and so does the right to shape it: an event's
 * admins for an event form — which also requires the event to exist — and core+
 * for challenge and generic forms (coordinator+ to archive those). All on the live actor; every
 * route here mounts `requireActiveUser`.
 */

/**
 * `admin_only` fields are the ones a user must not fill in — so they are also the ones a user has
 * no business seeing. Applied to every read a non-admin can make.
 */
function forViewer<T extends { fields: { admin_only: boolean }[] }>(form: T, admin: boolean): T {
    if (admin) return form;
    return { ...form, fields: form.fields.filter((f) => !f.admin_only) };
}

export const createFormHandler = wrap(async (req, res) => {
    const body = req.body as CreateFormInput;
    await requireOwnerAdmin(body.owner, actorOf(req));
    const form = await formService.createForm({ ...body, created_by: req.user!.id });
    res.status(201).json(form);
});

export const getFormHandler = wrap(async (req, res) => {
    const form = await formService.getForm(req.params.id as string);
    const admin = await isOwnerAdmin(form.owner, actorOf(req));
    // A draft is not a form anyone has been asked to fill in yet.
    if (!admin && form.status === 'draft') throw new ServiceError(404, 'form_not_found');
    res.json(forViewer(form.toObject(), admin));
});

/**
 * Drafts and admin_only fields are visible only on forms whose owner the caller administers. A
 * page of forms shares a handful of owners, so admin rights are resolved once per owner.
 */
export const listFormsHandler = wrap(async (req, res) => {
    const actor = actorOf(req);
    const adminOf = ownerAdminCache(actor);
    const query = req.query as unknown as ListFormsInput;
    // Drafts/archives only in a list scoped to one owner the caller administers; otherwise the
    // query itself is limited to published forms, so pages stay full.
    const owner = query.owner_id ? await ownerOfId(query.owner_id) : null;
    const scopedAdmin = !!owner && (await adminOf(owner));
    const forms = await formService.listForms({ ...query, status: scopedAdmin ? query.status : 'published' });
    const visible = [];
    for (const form of forms) visible.push(forViewer(form.toObject(), await adminOf(form.owner)));
    res.json(visible);
});

async function adminForm(req: Request, nonEventFloor: 'core' | 'coordinator' = 'core') {
    const form = await formService.getForm(req.params.id as string);
    await requireOwnerAdmin(form.owner, actorOf(req), nonEventFloor);
    return form;
}

export const updateFormHandler = wrap(async (req, res) => {
    await adminForm(req);
    res.json(await formService.updateForm(req.params.id as string, req.body as UpdateFormInput));
});

export const publishFormHandler = wrap(async (req, res) => {
    await adminForm(req);
    res.json(await formService.publishForm(req.params.id as string));
});

export const getFormVersionHandler = wrap(async (req, res) => {
    const { id, version } = req.params as unknown as { id: string; version: number };
    const form = await formService.getForm(id);
    const admin = await isOwnerAdmin(form.owner, actorOf(req));
    res.json(forViewer(await formService.getFormVersion(id, Number(version), admin), admin));
});

export const archiveFormHandler = wrap(async (req, res) => {
    await adminForm(req, 'coordinator');
    res.json(await formService.archiveForm(req.params.id as string));
});
