import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Sponsor } from './entities/sponsor.entity';
import { User } from './entities/user.entity';
import { UserSponsorAffiliation } from './entities/user-sponsor-affiliation.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

function getCurrentSemesterStart(): Date {
  const now = new Date();
  const year = now.getFullYear();
  if (now.getMonth() < 6) {
    return new Date(year, 0, 1);
  }
  return new Date(year, 6, 1);
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Sponsor)
    private readonly sponsorsRepository: Repository<Sponsor>,
    @InjectRepository(UserSponsorAffiliation)
    private readonly affiliationsRepository: Repository<UserSponsorAffiliation>,
  ) {}

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
  }): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
      where: filters,
    });

    return users.map((user) => this.toResponse(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
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

  async updateMe(
    id: string,
    updateMeDto: UpdateMeDto,
  ): Promise<UserResponseDto> {
    return this.update(id, updateMeDto);
  }

  async remove(id: string): Promise<UserResponseDto> {
    const user = await this.findEntity(id);
    user.status = UserStatus.DELETED;
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async selectSponsor(
    userId: string,
    sponsorId: string,
  ): Promise<UserResponseDto> {
    const user = await this.findEntity(userId);

    const sponsor = await this.sponsorsRepository.findOneBy({ id: sponsorId });
    if (!sponsor) {
      throw new NotFoundException('Sponsor not found');
    }
    if (sponsor.status !== 'active') {
      throw new BadRequestException('Sponsor is not active');
    }

    const today = new Date().toISOString().slice(0, 10);
    if (sponsor.tenureStart > today) {
      throw new BadRequestException('Sponsor tenure has not started yet');
    }
    if (sponsor.tenureEnd && sponsor.tenureEnd < today) {
      throw new BadRequestException('Sponsor tenure has ended');
    }

    if (user.activeSponsorId === sponsorId) {
      return this.findOne(userId);
    }

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
    if (!isFirstSelection) {
      user.lastSponsorChange = new Date();
    }
    await this.usersRepository.save(user);

    const existingAffiliation = await this.affiliationsRepository.findOneBy({
      userId,
      sponsorId,
    });
    if (!existingAffiliation) {
      const affiliation = this.affiliationsRepository.create({
        userId,
        sponsorId,
        affiliatedAt: new Date(),
      });
      await this.affiliationsRepository.save(affiliation);
    }

    return this.findOne(userId);
  }

  private async findEntity(id: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toResponse(user: User): UserResponseDto {
    return {
      activeSponsorId: user.activeSponsorId,
      avatarUrl: user.avatarUrl,
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
