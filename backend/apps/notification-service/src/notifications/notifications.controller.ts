import {
  Body,
  Controller,
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
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsListResponseDto } from './dto/notifications-list-response.dto';
import { NotificationsService } from './notifications.service';

type AuthRequest = Request & { user: { id: string; role: string } };

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a notification (internal use)' })
  create(@Body() dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    return this.notificationsService.create(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get authenticated user's notifications" })
  getMyNotifications(
    @Req() req: AuthRequest,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<NotificationsListResponseDto> {
    return this.notificationsService.getForUser(
      req.user.id,
      Math.max(1, parseInt(page, 10)),
      Math.min(100, Math.max(1, parseInt(limit, 10))),
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(id, req.user.id);
  }
}
