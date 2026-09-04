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
        const username = configService.get<string>('redis.username');
        const tls = configService.get<boolean>('redis.tls', false);
        const db = configService.get<number>('redis.db', 0);

        const common = {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          // Upstash redis:// with REDIS_TLS=true requires TLS; a rediss:// URL always uses TLS.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(tls ? { tls: {} as any } : {}),
        };

        if (url) {
          return new Redis(url, common);
        }

        return new Redis({
          host,
          port,
          ...(username ? { username } : {}),
          ...(password ? { password } : {}),
          ...(db ? { db } : {}),
          ...common,
        });
      },
      inject: [ConfigService],
    },
    BullMQConnectionLifecycle,
  ],
  exports: [BULLMQ_CONNECTION],
})
export class BullMQModule {}
