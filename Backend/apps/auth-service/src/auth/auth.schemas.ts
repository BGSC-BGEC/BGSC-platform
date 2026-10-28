import { z } from 'zod';
import { RESERVED_USERNAMES, phoneNumberSchema } from '@bgsc/shared';

// `.trim()` first throughout: zod runs checks in order, so `.min(2).trim()` measured the untrimmed
// value and a name of three spaces passed validation to fail as a 500 at the database.

/** bcrypt reads the first 72 BYTES and ignores the rest, so a longer password is not what it seems. */
const password = (field: string) =>
  z
    .string()
    .min(8, { message: `${field} must be at least 8 characters` })
    .refine((s) => Buffer.byteLength(s, 'utf8') <= 72, { message: `${field} must be at most 72 bytes` });

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'username must be alphanumeric with underscores only',
    })
    .refine((u) => !RESERVED_USERNAMES.includes(u), { message: 'username is reserved' }),
  password: password('password'),
  full_name: z.string().trim().min(2).max(120),
});

export const LoginSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

/** Logout by refresh token too: once the access token has expired, it is all the client holds. */
export const LogoutSchema = z.object({ refresh_token: z.string().min(1).optional() }).optional();

const mailCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: 'otp must be exactly 6 digits' });

export const VerifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: mailCode,
});

export const ResendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: mailCode,
  new_password: password('new_password'),
});

export const ReactivateAccountSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

export const SendPhoneOtpSchema = z.object({
  phone_number: phoneNumberSchema,
});

export const VerifyPhoneOtpSchema = z.object({
  phone_number: phoneNumberSchema,
  otp: mailCode,
});

export const GoogleExchangeSchema = z.object({
  login_code: z.string().regex(/^[0-9a-f]{64}$/),
  // RFC 7636 §4.1. Present exactly when the sign-in was started by the app with a code_challenge.
  code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/).optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ReactivateAccountInput = z.infer<typeof ReactivateAccountSchema>;
export type SendPhoneOtpInput = z.infer<typeof SendPhoneOtpSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof VerifyPhoneOtpSchema>;
