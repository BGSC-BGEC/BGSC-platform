import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Media Service local disk storage layer (Spec §5.11.1 & §15.1).
 * Ponytail architecture: local disk storage with magic-byte validation and strict size limits.
 * Prepares the surface for S3/R2 migration without changing calling contracts.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB

export const MEDIA_MIME_TYPES = {
    'image/jpeg': { ext: 'jpg', type: 'image' as const },
    'image/png': { ext: 'png', type: 'image' as const },
    'image/webp': { ext: 'webp', type: 'image' as const },
    'video/mp4': { ext: 'mp4', type: 'video' as const },
    'video/webm': { ext: 'webm', type: 'video' as const },
} as const;

export type SupportedMime = keyof typeof MEDIA_MIME_TYPES;

export interface SniffedMedia {
    mime: SupportedMime;
    type: 'image' | 'video';
    ext: string;
}

/**
 * Sniff real media format directly from magic bytes.
 * Client-provided Content-Type headers and extensions are untrusted.
 */
export function sniffMedia(buf: Buffer): SniffedMedia | null {
    if (!buf || buf.length < 12) return null;

    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { mime: 'image/jpeg', type: 'image', ext: 'jpg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mime: 'image/png', type: 'image', ext: 'png' };
    }

    // WebP: RIFF .... WEBP
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { mime: 'image/webp', type: 'image', ext: 'webp' };
    }

    // MP4: offset 4-8 has 'ftyp'
    if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
        return { mime: 'video/mp4', type: 'video', ext: 'mp4' };
    }

    // WebM: EBML header ID 0x1A 0x45 0xDF 0xA3
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
        return { mime: 'video/webm', type: 'video', ext: 'webm' };
    }

    return null;
}

export interface StoredMediaObject {
    key: string;
    url: string;
    bytes: number;
    mime: SupportedMime;
    media_type: 'image' | 'video';
}

/**
 * Writes raw media buffer to disk with defensive path traversal checks.
 */
export async function putMediaObject(
    prefix: string,
    body: Buffer,
    sniffed: SniffedMedia
): Promise<StoredMediaObject> {
    const filename = `${randomUUID()}.${sniffed.ext}`;
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const key = `${cleanPrefix}/${filename}`;
    const dest = path.join(UPLOAD_DIR, key);

    // Defense-in-depth against directory traversal
    if (!path.resolve(dest).startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
        throw new Error('putMediaObject: refusing to write outside upload directory');
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);

    return {
        key,
        url: `/uploads/${key}`,
        bytes: body.length,
        mime: sniffed.mime,
        media_type: sniffed.type,
    };
}

/**
 * Safe object removal from storage.
 */
export async function deleteMediaObject(key: string): Promise<void> {
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    const cleanKey = key.replace(/^\/+/, '');
    const dest = path.resolve(resolvedUploadDir, cleanKey);

    if (!dest.startsWith(resolvedUploadDir + path.sep)) {
        return;
    }

    await fs.rm(dest, { force: true });
}
