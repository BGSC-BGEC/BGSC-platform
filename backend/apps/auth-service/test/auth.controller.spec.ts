import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from '../src/controllers/auth.controller';
import { AuthService } from '../src/services/auth.service';
import { RateLimitGuard } from '../src/guards/rate-limit.guard';
import { LocalAuthGuard } from '../src/guards/local-auth.guard';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { GoogleAuthGuard } from '../src/guards/google-auth.guard';
import { EmailAlreadyLinkedException } from '../src/exceptions/email-already-linked.exception';
import { UserRole, UserStatus } from '../src/constants/roles.constant';
import type { JwtPayload } from '../src/interfaces/jwt-payload.interface';
import type { UserCredential } from '../src/entities/user-credential.entity';

interface MockRes {
  status: jest.Mock;
  json: jest.Mock;
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
}
interface MockAuthService {
  register: jest.Mock;
  login: jest.Mock;
  refreshTokens: jest.Mock;
  logout: jest.Mock;
  logoutAll: jest.Mock;
  forgotPassword: jest.Mock;
  resetPassword: jest.Mock;
  changePassword: jest.Mock;
  findOrCreateGoogleUser: jest.Mock;
  loginWithGoogle: jest.Mock;
}
interface MockConfigService {
  get: jest.Mock;
}

describe('AuthController', () => {
  let controller: AuthController;
  let authService: MockAuthService;
  let configService: MockConfigService;

  const mockResponse = (): MockRes => {
    const res = {} as MockRes;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockCredential = (
    partial: Partial<UserCredential> = {},
  ): UserCredential =>
    ({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      totpEnabled: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...partial,
    }) as UserCredential;

  const mockJwtPayload = (partial: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: '1',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
    jti: 'jti-1',
    ...partial,
  });

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      findOrCreateGoogleUser: jest.fn(),
      loginWithGoogle: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('https://app.bgsc-platform.in'),
    };

    const mockRateLimitGuard = { canActivate: () => true };
    const mockLocalAuthGuard = { canActivate: () => true };
    const mockJwtAuthGuard = { canActivate: () => true };
    const mockGoogleAuthGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    })
      .overrideGuard(RateLimitGuard)
      .useValue(mockRateLimitGuard)
      .overrideGuard(LocalAuthGuard)
      .useValue(mockLocalAuthGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(GoogleAuthGuard)
      .useValue(mockGoogleAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleAuth', () => {
    it('should be defined for the OAuth redirect entrypoint', () => {
      expect(controller.googleAuth()).toBeUndefined();
    });
  });

  describe('googleAuthCallback', () => {
    const profile = {
      googleId: 'gid-1',
      email: 'user@example.com',
      emailVerified: true,
      firstName: 'User',
      lastName: 'Test',
      picture: 'https://example.com/pic.png',
    };

    it('should set refresh cookie, issue tokens, and redirect with access_token in fragment', async () => {
      const user = {
        id: 'u-1',
        username: 'googler',
        email: 'user@example.com',
        role: 'user',
      };
      authService.findOrCreateGoogleUser.mockResolvedValue({
        user,
        isNewUser: true,
      });
      authService.loginWithGoogle.mockResolvedValue({
        accessToken: 'access-token-xyz',
        refreshToken: 'u-1.fam-1.random',
        isNewUser: true,
      });

      const req = {
        headers: { 'user-agent': 'browser' },
        socket: {},
      } as unknown as Request;
      const res = mockResponse();

      await controller.googleAuthCallback(
        profile,
        req,
        res as unknown as Response,
      );

      expect(authService.findOrCreateGoogleUser).toHaveBeenCalledWith(profile);
      expect(authService.loginWithGoogle).toHaveBeenCalledWith(
        user,
        true,
        '127.0.0.1',
        'browser',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'bgsc_refresh_token',
        'u-1.fam-1.random',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(res.redirect).toHaveBeenCalledTimes(1);
      const [status, url] = res.redirect.mock.calls[0];
      expect(status).toBe(302);
      expect(url).toContain('https://app.bgsc-platform.in/auth/callback#');
      expect(url).toContain('access_token=access-token-xyz');
      expect(url).toContain('is_new_user=true');
    });

    it('should pass isNewUser=false on second OAuth login with same googleId', async () => {
      const user = {
        id: 'u-1',
        username: 'googler',
        email: 'user@example.com',
      };
      authService.findOrCreateGoogleUser.mockResolvedValue({
        user,
        isNewUser: false,
      });
      authService.loginWithGoogle.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        isNewUser: false,
      });

      const req = { headers: {}, socket: {} } as unknown as Request;
      const res = mockResponse();

      await controller.googleAuthCallback(
        profile,
        req,
        res as unknown as Response,
      );

      const [, url] = res.redirect.mock.calls[0];
      expect(url).toContain('is_new_user=false');
    });

    it('should propagate EmailAlreadyLinkedException for collision', async () => {
      authService.findOrCreateGoogleUser.mockRejectedValue(
        new EmailAlreadyLinkedException(),
      );

      const req = { headers: {}, socket: {} } as unknown as Request;
      const res = mockResponse();

      await expect(
        controller.googleAuthCallback(profile, req, res as unknown as Response),
      ).rejects.toThrow(EmailAlreadyLinkedException);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register a user, set the refresh token cookie, and return data', async () => {
      const mockResult = {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user',
        },
        accessToken: 'access-token',
        refreshToken: '1.fam-1.random',
        isNewUser: true,
      };
      authService.register.mockResolvedValue(mockResult);

      const req = { headers: {}, socket: {} } as unknown as Request;
      const res = mockResponse();

      const result = await controller.register(
        {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password1!',
          acceptedTos: true,
        },
        req,
        res as unknown as Response,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(res.cookie).toHaveBeenCalledWith(
        'bgsc_refresh_token',
        '1.fam-1.random',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('login', () => {
    it('should set cookie and return tokens for local login without TOTP', async () => {
      const mockResult = {
        requiresTOTP: false,
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user',
        },
        accessToken: 'access-token',
        refreshToken: '1.fam-1.random',
        isNewUser: false,
      };
      authService.login.mockResolvedValue(mockResult);

      const user = mockCredential();
      const req = { headers: {}, socket: {} } as unknown as Request;
      const res = mockResponse();

      const result = await controller.login(
        user,
        {
          usernameOrEmail: 'testuser',
          password: 'password',
          keepMeLoggedIn: true,
        },
        req,
        res as unknown as Response,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access-token');
      expect(res.cookie).toHaveBeenCalledWith(
        'bgsc_refresh_token',
        '1.fam-1.random',
        expect.objectContaining({ maxAge: 7 * 24 * 60 * 60 * 1000 }),
      );
    });

    it('should return tempToken when TOTP is required', async () => {
      const mockResult = {
        requiresTOTP: true,
        tempToken: 'temp-token',
      };
      authService.login.mockResolvedValue(mockResult);

      const user = mockCredential();
      const req = { headers: {}, socket: {} } as unknown as Request;
      const res = mockResponse();

      const result = await controller.login(
        user,
        { usernameOrEmail: 'testuser', password: 'password' },
        req,
        res as unknown as Response,
      );

      expect(result).toBeDefined();
      expect(result.requiresTOTP).toBe(true);
      expect(result.tempToken).toBe('temp-token');
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('password flows', () => {
    it('should call forgotPassword and return generic response', async () => {
      authService.forgotPassword.mockResolvedValue({
        message:
          'If an account with that email exists, a reset link has been sent.',
      });

      const result = await controller.forgotPassword({
        email: 'user@example.com',
      });

      expect(authService.forgotPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
      expect(result.message).toContain('If an account with that email exists');
    });

    it('should call resetPassword with token and new password', async () => {
      authService.resetPassword.mockResolvedValue({
        message: 'Password has been reset successfully.',
      });

      const dto = { token: 'a'.repeat(64), newPassword: 'NewPassword1!' };
      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('Password has been reset successfully.');
    });

    it('should pass current session familyId to changePassword when cookie matches user', async () => {
      authService.changePassword.mockResolvedValue({
        message: 'Password changed successfully.',
      });

      const userId = '11111111-2222-3333-4444-555555555555';
      const familyId = '66666666-7777-8888-9999-000000000000';
      const randomHex =
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const req = {
        cookies: { bgsc_refresh_token: `${userId}.${familyId}.${randomHex}` },
      } as unknown as Request;
      const dto = {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      };
      const result = await controller.changePassword(
        mockJwtPayload({ sub: userId }),
        dto,
        req,
      );

      expect(authService.changePassword).toHaveBeenCalledWith(
        userId,
        dto,
        familyId,
      );
      expect(result.message).toBe('Password changed successfully.');
    });
  });
});
