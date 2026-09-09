import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { config, wrap } from '@bgsc/shared';

/**
 * Handlers return bare payloads. The shared success envelope in createServiceApp wraps them as
 * `{ success, data }` for every service alike — these used to wrap by hand, which is how auth
 * ended up with a different response shape from the other two services behind one gateway.
 */

export class AuthController {
  static register = wrap(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  });

  static login = wrap(async (req: Request, res: Response): Promise<void> => {
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
    res.status(200).json(result);
  });

  static refresh = wrap(async (req: Request, res: Response): Promise<void> => {
    const tokens = await AuthService.refreshToken(req.body.refresh_token);
    res.status(200).json({ tokens });
  });

  static logout = wrap(async (req: Request, res: Response): Promise<void> => {
    if (req.user?.id) {
      await AuthService.logout(req.user.id);
    }
    res.status(200).json({ message: 'logged_out' });
  });

  static verifyEmail = wrap(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.verifyEmail(req.body.token);
    res.status(200).json({ message: 'email_verified', ...result });
  });

  static resendVerification = wrap(async (req: Request, res: Response): Promise<void> => {
    await AuthService.resendVerification(req.body.email);
    res.status(200).json({ message: 'verification_email_sent' });
  });

  static forgotPassword = wrap(async (req: Request, res: Response): Promise<void> => {
    await AuthService.forgotPassword(req.body.email);
    res.status(200).json({ message: 'password_reset_email_sent' });
  });

  static resetPassword = wrap(async (req: Request, res: Response): Promise<void> => {
    await AuthService.resetPassword(req.body);
    res.status(200).json({ message: 'password_reset_successful' });
  });

  static reactivateAccount = wrap(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.reactivateAccount(req.body.login, req.body.password);
    res.status(200).json({ message: 'account_reactivated', ...result });
  });

  static googleAuth = (req: Request, res: Response): void => {
    const state = req.query.state as string | undefined;
    const url = AuthService.getGoogleAuthUrl(state);
    res.redirect(url);
  };

  static googleCallback = wrap(async (req: Request, res: Response): Promise<void> => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: 'missing_authorization_code' });
      return;
    }

    // Throws unless this callback corresponds to a consent screen we sent the user to. Returns
    // whatever the caller stashed on the way in — a return path, typically — to hand back.
    const callerState = AuthService.verifyState(req.query.state as string | undefined);

    const result = await AuthService.handleGoogleCallback(code);

    const isBrowser = req.headers.accept?.includes('text/html');
    if (isBrowser) {
      const params = new URLSearchParams({
        access_token: result.tokens.access_token,
        refresh_token: result.tokens.refresh_token,
      });
      if (callerState) params.append('state', callerState);
      res.redirect(`${config.frontendUrl}/auth/callback?${params.toString()}`);
      return;
    }

    res.status(200).json(result);
  });

  static sendPhoneOtp = wrap(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.sendPhoneOtp(req.user!.id, req.body.phone_number);
    res.status(200).json(result);
  });

  static verifyPhoneOtp = wrap(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.verifyPhoneOtp(
      req.user!.id,
      req.body.phone_number,
      req.body.otp
    );
    res.status(200).json(result);
  });
}
