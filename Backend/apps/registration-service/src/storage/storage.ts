import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Local-disk storage for form file answers, deliberately the same shape as user-service's avatar
 * storage so Week 4's Media Service replaces one `putObject` and neither caller changes
 * (be2-registration-service-plan.md §4).
 *
 * ponytail: no resize, no virus scan, no CDN. Upgrade path is Media Service implementing putObject
 * against S3/R2.
 */

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

/** Ceiling applied before a form's own `max_size_bytes`, so an oversized body never reaches disk. */
export const FILE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Magic-byte sniffing for the types a form may accept. The Content-Type header and the filename
 * are both client-supplied, so neither is evidence — this is a trust boundary.
 */
const SIGNATURES: { mime: string; ext: string; match: (b: Buffer) => boolean }[] = [
    { mime: 'image/jpeg', ext: 'jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    {
        mime: 'image/png',
        ext: 'png',
        match: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    },
    {
        mime: 'image/webp',
        ext: 'webp',
        match: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
    },
    { mime: 'application/pdf', ext: 'pdf', match: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-' },
];

export function sniff(buf: Buffer): { mime: string; ext: string } | null {
    if (buf.length < 12) return null;
    const hit = SIGNATURES.find((s) => s.match(buf));
    return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

/** The Content-Types the raw body parser will accept at all. */
export const ACCEPTED_MIMES = SIGNATURES.map((s) => s.mime);

export interface StoredFile {
    key: string;
    url: string;
    size: number;
    mime: string;
}

export async function putObject(prefix: string, body: Buffer, ext: string, mime: string): Promise<StoredFile> {
    const key = `${prefix}/${randomUUID()}.${ext}`;
    const dest = path.join(UPLOAD_DIR, key);

    // `prefix` carries a form id and a field key; a traversal here would write anywhere on disk.
    if (!path.resolve(dest).startsWith(UPLOAD_DIR + path.sep)) {
        throw new Error('putObject: refusing to write outside the upload directory');
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);

    return { key, url: `/uploads/${key}`, size: body.length, mime };
}

export { UPLOAD_DIR };
