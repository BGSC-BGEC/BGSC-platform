import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth, validate } from '@bgsc/shared';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ReactivateAccountSchema,
  SendPhoneOtpSchema,
  VerifyPhoneOtpSchema,
} from './auth.schemas';

/**
 * Two routers, because the gateway routes two prefixes here (`/auth` and `/account`, see
 * src/gateway/routing.ts). Declaring `/account/reactivate` inside the `/auth` router would have
 * served it at `/auth/account/reactivate`, and the `/account/reactivate` the gateway forwards
 * would have 404'd.
 */
export const authRoutes = Router();
export const accountRoutes = Router();

// Public Credentials & Session
authRoutes.post('/register', validate({ body: RegisterSchema }), AuthController.register);
authRoutes.post('/login', validate({ body: LoginSchema }), AuthController.login);
authRoutes.post('/refresh', validate({ body: RefreshTokenSchema }), AuthController.refresh);

// Protected Session
authRoutes.post('/logout', requireAuth, AuthController.logout);

// Email Verification
authRoutes.post('/verify-email', validate({ body: VerifyEmailSchema }), AuthController.verifyEmail);
authRoutes.post(
  '/resend-verification',
  validate({ body: ResendVerificationSchema }),
  AuthController.resendVerification
);

// Password Reset Flow
authRoutes.post(
  '/forgot-password',
  validate({ body: ForgotPasswordSchema }),
  AuthController.forgotPassword
);
authRoutes.post(
  '/reset-password',
  validate({ body: ResetPasswordSchema }),
  AuthController.resetPassword
);

// Account Lifecycle. Reactivation is unauthenticated by necessity: a deleted user cannot obtain
// a token (login returns a status, not tokens), so this authenticates by password and issues a
// fresh pair. It is the only working restore path — User Service's POST /users/me/restore sits
// behind requireAuth and is unreachable once the caller's old access token expires.
accountRoutes.post(
  '/reactivate',
  validate({ body: ReactivateAccountSchema }),
  AuthController.reactivateAccount
);

// Google OAuth (Co-located on same server)
authRoutes.get('/google', AuthController.googleAuth);
authRoutes.get('/google/callback', AuthController.googleCallback);

// Phone OTP Verification
authRoutes.post(
  '/phone/send-otp',
  requireAuth,
  validate({ body: SendPhoneOtpSchema }),
  AuthController.sendPhoneOtp
);
authRoutes.post(
  '/phone/verify-otp',
  requireAuth,
  validate({ body: VerifyPhoneOtpSchema }),
  AuthController.verifyPhoneOtp
);
