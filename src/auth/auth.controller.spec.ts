import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<Record<keyof AuthService, jest.Mock>>;

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: any) => {
      const config: Record<string, any> = {
        'app.environment': 'development',
        'auth.refreshExpiresInDays': 7,
        'auth.refreshRememberMeDays': 30,
      };
      return config[key] ?? defaultVal;
    }),
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      getMe: jest.fn(),
      forgotPassword: jest.fn(),
      verifyResetOtp: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      getSessions: jest.fn(),
      revokeSession: jest.fn(),
      revokeOtherSessions: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  const mockReq = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'TestAgent' },
    cookies: {},
    user: { id: 'user-1', role: 'USER', sessionId: 'rt-1' },
  } as any;

  const mockRes = () => {
    const res: any = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    return res;
  };

  describe('register', () => {
    it('calls authService.register and sets cookie', async () => {
      authService.register.mockResolvedValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        refreshToken: 'rt',
      });

      const res = mockRes();
      const result = await controller.register(
        { firstName: 'Test', lastName: 'User', email: 'test@example.com', password: 'StrongPass123!' },
        mockReq,
        res,
      );

      expect(authService.register).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt', expect.any(Object));
      expect(result.user).toBeDefined();
      expect(result.accessToken).toBe('token');
      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('login', () => {
    it('calls authService.login and sets cookie', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'user-1' },
        accessToken: 'token',
        refreshToken: 'rt',
      });

      const res = mockRes();
      const result = await controller.login(
        { email: 'test@example.com', password: 'pass', rememberMe: false },
        mockReq,
        res,
      );

      expect(authService.login).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalled();
      expect(result.accessToken).toBe('token');
    });
  });

  describe('refreshToken', () => {
    it('reads token from cookie and returns new access token', async () => {
      authService.refreshTokens.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-rt',
      });

      const reqWithCookie = { ...mockReq, cookies: { refresh_token: 'old-rt' } };
      const res = mockRes();
      const result = await controller.refreshToken(reqWithCookie, res);

      expect(authService.refreshTokens).toHaveBeenCalledWith('old-rt', '127.0.0.1', 'TestAgent');
      expect(result.accessToken).toBe('new-token');
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('calls authService.logout and clears cookie', async () => {
      authService.logout.mockResolvedValue(undefined);

      const res = mockRes();
      const result = await controller.logout(mockReq, res);

      expect(authService.logout).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
      expect(result.message).toContain('Logged out');
    });
  });

  describe('logoutAll', () => {
    it('revokes all sessions and clears cookie', async () => {
      authService.logoutAll.mockResolvedValue(undefined);

      const res = mockRes();
      const result = await controller.logoutAll('user-1', res);

      expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
      expect(res.clearCookie).toHaveBeenCalled();
      expect(result.message).toContain('All sessions');
    });
  });

  describe('getMe', () => {
    it('returns user profile', async () => {
      authService.getMe.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const result = await controller.getMe('user-1');

      expect(authService.getMe).toHaveBeenCalledWith('user-1');
      expect(result.id).toBe('user-1');
    });
  });

  describe('forgotPassword', () => {
    it('calls authService.forgotPassword', async () => {
      authService.forgotPassword.mockResolvedValue({
        message: 'If the account exists',
      });

      const result = await controller.forgotPassword({
        email: 'test@example.com',
      });

      expect(authService.forgotPassword).toHaveBeenCalled();
      expect(result.message).toContain('If the account exists');
    });
  });

  describe('verifyResetOtp', () => {
    it('returns reset token', async () => {
      authService.verifyResetOtp.mockResolvedValue({
        resetToken: 'jwt-reset',
      });

      const result = await controller.verifyResetOtp({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result.resetToken).toBe('jwt-reset');
    });
  });

  describe('resetPassword', () => {
    it('resets password', async () => {
      authService.resetPassword.mockResolvedValue({
        message: 'Password reset successful',
      });

      const result = await controller.resetPassword({
        resetToken: 'token',
        newPassword: 'NewPass123!',
      });

      expect(result.message).toContain('Password reset');
    });
  });

  describe('changePassword', () => {
    it('changes password', async () => {
      authService.changePassword.mockResolvedValue({
        message: 'Password changed successfully',
      });

      const result = await controller.changePassword('user-1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      });

      expect(result.message).toContain('Password changed');
    });
  });

  describe('verifyEmail', () => {
    it('verifies email', async () => {
      authService.verifyEmail.mockResolvedValue({
        message: 'Email verified',
      });

      const result = await controller.verifyEmail({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result.message).toContain('Email verified');
    });
  });

  describe('getSessions', () => {
    it('returns sessions', async () => {
      authService.getSessions.mockResolvedValue([]);

      const result = await controller.getSessions('user-1', mockReq);

      expect(result).toEqual([]);
    });
  });

  describe('revokeSession', () => {
    it('revokes a session', async () => {
      authService.revokeSession.mockResolvedValue({
        message: 'Session revoked',
      });

      const result = await controller.revokeSession('user-1', 'rt-2');

      expect(result.message).toContain('Session revoked');
    });
  });

  describe('revokeOtherSessions', () => {
    it('revokes other sessions', async () => {
      authService.revokeOtherSessions.mockResolvedValue({
        message: 'Other sessions revoked',
      });

      const result = await controller.revokeOtherSessions('user-1', mockReq);

      expect(result.message).toContain('Other sessions');
    });
  });
});
