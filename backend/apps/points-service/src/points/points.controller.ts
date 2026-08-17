import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { AwardAttendanceDto, AwardPointsDto } from './dto/award-points.dto';
import { PointsBalanceResponseDto } from './dto/points-balance-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { UserRole } from './enums/user-role.enum';
import { PointsService } from './points.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

const ADMIN_ROLES: UserRole[] = [
  UserRole.COORDINATOR,
  UserRole.FOUNDER,
  UserRole.CORE,
];

@ApiTags('points')
@Controller('points')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('me/balance')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get authenticated user's points balance" })
  getMyBalance(@Request() req: AuthRequest): Promise<PointsBalanceResponseDto> {
    return this.pointsService.getBalance(req.user.id);
  }

  @Get('me/transactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get authenticated user's transaction history" })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['event', 'challenge', 'store', 'leaderboard'],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['earn', 'spend', 'refund'],
  })
  getMyTransactions(
    @Request() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('source') source?: string,
    @Query('type') type?: string,
  ): Promise<TransactionResponseDto[]> {
    return this.pointsService.getMyTransactions(
      req.user.id,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      source,
      type,
    );
  }

  @Get('balance/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get any user's points balance (self or admin)" })
  getBalance(
    @Param('userId') userId: string,
    @Request() req: AuthRequest,
  ): Promise<PointsBalanceResponseDto> {
    if (req.user.id !== userId && !ADMIN_ROLES.includes(req.user.role)) {
      throw new ForbiddenException("Cannot view another user's balance");
    }
    return this.pointsService.getBalance(userId);
  }

  @Get('transactions/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: "Get any user's transaction history (admin only)" })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['event', 'challenge', 'store', 'leaderboard'],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['earn', 'spend', 'refund'],
  })
  getTransactionsForUser(
    @Param('userId') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('source') source?: string,
    @Query('type') type?: string,
  ): Promise<TransactionResponseDto[]> {
    return this.pointsService.getTransactionsForUser(
      userId,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      source,
      type,
    );
  }

  @Post('award')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Award points to a user (admin only)' })
  award(@Body() dto: AwardPointsDto): Promise<TransactionResponseDto> {
    return this.pointsService.award(dto);
  }

  @Post('internal/attendance')
  awardAttendance(
    @Headers('x-internal-key') key: string | undefined,
    @Body() dto: AwardAttendanceDto,
  ): Promise<TransactionResponseDto> {
    const expected = this.configService.get<string>(
      'points.internalServiceKey',
      '',
    );
    const providedBuffer = Buffer.from(key ?? '');
    const expectedBuffer = Buffer.from(expected);
    if (
      expectedBuffer.length === 0 ||
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException('Invalid internal service key');
    }
    return this.pointsService.awardAttendance(
      dto.registrationId,
      dto.userId,
      dto.eventId,
    );
  }
}
