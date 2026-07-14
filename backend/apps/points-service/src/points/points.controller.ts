import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { AwardParticipationDto, AwardPointsDto } from './dto/award-points.dto';
import { PointsBalanceResponseDto } from './dto/points-balance-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { UserRole } from './enums/user-role.enum';
import { PointsService } from './points.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

const ADMIN_ROLES: UserRole[] = [UserRole.COORDINATOR, UserRole.FOUNDER, UserRole.CORE];

@ApiTags('points')
@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('me/balance')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMyBalance(@Request() req: AuthRequest): Promise<PointsBalanceResponseDto> {
    return this.pointsService.getBalance(req.user.id);
  }

  @Get('me/transactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMyTransactions(
    @Request() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<TransactionResponseDto[]> {
    return this.pointsService.getMyTransactions(
      req.user.id,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    );
  }

  @Get('balance/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getBalance(
    @Param('userId') userId: string,
    @Request() req: AuthRequest,
  ): Promise<PointsBalanceResponseDto> {
    if (req.user.id !== userId && !ADMIN_ROLES.includes(req.user.role)) {
      throw new ForbiddenException('Cannot view another user\'s balance');
    }
    return this.pointsService.getBalance(userId);
  }

  @Post('award')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  award(@Body() dto: AwardPointsDto): Promise<TransactionResponseDto> {
    return this.pointsService.award(dto);
  }

  @Post('participation')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  awardParticipation(
    @Body() dto: AwardParticipationDto,
  ): Promise<TransactionResponseDto> {
    return this.pointsService.awardParticipation(dto.userId, dto.eventId);
  }
}
