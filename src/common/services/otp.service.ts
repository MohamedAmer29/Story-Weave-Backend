import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../config/redis.service';
import { createHash, randomInt } from 'crypto';

@Injectable()
export class OtpService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private get expiresInMinutes(): number {
    return this.configService.get<number>('otp.expiresInMinutes', 10);
  }

  private get maxAttempts(): number {
    return this.configService.get<number>('otp.maxAttempts', 5);
  }

  private get resendCooldownSeconds(): number {
    return this.configService.get<number>('otp.resendCooldownSeconds', 60);
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private key(userId: string, type: string): string {
    return `otp:${type}:${userId}`;
  }

  private attemptsKey(userId: string, type: string): string {
    return `otp:attempts:${type}:${userId}`;
  }

  private cooldownKey(userId: string, type: string): string {
    return `otp:cooldown:${type}:${userId}`;
  }

  async generate(userId: string, type: string): Promise<string> {
    const otp = randomInt(100000, 999999).toString();
    const hash = this.hashOtp(otp);
    const ttl = this.expiresInMinutes * 60 * 1000;

    await this.redisService.set(this.key(userId, type), hash, ttl);
    await this.redisService.del(this.attemptsKey(userId, type));

    return otp;
  }

  async verify(userId: string, type: string, otp: string): Promise<boolean> {
    const attempts = await this.getAttempts(userId, type);
    if (attempts >= this.maxAttempts) {
      return false;
    }

    const hash = this.hashOtp(otp);
    const stored = await this.redisService.get(this.key(userId, type));

    if (!stored || stored !== hash) {
      await this.incrementAttempts(userId, type);
      return false;
    }

    await this.redisService.del(this.key(userId, type));
    await this.redisService.del(this.attemptsKey(userId, type));
    return true;
  }

  async isExpired(userId: string, type: string): Promise<boolean> {
    const stored = await this.redisService.get(this.key(userId, type));
    return !stored;
  }

  async getAttempts(userId: string, type: string): Promise<number> {
    const val = await this.redisService.get(this.attemptsKey(userId, type));
    return val ? parseInt(val, 10) : 0;
  }

  async incrementAttempts(userId: string, type: string): Promise<number> {
    const key = this.attemptsKey(userId, type);
    const attempts = await this.redisService.incrby(key, 1);
    await this.redisService.expire(key, this.expiresInMinutes * 60);
    return attempts;
  }

  async isCoolingDown(userId: string, type: string): Promise<boolean> {
    const val = await this.redisService.get(this.cooldownKey(userId, type));
    return !!val;
  }

  async setCooldown(userId: string, type: string): Promise<void> {
    await this.redisService.set(
      this.cooldownKey(userId, type),
      '1',
      this.resendCooldownSeconds * 1000,
    );
  }

  async invalidate(userId: string, type: string): Promise<void> {
    await this.redisService.del(this.key(userId, type));
    await this.redisService.del(this.attemptsKey(userId, type));
  }
}
