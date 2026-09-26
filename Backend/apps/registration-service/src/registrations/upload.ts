import { FormDefinition, FormUpload, ServiceError } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
import { putObject, removeObject, sniff, FILE_MAX_BYTES } from '../storage/storage';
import { UploadFileInput } from './registration.schemas';

/**
 * Uploads per user per rolling hour. Every upload is a write to a shared disk that nothing garbage
 * collects. ponytail: a count over `form_uploads`; a sweep of never-submitted uploads is the upgrade.
 */
export const UPLOADS_PER_HOUR = 20;

const recentUploads = (userId: string) =>
    FormUpload.countDocuments({ user_id: userId, created_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });

/**
 * Runs BEFORE `express.raw()`: a caller already over quota, or declaring a body over the ceiling,
 * is refused before 10 MB is buffered into memory for them.
 */
export async function uploadPrecheck(req: Request, _res: Response, next: NextFunction) {
    try {
        const declared = Number(req.header('content-length') ?? 0);
        if (declared > FILE_MAX_BYTES) throw new ServiceError(413, 'payload_too_large', { max_size_bytes: FILE_MAX_BYTES });
        if ((await recentUploads(req.user!.id)) >= UPLOADS_PER_HOUR) throw new ServiceError(429, 'upload_quota_exceeded');
        next();
    } catch (err) {
        next(err);
    }
}

/**
 * `POST /registrations/upload-file?form_id=…&field_key=…` — upload first, submit second.
 * The response `url` is an opaque private reference the user puts in `files[]` when they submit;
 * size, mime and name are read back from the `form_uploads` record, never from the client, and the
 * file itself is only ever served through the authed download route.
 *
 * Raw body rather than multipart: one file, no form fields, no new dependency.
 */
export async function uploadFileHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { form_id: formId, field_key: fieldKey, name } = req.query as unknown as UploadFileInput;
        const userId = req.user!.id;

        const body = req.body as Buffer;
        if (!Buffer.isBuffer(body) || body.length === 0) {
            throw new ServiceError(400, 'empty_body');
        }

        // Only a form someone can still submit to takes uploads; drafts and archives do not.
        const form = await FormDefinition.findById(formId);
        if (!form || form.status !== 'published') throw new ServiceError(404, 'form_not_found');

        const field = form.fields.find((f) => f.key === fieldKey);
        if (!field) throw new ServiceError(404, 'field_not_found');
        if (field.type !== 'file') throw new ServiceError(400, 'not_a_file_field');
        // Nobody answers an admin_only field on their own registration (admin answers are set through
        // PATCH /registrations/:id/admin-answers, which takes no files).
        if (field.admin_only) throw new ServiceError(403, 'admin_only');

        // Magic bytes, not the declared Content-Type.
        const sniffed = sniff(body);
        if (!sniffed) {
            throw new ServiceError(415, 'unsupported_media_type');
        }

        // The form author's own rules, checked before anything touches disk.
        const accept = field.validation?.accept;
        if (accept && accept.length > 0 && !accept.includes(sniffed.mime)) {
            throw new ServiceError(415, 'mime_not_accepted', { accept });
        }
        const maxBytes = Math.min(field.validation?.max_size_bytes ?? FILE_MAX_BYTES, FILE_MAX_BYTES);
        if (body.length > maxBytes) {
            throw new ServiceError(413, 'payload_too_large', { max_size_bytes: maxBytes });
        }

        const stored = await putObject(`${formId}/${fieldKey}`, body, sniffed.ext, sniffed.mime);
        const record = {
            user_id: userId,
            form_id: formId,
            field_key: fieldKey,
            url: stored.ref,
            name: name ?? `upload.${sniffed.ext}`,
            size: stored.size,
            mime: stored.mime,
        };

        /**
         * Insert first, then count: two concurrent uploads that both passed the precheck both land
         * here, and each counts the other — so neither slips past the quota (count-then-insert let
         * both through).
         */
        let saved;
        try {
            saved = await FormUpload.create(record);
        } catch (err) {
            await removeObject(stored.ref);
            throw err;
        }
        if ((await recentUploads(userId)) > UPLOADS_PER_HOUR) {
            await FormUpload.deleteOne({ _id: saved._id });
            await removeObject(stored.ref);
            throw new ServiceError(429, 'upload_quota_exceeded');
        }

        res.status(201).json({
            field_key: fieldKey,
            url: record.url,
            name: record.name,
            size: record.size,
            mime: record.mime,
        });
    } catch (err) {
        next(err);
    }
}
