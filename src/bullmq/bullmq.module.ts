import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { BULLMQ_CONNECTION } from './bullmq.constants';

@Injectable()
class BullMQConnectionLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(BULLMQ_CONNECTION)
    private readonly connection: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      useFactory: (configService: ConfigService): Redis => {
        const url = configService.get<string>('redis.url');
        const host = configService.get<string>('redis.host', 'localhost');
        const port = configService.get<number>('redis.port', 6379);
        const password = configService.get<string>('redis.password');

        if (url) {
          return new Redis(url, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          });
        }

        return new Redis({
          host,
          port,
          ...(password ? { password } : {}),
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
      },
      inject: [ConfigService],
    },
    BullMQConnectionLifecycle,
  ],
  exports: [BULLMQ_CONNECTION],
})
export class BullMQModule {}
