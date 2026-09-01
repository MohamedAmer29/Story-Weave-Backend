import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationCleanupService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NotificationCleanupService.name);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    this.schedulePurge();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedulePurge(): void {
    const intervalHours = this.configService.get<number>(
      'notification.cleanupIntervalHours',
      24,
    );

    this.timer = setTimeout(
      async () => {
        try {
          const retentionDays = this.configService.get<number>(
            'notification.retentionDays',
            90,
          );
          const removed =
            await this.notificationsService.purgeOlderThan(retentionDays);
          if (removed > 0) {
            this.logger.log(`Purged ${removed} expired notifications`);
          }
        } catch (error: any) {
          this.logger.error(
            `Notification cleanup failed: ${
              (error as Error)?.message ?? 'Unknown error'
            }`,
          );
        }
        this.schedulePurge();
      },
      intervalHours * 60 * 60 * 1000,
    );

    this.timer.unref?.();
  }
}
