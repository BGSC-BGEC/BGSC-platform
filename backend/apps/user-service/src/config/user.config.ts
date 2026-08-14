import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const userConfigValidationSchema = Joi.object({
  PORT: Joi.number().default(3002),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ISSUER: Joi.string().required(),
  EVENT_SERVICE_URL: Joi.string().uri().default('http://localhost:3003'),
  STRAVA_CLIENT_ID: Joi.string().required(),
  STRAVA_CLIENT_SECRET: Joi.string().required(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: Joi.string().min(16).required(),
  STRAVA_TOKEN_ENCRYPTION_KEY: Joi.string().length(64).hex().required(),
  INTERNAL_SERVICE_KEY: Joi.string().min(32).required(),
});

export const userConfig = registerAs('user', () => ({
  port: parseInt(process.env.PORT ?? '3002', 10),
  env: process.env.NODE_ENV ?? 'development',
  db: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    issuer: process.env.JWT_ISSUER,
  },
  eventServiceUrl: process.env.EVENT_SERVICE_URL ?? 'http://localhost:3003',
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
    tokenEncryptionKey: process.env.STRAVA_TOKEN_ENCRYPTION_KEY,
  },
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY,
}));
