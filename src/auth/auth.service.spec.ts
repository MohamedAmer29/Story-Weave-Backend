import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from '../database/entities/user.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
import { EmailService } from '../common/services/email.service';
import { OtpService } from '../common/services/otp.service';
import { RedisService } from '../config/redis.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRefreshTokenRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      const config: Record<string, any> = {
        'auth.refreshExpiresInDays': 7,
        'auth.refreshRememberMeDays': 30,
        'auth.resetTokenExpiresIn': '15m',
        'otp.maxAttempts': 5,
      };
      return config[key] ?? defaultVal;
    }),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockOtpService = {
    generate: jest.fn().mockResolvedValue('123456'),
    verify: jest.fn().mockResolvedValue(true),
    getAttempts: jest.fn().mockResolvedValue(0),
    incrementAttempts: jest.fn().mockResolvedValue(1),
    setCooldown: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
    isCoolingDown: jest.fn().mockResolvedValue(false),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incrby: jest.fn(),
    expire: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      pipeline: jest.fn().mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        pexpire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 1]]),
      }),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  function makeUser(overrides: Partial<User> = {}): User {
    return Object.assign(new User(), {
      id: 'user-1',
      email: 'test@example.com',
      password: '$2b$12$hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      name: 'Test User',
      role: UserRole.USER,
      isActive: true,
      emailVerified: false,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  function makeRefreshToken(
    overrides: Partial<RefreshToken> = {},
  ): RefreshToken {
    return Object.assign(new RefreshToken(), {
      id: 'rt-1',
      userId: 'user-1',
      token: 'hashed-token',
      ipAddress: '127.0.0.1',
      userAgent: 'TestAgent',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: null,
      ...overrides,
    });
  }

  describe('register', () => {
    it('creates a new user and returns tokens', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue(user);
      mockUserRepo.save.mockResolvedValue(user);
      mockRefreshTokenRepo.create.mockReturnValue(makeRefreshToken());
      mockRefreshTokenRepo.save.mockResolvedValue(makeRefreshToken());

      const result = await service.register({
        firstName: 'Test',
        lastName: 'User',
        email: 'Test@Example.com',
        password: 'StrongPass123!',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.firstName).toBe('Test');
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('normalizes email to lowercase', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue(makeUser());
      mockUserRepo.save.mockResolvedValue(makeUser());
      mockRefreshTokenRepo.create.mockReturnValue(makeRefreshToken());
      mockRefreshTokenRepo.save.mockResolvedValue(makeRefreshToken());

      await service.register({
        firstName: 'Test',
        lastName: 'User',
        email: 'TEST@EXAMPLE.COM',
        password: 'StrongPass123!',
      });

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('throws ConflictException for duplicate email', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      await expect(
        service.register({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'StrongPass123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);
      qbMock.getOne.mockResolvedValue(makeUser());
      mockRefreshTokenRepo.create.mockReturnValue(makeRefreshToken());
      mockRefreshTokenRepo.save.mockResolvedValue(makeRefreshToken());

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'StrongPass123!',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-access-token');

      (bcrypt.compare as jest.Mock).mockRestore();
    });

    it('throws for invalid email', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws for invalid password', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);
      qbMock.getOne.mockResolvedValue(makeUser());

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);

      (bcrypt.compare as jest.Mock).mockRestore();
    });

    it('throws ForbiddenException for inactive account', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);
      qbMock.getOne.mockResolvedValue(makeUser({ isActive: false }));

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@example.com', password: 'pass' }),
      ).rejects.toThrow(ForbiddenException);

      (bcrypt.compare as jest.Mock).mockRestore();
    });
  });

  describe('refreshTokens', () => {
    it('returns new tokens for valid refresh token', async () => {
      const rt = makeRefreshToken({ user: makeUser() });
      mockRefreshTokenRepo.findOne.mockResolvedValue(rt);
      mockRefreshTokenRepo.update.mockResolvedValue(undefined);
      mockRefreshTokenRepo.create.mockReturnValue(makeRefreshToken());
      mockRefreshTokenRepo.save.mockResolvedValue(makeRefreshToken());

      const result = await service.refreshTokens('valid-token', '127.0.0.1');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('throws for invalid refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws for expired refresh token', async () => {
      const rt = makeRefreshToken({
        expiresAt: new Date(Date.now() - 1000),
        user: makeUser(),
      });
      mockRefreshTokenRepo.findOne.mockResolvedValue(rt);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws for revoked refresh token', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      mockRefreshTokenRepo.update.mockResolvedValue(undefined);

      await service.logout('token-to-revoke');

      expect(mockRefreshTokenRepo.update).toHaveBeenCalled();
    });

    it('handles undefined token gracefully', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
    });
  });

  describe('logoutAll', () => {
    it('revokes all user sessions', async () => {
      mockRefreshTokenRepo.update.mockResolvedValue(undefined);

      await service.logoutAll('user-1');

      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', revokedAt: expect.any(Object) },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('forgotPassword', () => {
    it('returns generic message', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result.message).toContain('If the account exists');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('returns same message for non-existent email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(result.message).toContain('If the account exists');
    });
  });

  describe('verifyResetOtp', () => {
    it('issues a reset token for valid OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockOtpService.getAttempts.mockResolvedValue(0);
      mockOtpService.verify.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('reset-jwt-token');

      const result = await service.verifyResetOtp({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result.resetToken).toBe('reset-jwt-token');
    });

    it('throws for too many attempts', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockOtpService.getAttempts.mockResolvedValue(5);

      await expect(
        service.verifyResetOtp({ email: 'test@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for invalid OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockOtpService.getAttempts.mockResolvedValue(0);
      mockOtpService.verify.mockResolvedValue(false);

      await expect(
        service.verifyResetOtp({ email: 'test@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        purpose: 'password-reset',
      });
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockRefreshTokenRepo.update.mockResolvedValue(undefined);

      const result = await service.resetPassword({
        resetToken: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toContain('Password reset successful');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalled();
    });

    it('throws for invalid reset token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        service.resetPassword({
          resetToken: 'invalid-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws for wrong purpose token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        purpose: 'wrong',
      });

      await expect(
        service.resetPassword({
          resetToken: 'wrong-purpose-token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('changes password with correct current password', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);
      qbMock.getOne.mockResolvedValue(makeUser());
      mockRefreshTokenRepo.update.mockResolvedValue(undefined);

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.changePassword('user-1', {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toContain('Password changed successfully');

      (bcrypt.compare as jest.Mock).mockRestore();
    });

    it('throws for incorrect current password', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);
      qbMock.getOne.mockResolvedValue(makeUser());

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      (bcrypt.compare as jest.Mock).mockRestore();
    });

    it('throws when new password is the same as current', async () => {
      const qbMock = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(qbMock);
      qbMock.getOne.mockResolvedValue(makeUser());

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'SamePassword123!',
          newPassword: 'SamePassword123!',
        }),
      ).rejects.toThrow(BadRequestException);

      (bcrypt.compare as jest.Mock).mockRestore();
    });
  });

  describe('verifyEmail', () => {
    it('verifies email with valid OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(
        makeUser({ emailVerified: false }),
      );
      mockOtpService.getAttempts.mockResolvedValue(0);
      mockOtpService.verify.mockResolvedValue(true);

      const result = await service.verifyEmail({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result.message).toContain('Email verified');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        emailVerified: true,
      });
    });

    it('throws for too many attempts', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockOtpService.getAttempts.mockResolvedValue(5);

      await expect(
        service.verifyEmail({ email: 'test@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for invalid OTP', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockOtpService.getAttempts.mockResolvedValue(0);
      mockOtpService.verify.mockResolvedValue(false);

      await expect(
        service.verifyEmail({ email: 'test@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMe', () => {
    it('returns sanitized user', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.getMe('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('throws if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.getMe('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getSessions', () => {
    it('returns sessions with current flag', async () => {
      mockRefreshTokenRepo.find.mockResolvedValue([
        makeRefreshToken({ id: 'rt-1', lastUsedAt: new Date() }),
        makeRefreshToken({ id: 'rt-2', lastUsedAt: null }),
      ]);

      const result = await service.getSessions('user-1', 'rt-1');

      expect(result).toHaveLength(2);
      expect(result[0].current).toBe(true);
      expect(result[1].current).toBe(false);
    });
  });

  describe('revokeSession', () => {
    it('revokes a specific session', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(makeRefreshToken());

      const result = await service.revokeSession('user-1', 'rt-1');

      expect(result.message).toContain('Session revoked');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalled();
    });

    it('throws if session not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);

      await expect(
        service.revokeSession('user-1', 'nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes other sessions but keeps current', async () => {
      const qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.revokeOtherSessions('user-1', 'rt-1');

      expect(result.message).toContain('Other sessions revoked');
      expect(qbMock.andWhere).toHaveBeenCalledWith('id != :currentSessionId', {
        currentSessionId: 'rt-1',
      });
      expect(qbMock.execute).toHaveBeenCalled();
    });

    it('revokes all sessions when no current session provided', async () => {
      const qbMock = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(qbMock);

      await service.revokeOtherSessions('user-1', undefined);

      expect(qbMock.andWhere).not.toHaveBeenCalledWith(
        'id != :currentSessionId',
        expect.anything(),
      );
    });
  });
});
