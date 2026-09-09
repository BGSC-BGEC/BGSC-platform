import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'username must be alphanumeric with underscores only',
    })
    .trim()
    .toLowerCase(),
  password: z.string().min(8, { message: 'password must be at least 8 characters' }),
  full_name: z.string().min(2).trim(),
});

export const LoginSchema = z.object({
  login: z.string().min(1).trim(),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8, { message: 'new_password must be at least 8 characters' }),
});

export const ReactivateAccountSchema = z.object({
  login: z.string().min(1).trim(),
  password: z.string().min(1),
});

export const SendPhoneOtpSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, {
      message: 'phone_number must be a valid phone number (e.g. +919876543210)',
    }),
});

export const VerifyPhoneOtpSchema = z.object({
  phone_number: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{9,14}$/, {
      message: 'phone_number must be a valid phone number',
    }),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: 'otp must be exactly 6 digits' }),
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
