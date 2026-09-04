import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../../config/redis.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    let database: 'ok' | 'error' = 'ok';
    let redis: 'ok' | 'error' = 'ok';

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'error';
    }

    try {
      await this.redisService.getClient().ping();
    } catch {
      redis = 'error';
    }

    const checks = { database, redis };
    const status = database === 'ok' && redis === 'ok' ? 'ok' : 'error';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
