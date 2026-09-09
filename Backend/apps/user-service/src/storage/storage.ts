import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * One-function storage interface. Spec §15.2 wants pre-signed S3 URLs, ClamAV scanning, three
 * resize targets, EXIF stripping and CDN invalidation — that is BE-1's Media Service in Week 4.
 *
 * ponytail: local disk, no resize, no virus scan. Upgrade path is Media Service implementing
 * `putObject` against S3/R2; nothing that calls it changes.
 */

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

/** Spec §15.1: JPG, PNG, WebP, max 10MB. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
} as const;

export type ImageMime = keyof typeof IMAGE_TYPES;

/**
 * Sniff the real type from magic bytes. The Content-Type header and the filename are both
 * attacker-controlled, so neither is evidence of anything — this is a trust boundary.
 */
export function sniffImage(buf: Buffer): ImageMime | null {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'image/webp';
    }
    return null;
}

export interface StoredObject {
    key: string;
    url: string;
    bytes: number;
    mime: ImageMime;
}

export async function putObject(prefix: string, body: Buffer, mime: ImageMime): Promise<StoredObject> {
    const key = `${prefix}/${randomUUID()}.${IMAGE_TYPES[mime]}`;
    const dest = path.join(UPLOAD_DIR, key);

    // Defence in depth: `prefix` is service-supplied today, but a traversal here would write anywhere.
    if (!path.resolve(dest).startsWith(UPLOAD_DIR + path.sep)) {
        throw new Error('putObject: refusing to write outside the upload directory');
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);

    return { key, url: `/uploads/${key}`, bytes: body.length, mime };
}

export async function deleteObject(key: string): Promise<void> {
    const dest = path.join(UPLOAD_DIR, key);
    if (!path.resolve(dest).startsWith(UPLOAD_DIR + path.sep)) return;
    await fs.rm(dest, { force: true });
}

export { UPLOAD_DIR };
