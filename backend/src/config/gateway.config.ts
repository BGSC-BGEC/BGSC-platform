import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const gatewayConfigValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  REDIS_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ISSUER: Joi.string().default('bgsc-auth-service'),
  AUTH_SERVICE_URL: Joi.string().uri().required(),
  USER_SERVICE_URL: Joi.string().uri().required(),
  SPONSOR_SERVICE_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().default(''),
  RATE_LIMIT_GENERAL_MAX: Joi.number().integer().min(1).default(100),
  RATE_LIMIT_GENERAL_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(60 * 1000),
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().min(1).default(5),
  RATE_LIMIT_AUTH_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .default(15 * 60 * 1000),
  PROXY_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(30 * 1000),
});

export const gatewayConfig = registerAs('gateway', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    issuer: process.env.JWT_ISSUER || 'bgsc-auth-service',
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL,
    user: process.env.USER_SERVICE_URL,
    sponsor: process.env.SPONSOR_SERVICE_URL,
  },
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [],
  },
  rateLimit: {
    general: {
      max: parseInt(process.env.RATE_LIMIT_GENERAL_MAX || '100', 10),
      windowMs: parseInt(
        process.env.RATE_LIMIT_GENERAL_WINDOW_MS || `${60 * 1000}`,
        10,
      ),
    },
    auth: {
      max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5', 10),
      windowMs: parseInt(
        process.env.RATE_LIMIT_AUTH_WINDOW_MS || `${15 * 60 * 1000}`,
        10,
      ),
    },
  },
  proxyTimeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS || `${30 * 1000}`, 10),
}));
