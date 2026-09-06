import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/requireAuth';
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

export const authRoutes = Router();

// Public Credentials & Session
authRoutes.post('/register', validate({ body: RegisterSchema }), AuthController.register);
authRoutes.post('/login', validate({ body: LoginSchema }), AuthController.login);
authRoutes.post('/refresh', validate({ body: RefreshTokenSchema }), AuthController.refresh);

// Protected Session & Identity
authRoutes.post('/logout', requireAuth, AuthController.logout);
authRoutes.get('/me', requireAuth, AuthController.me);

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

// Account Lifecycle (45-day restoration grace period)
authRoutes.post('/account/delete', requireAuth, AuthController.deleteAccount);
authRoutes.post(
  '/account/reactivate',
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
