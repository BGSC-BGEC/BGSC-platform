import './scratch-env';
import { Event, FormDefinitionVersion, FormSubmission, FormUpload, User, publish, subscribe } from '@bgsc/shared';
import assert from 'assert';
import { once } from 'events';
import express from 'express';
import { AddressInfo } from 'net';
import { promises as fs } from 'fs';
import path from 'path';
import * as registrationService from '../registrations/registration.service';
import * as formService from '../forms/form.service';
import { initializeConsumers } from '../events/consumers';
import { promotionSweep } from '../events/sweeps';
import { perUserRateLimit } from '../registrations/rate-limit';
import { downloadFileHandler } from '../registrations/registration.controller';
import { privatePathOf, putObject } from '../storage/storage';
import { v4 as uuid } from 'uuid';
import { closeScratchDb, openScratchDb, seedEvent, seedUser, startEventStub } from './seed';

/**
 * Registration selfcheck: submit, the seat path, waitlist, cancel, captain approval, scope, files.
 * Run: npx ts-node apps/registration-service/src/selfcheck/registration.selfcheck.ts
 *
 * The seat path runs against a stub Event Service that wraps every reply in the REAL
 * `{ success, data }` envelope (seed.ts). Every status is asserted exactly.
 */

const f = (over: Record<string, unknown>) =>
    ({
        key: 'name', label: 'Name', help_text: null, type: 'short_text', required: true, placeholder: null, options: null,
        validation: { min: 1, max: 100, pattern: null, accept: null, max_size_bytes: null },
        visible_if: null, admin_only: false, order: 0, ...over,
    }) as any;

const settle = () => new Promise((r) => setTimeout(r, 300));

async function main() {
    await openScratchDb();
    const stub = await startEventStub();
    initializeConsumers();

    const seen: Record<string, any[]> = {};
    for (const type of ['RegistrationCancelled', 'RegistrationCreated', 'RegistrationWaitlisted', 'CaptainApproved', 'ParticipantAttended']) {
        seen[type] = [];
        subscribe(type, (e) => void seen[type].push(e.payload));
    }

    const creatorId = uuid();
    const admin = { id: creatorId, role: 'core' }; // the event's creator: its admin
    const otherCore = { id: uuid(), role: 'core' }; // core, but not this event's admin
    const users = await Promise.all(['One', 'Two', 'Three', 'Four', 'Cap', 'Cap2', 'Five', 'Gone'].map((n) => seedUser(`User ${n}`)));
    const [u1, u2, u3, u4, cap, cap2, u5, gone] = users.map((u) => u._id);
    const as = (id: string) => ({ id, role: 'user' });

    const eventId = uuid();
    const form = await formService.createForm({
        owner: { type: 'event', id: eventId },
        title: 'Reg',
        fields: [f({}), f({ key: 'contact', type: 'email', required: false, order: 1 }), f({ key: 'seed', type: 'number', required: false, admin_only: true, order: 2 })],
        created_by: creatorId,
    });
    await formService.publishForm(form._id);
    await seedEvent({ id: eventId, formId: form._id, createdBy: creatorId, maxParticipants: 100 });

    const submit = (userId: string, extra: Record<string, unknown> = {}) =>
        registrationService.submitRegistration({
            form_id: form._id,
            owner: { type: 'event', id: eventId },
            answers: { name: 'x' },
            context: { event: { role: 'solo' } },
            user_id: userId,
            ...extra,
        });

    console.log('1. Validation failures are 422; admin_only is nobody\'s to self-submit...');
    await assert.rejects(() => submit(u1, { answers: {} }), (err: any) => err.status === 422 && err.code === 'validation_failed');
    await assert.rejects(() => submit(u1, { answers: { name: 'x', seed: 1 } }), (err: any) => err.details[0].code === 'admin_only');
    console.log('✓');

    console.log('2. Seat path against the real envelope (C1)...');
    const reg1 = await submit(u1, { answers: { name: 'x', contact: 'one@example.com' } });
    assert.strictEqual(reg1.status, 'confirmed');
    assert(stub.holders.get(eventId)!.has(reg1._id));
    await assert.rejects(() => submit(u1), (err: any) => err.code === 'already_registered');
    console.log('✓');

    console.log('3. Event-admin scope...');
    await assert.rejects(() => registrationService.updateRegistrationStatus(reg1._id, otherCore, 'rejected'),
        (err: any) => err.status === 403, 'a core member who does not administer the event cannot override');
    await assert.rejects(() => registrationService.getOwnRegistration(reg1._id, otherCore), (err: any) => err.status === 404,
        'nor read its registrations');
    await assert.rejects(() => registrationService.cancelRegistration(reg1._id, otherCore), (err: any) => err.status === 404);
    const page = { limit: 50, offset: 0 };
    assert.strictEqual((await registrationService.listRegistrations({ owner_id: eventId, ...page }, otherCore)).length, 0,
        'a non-admin list is only their own rows');
    assert.strictEqual((await registrationService.listRegistrations({ owner_id: eventId, ...page }, admin)).length, 1,
        'the event admin sees the event\'s registrations');
    const seeded = await registrationService.updateAdminAnswers(reg1._id, admin, { seed: 3 });
    assert.strictEqual(seeded.answers.seed, 3, 'the event admin fills admin_only answers');
    await assert.rejects(() => registrationService.updateAdminAnswers(reg1._id, admin, { name: 'hijack' }),
        (err: any) => err.status === 422, 'only admin_only fields');
    await assert.rejects(() => registrationService.updateAdminAnswers(reg1._id, otherCore, { seed: 9 }), (err: any) => err.status === 403);
    console.log('✓');

    console.log('4. A second published form for the same event is not a second seat...');
    const rogue = await formService.createForm({ owner: { type: 'event', id: eventId }, title: 'Rogue', fields: [f({})], created_by: creatorId });
    await formService.publishForm(rogue._id);
    await assert.rejects(
        () => registrationService.submitRegistration({ form_id: rogue._id, owner: { type: 'event', id: eventId }, answers: { name: 'x' }, user_id: u1 }),
        (err: any) => err.code === 'not_registration_form'
    );
    console.log('✓');

    console.log('5. Edit, then cancel releases the seat exactly once (H7, H9)...');
    // An admin answer written while the edit is in flight (just before its write) survives it.
    (FormSubmission as any).findOneAndUpdate = async (...args: unknown[]) => {
        delete (FormSubmission as any).findOneAndUpdate;
        await FormSubmission.updateOne({ _id: reg1._id }, { $set: { 'answers.seed': 7 } });
        return (FormSubmission as any).findOneAndUpdate(...args);
    };
    const edited = await registrationService.updateRegistration(reg1._id, u1, { answers: { name: 'Edited', contact: 'one@example.com' } });
    assert(edited.answers.name === 'Edited' && edited.answers.seed === 7, 'the owner edit never writes the admin answer');
    const [a, b] = await Promise.allSettled([
        registrationService.cancelRegistration(reg1._id, as(u1)),
        registrationService.cancelRegistration(reg1._id, as(u1)),
    ]);
    assert([a, b].filter((r) => r.status === 'fulfilled').length === 1);
    const cancelled = seen.RegistrationCancelled.filter((p) => p.registration_id === reg1._id);
    assert(cancelled.length === 1 && cancelled[0].freed_seat === true && cancelled[0].previous_status === 'confirmed');
    assert.strictEqual(cancelled[0].role, 'solo', 'RegistrationCancelled carries role');
    console.log('✓');

    console.log('6. Waitlist: promotion skips deleted accounts and never re-promotes a demoted row...');
    const reg2 = await submit(u1);
    stub.capacity.set(eventId, 1);
    const goneReg = await submit(gone);
    const wait = await submit(u2);
    assert(goneReg.status === 'waitlisted' && wait.status === 'waitlisted');
    await User.updateOne({ _id: gone }, { $set: { deleted_at: new Date() } });

    await registrationService.cancelRegistration(reg2._id, as(u1));
    await settle();
    assert.strictEqual((await registrationService.getRegistration(goneReg._id)).status, 'cancelled', 'a deleted account is not promoted');
    assert.strictEqual((await registrationService.getRegistration(wait._id)).status, 'confirmed', 'the next head is');

    // Demote the only confirmed row to the waitlist: its freed seat must not hand it straight back.
    await registrationService.updateRegistrationStatus(wait._id, admin, 'waitlisted');
    await settle();
    assert.strictEqual((await registrationService.getRegistration(wait._id)).status, 'waitlisted', 'no self-re-promotion');
    assert.strictEqual(await promotionSweep(), 0, 'nor by the sweep: an admin demotion stands until an admin promotes');

    // Two admins confirm the same row at once: one wins, and the loser must NOT release the seat.
    const both = await Promise.allSettled([
        registrationService.updateRegistrationStatus(wait._id, admin, 'confirmed'),
        registrationService.updateRegistrationStatus(wait._id, { id: uuid(), role: 'founder' }, 'confirmed'),
    ]);
    assert.strictEqual(both.filter((r) => r.status === 'fulfilled').length, 1);
    assert(stub.holders.get(eventId)!.has(wait._id), 'the winner keeps its seat');

    stub.waitlist.set(eventId, false);
    assert.strictEqual((await submit(u3)).status, 'rejected', 'waitlist_disabled -> rejected');
    stub.waitlist.delete(eventId);
    console.log('✓');

    console.log('7. A lost reserve answer is retried by resubmitting; the promotion sweep fills gaps...');
    stub.capacity.delete(eventId);
    stub.down = true;
    const stranded = await submit(u4);
    assert.strictEqual(stranded.status, 'submitted');
    stub.down = false;
    const retried = await submit(u4);
    assert(retried._id === stranded._id && retried.status === 'confirmed');

    // A waitlisted row with a free seat and no RegistrationCancelled (the bus dropped it).
    stub.capacity.set(eventId, stub.holders.get(eventId)!.size);
    const lost = await submit(u5);
    assert.strictEqual(lost.status, 'waitlisted');
    stub.capacity.delete(eventId);
    await Event.collection.updateOne({ _id: eventId as any }, { $set: { seat_holders: [] } });
    assert((await promotionSweep()) >= 1, 'the sweep promotes into a free seat');
    assert.strictEqual((await registrationService.getRegistration(lost._id)).status, 'confirmed');
    console.log('✓');

    console.log('8. An admin rejection stands (and cannot be cancelled away)...');
    await registrationService.updateRegistrationStatus(retried._id, admin, 'rejected', 'no-show');
    assert(!stub.holders.get(eventId)!.has(retried._id));
    await assert.rejects(() => submit(u4), (err: any) => err.code === 'registration_rejected');
    await assert.rejects(() => registrationService.cancelRegistration(retried._id, as(u4)),
        (err: any) => err.code === 'registration_rejected', 'cancelling the rejected row would lift the ban');
    assert.strictEqual((await submit(u3)).status, 'confirmed', 'a system refusal can be retried');
    console.log('✓');

    console.log('9. Captains: CAS approval; CaptainApproved on whichever path confirms (§7)...');
    const capReg = await submit(cap, { context: { event: { role: 'captain' } } });
    await registrationService.cancelRegistration(capReg._id, as(cap));
    await assert.rejects(() => registrationService.updateCaptainApplication(capReg._id, admin, 'approved'),
        (err: any) => err.code === 'application_not_pending');
    await assert.rejects(() => registrationService.updateCaptainApplication(capReg._id, otherCore, 'approved'),
        (err: any) => err.status === 403, 'approval is the event admin\'s');

    // Approved while full -> waitlisted, no CaptainApproved; promoted later -> CaptainApproved then.
    stub.capacity.set(eventId, stub.holders.get(eventId)!.size);
    const capReg2 = await submit(cap2, { context: { event: { role: 'captain' } } });
    const approved = await registrationService.updateCaptainApplication(capReg2._id, admin, 'approved');
    assert.strictEqual(approved.status, 'waitlisted');
    assert(!seen.CaptainApproved.some((p) => p.registration_id === capReg2._id), 'no CaptainApproved without a seat');
    stub.capacity.delete(eventId);
    assert(await registrationService.promoteNext(eventId));
    assert.strictEqual(seen.CaptainApproved.filter((p) => p.registration_id === capReg2._id).length, 1,
        'a promoted approved captain joins the pool');
    console.log('✓');

    console.log('10. Attendance only on confirmed rows, once...');
    const att = await registrationService.recordAttendance(eventId, creatorId, [
        { registration_id: capReg2._id, attended: true },
        { registration_id: goneReg._id, attended: true },
    ]);
    assert.deepStrictEqual(att, { updated_count: 1, skipped: [goneReg._id] });
    assert.strictEqual((await registrationService.recordAttendance(eventId, creatorId, [{ registration_id: capReg2._id, attended: true }])).updated_count, 0);
    console.log('✓');

    console.log('11. Files: bound to uploads, stored privately, downloaded only by owner/admin (§12)...');
    const fileForm = await formService.createForm({
        owner: { type: 'generic', id: null },
        title: 'Files',
        fields: [f({ key: 'proof', type: 'file', validation: { min: null, max: null, pattern: null, accept: ['application/pdf'], max_size_bytes: 1000 } })],
        created_by: creatorId,
    });
    await formService.publishForm(fileForm._id);
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4 selfcheck'), Buffer.alloc(100)]);
    const stored = await putObject(`${fileForm._id}/proof`, pdf, 'pdf', 'application/pdf');
    assert(stored.ref.startsWith('private://registrations/'), 'a private reference, not a public /uploads URL');
    assert(privatePathOf(stored.ref)!.includes(`${path.sep}.private${path.sep}`), 'under the dot-dir media never serves');
    const good = await FormUpload.create({ user_id: u1, form_id: fileForm._id, field_key: 'proof', url: stored.ref, name: 'p.pdf', size: stored.size, mime: 'application/pdf' });
    const submitFile = (userId: string, files: any[]) =>
        registrationService.submitRegistration({ form_id: fileForm._id, owner: { type: 'generic', id: null }, answers: {}, files, user_id: userId });

    await assert.rejects(() => submitFile(u1, [{ field_key: 'proof', url: 'javascript:alert(1)' }]), (err: any) => err.details[0].code === 'unknown_upload');
    const withFile = await submitFile(u1, [{ field_key: 'proof', url: good.url, size: 1, mime: 'text/html' }]);
    assert(withFile.files[0].size === stored.size && withFile.files[0].mime === 'application/pdf');
    const dl = await registrationService.registrationFile(withFile._id, 'proof', as(u1));
    assert((await fs.readFile(dl.path)).equals(pdf), 'the owner downloads their file');
    await assert.rejects(() => registrationService.registrationFile(withFile._id, 'proof', as(u2)), (err: any) => err.status === 404);
    assert(await registrationService.registrationFile(withFile._id, 'proof', { id: uuid(), role: 'core' }), 'core+ reads a generic form\'s files');
    // Over HTTP: the stored mime wins over the user-chosen filename's extension.
    await FormSubmission.updateOne({ _id: withFile._id }, { $set: { 'files.0.name': 'x.html' } });
    const app = express().get('/:id/:field_key', (req, _res, next) => void ((req as any).actor = { _id: u1, role: 'user' }, next()), downloadFileHandler);
    const server = app.listen(0);
    await once(server, 'listening');
    const got = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/${withFile._id}/proof`);
    await got.arrayBuffer();
    server.close();
    assert(got.headers.get('content-type') === 'application/pdf' && got.headers.get('x-content-type-options') === 'nosniff',
        'a download is served as its stored mime, never sniffed from its name');
    assert.strictEqual(privatePathOf('/uploads/registrations/a/b/c.pdf'), privatePathOf('private://registrations/a/b/c.pdf'),
        'legacy URLs map to the same private file');
    assert.strictEqual(privatePathOf('/uploads/registrations/../../etc/passwd'), null, 'and never outside it');

    // A legacy row (no upload record) keeps its own file across an edit.
    await FormSubmission.updateOne({ _id: withFile._id }, { $set: { 'files.0.url': '/uploads/registrations/legacy/x.pdf' } });
    await FormUpload.deleteMany({});
    const kept = await registrationService.updateRegistration(withFile._id, u1, {
        files: [{ field_key: 'proof', url: '/uploads/registrations/legacy/x.pdf' }],
    });
    assert.strictEqual(kept.files[0].url, '/uploads/registrations/legacy/x.pdf', 'resending a stored legacy file is not an unknown upload');
    console.log('✓');

    console.log('12. Edit window follows the event; UserDeleted strips contact answers...');
    await Event.collection.updateOne({ _id: eventId as any }, { $set: { 'registration.closes_at': new Date(Date.now() - 1000) } });
    await assert.rejects(() => registrationService.updateRegistration(capReg2._id, cap2, { answers: { name: 'late' } }),
        (err: any) => err.code === 'edit_window_closed');
    // A phone answer under a key only an archived version of the form knows.
    await FormDefinitionVersion.create({ form_id: form._id, version: 1, fields: [f({ key: 'old_phone', type: 'phone', required: false })] });
    await FormSubmission.updateOne({ _id: reg1._id }, { $set: { 'answers.old_phone': '+1 555 0100' } });
    publish('UserDeleted', 'user-service', { user_id: u1 });
    await settle();
    const scrubbed = await registrationService.getRegistration(reg1._id);
    assert(scrubbed.answers.contact === undefined && scrubbed.answers.old_phone === undefined && scrubbed.user.deleted === true,
        'email/phone answers go with the account, on any version of the form');
    console.log('✓');

    console.log('13. Submits are rate limited per user...');
    const limit = perUserRateLimit(2, 60_000);
    const results: unknown[] = [];
    for (let i = 0; i < 3; i++) limit({ user: { id: u2 } } as any, {} as any, (err?: unknown) => results.push(err));
    assert(results[0] === undefined && results[1] === undefined && (results[2] as any)?.status === 429);
    console.log('✓');

    await stub.close();
    await closeScratchDb();
    console.log('\n✅ All registration selfchecks passed!');
}

main().catch((err) => {
    console.error('❌ Selfcheck failed:', err);
    process.exit(1);
});
