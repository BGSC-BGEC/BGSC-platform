import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Local-disk storage for event posters and logos.
 * ponytail: local disk, no resize or external bucket.
 * Week 4's Media Service replaces this with S3/R2 + CDN.
 */
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

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

export async function putObject(prefix: string, body: Buffer, mime: ImageMime): Promise<StoredObject> {
    const key = `${prefix}/${randomUUID()}.${IMAGE_TYPES[mime]}`;
    const dest = path.join(UPLOAD_DIR, key);

    if (!path.resolve(dest).startsWith(UPLOAD_DIR + path.sep)) {
        throw new Error('putObject: refusing to write outside upload directory');
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);

    return {
        key,
        url: `/uploads/${key}`,
        bytes: body.length,
        mime,
    };
}
