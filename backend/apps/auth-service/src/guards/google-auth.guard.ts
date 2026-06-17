import {
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { isObservable, lastValueFrom } from 'rxjs';

type OAuthRequest = Request & {
  oauthState?: string;
};

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OAuthRequest>();

    if (this.isCallbackRequest(request)) {
      await this.validateState(request);
    } else {
      const state = randomBytes(32).toString('hex');
      request.oauthState = state;

      await this.redis.set(this.getStateKey(state), '1', 'EX', 10 * 60);
    }

    const activation = super.canActivate(context);

    if (typeof activation === 'boolean') {
      return activation;
    }

    if (isObservable(activation)) {
      return lastValueFrom(activation);
    }

    return activation;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<OAuthRequest>();

    return {
      scope: ['openid', 'email', 'profile'],
      session: false,
      state: request.oauthState,
    };
  }

  private async validateState(request: OAuthRequest): Promise<void> {
    const state = request.query?.state;
    if (typeof state !== 'string' || state.length === 0) {
      throw new UnauthorizedException('Missing OAuth state parameter');
    }

    const stored = await this.redis.get(this.getStateKey(state));
    if (!stored) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }

    await this.redis.del(this.getStateKey(state));
  }

  private isCallbackRequest(request: Request): boolean {
    return typeof request.query?.code === 'string';
  }

  private getStateKey(state: string): string {
    return `auth:oauth:google:state:${state}`;
  }
}
