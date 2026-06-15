import { UserRole } from '../user-role.enum';
import { UserStatus } from '../user-status.enum';

export class UserResponseDto {
  id!: string;
  username!: string;
  email!: string;
  contact?: string | null;
  role!: UserRole;
  avatarUrl?: string | null;
  interests!: string[];
  socials!: Record<string, string>;
  stravaId?: string | null;
  steamId?: string | null;
  pointsBalance!: number;
  status!: UserStatus;
  settings!: Record<string, unknown>;
  newsletterSubscriptions!: string[];
  activeSponsorId?: string | null;
  lastActive?: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}
