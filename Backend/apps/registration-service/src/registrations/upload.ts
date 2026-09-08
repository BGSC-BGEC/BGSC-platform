import { FormDefinition, ServiceError } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
import { putObject, sniff, FILE_MAX_BYTES } from '../storage/storage';
import { UploadFileInput } from './registration.schemas';

/**
 * `POST /registrations/upload-file?form_id=…&field_key=…` — upload first, submit second (plan §D2).
 * The response `url` is what the user puts in `files[]` when they submit the form, which keeps the
 * submit endpoint free of multipart parsing and means the file is already validated by then.
 *
 * Raw body rather than multipart: one file, no form fields, no new dependency — the same choice
 * user-service made for avatars.
 */
export async function uploadFileHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { form_id: formId, field_key: fieldKey, name } = req.query as unknown as UploadFileInput;

        const body = req.body as Buffer;
        if (!Buffer.isBuffer(body) || body.length === 0) {
            throw new ServiceError(400, 'empty_body');
        }

        const form = await FormDefinition.findById(formId);
        if (!form) throw new ServiceError(404, 'form_not_found');

        const field = form.fields.find((f) => f.key === fieldKey);
        if (!field) throw new ServiceError(404, 'field_not_found');
        if (field.type !== 'file') throw new ServiceError(400, 'not_a_file_field');

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
        const maxBytes = field.validation?.max_size_bytes ?? FILE_MAX_BYTES;
        if (body.length > maxBytes) {
            throw new ServiceError(413, 'payload_too_large', { max_size_bytes: maxBytes });
        }

        const stored = await putObject(`registrations/${formId}/${fieldKey}`, body, sniffed.ext, sniffed.mime);

        res.status(201).json({
            field_key: fieldKey,
            url: stored.url,
            name: name ?? `upload.${sniffed.ext}`,
            size: stored.size,
            mime: stored.mime,
        });
    } catch (err) {
        next(err);
    }
}
