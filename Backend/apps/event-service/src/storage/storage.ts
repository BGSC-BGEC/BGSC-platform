import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '@bgsc/shared';

/**
 * Local-disk storage for event posters and logos, under the platform's ONE upload root
 * (`config.uploadDir`, the shared volume) with this service's prefix `events/`. Media Service serves
 * `/uploads` for everyone; this service used to write `apps/event-service/uploads`, which neither the
 * volume nor the gateway's `/uploads` route could see.
 * ponytail: local disk, no resize or external bucket.
 */
const UPLOAD_ROOT = path.resolve(config.uploadDir);
const PREFIX = 'events';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB max

export const IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
} as const;

export type ImageMime = keyof typeof IMAGE_TYPES;

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

/** Writes `events/<eventId>/<uuid>.<ext>` and returns the `/uploads/...` URL Media Service serves. */
export async function putObject(eventId: string, body: Buffer, mime: ImageMime): Promise<StoredObject> {
    const key = `${PREFIX}/${eventId}/${randomUUID()}.${IMAGE_TYPES[mime]}`;
    const dest = path.join(UPLOAD_ROOT, key);

    if (!path.resolve(dest).startsWith(path.join(UPLOAD_ROOT, PREFIX) + path.sep)) {
        throw new Error('putObject: refusing to write outside the events upload prefix');
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);

    return { key, url: `/uploads/${key}`, bytes: body.length, mime };
}

/**
 * Deletes a file `putObject` wrote for THIS event. Anything else — an external URL, a shared
 * `/uploads` path, another event's file, a `..` escape — is left alone. A file already gone is fine.
 */
export async function deleteObject(eventId: string, url: string | null): Promise<void> {
    const prefix = `/uploads/${PREFIX}/${eventId}/`;
    if (!url?.startsWith(prefix)) return;
    const dest = path.resolve(UPLOAD_ROOT, url.slice('/uploads/'.length));
    if (!dest.startsWith(path.join(UPLOAD_ROOT, PREFIX, eventId) + path.sep)) return;
    await fs.unlink(dest).catch(() => undefined);
}
