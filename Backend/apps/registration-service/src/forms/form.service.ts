import { FormDefinition, FormDefinitionVersion, FormField, IFormDefinition, ServiceError, publish } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';

interface CreateFormInput {
    owner: { type: 'event' | 'challenge' | 'generic'; id: string | null };
    title: string;
    description?: string | null;
    fields?: any[];
    settings?: {
        allow_edit_until?: 'closes_at' | 'never' | 'always';
        confirmation_message?: string | null;
    };
    created_by: string;
}

export async function createForm(input: CreateFormInput): Promise<IFormDefinition> {
    const form = new FormDefinition({
        _id: uuid(),
        owner: input.owner,
        title: input.title,
        description: input.description ?? null,
        version: 1,
        status: 'draft',
        fields: input.fields ?? [],
        settings: {
            allow_edit_until: input.settings?.allow_edit_until ?? 'closes_at',
            confirmation_message: input.settings?.confirmation_message ?? null,
        },
        created_by: input.created_by,
        published_at: null,
    });

    await form.save();
    return form;
}

/**
 * The form model has `optimisticConcurrency`: a save whose read went stale (another admin edited,
 * published or archived in between) throws VersionError instead of silently overwriting.
 */
async function saveForm(form: IFormDefinition): Promise<void> {
    try {
        await form.save();
    } catch (err) {
        if ((err as Error)?.name === 'VersionError') throw new ServiceError(409, 'form_changed');
        throw err;
    }
}

export async function getForm(formId: string): Promise<IFormDefinition> {
    const form = await FormDefinition.findById(formId);
    if (!form) {
        throw new ServiceError(404, 'form_not_found');
    }
    return form;
}

export async function listForms(filter: {
    owner_type?: string;
    owner_id?: string;
    status?: string;
    limit: number;
    offset: number;
}): Promise<IFormDefinition[]> {
    const query: Record<string, unknown> = {};
    if (filter.owner_type) query['owner.type'] = filter.owner_type;
    if (filter.owner_id) query['owner.id'] = filter.owner_id;
    if (filter.status) query.status = filter.status;

    return FormDefinition.find(query).sort({ created_at: -1, _id: 1 }).skip(filter.offset).limit(filter.limit);
}

export async function updateForm(
    formId: string,
    updates: {
        title?: string;
        description?: string | null;
        fields?: any[];
        settings?: {
            allow_edit_until?: 'closes_at' | 'never' | 'always';
            confirmation_message?: string | null;
        };
    }
): Promise<IFormDefinition> {
    const form = await getForm(formId);

    // An archived form's field set is what its submissions were validated against; editing it in
    // place (no version bump — it is not `published`) rewrote their history.
    if (form.status === 'archived') throw new ServiceError(409, 'form_archived');

    // Fields are immutable once published: editing freezes the current set and bumps the version.
    const archive =
        form.status === 'published' && updates.fields
            ? { form_id: form._id, version: form.version, fields: form.toObject().fields as FormField[], published_at: form.published_at! }
            : null;
    if (archive) {
        form.version += 1;
        form.published_at = null; // needs republish
        form.status = 'draft';
    }

    if (updates.title !== undefined) form.title = updates.title;
    if (updates.description !== undefined) form.description = updates.description;
    if (updates.fields !== undefined) form.fields = updates.fields;
    if (updates.settings) {
        if (updates.settings.allow_edit_until !== undefined) {
            form.settings.allow_edit_until = updates.settings.allow_edit_until;
        }
        if (updates.settings.confirmation_message !== undefined) {
            form.settings.confirmation_message = updates.settings.confirmation_message;
        }
    }

    /**
     * Validate BEFORE the archive row is written, and write the archive idempotently. The old order
     * (archive, then a save that could still fail its invariants) left a row for version N behind,
     * and every later edit tried to insert version N again, hit the unique index and 500'd — the
     * form was frozen for good.
     */
    try {
        await form.validate();
    } catch (err) {
        throw new ServiceError(422, 'validation_failed', [{ field_key: 'fields', code: 'invalid_form', message: (err as Error).message }]);
    }
    if (archive) {
        await FormDefinitionVersion.updateOne(
            { form_id: archive.form_id, version: archive.version },
            { $setOnInsert: { _id: uuid(), ...archive } },
            { upsert: true }
        );
    }

    await saveForm(form);
    return form;
}

export async function publishForm(formId: string): Promise<IFormDefinition> {
    const form = await getForm(formId);

    // Publishing used to silently un-archive a form and re-announce an already published one.
    if (form.status === 'archived') throw new ServiceError(409, 'form_archived');
    if (form.status === 'published') return form;
    if (form.fields.length === 0) {
        throw new ServiceError(400, 'cannot_publish_empty_form');
    }

    form.status = 'published';
    form.published_at = new Date();
    await saveForm(form);

    publish('FormPublished', 'registration-service', {
        form_id: form._id,
        owner: form.owner,
        version: form.version,
    });

    return form;
}

export async function archiveForm(formId: string): Promise<IFormDefinition> {
    const form = await getForm(formId);
    form.status = 'archived';
    await saveForm(form);
    return form;
}

/**
 * The field set a submission was validated against. Editing a published form archives the old
 * fields and bumps the version; the current version is answered from the form itself.
 *
 * `includeDraft: false` (a non-admin) does not see the current version of a form that is still a
 * draft — that is an unpublished field set, not something anyone was asked.
 */
export async function getFormVersion(formId: string, version: number, includeDraft = true) {
    const form = await getForm(formId);
    if (form.version === version) {
        if (!includeDraft && form.status === 'draft') throw new ServiceError(404, 'form_version_not_found');
        return { form_id: form._id, version: form.version, fields: form.toObject().fields as FormField[], published_at: form.published_at };
    }

    const archived = await FormDefinitionVersion.findOne({ form_id: formId, version }).lean();
    if (!archived) {
        throw new ServiceError(404, 'form_version_not_found');
    }
    return archived;
}
