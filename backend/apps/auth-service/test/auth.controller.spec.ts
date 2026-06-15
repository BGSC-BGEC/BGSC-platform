import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuthController } from '../src/controllers/auth.controller';
import { AuthService } from '../src/services/auth.service';
import { RateLimitGuard } from '../src/guards/rate-limit.guard';
import { LocalAuthGuard } from '../src/guards/local-auth.guard';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
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
    };

    const mockRateLimitGuard = { canActivate: () => true };
    const mockLocalAuthGuard = { canActivate: () => true };
    const mockJwtAuthGuard = { canActivate: () => true };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    })
      .overrideGuard(RateLimitGuard)
      .useValue(mockRateLimitGuard)
      .overrideGuard(LocalAuthGuard)
      .useValue(mockLocalAuthGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
