import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis as IORedis } from 'ioredis';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private client: IORedis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('redis.url');
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    this.client = url
      ? new IORedis(url)
      : new IORedis({
          host,
          port,
          ...(password ? { password } : {}),
        });

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });
  }

  getClient(): IORedis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<string> {
    const client = this.getClient();
    if (ttl) {
      return (
        (await client.set(key, value, 'EX', Math.floor(ttl / 1000))) || value
      );
    }
    return (await client.set(key, value)) || value;
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.getClient().incrby(key, increment);
  }

  async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.getClient().expire(key, seconds);
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    return this.getClient().pexpire(key, milliseconds);
  }

  pipeline() {
    return this.getClient().pipeline();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.disconnect();
  }
}
