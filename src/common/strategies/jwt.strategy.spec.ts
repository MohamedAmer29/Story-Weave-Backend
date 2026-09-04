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
    strategy = new JwtStrategy(configService, userRepository as any);
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
        strategy.validate({ sub: 'u1', email: 'a@b.c', role: 'USER' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when account is inactive', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(
        strategy.validate({ sub: 'u1', email: 'a@b.c', role: 'USER' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('re-reads role/email from DB rather than trusting the token', async () => {
      const dbUser = {
        id: 'u1',
        email: 'fresh@example.com',
        role: UserRole.MANAGER,
        isActive: true,
      };
      userRepository.findOne.mockResolvedValue(dbUser);

      const result = await strategy.validate({
        sub: 'u1',
        email: 'stale@example.com',
        role: UserRole.USER,
        sessionId: 'sess-123',
      });

      // returns the DB-derived role/email, not the token values
      expect(result.role).toBe(UserRole.MANAGER);
      expect(result.email).toBe('fresh@example.com');
      expect(result.id).toBe('u1');
      expect(result.sessionId).toBe('sess-123');
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
        role: UserRole.USER,
        sessionId: 'sess-abc',
      });
      expect(result.sessionId).toBe('sess-abc');
    });
  });
});
