import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUserId } from '../rbac/current-user-id.decorator';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { EventHistoryItemDto } from './dto/event-history-response.dto';
import { EventSuggestionResponseDto } from './dto/event-suggestion-response.dto';
import { ExtendedProfileResponseDto } from './dto/extended-profile-response.dto';
import { FriendSuggestionResponseDto } from './dto/friend-suggestion-response.dto';
import { PlayerCardResponseDto } from './dto/player-card-response.dto';
import { PublicProfileDto } from './dto/public-profile.dto';
import { SelectSponsorDto } from './dto/select-sponsor.dto';
import { SponsorStatsResponseDto } from './dto/sponsor-stats-response.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { InterestEntry } from './interests.catalog';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { UsersService } from './users.service';

const ALL_USER_ROLES = [
  UserRole.USER,
  UserRole.MEMBER,
  UserRole.CORE,
  UserRole.COORDINATOR,
  UserRole.FOUNDER,
];

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  findAll(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAll({
      role,
      status,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(200, Math.max(1, parseInt(limit, 10) || 50)),
    });
  }

  @Patch(':id')
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  remove(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.remove(id);
  }

  // ─── Interests Catalog (public read) ─────────────────────────────────────────

  @Get('interests')
  @Roles(...ALL_USER_ROLES)
  getInterests(): InterestEntry[] {
    return this.usersService.getInterestsCatalog();
  }

  // ─── /me endpoints (all authenticated roles) ─────────────────────────────────

  @Get('me')
  @Roles(...ALL_USER_ROLES)
  findMe(@CurrentUserId() userId?: string): Promise<UserResponseDto> {
    return this.usersService.findOne(this.requireUserId(userId));
  }

  @Patch('me')
  @Roles(...ALL_USER_ROLES)
  updateMe(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: UpdateMeDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(this.requireUserId(userId), dto);
  }

  @Post('me/sponsor')
  @Roles(...ALL_USER_ROLES)
  selectSponsor(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: SelectSponsorDto,
  ): Promise<UserResponseDto> {
    return this.usersService.selectSponsor(this.requireUserId(userId), dto.sponsorId);
  }

  /** M1.3: Extended profile with bio, interests, social links, computed stats. */
  @Get('me/profile')
  @Roles(...ALL_USER_ROLES)
  getProfile(@CurrentUserId() userId?: string): Promise<ExtendedProfileResponseDto> {
    return this.usersService.getExtendedProfile(this.requireUserId(userId));
  }

  /** M1.3: Update profile fields (bio, displayName, interests, socialLinks, etc.). */
  @Patch('me/profile')
  @Roles(...ALL_USER_ROLES)
  updateProfile(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: UpdateProfileDto,
  ): Promise<ExtendedProfileResponseDto> {
    return this.usersService.updateProfile(this.requireUserId(userId), dto);
  }

  /** M1.3: Update interest IDs only. */
  @Patch('me/interests')
  @Roles(...ALL_USER_ROLES)
  updateInterests(
    @CurrentUserId() userId: string | undefined,
    @Body('interests') interests: string[],
  ): Promise<ExtendedProfileResponseDto> {
    return this.usersService.updateInterests(this.requireUserId(userId), interests ?? []);
  }

  /** M1.3: Sponsor stats for current affiliation. Returns null if no sponsor selected. */
  @Get('me/sponsor-stats')
  @Roles(...ALL_USER_ROLES)
  getSponsorStats(
    @CurrentUserId() userId?: string,
  ): Promise<SponsorStatsResponseDto | null> {
    return this.usersService.getSponsorStats(this.requireUserId(userId));
  }

  /** M1.3: Player card JSON for shareable card generation. */
  @Get('me/player-card')
  @Roles(...ALL_USER_ROLES)
  getPlayerCard(@CurrentUserId() userId?: string): Promise<PlayerCardResponseDto> {
    return this.usersService.getPlayerCard(this.requireUserId(userId));
  }

  /** M1.3: Upcoming events personalised to user interests. */
  @Get('me/event-suggestions')
  @Roles(...ALL_USER_ROLES)
  getEventSuggestions(
    @CurrentUserId() userId?: string,
  ): Promise<EventSuggestionResponseDto[]> {
    return this.usersService.getEventSuggestions(this.requireUserId(userId));
  }

  /** M1.3: Friend suggestions — Phase 2 stub, always returns []. */
  @Get('me/friend-suggestions')
  @Roles(...ALL_USER_ROLES)
  getFriendSuggestions(@CurrentUserId() userId?: string): FriendSuggestionResponseDto[] {
    return this.usersService.getFriendSuggestions(this.requireUserId(userId));
  }

  /** M1.3: Paginated event registration history. */
  @Get('me/history/events')
  @Roles(...ALL_USER_ROLES)
  getEventHistory(
    @CurrentUserId() userId: string | undefined,
    @Query('page') page = '1',
  ): EventHistoryItemDto[] {
    return this.usersService.getEventHistory(
      this.requireUserId(userId),
      Math.max(1, parseInt(page, 10)),
    );
  }

  /** M1.3: Match history — Phase 3 stub, always returns []. */
  @Get('me/history/matches')
  @Roles(...ALL_USER_ROLES)
  getMatchHistory(@CurrentUserId() userId?: string): unknown[] {
    return this.usersService.getMatchHistory(this.requireUserId(userId), 1);
  }

  /** M1.3: Challenge history — Phase 2 stub, always returns []. */
  @Get('me/history/challenges')
  @Roles(...ALL_USER_ROLES)
  getChallengeHistory(@CurrentUserId() userId?: string): unknown[] {
    return this.usersService.getChallengeHistory(this.requireUserId(userId), 1);
  }

  /** M1.3: Sponsor contribution timeline — Phase 2 stub pending fan_transactions table. */
  @Get('me/history/sponsor')
  @Roles(...ALL_USER_ROLES)
  getSponsorHistory(@CurrentUserId() userId?: string): unknown[] {
    return this.usersService.getSponsorHistory(this.requireUserId(userId), 1);
  }

  // ─── Public profile lookup ────────────────────────────────────────────────────

  @Get(':id')
  @Roles(...ALL_USER_ROLES)
  findOne(@Param('id') id: string): Promise<PublicProfileDto> {
    return this.usersService.findPublicProfile(id);
  }

  // ─── Helper ───────────────────────────────────────────────────────────────────

  private requireUserId(userId?: string): string {
    if (!userId) throw new UnauthorizedException('Missing authenticated user id');
    return userId;
  }
}
