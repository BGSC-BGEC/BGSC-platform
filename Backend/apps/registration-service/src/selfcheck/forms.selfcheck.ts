import { FormDefinition, FormDefinitionVersion, connectDB, disconnectDB } from '@bgsc/shared';
import assert from 'assert';
import * as formService from '../forms/form.service';
import { v4 as uuid } from 'uuid';

/**
 * Forms selfcheck: form creation, versioning, publish
 * Run: npx tsx apps/registration-service/src/selfcheck/forms.selfcheck.ts
 */

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

    // Cleanup
    await FormDefinition.deleteOne({ _id: form._id });
    await FormDefinitionVersion.deleteMany({ form_id: form._id });

    await disconnectDB();
    console.log('\n✅ All forms selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
