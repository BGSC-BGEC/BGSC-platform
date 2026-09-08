import { FormSubmission, connectDB, disconnectDB } from '@bgsc/shared';
import assert from 'assert';
import * as registrationService from '../registrations/registration.service';
import * as formService from '../forms/form.service';
import { v4 as uuid } from 'uuid';
import { seedUser, dropUsers } from './seed';

/**
 * Registration selfcheck: submit, capacity, waitlist, cancel
 * Run: npx tsx apps/registration-service/src/selfcheck/registration.selfcheck.ts
 *
 * Note: This selfcheck CANNOT fully test capacity/waitlist without Event Service running.
 * It tests the validation and submission flow only.
 */

async function main() {
    await connectDB();

    const testEventId = uuid();
    const creatorId = uuid();
    const user1 = await seedUser('User One');
    const user2 = await seedUser('User Two');
    const user1Id = user1._id;
    const user2Id = user2._id;

    // Create and publish a form
    console.log('1. Creating test form...');
    const form = await formService.createForm({
        owner: { type: 'event', id: testEventId },
        title: 'Test Registration',
        fields: [
            {
                key: 'name',
                label: 'Name',
                help_text: null,
                type: 'short_text',
                required: true,
                placeholder: null,
                options: null,
                validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null,
                admin_only: false,
                order: 0,
            },
        ],
        created_by: creatorId,
    });
    await formService.publishForm(form._id);
    console.log('✓ Form published');

    // Test validation: missing required field
    console.log('2. Testing validation (missing required field)...');
    try {
        await registrationService.submitRegistration({
            form_id: form._id,
            owner: { type: 'event', id: testEventId },
            answers: {}, // missing 'name'
            user_id: user1Id,
            is_admin: false,
        });
        assert.fail('Should have thrown validation error');
    } catch (err: any) {
        assert(err.code === 'validation_failed', 'Should be validation_failed error');
        console.log('✓ Validation correctly rejected missing required field');
    }

    // Test validation: admin_only field rejection
    console.log('3. Testing validation (admin_only field)...');
    const formWithAdminField = await formService.createForm({
        owner: { type: 'event', id: testEventId },
        title: 'Admin Form',
        fields: [
            {
                key: 'seed',
                label: 'Seed',
                help_text: null,
                type: 'number',
                required: false,
                placeholder: null,
                options: null,
                validation: { min: null, max: null, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null,
                admin_only: true,
                order: 0,
            },
        ],
        created_by: creatorId,
    });
    await formService.publishForm(formWithAdminField._id);

    try {
        await registrationService.submitRegistration({
            form_id: formWithAdminField._id,
            owner: { type: 'event', id: testEventId },
            answers: { seed: 5 },
            user_id: user1Id,
            is_admin: false, // non-admin trying to set admin field
        });
        assert.fail('Should have thrown validation error');
    } catch (err: any) {
        assert(err.code === 'validation_failed', 'Should be validation_failed error');
        console.log('✓ Validation correctly rejected admin_only field from non-admin');
    }

    // Submit valid registration (will stay 'submitted' since Event Service is not running)
    console.log('4. Submitting valid registration...');
    const reg1 = await registrationService.submitRegistration({
        form_id: form._id,
        owner: { type: 'event', id: testEventId },
        answers: { name: 'User One' },
        context: { event: { role: 'solo' } },
        user_id: user1Id,
        is_admin: false,
    });

    // Since Event Service is not running, registration will stay 'submitted'
    assert(reg1.status === 'submitted' || reg1.status === 'confirmed', 'Registration should be submitted or confirmed');
    assert(reg1.answers.name === 'User One', 'Answers should be stored');
    console.log(`✓ Registration created with status: ${reg1.status}`);

    // Test duplicate registration
    console.log('5. Testing duplicate registration...');
    try {
        await registrationService.submitRegistration({
            form_id: form._id,
            owner: { type: 'event', id: testEventId },
            answers: { name: 'User One Again' },
            context: { event: { role: 'solo' } },
            user_id: user1Id,
            is_admin: false,
        });
        assert.fail('Should have thrown duplicate error');
    } catch (err: any) {
        assert(err.code === 'already_registered', 'Should be already_registered error');
        console.log('✓ Duplicate registration correctly rejected');
    }

    // Test getMyRegistration
    console.log('6. Testing getMyRegistration...');
    const myReg = await registrationService.getMyRegistration(testEventId, user1Id);
    assert(myReg !== null, 'Should find registration');
    assert(myReg._id === reg1._id, 'Should be the same registration');
    console.log('✓ getMyRegistration works');

    // Test update registration
    console.log('7. Testing update registration...');
    const updated = await registrationService.updateRegistration(
        reg1._id,
        user1Id,
        { answers: { name: 'User One Updated' } }
    );
    assert(updated.answers.name === 'User One Updated', 'Answers should be updated');
    console.log('✓ Registration updated');

    // Test cancel registration
    console.log('8. Testing cancel registration...');
    const cancelled = await registrationService.cancelRegistration(reg1._id, user1Id, false, 'test cancel');
    assert(cancelled.status === 'cancelled', 'Should be cancelled');
    assert(cancelled.cancelled_at !== null, 'Should have cancelled_at');
    // The history entry used to read `from: 'cancelled'` because status was overwritten first.
    const lastMove = cancelled.status_history[cancelled.status_history.length - 1];
    assert(lastMove.to === 'cancelled', 'History should record the move to cancelled');
    assert(lastMove.from !== 'cancelled', `History 'from' must be the previous status, got '${lastMove.from}'`);
    console.log('✓ Registration cancelled, history records the real previous status');

    // Verify can register again after cancel
    console.log('9. Testing re-registration after cancel...');
    const reg2 = await registrationService.submitRegistration({
        form_id: form._id,
        owner: { type: 'event', id: testEventId },
        answers: { name: 'User One Again' },
        context: { event: { role: 'solo' } },
        user_id: user1Id,
        is_admin: false,
    });
    assert(reg2._id !== reg1._id, 'Should be a new registration');
    console.log('✓ Re-registration after cancel works');

    // A waitlisted registration must be cancellable: the model requires waitlist_position to be
    // set exactly when the status is 'waitlisted', so a cancel that leaves it behind throws.
    console.log('10. Testing cancel of a waitlisted registration...');
    await registrationService.transition(reg2, 'waitlisted', 'system', 'capacity_full');
    await reg2.save();
    assert(reg2.waitlist_position === 1, `Waitlist position should be 1, got ${reg2.waitlist_position}`);

    const cancelledWaitlisted = await registrationService.cancelRegistration(reg2._id, user1Id, false);
    assert(cancelledWaitlisted.status === 'cancelled', 'Waitlisted registration should cancel');
    assert(
        cancelledWaitlisted.waitlist_position === null,
        'Cancelling must clear waitlist_position, or the model invariant rejects the save'
    );
    console.log('✓ Waitlisted registration cancelled and position cleared');

    // An admin may cancel someone else's registration; an unrelated user may not.
    console.log('11. Testing cancel authorisation...');
    const reg3 = await registrationService.submitRegistration({
        form_id: form._id,
        owner: { type: 'event', id: testEventId },
        answers: { name: 'User Two' },
        context: { event: { role: 'solo' } },
        user_id: user2Id,
        is_admin: false,
    });
    await assert.rejects(
        () => registrationService.cancelRegistration(reg3._id, user1Id, false),
        (err: any) => err.code === 'not_owner',
        'A different user must not cancel this registration'
    );
    const adminCancelled = await registrationService.cancelRegistration(reg3._id, user1Id, true, 'admin');
    assert(adminCancelled.status === 'cancelled', 'An admin may cancel on someone else\'s behalf');
    console.log('✓ Cancel authorisation enforced');

    // A required `file` field is answered in files[], never in answers — validating only answers
    // made such a field impossible to satisfy.
    console.log('12. Testing file field validation...');
    const fileForm = await formService.createForm({
        owner: { type: 'event', id: testEventId },
        title: 'File Form',
        fields: [
            {
                key: 'proof',
                label: 'Proof',
                help_text: null,
                type: 'file',
                required: true,
                placeholder: null,
                options: null,
                validation: { min: null, max: null, pattern: null, accept: ['application/pdf'], max_size_bytes: 1000 },
                visible_if: null,
                admin_only: false,
                order: 0,
            },
        ],
        created_by: creatorId,
    });
    await formService.publishForm(fileForm._id);

    const submitFile = (files: any[], userId: string) =>
        registrationService.submitRegistration({
            form_id: fileForm._id,
            owner: { type: 'event', id: testEventId },
            answers: {},
            files,
            context: { event: { role: 'solo' } },
            user_id: userId,
            is_admin: false,
        });

    await assert.rejects(
        () => submitFile([], user1Id),
        (err: any) => err.code === 'validation_failed' && err.details[0].code === 'required',
        'A required file field with no upload must fail as required'
    );

    await assert.rejects(
        () => submitFile([{ field_key: 'proof', url: '/uploads/x.png', name: 'x.png', size: 10, mime: 'image/png' }], user1Id),
        (err: any) => err.details[0].code === 'invalid_mime',
        'A mime outside the field\'s accept list must be rejected'
    );

    await assert.rejects(
        () => submitFile([{ field_key: 'proof', url: '/uploads/x.pdf', name: 'x.pdf', size: 9999, mime: 'application/pdf' }], user1Id),
        (err: any) => err.details[0].code === 'too_large',
        'A file over max_size_bytes must be rejected'
    );

    const withFile = await submitFile(
        [{ field_key: 'proof', url: '/uploads/x.pdf', name: 'x.pdf', size: 500, mime: 'application/pdf' }],
        user1Id
    );
    assert(withFile.files.length === 1, 'A valid upload must be stored on the submission');
    console.log('✓ File field validation enforced (required, accept, max_size_bytes)');

    // An owner editing their own registration must not destroy what an admin filled in: the edit
    // replaces the whole answer set, and admin_only fields are stripped from a non-admin payload,
    // so without carrying them across they vanished by omission.
    console.log('13. Testing that a user edit preserves admin-only answers...');
    const mixedForm = await formService.createForm({
        owner: { type: 'generic', id: null },
        title: 'Mixed Form',
        fields: [
            {
                key: 'name', label: 'Name', help_text: null, type: 'short_text', required: true,
                placeholder: null, options: null,
                validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null, admin_only: false, order: 0,
            },
            {
                key: 'seed', label: 'Seed', help_text: null, type: 'number', required: false,
                placeholder: null, options: null,
                validation: { min: null, max: null, pattern: null, accept: null, max_size_bytes: null },
                visible_if: null, admin_only: true, order: 1,
            },
        ],
        created_by: creatorId,
    });
    await formService.publishForm(mixedForm._id);

    // Submitted by an admin, who may set the admin-only field.
    const mixed = await registrationService.submitRegistration({
        form_id: mixedForm._id,
        owner: { type: 'generic', id: null },
        answers: { name: 'User Two', seed: 7 },
        user_id: user2Id,
        is_admin: true,
    });
    assert(mixed.answers.seed === 7, 'an admin can set an admin_only field');

    const edited = await registrationService.updateRegistration(mixed._id, user2Id, {
        answers: { name: 'User Two Edited' },
    });
    assert(edited.answers.name === 'User Two Edited', 'the user edit lands');
    assert(edited.answers.seed === 7, 'and the admin_only answer survives it');
    console.log('✓ admin-only answers survive a user edit');

    // Cleanup
    await FormSubmission.deleteMany({ form_id: mixedForm._id });
    await formService.archiveForm(mixedForm._id);
    await FormSubmission.deleteMany({ form_id: fileForm._id });
    await formService.archiveForm(fileForm._id);
    await FormSubmission.deleteMany({ form_id: form._id });
    await FormSubmission.deleteMany({ form_id: formWithAdminField._id });
    await formService.archiveForm(form._id);
    await formService.archiveForm(formWithAdminField._id);
    await dropUsers([user1Id, user2Id]);

    await disconnectDB();
    console.log('\n✅ All registration selfchecks passed!');
    console.log('Note: capacity and waitlist promotion need the Event Service; not covered here.');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
