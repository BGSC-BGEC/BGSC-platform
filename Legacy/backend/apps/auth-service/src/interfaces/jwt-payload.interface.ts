import { UserRole } from '../constants/roles.constant';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: UserRole;
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
}
