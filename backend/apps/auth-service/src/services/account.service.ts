import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { UserCredential } from '../entities/user-credential.entity';
import { UserRole, UserStatus } from '../constants/roles.constant';
import { SessionService } from './session.service';
import { EventBusService } from './event-bus.service';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  private static readonly ROLE_HIERARCHY: Record<UserRole, number> = {
    [UserRole.GUEST]: 0,
    [UserRole.USER]: 1,
    [UserRole.MEMBER]: 2,
    [UserRole.CORE]: 3,
    [UserRole.COORDINATOR]: 4,
    [UserRole.FOUNDER]: 5,
  };

  constructor(
    @InjectRepository(UserCredential)
    private readonly userRepository: Repository<UserCredential>,
    private readonly sessionService: SessionService,
    private readonly eventBusService: EventBusService,
  ) {}

  async disableAccount(
    actorId: string,
    actorRole: UserRole,
    targetUserId?: string,
  ): Promise<{ message: string }> {
    const userId = targetUserId ?? actorId;
    const isAdminAction = targetUserId != null && targetUserId !== actorId;

    if (isAdminAction) {
      const actorLevel = AccountService.ROLE_HIERARCHY[actorRole] ?? 0;
      if (actorLevel < AccountService.ROLE_HIERARCHY[UserRole.COORDINATOR]) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (user.status === UserStatus.DISABLED) {
      return { message: 'Account is already disabled' };
    }

    user.status = UserStatus.DISABLED;
    user.disabledAt = new Date();
    user.disabledBy = actorId;
    await this.userRepository.save(user);

    await this.sessionService.revokeAllSessions(userId);

    this.eventBusService.emit('UserDisabled', {
      userId,
      disabledBy: actorId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Account disabled: userId=${userId}, by=${actorId}`);

    return { message: 'Account disabled successfully' };
  }

  async enableAccount(
    actorId: string,
    targetUserId: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (user.status !== UserStatus.DISABLED) {
      return { message: 'Account is not disabled' };
    }

    user.status = UserStatus.ACTIVE;
    user.disabledAt = null;
    user.disabledBy = null;
    await this.userRepository.save(user);

    this.eventBusService.emit('UserEnabled', {
      userId: targetUserId,
      enabledBy: actorId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Account enabled: userId=${targetUserId}, by=${actorId}`);

    return { message: 'Account enabled successfully' };
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    user.status = UserStatus.PENDING_DELETION;
    user.deletionScheduled = new Date(Date.now() + thirtyDays);
    await this.userRepository.save(user);

    await this.sessionService.revokeAllSessions(userId);

    this.eventBusService.emit('UserDeletionScheduled', {
      userId,
      deletionScheduled: user.deletionScheduled.toISOString(),
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Account deletion scheduled: userId=${userId}, scheduledFor=${user.deletionScheduled.toISOString()}`,
    );

    return { message: 'Account scheduled for deletion in 30 days' };
  }

  async cancelDeletion(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (user.status !== UserStatus.PENDING_DELETION) {
      return { message: 'Account is not pending deletion' };
    }

    user.status = UserStatus.ACTIVE;
    user.deletionScheduled = null;
    await this.userRepository.save(user);

    this.eventBusService.emit('UserDeletionCancelled', {
      userId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Account deletion cancelled: userId=${userId}`);

    return { message: 'Account deletion cancelled' };
  }

  async purgeScheduledDeletions(now = new Date()): Promise<number> {
    const users = await this.userRepository.find({
      where: {
        status: UserStatus.PENDING_DELETION,
        deletionScheduled: LessThanOrEqual(now),
      },
    });

    for (const user of users) {
      await this.sessionService.revokeAllSessions(user.id);
      await this.userRepository.delete(user.id);
      this.eventBusService.emit('UserDeleted', {
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
    }

    return users.length;
  }

  async requestDataExport(userId: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    this.eventBusService.emit('UserDataExportRequested', {
      userId,
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Data export requested: userId=${userId}`);

    return {
      message: 'Data export request submitted. You will receive an email.',
    };
  }
}
