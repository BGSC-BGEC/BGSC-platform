import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw (err as Error) || new UnauthorizedException('Invalid or missing token');
    }
    return user;
  }
}
