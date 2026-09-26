import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '@bgsc/shared';

/**
 * Media Service local disk storage layer (Spec §5.11.1 & §15.1).
 * Ponytail architecture: local disk storage with magic-byte validation and strict size limits.
 * Prepares the surface for S3/R2 migration without changing calling contracts.
 *
 * Two trees, one volume:
 *  - `UPLOAD_DIR` (`config.uploadDir`) is the platform's one upload root, and this service is the
 *    only thing that serves it at `/uploads`. Media writes under `media/`; avatars, events and
 *    registrations are other services' prefixes in the same directory.
 *  - `PENDING_DIR` holds files nobody has approved yet. It lives on the same volume so it survives
 *    a restart and an approval is a rename, but under a dot-directory, which the static mount
 *    ignores (`dotfiles: 'ignore'` → 404). A pending or rejected upload is never publicly served —
 *    before the Sep 26 audit, moderation hid the gallery row and served the file anyway.
 */

export const UPLOAD_DIR = config.uploadDir;
export const PENDING_DIR = path.join(UPLOAD_DIR, '.pending');

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB

export const MEDIA_MIME_TYPES = {
    'image/jpeg': { ext: 'jpg', type: 'image' as const },
    'image/png': { ext: 'png', type: 'image' as const },
    'image/webp': { ext: 'webp', type: 'image' as const },
    'video/mp4': { ext: 'mp4', type: 'video' as const },
    'video/webm': { ext: 'webm', type: 'video' as const },
} as const;

/**
 * What the upload route will buffer. The declared type only decides whether the body is read at
 * all — the bytes are sniffed regardless — but `*\/*` meant every request of any type was read.
 */
export const ACCEPTED_CONTENT_TYPES = [...Object.keys(MEDIA_MIME_TYPES), 'application/octet-stream'];

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

/** `root/key`, refusing anything that resolves outside `root`. */
function within(root: string, key: string): string {
    const base = path.resolve(root);
    const dest = path.resolve(base, key.replace(/^\/+/, ''));
    if (!dest.startsWith(base + path.sep)) {
        throw new Error('media storage: refusing to write outside upload directory');
    }
    return dest;
}

/**
 * Writes raw media buffer to disk with defensive path traversal checks. `pending` files go to the
 * unserved tree; the URL is the one the file WILL have once approved.
 */
export async function putMediaObject(
    prefix: string,
    body: Buffer,
    sniffed: SniffedMedia,
    pending = false
): Promise<StoredMediaObject> {
    const filename = `${randomUUID()}.${sniffed.ext}`;
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const key = `${cleanPrefix}/${filename}`;
    const dest = within(pending ? PENDING_DIR : UPLOAD_DIR, key);

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

/** Rename between the trees. Idempotent: a file already where it is going is a success. */
async function move(key: string, from: string, to: string): Promise<void> {
    const src = within(from, key);
    const dest = within(to, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
        await fs.rename(src, dest);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT' && (await exists(dest))) return;
        throw err;
    }
}

const exists = (p: string) => fs.access(p).then(() => true, () => false);

/** Approval: the file becomes publicly served. */
export const publishMediaObject = (key: string) => move(key, PENDING_DIR, UPLOAD_DIR);

/** Back to review: the file stops being served. */
export const withdrawMediaObject = (key: string) => move(key, UPLOAD_DIR, PENDING_DIR);

/** Whether the file exists in either tree — a legacy row can point at a file that never moved here. */
export async function hasMediaObject(key: string): Promise<boolean> {
    for (const root of [PENDING_DIR, UPLOAD_DIR]) {
        try {
            if (await exists(within(root, key))) return true;
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * Safe object removal, from whichever tree holds it. Never throws for a key outside the root.
 *
 * Pending, public, pending again: a concurrent approve (pending → public) or withdraw (public →
 * pending) renames between two `rm`s, and a single pass in either order can miss the file and
 * orphan it in the tree it just moved to (audit #2). Three passes catch one move either way.
 */
export async function deleteMediaObject(key: string): Promise<void> {
    for (const root of [PENDING_DIR, UPLOAD_DIR, PENDING_DIR]) {
        let dest: string;
        try {
            dest = within(root, key);
        } catch {
            return;
        }
        await fs.rm(dest, { force: true });
    }
}

/** Where a stored URL's file lives, relative to either root. */
export const keyOf = (url: string): string => url.replace(/^\/uploads\//, '');
