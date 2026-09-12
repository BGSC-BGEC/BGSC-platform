export type UserRole = 'guest' | 'user' | 'member' | 'core' | 'coordinator' | 'founder';

export interface AdminUser {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    pointsBalance?: number;
}