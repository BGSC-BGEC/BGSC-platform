import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserCredential } from '../entities/user-credential.entity';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(user: UserCredential): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.jwt.accessSecret'),
      expiresIn: (this.configService.get<string>('auth.jwt.accessExpiry') || '15m') as any,
      issuer: this.configService.get<string>('auth.jwt.issuer') || 'bgsc-auth-service',
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.get<string>('auth.jwt.accessSecret'),
      issuer: this.configService.get<string>('auth.jwt.issuer') || 'bgsc-auth-service',
    });
  }

  signTempToken(userId: string, purpose: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose },
      {
        secret: this.configService.get<string>('auth.jwt.accessSecret'),
        expiresIn: '5m',
        issuer: this.configService.get<string>('auth.jwt.issuer') || 'bgsc-auth-service',
      },
    );
  }

  verifyTempToken(token: string, expectedPurpose: string): string {
    const payload = this.jwtService.verify(token, {
      secret: this.configService.get<string>('auth.jwt.accessSecret'),
      issuer: this.configService.get<string>('auth.jwt.issuer') || 'bgsc-auth-service',
    });

    if (payload.purpose !== expectedPurpose) {
      throw new Error('Invalid token purpose');
    }

    return payload.sub;
  }

  generateRefreshToken(userId: string, familyId?: string): { raw: string; hash: string; familyId: string } {
    const fid = familyId || randomUUID();
    const random = randomBytes(32).toString('hex');
    const raw = `${userId}.${fid}.${random}`;
    const hash = this.hashToken(raw);
    return { raw, hash, familyId: fid };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
