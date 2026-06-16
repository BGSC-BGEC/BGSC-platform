import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AccountService } from './account.service';

@Injectable()
export class AccountDeletionJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionJob.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly accountService: AccountService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.run(), 24 * 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<number> {
    try {
      return await this.accountService.purgeScheduledDeletions(now);
    } catch (error) {
      this.logger.error(
        'Scheduled account deletion cleanup failed',
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }
}
