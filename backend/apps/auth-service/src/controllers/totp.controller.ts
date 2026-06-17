import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Ip,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { TotpService } from '../services/totp.service';
import { TokenService } from '../services/token.service';
import { SessionService } from '../services/session.service';
import { EventBusService } from '../services/event-bus.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { UserCredential } from '../entities/user-credential.entity';
import { UserStatus } from '../constants/roles.constant';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { LoginAuditLog } from '../entities/login-audit-log.entity';
import {
  VerifyTotpSetupDto,
  AuthenticateTotpDto,
  DisableTotpDto,
} from '../dto/totp.dto';
import type { Request, Response } from 'express';
import {
  TotpSetupResponseDto,
  TotpVerifySetupResponseDto,
  AuthResponseDto,
  SuccessMessageDto,
} from '../dto/responses.dto';

@ApiTags('TOTP 2FA')
@Controller('auth/totp')
@UseGuards(RateLimitGuard)
export class TotpController {
  constructor(
    private readonly totpService: TotpService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly eventBusService: EventBusService,
    @InjectRepository(UserCredential)
    private readonly userRepository: Repository<UserCredential>,
    @InjectRepository(LoginAuditLog)
    private readonly auditLogRepository: Repository<LoginAuditLog>,
  ) {}

  @Post('setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({
    summary: 'Initialize TOTP setup — returns secret and QR code',
  })
  @ApiResponse({
    status: 201,
    description: 'TOTP setup initialized',
    type: TotpSetupResponseDto,
  })
  @ApiResponse({ status: 400, description: 'TOTP already enabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setupTotp(@Req() req: Request & { user: JwtPayload }) {
    const userId = req.user.sub;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled');
    }

    const secret = this.totpService.generateSecret();
    const qrCodeUrl = await this.totpService.generateQRCode(user.email, secret);
    const { plainTextCodes, hashedCodes } =
      await this.totpService.generateBackupCodes();

    user.totpSecretEnc = this.totpService.encryptSecret(secret);
    user.totpBackupCodesHash = hashedCodes;
    await this.userRepository.save(user);

    return {
      secret,
      qrCodeUrl,
      backupCodes: plainTextCodes,
    };
  }

  @Post('verify-setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({
    summary:
      'Verify TOTP setup with a code — enables 2FA and returns backup codes',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP enabled, backup codes returned',
    type: TotpVerifySetupResponseDto,
  })
  @ApiResponse({ status: 400, description: 'TOTP setup not initialized' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  async verifySetup(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: VerifyTotpSetupDto,
  ) {
    const userId = req.user.sub;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.totpSecretEnc) {
      throw new BadRequestException('TOTP setup not initialized');
    }

    const secret = this.totpService.decryptSecret(user.totpSecretEnc);
    const isValid = await this.totpService.verifyCode(secret, body.token);

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    user.totpEnabled = true;
    await this.userRepository.save(user);

    this.eventBusService.emit('UserTOTPEnabled', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return {
      enabled: true,
    };
  }

  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'totp' })
  @ApiOperation({
    summary: 'Authenticate with TOTP code or backup code after login',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid code or expired token' })
  async authenticate(
    @Body() body: AuthenticateTotpDto,
    @Req() req: Request,
    @Ip() ip: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const userAgent = req.headers['user-agent'] || 'unknown';

    let userId: string;
    try {
      userId = this.tokenService.verifyTempToken(
        body.tempToken,
        'totp_verification',
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecretEnc) {
      throw new UnauthorizedException('TOTP is not enabled for this user');
    }

    const secret = this.totpService.decryptSecret(user.totpSecretEnc);
    const isValidTotp =
      body.token.length === 6
        ? await this.totpService.verifyCode(secret, body.token)
        : false;

    let isValidBackup = false;
    let matchedBackupIndex = -1;

    if (!isValidTotp && user.totpBackupCodesHash && body.token.length === 8) {
      // Check backup codes
      for (let i = 0; i < user.totpBackupCodesHash.length; i++) {
        const isMatch = await bcrypt.compare(
          body.token,
          user.totpBackupCodesHash[i],
        );
        if (isMatch) {
          isValidBackup = true;
          matchedBackupIndex = i;
          break;
        }
      }
    }

    if (!isValidTotp && !isValidBackup) {
      const method = body.token.length === 8 ? 'backup_code' : 'totp';
      await this.logLoginAttempt(
        user.id,
        ip,
        userAgent,
        method,
        false,
        'invalid_code',
      );
      throw new UnauthorizedException('Invalid authentication code');
    }

    if (isValidBackup && matchedBackupIndex !== -1) {
      // Consume the backup code
      user.totpBackupCodesHash!.splice(matchedBackupIndex, 1);
      await this.userRepository.save(user);
    }

    const method = isValidBackup ? 'backup_code' : 'totp';

    await this.logLoginAttempt(user.id, ip, userAgent, method, true);

    const {
      raw: refreshToken,
      hash: tokenHash,
      familyId,
    } = this.tokenService.generateRefreshToken(user.id);
    await this.sessionService.createSession(
      user.id,
      tokenHash,
      familyId,
      ip,
      userAgent,
      !!body.keepMeLoggedIn,
    );

    const accessToken = this.tokenService.signAccessToken(user);
    if (res) this.setRefreshCookie(res, refreshToken, !!body.keepMeLoggedIn);

    this.eventBusService.emit('UserLoggedIn', {
      userId: user.id,
      device: userAgent,
      ip,
      method,
      timestamp: new Date().toISOString(),
    });

    if (user.status === UserStatus.PENDING_DELETION) {
      if (res) {
        res.status(HttpStatus.FORBIDDEN);
      }
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Account is scheduled for deletion. Log in to cancel.',
        accessToken,
      };
    }

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Post('disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({ summary: 'Disable TOTP 2FA (requires valid TOTP code)' })
  @ApiResponse({
    status: 200,
    description: 'TOTP disabled successfully',
    type: SuccessMessageDto,
  })
  @ApiResponse({ status: 400, description: 'TOTP is not enabled' })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  async disableTotp(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: DisableTotpDto,
  ) {
    const userId = req.user.sub;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecretEnc) {
      throw new BadRequestException('TOTP is not enabled');
    }

    const secret = this.totpService.decryptSecret(user.totpSecretEnc);
    const isValid = await this.totpService.verifyCode(secret, body.token);

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    user.totpEnabled = false;
    user.totpSecretEnc = null;
    user.totpBackupCodesHash = null;

    await this.userRepository.save(user);

    this.eventBusService.emit('UserTOTPDisabled', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return {
      message: 'TOTP disabled successfully',
    };
  }

  private async logLoginAttempt(
    userId: string | null,
    ip: string,
    userAgent: string,
    method: string,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    const log = this.auditLogRepository.create({
      userId: userId ?? undefined,
      ipAddress: ip,
      userAgent,
      method,
      success,
      failureReason,
    });
    await this.auditLogRepository.save(log);
  }

  private setRefreshCookie(
    res: Response,
    token: string,
    keepMeLoggedIn: boolean,
  ): void {
    res.cookie('bgsc_refresh_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: keepMeLoggedIn ? 7 * 24 * 60 * 60 * 1000 : undefined,
    });
  }
}
