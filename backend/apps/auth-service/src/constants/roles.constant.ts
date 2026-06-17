export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  MEMBER = 'member',
  CORE = 'core',
  COORDINATOR = 'coordinator',
  FOUNDER = 'founder',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  PENDING_DELETION = 'pending_deletion',
  DELETED = 'deleted',
}
