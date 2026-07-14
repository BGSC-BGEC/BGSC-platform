import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationsListResponseDto } from './dto/notifications-list-response.dto';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = this.repo.create(dto);
    return this.repo.save(notification);
  }

  async getForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationsListResponseDto> {
    const [notifications, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.repo.count({
      where: { userId, isRead: false },
    });

    return { notifications, unreadCount, total };
  }

  async markRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.repo.findOne({ where: { id: notificationId } });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot mark another user\'s notification as read');
    }

    notification.isRead = true;
    return this.repo.save(notification);
  }
}
