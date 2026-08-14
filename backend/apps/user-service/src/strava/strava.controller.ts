import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUserId } from '../rbac/current-user-id.decorator';
import { StravaService } from './strava.service';

@ApiTags('Strava')
@Controller('strava')
export class StravaController {
  constructor(private readonly stravaService: StravaService) {}

  // ─── Webhook verification (GET) — Strava hub challenge ───────────────────────

  @Get('webhook')
  @ApiOperation({ summary: 'Strava webhook verification challenge' })
  webhookVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const accepted = this.stravaService.verifyWebhookChallenge(mode, verifyToken, challenge);
    return res.status(200).json({ 'hub.challenge': accepted });
  }

  // ─── Webhook event receiver (POST) ───────────────────────────────────────────

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Strava activity push events' })
  async webhookEvent(
    @Body()
    body: {
      object_type: string;
      object_id: number;
      aspect_type: string;
      owner_id: number;
    },
  ) {
    // Respond immediately; processing is async fire-and-forget.
    void this.stravaService.handleWebhookEvent(body).catch(() => {});
    return { received: true };
  }

  // ─── Internal: link / unlink (called by auth-service) ────────────────────────

  @Post('internal/link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal: persist Strava tokens for a user' })
  async internalLink(
    @Headers('x-service-key') serviceKey: string,
    @Body()
    body: {
      userId: string;
      athleteId: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      scope: string;
    },
  ) {
    this.stravaService.verifyServiceKey(serviceKey);
    await this.stravaService.linkAccount(
      body.userId,
      body.athleteId,
      body.accessToken,
      body.refreshToken,
      body.expiresAt,
      body.scope,
    );
    return { linked: true };
  }

  @Delete('internal/unlink/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal: remove Strava tokens for a user' })
  async internalUnlink(
    @Headers('x-service-key') serviceKey: string,
    @Param('userId') userId: string,
  ) {
    this.stravaService.verifyServiceKey(serviceKey);
    await this.stravaService.unlinkAccount(userId);
    return { unlinked: true };
  }

  // ─── Public: activity feed & stats ───────────────────────────────────────────

  @Get('me/activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user Strava activity feed' })
  @ApiResponse({ status: 200, description: 'Paginated activity list' })
  async myActivities(
    @CurrentUserId() userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.stravaService.getActivities(userId, Number(page), Math.min(Number(limit), 100));
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user weekly Strava stats' })
  async myStats(@CurrentUserId() userId: string) {
    return this.stravaService.getWeeklyStats(userId);
  }

  @Get('me/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user has Strava connected' })
  async myStatus(@CurrentUserId() userId: string) {
    return { connected: await this.stravaService.isConnected(userId) };
  }

  @Get(':userId/activities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get another user Strava activity feed (public)' })
  async userActivities(
    @Param('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.stravaService.getActivities(userId, Number(page), Math.min(Number(limit), 100));
  }
}
