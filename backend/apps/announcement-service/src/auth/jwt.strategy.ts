import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  username: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('announcement.jwt.accessSecret')!,
      issuer: configService.get<string>('announcement.jwt.issuer')!,
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
      username: payload.username,
    };
  }
}
