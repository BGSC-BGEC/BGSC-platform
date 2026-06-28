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
}));
