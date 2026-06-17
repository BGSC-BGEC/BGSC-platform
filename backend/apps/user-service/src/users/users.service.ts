import {
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
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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
