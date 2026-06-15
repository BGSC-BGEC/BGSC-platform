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
import { CurrentUserId } from '../rbac/current-user-id.decorator';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  findAll(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAll({ role, status });
  }

  @Get('me')
  @Roles(
    UserRole.USER,
    UserRole.MEMBER,
    UserRole.CORE,
    UserRole.COORDINATOR,
    UserRole.FOUNDER,
  )
  findMe(@CurrentUserId() userId?: string): Promise<UserResponseDto> {
    return this.usersService.findOne(this.requireUserId(userId));
  }

  @Patch('me')
  @Roles(
    UserRole.USER,
    UserRole.MEMBER,
    UserRole.CORE,
    UserRole.COORDINATOR,
    UserRole.FOUNDER,
  )
  updateMe(
    @CurrentUserId() userId: string | undefined,
    @Body() updateMeDto: UpdateMeDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateMe(this.requireUserId(userId), updateMeDto);
  }

  @Get(':id')
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  remove(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.remove(id);
  }

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user id');
    }

    return userId;
  }
}
