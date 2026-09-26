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
 *    ignores (`dotfiles: 'ignore'` → 404). A pending or rejected upload is never publicly served;
 *    its uploader and moderators fetch it through `GET /media/:id/file`, which checks who is asking.
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

const MP4_BRANDS = new Set([
    'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'iso7', 'iso8', 'iso9',
    'mp41', 'mp42', 'mmp4', 'avc1', 'dash', 'M4V ', 'MSNV', 'XAVC', 'f4v ',
]);
/**
 * Major brands that are not video however MP4-compatible they claim to be: HEIF/AVIF image
 * sequences list `iso8`, and iTunes audio lists `mp42`/`isom`.
 */
const NOT_VIDEO_BRANDS = new Set(['heic', 'heix', 'mif1', 'msf1', 'avif', 'avis', 'M4A ', 'M4B ']);

/**
 * The `ftyp` box: major brand at 8..12, then (after the minor version) compatible brands from 16 to
 * the box's end, four bytes each, bounded by what was sniffed. MP4 if the major brand or any
 * compatible one is an MP4 brand — encoders put their own major brand first (`qt  `, `3gp4`, ...).
 */
function isMp4(buf: Buffer): boolean {
    const major = buf.subarray(8, 12).toString('latin1');
    if (NOT_VIDEO_BRANDS.has(major)) return false;
    if (MP4_BRANDS.has(major)) return true;
    const end = Math.min(buf.readUInt32BE(0), buf.length);
    for (let i = 16; i + 4 <= end; i += 4) {
        if (MP4_BRANDS.has(buf.subarray(i, i + 4).toString('latin1'))) return true;
    }
    return false;
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

    // MP4: offset 4-8 has 'ftyp'. Every ISO-BMFF file has an `ftyp` box — HEIC, AVIF, QuickTime,
    // 3GP, JPEG 2000 — so its brands decide whether it is an MP4 at all.
    if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
        return isMp4(buf) ? { mime: 'video/mp4', type: 'video', ext: 'mp4' } : null;
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

/**
 * Where the file is on disk, in either tree, or null — a legacy row can point at a file that never
 * moved here. `key` must come from a stored row, never from a request.
 */
export async function locateMediaObject(key: string): Promise<string | null> {
    for (const root of [PENDING_DIR, UPLOAD_DIR]) {
        let dest: string;
        try {
            dest = within(root, key);
        } catch {
            return null;
        }
        if (await exists(dest)) return dest;
    }
    return null;
}

/**
 * Safe object removal, from whichever tree holds it. Never throws for a key outside the root.
 *
 * Pending, public, pending again: a concurrent approve (pending → public) or withdraw (public →
 * pending) renames between two `rm`s, and a single pass in either order can miss the file and
 * orphan it in the tree it just moved to. Three passes catch one move either way.
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
