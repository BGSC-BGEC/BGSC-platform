import { Request, Response, NextFunction } from 'express';
import { User, UserRole, UserStatus } from '../models/User';
import * as svc from './user.service';
import { serializeUser, snapshotOf, Viewer } from './user.serializer';
import { playerCardFor } from './playerCard';
import { putObject, deleteObject, sniffImage, IMAGE_MAX_BYTES } from '../storage/storage';
import { recordAudit } from '../models/AuditLog';

/** HTTP only. Data access, events and audit rows live in user.service.ts. */

const viewerOf = (req: Request): Viewer | undefined =>
    req.user ? { id: req.user.id, role: req.user.role } : undefined;

/** Wraps an async handler so a rejected promise reaches the error middleware instead of hanging. */
export const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res).catch(next);
    };

export const getMe = wrap(async (req, res) => {
    const user = await svc.findById(req.user!.id);
    if (!user) return void res.status(404).json({ error: 'not_found' });
    svc.touchLastActive(user._id);
    res.json(serializeUser(user, viewerOf(req)));
});

export const updateMe = wrap(async (req, res) => {
    const user = await svc.findActiveSelf(req.user!.id);
    const updated = await svc.updateProfile(user, req.body);
    res.json(serializeUser(updated, viewerOf(req)));
});

export const updateMySettings = wrap(async (req, res) => {
    const user = await svc.findActiveSelf(req.user!.id);
    const updated = await svc.updateSettings(user, req.body);
    res.json(serializeUser(updated, viewerOf(req)));
});

export const deleteMe = wrap(async (req, res) => {
    const user = await svc.findById(req.user!.id);
    if (!user) return void res.status(404).json({ error: 'not_found' });
    await svc.softDelete(user, req.user!.id, 'self-service deletion');
    // Spec §11.2: 30-day grace. The row survives so ledger rows and snapshots keep resolving.
    res.status(202).json({ status: 'deletion_scheduled', grace_days: 30 });
});

export const uploadAvatar = wrap(async (req, res) => {
    await svc.findActiveSelf(req.user!.id);          // suspended accounts may not upload
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
        return void res.status(422).json({ error: 'validation_failed', fields: [{ key: 'body', code: 'empty' }] });
    }
    if (body.length > IMAGE_MAX_BYTES) {
        return void res.status(413).json({ error: 'payload_too_large' });
    }

    // Magic bytes, not the declared Content-Type — the header is attacker-controlled.
    const mime = sniffImage(body);
    if (!mime) {
        return void res
            .status(415)
            .json({ error: 'unsupported_media_type', fields: [{ key: 'body', code: 'not_jpg_png_webp' }] });
    }

    const stored = await putObject(`avatars/${req.user!.id}`, body, mime);
    const previous = await User.findOneAndUpdate(
        { _id: req.user!.id, deleted_at: null },
        { $set: { 'profile.avatar_url': stored.url } },
        { returnDocument: 'before' }
    );
    if (!previous) {
        await deleteObject(stored.key);            // nothing to attach it to; do not leave it behind
        return void res.status(404).json({ error: 'not_found' });
    }

    // Replace, do not accumulate. Best-effort: the new avatar is already saved, so a failed
    // cleanup must not fail the request — it only leaves a file for the Week 4 Media Service.
    //
    // ponytail: two uploads racing each other still orphan one file — both write, one wins the
    // document, the loser's file is never referenced. Disk-only, no correctness impact, and a
    // per-user lock costs more than the leak. Media Service (Week 4) owns lifecycle/GC.
    const old = previous.profile?.avatar_url;
    if (old && old !== stored.url && old.startsWith('/uploads/')) {
        deleteObject(old.replace(/^\/uploads\//, '')).catch((err) =>
            console.error('Failed to remove replaced avatar:', err)
        );
    }

    res.status(201).json({ avatar_url: stored.url, bytes: stored.bytes, mime: stored.mime });
});

export const getUser = wrap(async (req, res) => {
    const user = await svc.findByRef((req.params as Record<string, string>).ref);
    if (!user) return void res.status(404).json({ error: 'not_found' });
    const viewer = viewerOf(req);
    const scope = await svc.piiScopeFor(viewer);
    res.json(serializeUser(user, viewer, svc.scopeAllows(scope, user._id)));
});

export const getPlayerCard = wrap(async (req, res) => {
    const user = await svc.findByRef((req.params as Record<string, string>).ref);
    if (!user) return void res.status(404).json({ error: 'not_found' });
    // A private profile still exposes its card (D9) — that is the stub deep links render.
    res.json(await playerCardFor(user));
});

export const listUsers = wrap(async (req, res) => {
    const { users, next_cursor } = await svc.listUsers(req.query as never);
    const viewer = viewerOf(req);
    // Coordinator-gated route, so the scope is 'all' — resolved anyway rather than assumed.
    const scope = await svc.piiScopeFor(viewer);
    res.json({
        users: users.map((u) => serializeUser(u, viewer, svc.scopeAllows(scope, u._id))),
        next_cursor,
    });
});

export const searchUsers = wrap(async (req, res) => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };
    const users = await svc.searchUsers(q, limit);
    const viewer = viewerOf(req);
    // One scope lookup for the whole page, not one per row.
    const scope = await svc.piiScopeFor(viewer);
    res.json({ users: users.map((u) => serializeUser(u, viewer, svc.scopeAllows(scope, u._id))) });
});

export const changeRole = wrap(async (req, res) => {
    const target = await svc.findByRef((req.params as Record<string, string>).ref);
    if (!target) return void res.status(404).json({ error: 'not_found' });

    // A ServiceError propagates to the error handler in index.ts, which maps it to its status.
    const { role, reason } = req.body as { role: UserRole; reason: string };
    const updated = await svc.changeRole(target, role, req.user!, reason);
    res.json(serializeUser(updated, viewerOf(req)));
});

export const changeStatus = wrap(async (req, res) => {
    const target = await svc.findByRef((req.params as Record<string, string>).ref);
    if (!target) return void res.status(404).json({ error: 'not_found' });

    const { status, reason } = req.body as { status: UserStatus; reason: string };
    const updated = await svc.changeStatus(target, status, req.user!, reason);
    res.json(serializeUser(updated, viewerOf(req)));
});

export const getSnapshots = wrap(async (req, res) => {
    const { ids } = req.query as unknown as { ids: string[] };
    const users = await svc.snapshots(ids);
    res.json({ snapshots: users.map(snapshotOf) });
});

/** Exported for the admin detail view; the list endpoint deliberately omits per-row counts. */
export const auditForUser = wrap(async (req, res) => {
    const { ref } = req.params as Record<string, string>;
    const user = await svc.findByRef(ref);
    if (!user) return void res.status(404).json({ error: 'not_found' });
    const { AuditLog } = await import('../models/AuditLog');
    const rows = await AuditLog.find({ target_type: 'user', target_id: user._id })
        .sort({ created_at: -1 })
        .limit(50);
    res.json({ entries: rows });
});

export { recordAudit };
