import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds =
      this.configService.get<number>('auth.bcrypt.saltRounds') || 12;
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  generateResetToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('hex');
    const hash = this.hashResetToken(raw);
    return { raw, hash };
  }

  hashResetToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
