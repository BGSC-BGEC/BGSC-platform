import { Controller, Post, Body, Req, Res, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @RateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'register' }) // 3 per hour
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
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
  @ApiResponse({ status: 200, description: 'Login successful' })
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

    return {
      user: result.user,
      accessToken: result.accessToken,
      isNewUser: result.isNewUser,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'refresh' }) // 30 per min
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
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
  @ApiOperation({ summary: 'Log out current session' })
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['bgsc_refresh_token'];
    if (refreshToken) {
      const parts = refreshToken.split('.');
      if (parts.length === 3) {
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
  @RateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyPrefix: 'password_reset' })
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Password reset request accepted' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with emailed token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for current user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
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
    if (parts.length !== 3 || parts[0] !== userId) {
      return undefined;
    }

    return parts[1];
  }
}
