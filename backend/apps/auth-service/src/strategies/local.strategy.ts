import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'usernameOrEmail',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    usernameOrEmail: string,
    password: string,
  ): Promise<any> {
    const rawIp =
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      req.ip ||
      '';
    const ip = Array.isArray(rawIp)
      ? rawIp[0]
      : rawIp.split(',')[0].trim() || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    return this.authService.validateAndLogUser(
      usernameOrEmail,
      password,
      ip,
      userAgent,
    );
  }
}
