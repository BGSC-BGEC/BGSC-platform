import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from '../src/controllers/auth.controller';
import { AuthService } from '../src/services/auth.service';
import { RateLimitGuard } from '../src/guards/rate-limit.guard';
import { LocalAuthGuard } from '../src/guards/local-auth.guard';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { GoogleAuthGuard } from '../src/guards/google-auth.guard';
import { EmailAlreadyLinkedException } from '../src/exceptions/email-already-linked.exception';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let configService: any;

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };

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
    it('should be defined for the OAuth redirect entrypoint', async () => {
      await expect(controller.googleAuth()).resolves.toBeUndefined();
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
      const user = { id: 'u-1', username: 'googler', email: 'user@example.com', role: 'user' };
      authService.findOrCreateGoogleUser.mockResolvedValue({ user, isNewUser: true });
      authService.loginWithGoogle.mockResolvedValue({
        accessToken: 'access-token-xyz',
        refreshToken: 'u-1.fam-1.random',
        isNewUser: true,
      });

      const req: any = { headers: { 'user-agent': 'browser' }, socket: {} };
      const res = mockResponse();

      await controller.googleAuthCallback(profile, req, res);

      expect(authService.findOrCreateGoogleUser).toHaveBeenCalledWith(profile);
      expect(authService.loginWithGoogle).toHaveBeenCalledWith(user, true, '127.0.0.1', 'browser');
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
      const user = { id: 'u-1', username: 'googler', email: 'user@example.com' };
      authService.findOrCreateGoogleUser.mockResolvedValue({ user, isNewUser: false });
      authService.loginWithGoogle.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        isNewUser: false,
      });

      const req: any = { headers: {}, socket: {} };
      const res = mockResponse();

      await controller.googleAuthCallback(profile, req, res);

      const [, url] = res.redirect.mock.calls[0];
      expect(url).toContain('is_new_user=false');
    });

    it('should propagate EmailAlreadyLinkedException for collision', async () => {
      authService.findOrCreateGoogleUser.mockRejectedValue(new EmailAlreadyLinkedException());

      const req: any = { headers: {}, socket: {} };
      const res = mockResponse();

      await expect(controller.googleAuthCallback(profile, req, res)).rejects.toThrow(EmailAlreadyLinkedException);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register a user, set the refresh token cookie, and return data', async () => {
      const mockResult = {
        user: { id: '1', username: 'testuser', email: 'test@example.com', role: 'user' },
        accessToken: 'access-token',
        refreshToken: '1.fam-1.random',
        isNewUser: true,
      };
      authService.register.mockResolvedValue(mockResult);

      const req: any = { headers: {}, socket: {} };
      const res = mockResponse();

      const result = await controller.register(
        {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password1!',
          acceptedTos: true,
        },
        req,
        res,
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
        user: { id: '1', username: 'testuser', email: 'test@example.com', role: 'user' },
        accessToken: 'access-token',
        refreshToken: '1.fam-1.random',
        isNewUser: false,
      };
      authService.login.mockResolvedValue(mockResult);

      const user = { id: '1', username: 'testuser' };
      const req: any = { headers: {}, socket: {} };
      const res = mockResponse();

      const result = await controller.login(
        user,
        { usernameOrEmail: 'testuser', password: 'password', keepMeLoggedIn: true },
        req,
        res,
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

      const user = { id: '1', username: 'testuser' };
      const req: any = { headers: {}, socket: {} };
      const res = mockResponse();

      const result = await controller.login(
        user,
        { usernameOrEmail: 'testuser', password: 'password' },
        req,
        res,
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
        message: 'If an account with that email exists, a reset link has been sent.',
      });

      const result = await controller.forgotPassword({ email: 'user@example.com' });

      expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
      expect(result.message).toContain('If an account with that email exists');
    });

    it('should call resetPassword with token and new password', async () => {
      authService.resetPassword.mockResolvedValue({ message: 'Password has been reset successfully.' });

      const dto = { token: 'a'.repeat(64), newPassword: 'NewPassword1!' };
      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('Password has been reset successfully.');
    });

    it('should pass current session familyId to changePassword when cookie matches user', async () => {
      authService.changePassword.mockResolvedValue({ message: 'Password changed successfully.' });

      const req: any = { cookies: { bgsc_refresh_token: 'u-1.fam-1.random' } };
      const dto = { currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' };
      const result = await controller.changePassword({ sub: 'u-1' }, dto, req);

      expect(authService.changePassword).toHaveBeenCalledWith('u-1', dto, 'fam-1');
      expect(result.message).toBe('Password changed successfully.');
    });
  });
});
