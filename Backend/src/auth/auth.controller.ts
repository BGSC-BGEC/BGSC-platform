import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { User } from '../models/User';
import { config } from '../config/env';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        res.status(409).json({ error: 'conflict' });
        return;
      }
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      if ('account_status' in result) {
        res.status(403).json({
          error: 'account_deactivated',
          account_status: result.account_status,
          days_remaining: result.days_remaining,
          message: 'Account is scheduled for deletion. Please reactivate to continue.',
        });
        return;
      }
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 401) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      if (err.statusCode === 403) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await AuthService.refreshToken(req.body.refresh_token);
      res.status(200).json({
        success: true,
        data: { tokens },
      });
    } catch (err: any) {
      if (err.statusCode === 401) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.id) {
        await AuthService.logout(req.user.id);
      }
      res.status(200).json({
        success: true,
        message: 'logged_out',
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(200).json({
        success: true,
        data: {
          user: AuthService.formatUser(user),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.verifyEmail(req.body.token);
      res.status(200).json({
        success: true,
        message: 'email_verified',
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ error: 'invalid_or_expired_token' });
        return;
      }
      next(err);
    }
  }

  static async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.resendVerification(req.body.email);
      res.status(200).json({
        success: true,
        message: 'verification_email_sent',
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.forgotPassword(req.body.email);
      res.status(200).json({
        success: true,
        message: 'password_reset_email_sent',
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.resetPassword(req.body);
      res.status(200).json({
        success: true,
        message: 'password_reset_successful',
      });
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ error: 'invalid_or_expired_token' });
        return;
      }
      next(err);
    }
  }

  static async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.deleteAccount(req.user!.id);
      res.status(200).json({
        success: true,
        message: 'account_deletion_scheduled',
        grace_period_days: 45,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.reactivateAccount(req.body.login, req.body.password);
      res.status(200).json({
        success: true,
        message: 'account_reactivated',
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 401) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      if (err.statusCode === 410) {
        res.status(410).json({ error: 'account_permanently_deleted' });
        return;
      }
      next(err);
    }
  }

  static googleAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      const state = req.query.state as string | undefined;
      const url = AuthService.getGoogleAuthUrl(state);
      res.redirect(url);
    } catch (err: any) {
      if (err.statusCode === 503) {
        res.status(503).json({ error: 'google_oauth_not_configured' });
        return;
      }
      next(err);
    }
  }

  static async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).json({ error: 'missing_authorization_code' });
        return;
      }

      const result = await AuthService.handleGoogleCallback(code);

      // If called from a browser redirect, forward to frontend with tokens
      const isBrowser = req.headers.accept?.includes('text/html');
      if (isBrowser) {
        const redirectUrl = `${config.frontendUrl}/auth/callback?access_token=${result.tokens.access_token}&refresh_token=${result.tokens.refresh_token}`;
        res.redirect(redirectUrl);
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 401) {
        res.status(401).json({ error: 'google_auth_failed' });
        return;
      }
      if (err.statusCode === 503) {
        res.status(503).json({ error: 'google_oauth_not_configured' });
        return;
      }
      next(err);
    }
  }

  static async sendPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.sendPhoneOtp(req.user!.id, req.body.phone_number);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 401) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      next(err);
    }
  }

  static async verifyPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.verifyPhoneOtp(
        req.user!.id,
        req.body.phone_number,
        req.body.otp
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err.statusCode === 400) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err.statusCode === 429) {
        res.status(429).json({ error: 'too_many_attempts' });
        return;
      }
      next(err);
    }
  }
}
