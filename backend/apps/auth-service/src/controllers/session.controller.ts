import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { SessionService } from '../services/session.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { SessionResponseDto, SuccessMessageDto } from '../dto/responses.dto';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@ApiTags('Sessions')
@Controller('auth/sessions')
@UseGuards(RateLimitGuard, JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'sessions_list' })
  @ApiOperation({ summary: 'List all active sessions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of active sessions',
    type: [SessionResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listSessions(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const currentFamilyId = this.getFamilyIdFromRefreshCookie(req, user.sub);
    return this.sessionService.listSessions(user.sub, currentFamilyId);
  }

  @Delete(':familyId')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'sessions_revoke' })
  @ApiOperation({ summary: 'Revoke a specific session by familyId' })
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully',
    type: SuccessMessageDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot revoke the current session',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('familyId') familyId: string,
    @Req() req: Request,
  ) {
    const currentFamilyId = this.getFamilyIdFromRefreshCookie(req, user.sub);
    if (currentFamilyId && familyId === currentFamilyId) {
      throw new BadRequestException(
        'Cannot revoke the current session. Use /auth/logout instead.',
      );
    }

    await this.sessionService.revokeSession(user.sub, familyId);
    return { message: 'Session revoked successfully' };
  }

  private getFamilyIdFromRefreshCookie(
    req: Request,
    userId: string,
  ): string | undefined {
    const refreshToken = (req.cookies as Record<string, string>)?.[
      'bgsc_refresh_token'
    ];
    if (!refreshToken) {
      return undefined;
    }

    const parts = refreshToken.split('.');
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const randomHexRegex = /^[0-9a-f]{64}$/i;
    if (
      parts.length !== 3 ||
      !uuidRegex.test(parts[0]) ||
      !uuidRegex.test(parts[1]) ||
      !randomHexRegex.test(parts[2]) ||
      parts[0] !== userId
    ) {
      return undefined;
    }

    return parts[1];
  }
}
