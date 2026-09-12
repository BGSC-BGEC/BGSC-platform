import { FormDefinition, FormDefinitionVersion, IFormDefinition, ServiceError, publish } from '@bgsc/shared';
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
}): Promise<IFormDefinition[]> {
    const query: any = {};
    if (filter.owner_type) query['owner.type'] = filter.owner_type;
    if (filter.owner_id) query['owner.id'] = filter.owner_id;
    if (filter.status) query.status = filter.status;

    return FormDefinition.find(query).sort({ created_at: -1 });
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

    // If form is published and fields are being changed, bump version and archive old fields
    if (form.status === 'published' && updates.fields) {
        // Archive current version
        const version = new FormDefinitionVersion({
            _id: uuid(),
            form_id: form._id,
            version: form.version,
            fields: form.fields,
            published_at: form.published_at!,
        });
        await version.save();

        // Bump version
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

    await form.save();
    return form;
}

export async function publishForm(formId: string): Promise<IFormDefinition> {
    const form = await getForm(formId);

    if (form.fields.length === 0) {
        throw new ServiceError(400, 'cannot_publish_empty_form');
    }

    form.status = 'published';
    form.published_at = new Date();

    await form.save();

    await publish(
        'FormPublished',
        'registration-service',
        {
            form_id: form._id,
            owner: form.owner,
            version: form.version,
        }
    );

    return form;
}

export async function archiveForm(formId: string): Promise<IFormDefinition> {
    const form = await getForm(formId);
    form.status = 'archived';
    await form.save();
    return form;
}

/**
 * The archived field set a submission was validated against.
 *
 * Editing a published form archives the old fields and bumps the version (§D7), so a submission
 * made against v1 still knows what it answered. That archive was write-only until this had a
 * route: the rows were being written and nothing could ever read them back, which is the whole
 * point of keeping them.
 *
 * The current version lives on the form itself, so it is answered from there rather than from an
 * archive row that only exists once the form has been edited at least once.
 */
export async function getFormVersion(formId: string, version: number) {
    const form = await getForm(formId);
    if (form.version === version) {
        return { form_id: form._id, version: form.version, fields: form.fields, published_at: form.published_at };
    }

    const archived = await FormDefinitionVersion.findOne({ form_id: formId, version });
    if (!archived) {
        throw new ServiceError(404, 'form_version_not_found');
    }
    return archived;
}
