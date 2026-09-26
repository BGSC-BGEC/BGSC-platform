import { Request } from 'express';
import * as svc from './user.service';
import { serializeUser, visibilityFor, Viewer } from './user.serializer';
import { playerCardFor } from './playerCard';
import { putObject, deleteObject, sniffImage, IMAGE_MAX_BYTES } from '../storage/storage';
import {
    AuditLog,
    User,
    UserRole,
    UserStatus,
    publish,
    restorableUntil,
    wrap,
} from '@bgsc/shared';

/** HTTP only. Data access, events and audit rows live in user.service.ts. */

/**
 * Who is looking. The LIVE role when `requireActiveUser` loaded the viewer (every route that
 * resolves PII scope does): the token's role claim outlives a demotion by up to fifteen minutes,
 * and PII visibility is exactly what a demoted coordinator should lose at once. Self routes may
 * fall back to the token — a viewer is always "full" on their own record.
 */
const viewerOf = (req: Request): Viewer | undefined =>
    req.actor
        ? { id: req.actor._id, role: req.actor.role }
        : req.user
          ? { id: req.user.id, role: req.user.role }
          : undefined;

/**
 * The actor for a role or status change: the document `requireActiveUser` just loaded, never the
 * token's claim. The claim is what a demoted administrator still carries around for fifteen
 * minutes; the document is what they actually are.
 */
const liveActorOf = (req: Request): svc.Actor => ({
    id: req.actor!._id,
    role: req.actor!.role,
    ip: req.ip ?? null,
});

export const getMe = wrap(async (req, res) => {
    // Deleted-inclusive on purpose: an owner must be able to see their own pending deletion,
    // otherwise the client has no way to know a restore is available.
    const user = await svc.findSelfIncludingDeleted(req.user!.id);
    if (!user) return void res.status(404).json({ error: 'not_found' });

    if (user.deleted_at) {
        const until = restorableUntil(user)!;
        // Reactivation authenticates by password. An account made by Google sign-in has none, so
        // it sets one through the reset flow first — say so, or its owner is told of a door they
        // cannot open.
        const hasPassword = !!(await User.exists({ _id: user._id, password_hash: { $type: 'string' } }));
        res.json({
            ...serializeUser(user, viewerOf(req), true),
            deletion: {
                deleted_at: user.deleted_at,
                restorable_until: until,
                restorable: new Date() <= until,
                research_consent: user.deletion?.research_consent ?? false,
                // Named because this service deliberately has no restore route: a deleted user
                // holds no token, so restoring authenticates by password at the Auth Service.
                // Without this the only place a client learns a restore exists does not say how.
                restore_with: hasPassword
                    ? 'POST /account/reactivate'
                    : 'POST /auth/forgot-password, then POST /account/reactivate',
            },
        });
        return;
    }

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

/**
 * What deletion does, so the client gate discloses the truth rather than a paraphrase of it
 * (Spec §11.2.1). Fetch this, show it, then send the confirmation.
 */
export const deletionPreview = wrap(async (_req, res) => {
    res.json(svc.RETENTION_DISCLOSURE);
});

export const deleteMe = wrap(async (req, res) => {
    // Active accounts only. A suspended user who self-deleted could never come back — reactivate
    // refuses a suspended prior status, and the admin status route cannot see deleted accounts —
    // so self-deletion under suspension was an irreversible action taken with a dead session.
    const user = await svc.findActiveSelf(req.user!.id);

    const { reason, research_consent } = req.body as { reason?: string; research_consent: boolean };
    const { restorable_until } = await svc.softDelete(user, req.user!.id, { reason, research_consent, ip: req.ip ?? null });

    // Not "deleted": nothing was destroyed. The account is hidden and restorable until this date.
    res.status(202).json({
        status: 'account_hidden',
        restorable_until,
        restore_window_days: svc.RESTORE_WINDOW_DAYS,
        data_retained: true,
        research_consent,
    });
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
    // cleanup must not fail the request — it only leaves an orphaned file on disk.
    //
    // ponytail: two uploads racing each other still orphan one file — both write, one wins the
    // document, the loser's file is never referenced. Disk-only, no correctness impact, and a
    // per-user lock costs more than the leak. Nothing garbage-collects avatars; add a sweep if
    // orphans ever matter.
    const old = previous.profile?.avatar_url;
    if (old && old !== stored.url && old.startsWith('/uploads/')) {
        deleteObject(old.replace(/^\/uploads\//, '')).catch((err) =>
            console.error('Failed to remove replaced avatar:', err)
        );
    }

    // avatar_url is half of every UserSnapshot. Without this, form_submissions, teams and
    // announcements keep the old picture forever — the profile PATCH path emits, this one did not.
    publish('UserProfileUpdated', 'user-service', { user_id: previous._id, changed_fields: ['avatar_url'] });

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
    // A private profile still answers with its card — that is the stub deep links render — but
    // a stranger gets the stub only: no bio, interests, social handles or rating inputs.
    const viewer = viewerOf(req);
    const scope = await svc.piiScopeFor(viewer);
    const stubOnly = visibilityFor(user, viewer, svc.scopeAllows(scope, user._id)) === 'minimal';
    res.json(await playerCardFor(user, stubOnly));
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
    const updated = await svc.changeRole(target, role, liveActorOf(req), reason);
    res.json(serializeUser(updated, viewerOf(req)));
});

export const changeStatus = wrap(async (req, res) => {
    const target = await svc.findByRef((req.params as Record<string, string>).ref);
    if (!target) return void res.status(404).json({ error: 'not_found' });

    const { status, reason } = req.body as { status: UserStatus; reason: string };
    const updated = await svc.changeStatus(target, status, liveActorOf(req), reason);
    res.json(serializeUser(updated, viewerOf(req)));
});

/** Exported for the admin detail view; the list endpoint deliberately omits per-row counts. */
export const auditForUser = wrap(async (req, res) => {
    const { ref } = req.params as Record<string, string>;
    // Deleted accounts included: their trail is exactly what an admin comes here for.
    const user = await svc.findByRefIncludingDeleted(ref);
    if (!user) return void res.status(404).json({ error: 'not_found' });
    const rows = await AuditLog.find({ target_type: 'user', target_id: user._id })
        .sort({ created_at: -1 })
        .limit(50);
    res.json({ entries: rows });
});
