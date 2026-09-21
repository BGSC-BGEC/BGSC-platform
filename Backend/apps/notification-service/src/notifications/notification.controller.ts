import { INotification, wrap } from '@bgsc/shared';
import { Request } from 'express';
import * as prefs from './preferences';
import * as svc from './notification.service';
import { ListNotificationsInput, UpdatePreferencesInput } from './notification.schemas';

/**
 * Thin by construction: parse, call the service, answer. No business logic, no `res.status(...)`
 * for refusals — a `ServiceError` from the service is mapped centrally (service.ts:errorHandler).
 *
 * The caller's id always comes from `req.user`, which `requireAuth` populated from a verified
 * token. It is never read from a body, a query string or a path parameter: the inbox is the
 * caller's by definition, and an id parameter would be an authorization decision made by a client.
 */

const actorId = (req: Request): string => req.user!.id;

/** `__v` is mongoose bookkeeping and has no meaning to a client. Everything else is display data. */
function present(n: INotification): Omit<INotification, '__v'> {
    const { __v, ...rest } = n as INotification & { __v?: number };
    return rest as Omit<INotification, '__v'>;
}

export const listNotifications = wrap(async (req, res) => {
    const { notifications, next_cursor } = await svc.list(
        actorId(req),
        req.query as unknown as ListNotificationsInput
    );
    res.json({ notifications: notifications.map(present), next_cursor });
});

export const getUnreadCount = wrap(async (req, res) => {
    res.json({ unread: await svc.unreadCount(actorId(req)) });
});

export const getPreferences = wrap(async (req, res) => {
    res.json(await prefs.get(actorId(req)));
});

export const updatePreferences = wrap(async (req, res) => {
    res.json(await prefs.update(actorId(req), req.body as UpdatePreferencesInput));
});

export const markAllRead = wrap(async (req, res) => {
    res.json({ marked: await svc.markAllRead(actorId(req)) });
});

export const markRead = wrap(async (req, res) => {
    const id = (req.params as Record<string, string>).id;
    res.json({ read_at: await svc.markRead(actorId(req), id) });
});

export const dismiss = wrap(async (req, res) => {
    const id = (req.params as Record<string, string>).id;
    await svc.dismiss(actorId(req), id);
    // Nothing to say; the row is gone.
    res.status(204).send();
});
