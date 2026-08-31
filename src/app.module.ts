import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import { RedisModule } from './config/redis.module';
import jwtConfig from './config/jwt.config';
import cloudinaryConfig from './config/cloudinary.config';
import aiConfig from './config/ai.config';
import corsConfig from './config/cors.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { AIModule } from './modules/ai/ai.module';
import { StoryModule } from './modules/story/story.module';
import { User } from './database/entities/user.entity';
import { Story } from './database/entities/story.entity';
import { StoryPage } from './database/entities/story-page.entity';
import { JwtStrategy } from './common/strategies/jwt.strategy';

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
      ],
      envFilePath: ['.env.local', '.env'],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [User, Story, StoryPage],
        synchronize: configService.get<boolean>('database.synchronize', false),
        logging: configService.get<boolean>('database.logging', false),
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    AIModule,
    StoryModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
  exports: [PassportModule],
})
export class AppModule {}
