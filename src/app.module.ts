import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import { RedisModule } from './config/redis.module';
import jwtConfig from './config/jwt.config';
import cloudinaryConfig from './config/cloudinary.config';
import aiConfig from './config/ai.config';
import corsConfig from './config/cors.config';
import emailConfig from './config/email.config';
import otpConfig from './config/otp.config';
import adminConfig from './config/admin.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { AIModule } from './modules/ai/ai.module';
import { StoryModule } from './modules/story/story.module';
import { IllustrationModule } from './illustration/illustration.module';
import { NotificationsModule } from './notifications/notifications.module';
import notificationConfig from './notifications/config/notification.config';
import { User } from './database/entities/user.entity';
import { Story } from './database/entities/story.entity';
import { StoryPage } from './database/entities/story-page.entity';
import { StoryShare } from './database/entities/story-share.entity';
import { RefreshToken } from './database/entities/refresh-token.entity';
import { Notification } from './notifications/notification.entity';
import { AuditLog } from './admin/entities/audit-log.entity';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        cloudinaryConfig,
        aiConfig,
        corsConfig,
        notificationConfig,
        emailConfig,
        otpConfig,
        adminConfig,
      ],
      envFilePath: ['.env.local', '.env'],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const pool = configService.get<{
          max: number;
          min: number;
          connectionTimeoutMs: number;
          idleTimeoutMs: number;
          statementTimeoutMs: number;
        }>('database.pool')!;
        return {
          type: 'postgres' as const,
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
          entities: [
            User,
            Story,
            StoryPage,
            StoryShare,
            Notification,
            RefreshToken,
            AuditLog,
          ],
          synchronize: configService.get<boolean>(
            'database.synchronize',
            false,
          ),
          logging: configService.get<boolean>('database.logging', false),
          extra: {
            max: pool.max,
            min: pool.min,
            connectionTimeoutMillis: pool.connectionTimeoutMs,
            idleTimeoutMillis: pool.idleTimeoutMs,
            statement_timeout: pool.statementTimeoutMs,
          },
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    DashboardModule,
    HealthModule,
    AIModule,
    StoryModule,
    IllustrationModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [PassportModule],
})
export class AppModule {}
