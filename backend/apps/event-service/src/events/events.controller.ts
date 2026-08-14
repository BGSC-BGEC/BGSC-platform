import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CompleteEventDto } from './dto/complete-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import {
  RegistrationHistoryItemDto,
  UserEventStatsDto,
} from './dto/registration-history-response.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { SubmitScoresDto } from './dto/submit-scores.dto';
import { UserRole } from './enums/user-role.enum';
import { EventsService } from './events.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Query() query: ListEventsQueryDto): Promise<EventResponseDto[]> {
    return this.eventsService.findAll(query);
  }

  /**
   * M1.3 — Paginated event registration history for the authenticated user.
   * Called directly by the mobile frontend (JWT protected at gateway + service level).
   */
  @Get('me/registrations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMyRegistrations(
    @Request() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<RegistrationHistoryItemDto[]> {
    return this.eventsService.getMyRegistrations(
      req.user.id,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, parseInt(limit, 10) || 20),
    );
  }

  /**
   * M1.3 — Total registration + win counts for the authenticated user's profile.
   * Called directly by the mobile frontend (JWT protected at gateway + service level).
   */
  @Get('me/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMyEventStats(@Request() req: AuthRequest): Promise<UserEventStatsDto> {
    return this.eventsService.getMyEventStats(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EventResponseDto> {
    return this.eventsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  create(
    @Body() dto: CreateEventDto,
    @Request() req: AuthRequest,
  ): Promise<EventResponseDto> {
    return this.eventsService.create(dto, req.user.id);
  }

  @Post(':id/register')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  register(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<RegistrationResponseDto> {
    return this.eventsService.register(id, req.user.id);
  }

  @Post(':id/scores')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  submitScores(
    @Param('id') id: string,
    @Body() dto: SubmitScoresDto,
    @Request() req: AuthRequest,
  ): Promise<LeaderboardEntryDto[]> {
    return this.eventsService.submitScores(id, dto, req.user.id);
  }

  @Get(':id/leaderboard')
  getLeaderboard(@Param('id') id: string): Promise<LeaderboardEntryDto[]> {
    return this.eventsService.getLeaderboard(id);
  }

  @Patch(':id/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteEventDto,
    @Request() req: AuthRequest,
  ): Promise<EventResponseDto> {
    return this.eventsService.complete(id, dto, req.user.id);
  }

  @Get(':id/my-registration')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMyRegistration(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<RegistrationResponseDto | null> {
    return this.eventsService.getMyRegistrationForEvent(id, req.user.id);
  }

  @Delete(':id/registrations/:registrationId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  withdrawRegistration(
    @Param('id') id: string,
    @Param('registrationId') registrationId: string,
    @Request() req: AuthRequest,
  ): Promise<void> {
    return this.eventsService.withdrawRegistration(id, registrationId, req.user.id);
  }

  @Post(':id/captain-application')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  applyCaptain(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<{ status: 'pending' }> {
    return this.eventsService.applyCaptain(id, req.user.id);
  }
}
