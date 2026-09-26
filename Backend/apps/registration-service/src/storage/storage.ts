import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { config } from '@bgsc/shared';

/**
 * Local-disk storage for form file answers.
 *
 * Registration files are PRIVATE: ID scans, certificates, medical forms. They live
 * under `config.uploadDir/.private/registrations/` — a dot-directory media-service's static handler
 * never serves — and are read back only through `GET /registrations/:id/files/:field_key`, which
 * checks who is asking. Earlier builds put them under the public `/uploads` tree, where anyone holding the
 * URL could fetch them.
 *
 * A stored reference is `private://registrations/<form>/<field>/<uuid>.<ext>`. Rows written before
 * this carry `/uploads/registrations/…`; both map to the same private path, and
 * `migrateLegacyUploads` moves the old files there at startup.
 *
 * ponytail: no resize, no virus scan, no CDN. Upgrade path is object storage with signed URLs.
 */

const ROOT = path.resolve(config.uploadDir);
const PRIVATE_ROOT = path.join(ROOT, '.private');
const PREFIX = 'registrations';
const REF_SCHEME = 'private://';
const LEGACY_URL_PREFIX = '/uploads/';

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
    ref: string;
    size: number;
    mime: string;
}

/** Absolute private path for a stored reference (new or legacy), or null if it is not one of ours. */
export function privatePathOf(ref: string): string | null {
    const rel = ref.startsWith(REF_SCHEME)
        ? ref.slice(REF_SCHEME.length)
        : ref.startsWith(LEGACY_URL_PREFIX)
          ? ref.slice(LEGACY_URL_PREFIX.length)
          : null;
    if (!rel || !rel.startsWith(`${PREFIX}/`)) return null;
    const abs = path.resolve(PRIVATE_ROOT, rel);
    return abs.startsWith(path.join(PRIVATE_ROOT, PREFIX) + path.sep) ? abs : null;
}

export async function putObject(prefix: string, body: Buffer, ext: string, mime: string): Promise<StoredFile> {
    const ref = `${REF_SCHEME}${PREFIX}/${prefix}/${randomUUID()}.${ext}`;
    // `prefix` carries a form id and a field key; a traversal here would write anywhere on disk.
    const dest = privatePathOf(ref);
    if (!dest) throw new Error('putObject: refusing to write outside the private upload directory');

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    return { ref, size: body.length, mime };
}

/** Best-effort delete, for a write whose upload record could not be kept. */
export async function removeObject(ref: string): Promise<void> {
    const dest = privatePathOf(ref);
    if (dest) await fs.rm(dest, { force: true }).catch(() => undefined);
}

/**
 * One-off, idempotent: move files earlier builds wrote under the public `uploadDir/registrations/` into the
 * private tree, so the old URLs stop being fetchable from `/uploads`. Files already moved are
 * skipped; anything that cannot be moved is logged and left for the next boot.
 */
export async function migrateLegacyUploads(): Promise<number> {
    const legacyRoot = path.join(ROOT, PREFIX);
    let moved = 0;
    const walk = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            const from = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(from);
                continue;
            }
            const to = path.join(PRIVATE_ROOT, path.relative(ROOT, from));
            try {
                await fs.mkdir(path.dirname(to), { recursive: true });
                await fs.rename(from, to);
                moved++;
            } catch (err) {
                console.error(`[registration-service] could not move legacy upload ${from}:`, err);
            }
        }
    };
    await walk(legacyRoot);
    return moved;
}
