import { SetMetadata } from '@nestjs/common';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyBy?: 'default' | 'email' | 'refreshToken';
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);
