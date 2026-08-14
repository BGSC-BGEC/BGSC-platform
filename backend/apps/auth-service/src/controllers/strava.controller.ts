import {
  Controller,
  Delete,
  Get,
  Headers,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StravaService } from '../services/strava.service';

@ApiTags('Strava Integration')
@Controller('auth/strava')
export class StravaController {
  private readonly frontendCallbackUrl: string;

  constructor(
    private readonly stravaService: StravaService,
    private readonly configService: ConfigService,
  ) {
    this.frontendCallbackUrl =
      configService.get<string>('auth.oauth.frontendCallbackUrl') ||
      'https://bgsc-platform.in';
  }

  @Get('connect')
  @ApiOperation({ summary: 'Initiate Strava OAuth account linking' })
  @ApiResponse({ status: 302, description: 'Redirect to Strava consent screen' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  async connect(
    @Headers('authorization') authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const userId = this.stravaService.extractUserIdFromBearer(authHeader);
    const state = await this.stravaService.generateState(userId);
    const url = this.stravaService.buildAuthorizationUrl(state);
    return res.redirect(302, url);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle Strava OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirect to frontend with result' })
  @ApiResponse({ status: 400, description: 'Missing or invalid code/state' })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const failUrl = `${this.frontendCallbackUrl}/settings/integrations?strava=error`;

    if (error || !code || !state) {
      return res.redirect(302, failUrl);
    }

    let userId: string;
    try {
      userId = await this.stravaService.consumeState(state);
    } catch {
      return res.redirect(302, failUrl);
    }

    try {
      const tokens = await this.stravaService.exchangeCode(code);
      await this.stravaService.linkToUserService({
        userId,
        athleteId: String(tokens.athlete.id),
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
        scope: 'activity:read_all,profile:read_all',
      });
    } catch {
      return res.redirect(302, failUrl);
    }

    return res.redirect(
      302,
      `${this.frontendCallbackUrl}/settings/integrations?strava=connected`,
    );
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Unlink Strava from the current account' })
  @ApiResponse({ status: 200, description: 'Strava account unlinked' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  async disconnect(
    @Headers('authorization') authHeader: string | undefined,
  ) {
    const userId = this.stravaService.extractUserIdFromBearer(authHeader);
    await this.stravaService.unlinkFromUserService(userId);
    return { message: 'Strava account disconnected' };
  }
}
