import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { User, UserRole } from '../../database/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepository: { findOne: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = { findOne: jest.fn() };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'jwt.secret' ? 'test-secret' : undefined,
      ),
    } as unknown as ConfigService;
    const redisService = {
      get: jest.fn().mockResolvedValue('jti-123'),
    };
    const refreshTokenRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'sess-123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    strategy = new JwtStrategy(
      configService,
      userRepository as any,
      refreshTokenRepository as any,
      redisService as any,
    );
  });

  describe('validate', () => {
    it('throws for missing payload or sub', async () => {
      await expect(strategy.validate(null as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(strategy.validate({} as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(
        strategy.validate({
          sub: 'u1',
          email: 'a@b.c',
          role: 'USER',
          jti: 'jti-123',
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when account is inactive', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(
        strategy.validate({
          sub: 'u1',
          email: 'a@b.c',
          role: 'USER',
          jti: 'jti-123',
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('re-reads role/email from DB rather than trusting the token', async () => {
      const dbUser = {
        id: 'u1',
        email: 'fresh@example.com',
        role: UserRole.AUTHOR,
        isActive: true,
      };
      userRepository.findOne.mockResolvedValue(dbUser);

      const result = await strategy.validate({
        sub: 'u1',
        email: 'stale@example.com',
        role: UserRole.USER,
        sessionId: 'sess-123',
        jti: 'jti-123',
      } as any);

      // returns the DB-derived role/email, not the token values
      expect(result.role).toBe(UserRole.AUTHOR);
      expect(result.email).toBe('fresh@example.com');
      expect(result.id).toBe('u1');
      expect(result.sessionId).toBe('sess-123');
    });

    it('rejects access tokens whose session has been revoked', async () => {
      const dbUser = {
        id: 'u1',
        email: 'a@b.c',
        role: UserRole.USER,
        isActive: true,
      };
      userRepository.findOne.mockResolvedValue(dbUser);
      (strategy as any).refreshTokenRepository.findOne.mockResolvedValue({
        id: 'sess-123',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        strategy.validate({
          sub: 'u1',
          email: 'a@b.c',
          role: UserRole.USER,
          sessionId: 'sess-123',
          jti: 'jti-123',
        } as any),
      ).rejects.toMatchObject({ message: 'Session has been revoked' });
    });

    it('rejects access tokens whose session has expired', async () => {
      const dbUser = {
        id: 'u1',
        email: 'a@b.c',
        role: UserRole.USER,
        isActive: true,
      };
      userRepository.findOne.mockResolvedValue(dbUser);
      (strategy as any).refreshTokenRepository.findOne.mockResolvedValue({
        id: 'sess-123',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        strategy.validate({
          sub: 'u1',
          email: 'a@b.c',
          role: UserRole.USER,
          sessionId: 'sess-123',
          jti: 'jti-123',
        } as any),
      ).rejects.toMatchObject({ message: 'Session has expired' });
    });

    it('propagates a sessionId when present', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        role: UserRole.USER,
        isActive: true,
      });
      const result = await strategy.validate({
        sub: 'u1',
        email: 'a@b.c',
        role: UserRole.USER,
        sessionId: 'sess-abc',
        jti: 'jti-123',
      } as any);
      expect(result.sessionId).toBe('sess-abc');
    });
  });
});
