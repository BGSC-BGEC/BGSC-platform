import type { UserRole } from '../types/admin'
import { useAuthStore } from '../stores/authStore'

/**
 * Client mirror of the backend's role floors, so the console hides actions a role cannot perform
 * instead of showing a button that answers 403. The backend stays authoritative; each entry names
 * the route that enforces it.
 */
const RANK: Record<UserRole, number> = {
  guest: 0,
  user: 1,
  member: 2,
  core: 3,
  coordinator: 4,
  founder: 5,
}

export type Permission =
  | 'users.view' //            GET  /users                         coordinator+
  | 'users.manage' //          PATCH /users/:ref/role|status        coordinator+
  | 'points.adjust' //         POST /points/adjust                 coordinator+
  | 'points.rules.edit' //     PATCH /points/rules/:id             coordinator+
  | 'hallOfFame.delete' //     DELETE /hall-of-fame/:id            coordinator+
  | 'announcements.delete' //  DELETE /announcements/:id           coordinator+
  | 'challenges.delete' //     DELETE /challenges/:id              coordinator+

const FLOOR: Record<Permission, UserRole> = {
  'users.view': 'coordinator',
  'users.manage': 'coordinator',
  'points.adjust': 'coordinator',
  'points.rules.edit': 'coordinator',
  'hallOfFame.delete': 'coordinator',
  'announcements.delete': 'coordinator',
  'challenges.delete': 'coordinator',
}

export function rankOf(role: UserRole | undefined): number {
  return role ? RANK[role] ?? -1 : -1
}

export function can(role: UserRole | undefined, permission: Permission): boolean {
  return rankOf(role) >= RANK[FLOOR[permission]]
}

/** Roles `actor` may assign: strictly below their own rank, never founder (backend assertOutranks). */
export function assignableRoles(actor: UserRole | undefined): UserRole[] {
  const options: UserRole[] = ['user', 'member', 'core', 'coordinator']
  return options.filter((r) => rankOf(r) < rankOf(actor))
}

/** Hook form: `const allowed = useCan('points.adjust')`. */
export function useCan(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role)
  return can(role, permission)
}
