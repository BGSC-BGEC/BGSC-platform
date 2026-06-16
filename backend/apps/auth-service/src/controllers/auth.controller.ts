import { Controller, Post, Body, Req, Res, UseGuards, HttpStatus, HttpCode, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import type { GoogleProfilePayload } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { UserStatus } from '../constants/roles.constant';
import { AuthResponseDto, RefreshResponseDto, SuccessMessageDto, LoginPendingDeletionResponseDto } from '../dto/responses.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth2 consent screen' })
  @ApiResponse({ status: 302, description: 'Redirected to Google OAuth2 consent screen' })
  async googleAuth() {
    return;
  }

  @Public()
  @Get('google/callback')
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Handle Google OAuth2 callback' })
  @ApiResponse({ status: 302, description: 'Redirected to frontend with access token in fragment' })
  @ApiResponse({ status: 401, description: 'Invalid or expired state' })
  @ApiResponse({ status: 409, description: 'Email already linked to a non-Google account' })
  async googleAuthCallback(
    @CurrentUser() googleProfile: GoogleProfilePayload,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
    const ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp.split(',')[0].trim() || '127.0.0.1');
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { user, isNewUser } = await this.authService.findOrCreateGoogleUser(googleProfile);
    const tokens = await this.authService.loginWithGoogle(user, isNewUser, ip, userAgent);

    this.setCookie(res, tokens.refreshToken, true);

    const frontendUrl = this.configService.get<string>('auth.oauth.frontendCallbackUrl')
      || this.configService.get<string>('auth.cors.origins.0')
      || 'https://bgsc-platform.in';

    const params = new URLSearchParams({
      access_token: tokens.accessToken,
      is_new_user: String(tokens.isNewUser),
    });
    if (user.status === UserStatus.PENDING_DELETION) {
      params.append('is_pending_deletion', 'true');
    }

    return res.redirect(302, `${frontendUrl}/auth/callback#${params.toString()}`);
  }

  @Public()
  @Post('register')
  @RateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'register' }) // 3 per hour
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
    const ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp.split(',')[0].trim() || '127.0.0.1');
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.register(dto, ip, userAgent);
    this.setCookie(res, result.refreshToken, true);

    return {
      user: result.user,
      accessToken: result.accessToken,
      isNewUser: result.isNewUser,
    };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: 'login' }) // 5 per 15 mins
  @ApiOperation({ summary: 'Log in with credentials' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 403, description: 'Account scheduled for deletion', type: LoginPendingDeletionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @CurrentUser() user: any,
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
    const ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp.split(',')[0].trim() || '127.0.0.1');
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.authService.login(user, ip, userAgent, dto.keepMeLoggedIn);

    if (result.requiresTOTP) {
      return {
        requiresTOTP: true,
        tempToken: result.tempToken,
      };
    }

    this.setCookie(res, result.refreshToken!, !!dto.keepMeLoggedIn);

    if (user.status === UserStatus.PENDING_DELETION) {
      res.status(HttpStatus.FORBIDDEN);
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'Account is scheduled for deletion. Log in to cancel.',
        accessToken: result.accessToken,
      };
    }

    return {
      user: result.user,
      accessToken: result.accessToken,
      isNewUser: result.isNewUser,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'refresh', keyBy: 'refreshToken' }) // 30 per min
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully', type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['bgsc_refresh_token'];
    if (!refreshToken) {
      res.clearCookie('bgsc_refresh_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/auth',
      });
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Missing refresh token' });
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
    const ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp.split(',')[0].trim() || '127.0.0.1');
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
      const result = await this.authService.refreshTokens(refreshToken, ip, userAgent);
      this.setCookie(res, result.refreshToken, result.keepMeLoggedIn);
      return { accessToken: result.accessToken };
    } catch (error) {
      res.clearCookie('bgsc_refresh_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/auth',
      });
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({ summary: 'Log out current session' })
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['bgsc_refresh_token'];
    if (refreshToken) {
      const parts = refreshToken.split('.');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const randomHexRegex = /^[0-9a-f]{64}$/i;
      if (
        parts.length === 3 &&
        uuidRegex.test(parts[0]) &&
        uuidRegex.test(parts[1]) &&
        randomHexRegex.test(parts[2])
      ) {
        const [userId, familyId] = parts;
        if (userId === user.sub) {
          await this.authService.logout(user.sub, familyId, user.jti, user.exp);
        }
      }
    }

    res.clearCookie('bgsc_refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
    });

    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({ summary: 'Log out all sessions across all devices' })
  async logoutAll(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.sub, user.jti, user.exp);

    res.clearCookie('bgsc_refresh_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
    });

    return { message: 'Logged out of all devices successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'password_reset', keyBy: 'email' })
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Password reset request accepted', type: SuccessMessageDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({ summary: 'Reset password with emailed token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully', type: SuccessMessageDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'general' })
  @ApiOperation({ summary: 'Change password for current user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully', type: SuccessMessageDto })
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const currentFamilyId = this.getFamilyIdFromRefreshCookie(req, user.sub);
    return this.authService.changePassword(user.sub, dto, currentFamilyId);
  }



  private setCookie(res: Response, token: string, keepMeLoggedIn: boolean) {
    res.cookie('bgsc_refresh_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth',
      maxAge: keepMeLoggedIn ? 7 * 24 * 60 * 60 * 1000 : undefined,
    });
  }

  private getFamilyIdFromRefreshCookie(req: Request, userId: string): string | undefined {
    const refreshToken = req.cookies?.['bgsc_refresh_token'];
    if (!refreshToken) {
      return undefined;
    }

    const parts = refreshToken.split('.');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const randomHexRegex = /^[0-9a-f]{64}$/i;
    if (
      parts.length !== 3 ||
      !uuidRegex.test(parts[0]) ||
      !uuidRegex.test(parts[1]) ||
      !randomHexRegex.test(parts[2]) ||
      parts[0] !== userId
    ) {
      return undefined;
    }

    return parts[1];
  }
}
