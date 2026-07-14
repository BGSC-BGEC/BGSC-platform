import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { EventHistoryItemDto } from './dto/event-history-response.dto';
import {
  EventSuggestionResponseDto,
} from './dto/event-suggestion-response.dto';
import {
  ExtendedProfileResponseDto,
  ProfileInterestDto,
  SocialLinkDto,
} from './dto/extended-profile-response.dto';
import { FriendSuggestionResponseDto } from './dto/friend-suggestion-response.dto';
import { PlayerCardResponseDto } from './dto/player-card-response.dto';
import { PublicProfileDto } from './dto/public-profile.dto';
import { SelectSponsorDto } from './dto/select-sponsor.dto';
import { SponsorStatsResponseDto } from './dto/sponsor-stats-response.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Sponsor } from './entities/sponsor.entity';
import { User } from './entities/user.entity';
import { UserSponsorAffiliation } from './entities/user-sponsor-affiliation.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import {
  INTERESTS_CATALOG,
  INTEREST_ID_SET,
  InterestEntry,
} from './interests.catalog';

function getCurrentSemesterStart(): Date {
  const now = new Date();
  const year = now.getFullYear();
  if (now.getMonth() < 6) {
    return new Date(year, 0, 1);
  }
  return new Date(year, 6, 1);
}

/** Maps stored interest IDs to catalog entries; unknown IDs are silently dropped. */
function resolveInterests(ids: string[]): ProfileInterestDto[] {
  return ids
    .map((id) => INTERESTS_CATALOG.find((i) => i.id === id))
    .filter((i): i is InterestEntry => i !== undefined);
}

/** Converts socials jsonb `{platform: url}` → SocialLinkDto[]. */
function parseSocialLinks(socials: Record<string, string>): SocialLinkDto[] {
  return Object.entries(socials).map(([platform, url]) => ({ platform, url }));
}

/** Converts SocialLinkDto[] → socials jsonb `{platform: url}`. */
function serializeSocialLinks(
  links: Array<{ platform: string; url: string }>,
): Record<string, string> {
  return Object.fromEntries(links.map((l) => [l.platform, l.url]));
}

@Injectable()
export class UsersService {
  private readonly eventServiceUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Sponsor)
    private readonly sponsorsRepository: Repository<Sponsor>,
    @InjectRepository(UserSponsorAffiliation)
    private readonly affiliationsRepository: Repository<UserSponsorAffiliation>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.eventServiceUrl =
      this.configService.get<string>('user.eventServiceUrl') ??
      'http://localhost:3003';
  }

  // ─── Existing CRUD ──────────────────────────────────────────────────────────

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = this.usersRepository.create({
      ...createUserDto,
      role: createUserDto.role ?? UserRole.USER,
      status: createUserDto.status ?? UserStatus.ACTIVE,
    });

    try {
      return this.toResponse(await this.usersRepository.save(user));
    } catch (error) {
      this.throwConflictForUniqueViolation(error);
      throw error;
    }
  }

  async findAll(filters?: {
    role?: UserRole;
    status?: UserStatus;
    page?: number;
    limit?: number;
  }): Promise<UserResponseDto[]> {
    const { page = 1, limit = 50, ...where } = filters ?? {};
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
      where,
      skip: (page - 1) * limit,
      take: limit,
    });

    return users.map((user) => this.toResponse(user));
  }

  async findPublicProfile(id: string): Promise<PublicProfileDto> {
    const user = await this.findEntity(id);
    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      interests: user.interests,
      socials: user.socials,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.findEntity(id);
    Object.assign(user, updateUserDto);

    try {
      await this.usersRepository.save(user);
      return this.findOne(id);
    } catch (error) {
      this.throwConflictForUniqueViolation(error);
      throw error;
    }
  }

  async updateMe(id: string, updateMeDto: UpdateMeDto): Promise<UserResponseDto> {
    return this.update(id, updateMeDto);
  }

  async remove(id: string): Promise<UserResponseDto> {
    const user = await this.findEntity(id);
    user.status = UserStatus.DELETED;
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async selectSponsor(userId: string, sponsorId: string): Promise<UserResponseDto> {
    const user = await this.findEntity(userId);

    const sponsor = await this.sponsorsRepository.findOneBy({ id: sponsorId });
    if (!sponsor) throw new NotFoundException('Sponsor not found');
    if (sponsor.status !== 'active')
      throw new BadRequestException('Sponsor is not active');

    const today = new Date().toISOString().slice(0, 10);
    if (sponsor.tenureStart > today)
      throw new BadRequestException('Sponsor tenure has not started yet');
    if (sponsor.tenureEnd && sponsor.tenureEnd < today)
      throw new BadRequestException('Sponsor tenure has ended');

    if (user.activeSponsorId === sponsorId) return this.findOne(userId);

    const isFirstSelection = !user.activeSponsorId;
    if (!isFirstSelection && user.lastSponsorChange) {
      const semesterStart = getCurrentSemesterStart();
      if (new Date(user.lastSponsorChange) >= semesterStart) {
        throw new BadRequestException(
          'You can only change your sponsor once per semester',
        );
      }
    }

    user.activeSponsorId = sponsorId;
    if (!isFirstSelection) user.lastSponsorChange = new Date();
    await this.usersRepository.save(user);

    const existing = await this.affiliationsRepository.findOneBy({ userId, sponsorId });
    if (!existing) {
      await this.affiliationsRepository.save(
        this.affiliationsRepository.create({ userId, sponsorId, affiliatedAt: new Date() }),
      );
    }

    return this.findOne(userId);
  }

  // ─── M1.3: Extended Profile ──────────────────────────────────────────────────

  async getExtendedProfile(userId: string): Promise<ExtendedProfileResponseDto> {
    const user = await this.findEntity(userId);

    // Fan count from current sponsor affiliation
    let totalFans = 0;
    if (user.activeSponsorId) {
      const affil = await this.affiliationsRepository.findOneBy({
        userId,
        sponsorId: user.activeSponsorId,
      });
      totalFans = affil?.fanCount ?? 0;
    }

    // totalEvents/totalWins: frontend fetches these directly from GET /events/me/stats
    // (JWT-protected event-service endpoint). Returning 0 here; profile card uses
    // the dedicated player-card endpoint which also returns 0 until Phase 2 adds
    // a proper service-to-service auth token exchange.
    const totalEvents = 0;
    const totalWins = 0;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      contact: user.contact,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      interests: resolveInterests(user.interests),
      customTags: user.customTags,
      friendTags: [], // Phase 2: social service
      socialLinks: parseSocialLinks(user.socials),
      newsletterSubscriptions: user.newsletterSubscriptions,
      activeSponsorId: user.activeSponsorId,
      pointsBalance: user.pointsBalance,
      totalEvents,
      totalWins,
      totalFans,
      rating: null, // Phase 2: rating system
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ExtendedProfileResponseDto> {
    const user = await this.findEntity(userId);

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.contact !== undefined) user.contact = dto.contact;
    if (dto.newsletterSubscriptions !== undefined)
      user.newsletterSubscriptions = dto.newsletterSubscriptions;
    if (dto.customTags !== undefined) user.customTags = dto.customTags;

    if (dto.interests !== undefined) {
      const invalid = dto.interests.filter((id) => !INTEREST_ID_SET.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Unknown interest IDs: ${invalid.join(', ')}`,
        );
      }
      user.interests = dto.interests;
    }

    if (dto.socialLinks !== undefined) {
      user.socials = serializeSocialLinks(dto.socialLinks);
    }

    await this.usersRepository.save(user);
    return this.getExtendedProfile(userId);
  }

  // ─── M1.3: Interests Catalog ─────────────────────────────────────────────────

  getInterestsCatalog(): typeof INTERESTS_CATALOG {
    return INTERESTS_CATALOG;
  }

  async updateInterests(userId: string, interestIds: string[]): Promise<ExtendedProfileResponseDto> {
    const invalid = interestIds.filter((id) => !INTEREST_ID_SET.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unknown interest IDs: ${invalid.join(', ')}`);
    }
    const user = await this.findEntity(userId);
    user.interests = interestIds;
    await this.usersRepository.save(user);
    return this.getExtendedProfile(userId);
  }

  // ─── M1.3: Sponsor Stats ──────────────────────────────────────────────────────

  async getSponsorStats(userId: string): Promise<SponsorStatsResponseDto | null> {
    const user = await this.findEntity(userId);
    if (!user.activeSponsorId) return null;

    const sponsor = await this.sponsorsRepository.findOneBy({ id: user.activeSponsorId });
    if (!sponsor) return null;

    const affil = await this.affiliationsRepository.findOneBy({
      userId,
      sponsorId: user.activeSponsorId,
    });

    const totalAffiliates = await this.affiliationsRepository.count({
      where: { sponsorId: user.activeSponsorId },
    });

    // Rank = number of affiliates with strictly higher fan count + 1
    const higherCount = await this.affiliationsRepository
      .createQueryBuilder('a')
      .where('a.sponsorId = :sponsorId', { sponsorId: user.activeSponsorId })
      .andWhere('a.fanCount > :fanCount', { fanCount: affil?.fanCount ?? 0 })
      .getCount();

    return {
      sponsorId: user.activeSponsorId,
      sponsorName: sponsor.name,
      sponsorLogoUrl: sponsor.logoUrl,
      rank: higherCount + 1,
      totalAffiliates,
      fansContributed: affil?.fanCount ?? 0,
      eventsWon: affil?.eventsWon?.length ?? 0,
    };
  }

  // ─── M1.3: Player Card ────────────────────────────────────────────────────────

  async getPlayerCard(userId: string): Promise<PlayerCardResponseDto> {
    const user = await this.findEntity(userId);

    let sponsorName: string | null = null;
    let sponsorLogoUrl: string | null = null;
    let totalFans = 0;

    if (user.activeSponsorId) {
      const sponsor = await this.sponsorsRepository.findOneBy({ id: user.activeSponsorId });
      if (sponsor) {
        sponsorName = sponsor.name;
        sponsorLogoUrl = sponsor.logoUrl ?? null;
      }
      const affil = await this.affiliationsRepository.findOneBy({
        userId,
        sponsorId: user.activeSponsorId,
      });
      totalFans = affil?.fanCount ?? 0;
    }

    // Frontend fetches these directly from GET /events/me/stats (JWT-protected)
    const totalEvents = 0;
    const totalWins = 0;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      activeSponsorId: user.activeSponsorId,
      sponsorName,
      sponsorLogoUrl,
      interests: user.interests,
      customTags: user.customTags,
      totalEvents,
      totalWins,
      totalFans,
      rating: null,
    };
  }

  // ─── M1.3: Event Suggestions ─────────────────────────────────────────────────

  async getEventSuggestions(userId: string): Promise<EventSuggestionResponseDto[]> {
    const user = await this.findEntity(userId);

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<EventSuggestionResponseDto[]>(
          `${this.eventServiceUrl}/events/me/suggestions`,
          {
            params: { interests: user.interests.join(','), limit: 5 },
            headers: { 'x-user-id': userId },
          },
        ),
      );
      return data;
    } catch {
      // Fallback: return upcoming events without personalisation
      try {
        const { data } = await firstValueFrom(
          this.httpService.get<Array<{ id: string; title: string; status: string; startDate: string; type: string; needsLeaderboard: boolean }>>(
            `${this.eventServiceUrl}/events`,
            { params: { status: 'upcoming', limit: 5 } },
          ),
        );
        return data.slice(0, 5).map((e) => ({
          id: e.id,
          title: e.title,
          coverImageUrl: null,
          startDate: e.startDate,
          status: e.status,
          registrationStatus: 'open',
          category: 'general',
          isTeamed: false,
          userTeam: null,
        }));
      } catch {
        return [];
      }
    }
  }

  // ─── M1.3: Friend Suggestions (Phase 2 stub) ─────────────────────────────────

  getFriendSuggestions(_userId: string): FriendSuggestionResponseDto[] {
    // Social service not built yet — Phase 2
    return [];
  }

  // ─── M1.3: History ───────────────────────────────────────────────────────────

  getEventHistory(_userId: string, _page: number): EventHistoryItemDto[] {
    // Frontend calls GET /events/me/registrations directly (JWT-protected event-service endpoint).
    // This user-service route is kept for backward compatibility but returns [].
    return [];
  }

  getMatchHistory(_userId: string, _page: number): unknown[] {
    // Phase 3: team/match service not built yet
    return [];
  }

  getChallengeHistory(_userId: string, _page: number): unknown[] {
    // Phase 2: challenge service not built yet
    return [];
  }

  getSponsorHistory(_userId: string, _page: number): unknown[] {
    // Requires per-event fan transaction log not yet in schema.
    // Phase 2: add sponsor_fan_transactions table.
    return [];
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async findEntity(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toResponse(user: User): UserResponseDto {
    return {
      activeSponsorId: user.activeSponsorId,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      contact: user.contact,
      createdAt: user.createdAt,
      email: user.email,
      id: user.id,
      interests: user.interests,
      lastActive: user.lastActive,
      lastSponsorChange: user.lastSponsorChange,
      newsletterSubscriptions: user.newsletterSubscriptions,
      pointsBalance: user.pointsBalance,
      role: user.role,
      settings: user.settings,
      socials: user.socials,
      status: user.status,
      steamId: user.steamId,
      stravaId: user.stravaId,
      updatedAt: user.updatedAt,
      username: user.username,
    };
  }

  private throwConflictForUniqueViolation(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ConflictException('Username or email already exists');
    }
  }
}
