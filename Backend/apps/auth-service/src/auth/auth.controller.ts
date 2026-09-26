import crypto from 'crypto';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { config, wrap } from '@bgsc/shared';

/**
 * Binds a Google sign-in to the browser that started it (see AuthService.verifyState). Lax, not
 * Strict: the callback is a top-level navigation back from accounts.google.com, which Strict would
 * strip the cookie from. Scoped to the OAuth paths so it rides on nothing else.
 */
export const OAUTH_NONCE_COOKIE = 'bgsc_oauth_nonce';
const OAUTH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.nodeEnv === 'production',
  path: '/auth/google',
};

/** One cookie out of the Cookie header. No cookie-parser for a single value. */
export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

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
    // No tokens: a verification link is not a sign-in link.
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
    const result = await AuthService.reactivateAccount(req.body.login, req.body.password, req.ip ?? null);
    res.status(200).json({ message: 'account_reactivated', ...result });
  });

  static googleAuth = (req: Request, res: Response): void => {
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const nonce = crypto.randomBytes(32).toString('hex');
    const url = AuthService.getGoogleAuthUrl(nonce, state);
    res.cookie(OAUTH_NONCE_COOKIE, nonce, { ...OAUTH_COOKIE_OPTS, maxAge: 10 * 60 * 1000 });
    res.redirect(url);
  };

  static googleCallback = wrap(async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.status(400).json({ error: 'missing_authorization_code' });
      return;
    }

    // Throws unless this callback belongs to a consent screen THIS browser was sent to. Returns
    // whatever the caller stashed on the way in — a return path, typically — to hand back.
    const callerState = AuthService.verifyState(
      typeof req.query.state === 'string' ? req.query.state : undefined,
      readCookie(req, OAUTH_NONCE_COOKIE)
    );
    res.clearCookie(OAUTH_NONCE_COOKIE, OAUTH_COOKIE_OPTS);

    const isBrowser = req.headers.accept?.includes('text/html');
    if (isBrowser) {
      // A one-time code, never the tokens: a URL is kept by history, logs and proxies.
      const params = new URLSearchParams({ login_code: await AuthService.googleLoginCode(code) });
      if (callerState) params.append('state', callerState);
      res.redirect(`${config.frontendUrl}/auth/callback?${params.toString()}`);
      return;
    }

    res.status(200).json(await AuthService.handleGoogleCallback(code));
  });

  /** The frontend swaps the callback's one-time login code for the token pair. */
  static googleExchange = wrap(async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await AuthService.exchangeLoginCode(req.body.login_code));
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
