import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
  };
}

export interface StravaConnectPayload {
  userId: string;
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly userServiceUrl: string;
  private readonly internalServiceKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.clientId = configService.get<string>('auth.strava.clientId')!;
    this.clientSecret = configService.get<string>('auth.strava.clientSecret')!;
    this.callbackUrl = configService.get<string>('auth.strava.callbackUrl')!;
    this.userServiceUrl = configService.get<string>('auth.userServiceUrl')!;
    this.internalServiceKey = configService.get<string>('auth.internalServiceKey')!;
  }

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'activity:read_all,profile:read_all',
      state,
    });
    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  async generateState(userId: string): Promise<string> {
    const nonce = randomBytes(32).toString('hex');
    await this.redis.set(
      `auth:oauth:strava:state:${nonce}`,
      userId,
      'EX',
      600, // 10 minutes
    );
    return nonce;
  }

  async consumeState(nonce: string): Promise<string> {
    const key = `auth:oauth:strava:state:${nonce}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
    await this.redis.del(key);
    return userId;
  }

  async exchangeCode(code: string): Promise<StravaTokenResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<StravaTokenResponse>(
          'https://www.strava.com/oauth/token',
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code,
            grant_type: 'authorization_code',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
      return response.data;
    } catch {
      throw new BadRequestException('Failed to exchange Strava authorization code');
    }
  }

  async linkToUserService(payload: StravaConnectPayload): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.userServiceUrl}/strava/internal/link`,
          payload,
          { headers: { 'x-service-key': this.internalServiceKey } },
        ),
      );
    } catch (err) {
      this.logger.error('Failed to link Strava to user-service', err);
      throw new InternalServerErrorException('Could not persist Strava connection');
    }
  }

  async unlinkFromUserService(userId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.userServiceUrl}/strava/internal/unlink/${userId}`,
          { headers: { 'x-service-key': this.internalServiceKey } },
        ),
      );
    } catch (err) {
      this.logger.error('Failed to unlink Strava from user-service', err);
      throw new InternalServerErrorException('Could not remove Strava connection');
    }
  }

  async deauthorizeOnStrava(accessToken: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          'https://www.strava.com/oauth/deauthorize',
          new URLSearchParams({ access_token: accessToken }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
    } catch {
      // Non-fatal — token may already be expired or revoked on Strava's side.
      this.logger.warn('Strava deauthorize call failed (non-fatal)');
    }
  }

  extractUserIdFromBearer(authHeader: string | undefined): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('auth.jwt.accessSecret'),
        issuer:
          this.configService.get<string>('auth.jwt.issuer') || 'bgsc-auth-service',
      });
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
