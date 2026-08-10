import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { UserRole } from '../rbac/user-role.enum';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements-query.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

type AuthRequest = Request & { user: { id: string; role: string } };

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'List non-expired announcements (paginated, filterable by type and tag)' })
  findAll(@Query() query: ListAnnouncementsQueryDto): Promise<AnnouncementResponseDto[]> {
    return this.announcementsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single announcement by ID' })
  findOne(@Param('id') id: string): Promise<AnnouncementResponseDto> {
    return this.announcementsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER, UserRole.CORE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an announcement' })
  create(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: AuthRequest,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementsService.create(dto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER, UserRole.CORE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an announcement' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an announcement' })
  remove(@Param('id') id: string): Promise<AnnouncementResponseDto> {
    return this.announcementsService.remove(id);
  }
}
