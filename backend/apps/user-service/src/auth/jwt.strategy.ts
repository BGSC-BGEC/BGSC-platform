import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../users/enums/user-role.enum';

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  username: string;
  jti: string;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET!,
      issuer: process.env.JWT_ISSUER || 'bgsc-auth-service',
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      role: payload.role as UserRole,
      email: payload.email,
      username: payload.username,
    };
  }
}
