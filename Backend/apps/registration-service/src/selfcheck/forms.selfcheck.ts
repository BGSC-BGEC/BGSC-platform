import { FormDefinition, FormDefinitionVersion, connectDB, disconnectDB } from '@bgsc/shared';
import assert from 'assert';
import * as formService from '../forms/form.service';
import { v4 as uuid } from 'uuid';

/**
 * Forms selfcheck: form creation, versioning, publish
 * Run: npx tsx apps/registration-service/src/selfcheck/forms.selfcheck.ts
 */

import { validateAnswers } from '../registrations/validation';

/** A field with the given overrides, so the cases below read as just their difference. */
const field = (over: Record<string, unknown>) => ({
    key: 'f', label: 'F', help_text: null, type: 'short_text', required: false, placeholder: null,
    options: null, validation: { min: null, max: null, pattern: null, accept: null, max_size_bytes: null },
    visible_if: null, admin_only: false, order: 0, ...over,
}) as any;

function validationRules() {
    console.log('9. Testing the validation engine gates...');

    // An admin_only field hidden by a condition the submitter controls must still be refused.
    // Checking visibility first let this through and stored the value unvalidated.
    const smuggle: Record<string, unknown> = { tier: 'basic', seed: 999 };
    const errs = validateAnswers(
        smuggle,
        [
            field({ key: 'tier', options: null }),
            field({ key: 'seed', type: 'number', admin_only: true, visible_if: { field_key: 'tier', op: 'eq', value: 'pro' } }),
        ],
        [],
        { isAdmin: false }
    );
    assert(errs.some((e) => e.field_key === 'seed' && e.code === 'admin_only'),
        'a hidden admin_only field must still reject a non-admin value');
    assert(!('seed' in smuggle), 'and the value must not survive into the stored answers');

    // A hidden field's answer is not an answer to anything.
    const hidden: Record<string, unknown> = { tier: 'basic', extra: 'stowaway' };
    validateAnswers(
        hidden,
        [field({ key: 'tier' }), field({ key: 'extra', visible_if: { field_key: 'tier', op: 'eq', value: 'pro' } })],
        [],
        { isAdmin: false }
    );
    assert(!('extra' in hidden), 'a hidden field\'s answer is stripped, not stored');

    // An admin_only field cannot be required OF a non-admin — the form says an admin fills it.
    const empty: Record<string, unknown> = {};
    const req = validateAnswers(empty, [field({ key: 'seed', required: true, admin_only: true })], [], { isAdmin: false });
    assert(req.length === 0, 'a required admin_only field does not block a user submission');

    // The admin who is allowed to set it still gets it validated.
    const asAdmin: Record<string, unknown> = { seed: 'not-a-number' };
    const adminErrs = validateAnswers(asAdmin, [field({ key: 'seed', type: 'number', admin_only: true })], [], { isAdmin: true });
    assert(adminErrs.some((e) => e.code === 'invalid_type'), 'an admin still gets type validation on it');

    // Visibility must not depend on where the controlling field sits in the array. Declared
    // *before* its controller here, which is the case that used to read an uncoerced value.
    const beforeCtl: Record<string, unknown> = { gate: 'pro', shown: 'kept' };
    validateAnswers(
        beforeCtl,
        [
            field({ key: 'shown', visible_if: { field_key: 'gate', op: 'eq', value: 'pro' }, order: 0 }),
            field({ key: 'gate', order: 1 }),
        ],
        [],
        { isAdmin: false }
    );
    assert(beforeCtl.shown === 'kept', 'a visible field survives regardless of field order');

    // A file attached to an admin_only field is still an admin_only write, even though files
    // never appear in `answers`.
    const fileErrs = validateAnswers(
        {},
        [field({ key: 'doc', type: 'file', admin_only: true })],
        [{ field_key: 'doc', url: '/uploads/x.pdf', name: 'x.pdf', size: 10, mime: 'application/pdf' }],
        { isAdmin: false }
    );
    assert(fileErrs.some((e) => e.field_key === 'doc' && e.code === 'admin_only'),
        'a non-admin cannot attach a file to an admin_only field');

    console.log('✓ admin_only survives hiding, hidden answers are stripped, order does not matter');
}

async function main() {
    await connectDB();

    const testEventId = uuid();
    const creatorId = uuid();

    // Create draft form
    console.log('1. Creating draft form...');
    const form = await formService.createForm({
        owner: { type: 'event', id: testEventId },
        title: 'Test Form',
        description: 'Test description',
        fields: [
            {
                key: 'name',
                label: 'Name',
                help_text: null,
                type: 'short_text',
                required: true,
                placeholder: 'Your name',
                options: null,
                validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null,
                admin_only: false,
                order: 0,
            },
        ],
        created_by: creatorId,
    });

    assert(form.status === 'draft', 'Form should be draft');
    assert(form.version === 1, 'Version should be 1');
    assert(form.fields.length === 1, 'Should have 1 field');
    console.log('✓ Draft form created');

    // Publish form
    console.log('2. Publishing form...');
    const published = await formService.publishForm(form._id);
    assert(published.status === 'published', 'Form should be published');
    assert(published.published_at !== null, 'Should have published_at');
    console.log('✓ Form published');

    // Edit published form (should bump version and archive)
    console.log('3. Editing published form (should bump version)...');
    const updated = await formService.updateForm(form._id, {
        fields: [
            {
                key: 'name',
                label: 'Full Name',
                help_text: null,
                type: 'short_text',
                required: true,
                placeholder: 'Your full name',
                options: null,
                validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null,
                admin_only: false,
                order: 0,
            },
            {
                key: 'email',
                label: 'Email',
                help_text: null,
                type: 'email',
                required: true,
                placeholder: 'your@email.com',
                options: null,
                validation: { min: null, max: null, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null,
                admin_only: false,
                order: 1,
            },
        ],
    });

    assert(updated.version === 2, 'Version should be bumped to 2');
    assert(updated.status === 'draft', 'Should be draft after edit');
    assert(updated.fields.length === 2, 'Should have 2 fields now');
    console.log('✓ Form version bumped to 2');

    // Verify version 1 was archived
    console.log('4. Verifying version 1 was archived...');
    const archived = await FormDefinitionVersion.findOne({ form_id: form._id, version: 1 });
    assert(archived !== null, 'Version 1 should be archived');
    assert(archived.fields.length === 1, 'Archived version should have 1 field');
    console.log('✓ Version 1 archived correctly');

    // Get form (should return latest)
    console.log('5. Getting form (should return v2)...');
    const retrieved = await formService.getForm(form._id);
    assert(retrieved.version === 2, 'Should return version 2');
    console.log('✓ Form retrieved correctly');

    // List forms
    console.log('6. Listing forms...');
    const forms = await formService.listForms({ owner_id: testEventId });
    assert(forms.length === 1, 'Should have 1 form');
    assert(forms[0]._id === form._id, 'Should be our form');
    console.log('✓ Forms listed correctly');

    // The archive exists so a submission made against v1 still knows what it asked. Reading it
    // back is the half that was missing.
    console.log('8. Reading an archived form version...');
    const v1 = await formService.getFormVersion(form._id, 1);
    assert(v1.version === 1, 'version 1 is readable after the form moved on');
    assert(v1.fields.length > 0, 'and carries the field set it was published with');
    const current = await formService.getFormVersion(form._id, 2);
    assert(current.version === 2, 'the current version answers from the form itself');
    await assert.rejects(
        () => formService.getFormVersion(form._id, 99),
        (err: any) => err.code === 'form_version_not_found',
        'a version that never existed is a 404, not an empty body'
    );
    console.log('✓ Archived versions are readable');

    // Cleanup
    await FormDefinition.deleteOne({ _id: form._id });
    await FormDefinitionVersion.deleteMany({ form_id: form._id });

    validationRules();

    await disconnectDB();
    console.log('\n✅ All forms selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
