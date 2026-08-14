import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const pointsConfigValidationSchema = Joi.object({
  PORT: Joi.number().default(3005),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ISSUER: Joi.string().required(),
});

export const pointsConfig = registerAs('points', () => ({
  port: parseInt(process.env.PORT ?? '3005', 10),
  env: process.env.NODE_ENV ?? 'development',
  db: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    issuer: process.env.JWT_ISSUER,
  },
}));
