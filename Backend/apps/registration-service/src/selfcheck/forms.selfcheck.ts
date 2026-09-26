import './scratch-env';
import { FormDefinition, FormDefinitionVersion } from '@bgsc/shared';
import { requireOwnerAdmin } from '../access';
import { seedEvent } from './seed';
import assert from 'assert';
import * as formService from '../forms/form.service';
import { CreateFormSchema } from '../forms/form.schemas';
import { patternProblem } from '../registrations/validation';
import { closeScratchDb, openScratchDb } from './seed';
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

    console.log('10. Visibility and type strictness (backend-audit-2026-09-26 H4 + lows)...');
    const run = (answers: Record<string, unknown>, fields: any[], files: any[] = []) =>
        validateAnswers(answers, fields, files, { isAdmin: false });

    // A hidden controller's answer must not hide a required field: `attending` is hidden (role is
    // not guest), so its 'no' is not an answer, and the waiver it would have hidden is required.
    const chain = [
        field({ key: 'role', type: 'select', options: [{ value: 'guest', label: 'g' }, { value: 'player', label: 'p' }] }),
        field({ key: 'attending', type: 'select', options: [{ value: 'yes', label: 'y' }, { value: 'no', label: 'n' }],
            visible_if: { field_key: 'role', op: 'eq', value: 'guest' } }),
        field({ key: 'waiver', type: 'checkbox', required: true, visible_if: { field_key: 'attending', op: 'neq', value: 'no' } }),
    ];
    assert(run({ role: 'player', attending: 'no' }, chain).some((e) => e.field_key === 'waiver' && e.code === 'required'),
        'a hidden controller cannot hide a required field');

    // Visibility reads the coerced value: "20" and 20 are the same answer.
    const numeric = [field({ key: 'age', type: 'number' }),
        field({ key: 'guard', required: true, visible_if: { field_key: 'age', op: 'eq', value: 20 } })];
    assert(run({ age: '20' }, numeric).some((e) => e.field_key === 'guard'), 'visibility compares coerced values');

    const one = (type: string, value: unknown, over: Record<string, unknown> = {}) =>
        run({ x: value }, [field({ key: 'x', type, ...over })]);
    assert(one('checkbox', false, { required: true }).some((e) => e.code === 'required'), 'a required checkbox needs true');
    assert(one('short_text', '   ', { required: true }).some((e) => e.code === 'required'), 'whitespace is not an answer');
    assert(one('number', true).length === 1 && one('number', [5]).length === 1, 'booleans/arrays are not numbers');
    assert(one('number', '1e400').length === 1, 'Infinity is not a number');
    assert(one('date', true).length === 1 && one('date', 0).length === 1, 'only ISO strings are dates');
    assert(one('url', 'javascript:alert(1)').some((e) => e.code === 'invalid_format'), 'only http(s) urls');
    assert(one('user_ref', '-'.repeat(36)).length === 1, 'user_ref must be a real UUID');
    assert(one('multi_select', ['a', 'a'], { options: [{ value: 'a', label: 'A' }] }).some((e) => e.code === 'duplicate_option'),
        'duplicate selections do not count twice');
    // `constructor` is a legal key and must not read Object.prototype.constructor.
    assert(run({}, [field({ key: 'constructor' })]).length === 0, 'prototype-named keys read own answers only');

    // A hidden file field's upload is dropped, not stored unchecked.
    const hiddenFiles = [{ field_key: 'doc', url: '/uploads/x.pdf', name: 'x', size: 1, mime: 'application/pdf' }];
    run({ q: 'no' }, [field({ key: 'q' }), field({ key: 'doc', type: 'file', visible_if: { field_key: 'q', op: 'eq', value: 'yes' } })], hiddenFiles);
    assert(hiddenFiles.length === 0, 'a hidden file field keeps no upload');
    console.log('✓ hidden controllers, coerced visibility and strict types enforced');

    console.log('11. Admin patterns cannot stall the service (H3)...');
    assert(patternProblem('(') === 'pattern_invalid', 'an invalid pattern is refused at save');
    assert(patternProblem('^(a+)+$') === 'pattern_unsafe', 'a nested quantifier is refused at save');
    assert(patternProblem('^[A-Z]{2}[0-9]{4}$') === null, 'an ordinary pattern is accepted');
    // Alternation inside a repeated group backtracks exponentially too (audit #2).
    assert(patternProblem('^(a|a)+$') === 'pattern_unsafe' && patternProblem('^(\\w|\\d)*$') === 'pattern_unsafe',
        'a repeated alternation is refused at save');
    assert(patternProblem('^(?:cat|dog)$') === null && patternProblem('^(ab)?c$') === null, 'plain groups still pass');
    // One stored before the save check existed still cannot hold the event loop.
    const started = Date.now();
    const slow = one('short_text', 'a'.repeat(40) + '!', { validation: { min: null, max: null, pattern: '^(a+)+$', accept: null, max_size_bytes: null } });
    assert(slow.some((e) => e.code === 'pattern_timeout'), 'a catastrophic pattern times out as a field error');
    assert(Date.now() - started < 1000, `and returns promptly (${Date.now() - started}ms)`);
    // One request shares ONE budget across all its fields: 10 slow fields cannot buy 50 ms each.
    const slowFields = Array.from({ length: 10 }, (_, i) =>
        field({ key: `s${i}`, validation: { min: null, max: null, pattern: '^(a+)+$', accept: null, max_size_bytes: null } }));
    const slowAnswers = Object.fromEntries(slowFields.map((sf: any) => [sf.key, 'a'.repeat(40) + '!']));
    const t0 = Date.now();
    const budgeted = validateAnswers(slowAnswers, slowFields, [], { isAdmin: false });
    assert(budgeted.every((e) => e.code === 'pattern_timeout') && budgeted.length === 10, 'every slow field fails');
    assert(Date.now() - t0 < 400, `within the per-request budget, not 10 x 50 ms (${Date.now() - t0}ms)`);
    // A stored Date answer re-validates (files-only edit).
    assert(one('date', new Date()).length === 0, 'a stored Date is a valid date answer');
    console.log('✓ unsafe patterns refused at save and time-boxed at run');
}

async function main() {
    await openScratchDb();

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
    const forms = await formService.listForms({ owner_id: testEventId, limit: 10, offset: 0 });
    assert((await formService.listForms({ owner_id: testEventId, limit: 10, offset: 1 })).length === 0, 'lists page');
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

    console.log('12. A failed edit cannot brick the form; archived forms are frozen...');
    await formService.publishForm(form._id); // v2 published
    const badEdit = CreateFormSchema.safeParse({
        owner: { type: 'event', id: testEventId },
        title: 't',
        fields: [field({ key: 'a' }), field({ key: 'a', order: 1 })],
    });
    assert(!badEdit.success, 'duplicate keys are a 422 at the schema, not a model 500');
    await assert.rejects(
        () => formService.updateForm(form._id, { fields: [field({ key: 'a' }), field({ key: 'a', order: 1 })] }),
        (err: any) => err.status === 422,
        'the model invariant surfaces as 422'
    );
    assert((await FormDefinitionVersion.countDocuments({ form_id: form._id, version: 2 })) === 0,
        'and leaves no archive row behind');
    const fixed = await formService.updateForm(form._id, { fields: [field({ key: 'a' })] });
    assert(fixed.version === 3, 'the next valid edit still goes through');

    await formService.archiveForm(form._id);
    await assert.rejects(() => formService.updateForm(form._id, { title: 'x' }), (err: any) => err.code === 'form_archived',
        'an archived form is not edited in place');
    await assert.rejects(() => formService.publishForm(form._id), (err: any) => err.code === 'form_archived',
        'publishing does not silently un-archive');
    assert(!CreateFormSchema.safeParse({ owner: { type: 'event', id: null }, title: 't' }).success,
        'an event form needs its event id');
    // A stale read-modify-save is a conflict, not a silent overwrite (optimisticConcurrency).
    const racer = await formService.createForm({ owner: { type: 'generic', id: null }, title: 'Race', fields: [field({ key: 'a' })], created_by: creatorId });
    const stale = await FormDefinition.findById(racer._id);
    await formService.updateForm(racer._id, { title: 'first' });
    stale!.title = 'second';
    await assert.rejects(() => stale!.save(), (err: any) => err.name === 'VersionError', 'the stale save is refused');

    // Form writes are scoped to the owner's admins.
    const creator = uuid();
    const evForm = uuid();
    const ev = await seedEvent({ formId: evForm, createdBy: creator });
    await requireOwnerAdmin({ type: 'event', id: ev }, { id: creator, role: 'user' });
    await assert.rejects(() => requireOwnerAdmin({ type: 'event', id: ev }, { id: uuid(), role: 'core' }), (err: any) => err.status === 403,
        'a core member who does not administer the event');
    await assert.rejects(() => requireOwnerAdmin({ type: 'event', id: uuid() }, { id: creator, role: 'founder' }), (err: any) => err.status === 404,
        'an event form needs its event to exist');
    await assert.rejects(() => requireOwnerAdmin({ type: 'generic', id: null }, { id: creator, role: 'member' }), (err: any) => err.status === 403);
    console.log('✓ edits validate before archiving; archived forms are frozen; stale saves and outsiders refused');

    // Cleanup
    await FormDefinition.deleteOne({ _id: form._id });
    await FormDefinitionVersion.deleteMany({ form_id: form._id });

    validationRules();

    await closeScratchDb();
    console.log('\n✅ All forms selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
