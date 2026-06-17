import { UnauthorizedException } from '@nestjs/common';

export class TokenReuseDetectedException extends UnauthorizedException {
  constructor() {
    super('Session invalidated for security. Please log in again.');
  }
}
