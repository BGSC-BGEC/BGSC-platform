import type { UserRole } from "./admin";

export type UserStatus = 'active' | 'pending' | 'suspended' | 'inactive';

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
    pointsBalance: number;
    joinDate: string;
    
}