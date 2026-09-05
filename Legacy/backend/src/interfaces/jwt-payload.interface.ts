/**
 * Shape of the access-token payload issued by the auth-service.
 * Kept in sync with apps/auth-service/src/interfaces/jwt-payload.interface.ts.
 */
export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
}
