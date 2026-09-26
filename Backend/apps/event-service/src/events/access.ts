import { IEvent, ServiceError, UserRole, rankOf, isEventAdmin } from '@bgsc/shared';

/**
 * Who may act on an event. `isEventAdmin` and `escapeRegex` are the shared definitions
 * (`@bgsc/shared` access/eventAdmin.ts) — re-exported, not copied, so this service and every other
 * one agree on "administers this event" by construction.
 */
export { isEventAdmin, escapeRegex } from '@bgsc/shared';

export interface Actor {
    id: string;
    role: string;
}

export const atLeast = (role: string, floor: UserRole): boolean => rankOf(role as UserRole) >= rankOf(floor);

export function assertEventAdmin(event: Pick<IEvent, 'created_by' | 'core_admins'>, actor: Actor): void {
    if (!isEventAdmin(event, actor)) throw new ServiceError(403, 'forbidden');
}

/** Drafts exist only for their admins; everyone else gets the 404 a missing event gets. */
export function assertVisible(event: Pick<IEvent, 'status' | 'created_by' | 'core_admins'>, viewer?: Actor | null): void {
    if (event.status === 'draft' && !isEventAdmin(event, viewer)) throw new ServiceError(404, 'not_found');
}

/**
 * Admin check on something reached through an event (a lot): visibility first, so a draft's lot is a
 * 404 to a non-admin rather than a 403 that confirms it exists.
 */
export function assertAdminOf(
    event: Pick<IEvent, 'status' | 'created_by' | 'core_admins'>,
    actor: Actor,
    notFound = 'not_found'
): void {
    if (isEventAdmin(event, actor)) return;
    if (event.status === 'draft') throw new ServiceError(404, notFound);
    throw new ServiceError(403, 'forbidden');
}

export const TERMINAL_STATUSES: ReadonlyArray<IEvent['status']> = ['past', 'cancelled'];
