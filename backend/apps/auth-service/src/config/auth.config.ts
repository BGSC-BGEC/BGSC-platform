import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const authConfigValidationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required().not(Joi.ref('JWT_ACCESS_SECRET')).messages({
    'any.invalid': 'JWT_REFRESH_SECRET must be different from JWT_ACCESS_SECRET',
  }),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
  JWT_ISSUER: Joi.string().default('bgsc-auth-service'),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),
  OAUTH_FRONTEND_CALLBACK_URL: Joi.string().uri().optional(),
  AUTH_TOTP_ENCRYPTION_KEY: Joi.string().length(64).hex().required(),
  AUTH_TOTP_ISSUER: Joi.string().default('BGSC Platform'),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  SMTP_FROM: Joi.string().email().required(),
  CORS_ORIGINS: Joi.string().required(),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
});

export const authConfig = registerAs('auth', () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  env: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'bgsc-auth-service',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  oauth: {
    frontendCallbackUrl: process.env.OAUTH_FRONTEND_CALLBACK_URL,
  },
  totp: {
    encryptionKey: process.env.AUTH_TOTP_ENCRYPTION_KEY,
    issuer: process.env.AUTH_TOTP_ISSUER || 'BGSC Platform',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  },
  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },
}));
