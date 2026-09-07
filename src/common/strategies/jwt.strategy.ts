import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { RedisService } from '../../config/redis.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionId?: string;
  jti?: string;
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException({
        errorCode: 'ACCESS_TOKEN_INVALIDATED',
        message: 'Invalid access token payload',
      });
    }

    if (payload.jti) {
      const activeJti = await this.redisService.get(
        `active_token:${payload.sub}`,
      );
      if (activeJti && payload.jti !== activeJti) {
        throw new UnauthorizedException({
          errorCode: 'ACCESS_TOKEN_INVALIDATED',
          message: 'Access token is an old version and has been invalidated',
        });
      }
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is unavailable');
    }

    if (
      payload.tokenVersion !== undefined &&
      payload.tokenVersion !== user.tokenVersion
    ) {
      throw new UnauthorizedException({
        errorCode: 'ACCESS_TOKEN_INVALIDATED',
        message: 'Session has been revoked',
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
    };
  }
}
