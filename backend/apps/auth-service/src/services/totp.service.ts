import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, verify, generateURI } from 'otplib';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TotpService {
  private readonly encryptionKey: Buffer;
  private readonly issuer: string;

  constructor(private readonly configService: ConfigService) {
    const keyStr = this.configService.get<string>('auth.totp.encryptionKey');
    if (!keyStr) {
      throw new InternalServerErrorException('TOTP encryption key is not configured');
    }
    if (!/^[a-fA-F0-9]{64}$/.test(keyStr)) {
      throw new InternalServerErrorException('TOTP encryption key must be 32 bytes encoded as hex');
    }
    this.encryptionKey = Buffer.from(keyStr, 'hex');
    this.issuer = this.configService.get<string>('auth.totp.issuer') || 'BGSC Platform';
  }

  generateSecret(): string {
    return generateSecret();
  }

  encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  decryptSecret(encryptedSecret: string): string {
    const parts = encryptedSecret.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Invalid encrypted secret format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm', 
      this.encryptionKey, 
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async generateQRCode(userEmail: string, secret: string): Promise<string> {
    const uri = generateURI({
      issuer: this.issuer,
      label: userEmail,
      secret,
    });
    return await qrcode.toDataURL(uri);
  }

  async verifyCode(secret: string, token: string): Promise<boolean> {
    const result = await verify({
      token,
      secret,
      epochTolerance: 30, // 1-step window tolerance (30 seconds)
    });
    return result.valid;
  }

  async generateBackupCodes(): Promise<{ plainTextCodes: string[]; hashedCodes: string[] }> {
    const plainTextCodes: string[] = [];
    const hashedCodes: string[] = [];
    const saltRounds = this.configService.get<number>('auth.bcrypt.saltRounds') || 12;

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex'); // 8 hex chars
      plainTextCodes.push(code);
      const hash = await bcrypt.hash(code, saltRounds);
      hashedCodes.push(hash);
    }

    return { plainTextCodes, hashedCodes };
  }
}
