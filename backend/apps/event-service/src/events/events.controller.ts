import {
  Body,
  Controller,
  Get,
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
}
