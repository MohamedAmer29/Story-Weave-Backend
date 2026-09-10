import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmailVerifiedGuard } from './email-verified.guard';
import { SKIP_EMAIL_VERIFICATION_KEY } from '../decorators/skip-email-verification.decorator';
import { UserRole } from '../../database/entities/user.entity';

interface RequestShape {
  user?: { role?: string; emailVerified?: boolean } | undefined;
  method: string;
}

describe('EmailVerifiedGuard', () => {
  let guard: EmailVerifiedGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const makeContext = (
    user: RequestShape['user'],
    method = 'POST',
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: (): RequestShape => ({ user, method }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = { getAllAndOverride: jest.fn() };
    guard = new EmailVerifiedGuard(reflector as unknown as Reflector);
  });

  it('allows requests without an authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows admins regardless of verification state', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(
      guard.canActivate(
        makeContext({ role: UserRole.ADMIN, emailVerified: false }),
      ),
    ).toBe(true);
  });

  it('allows GET requests regardless of verification state', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(
      guard.canActivate(
        makeContext({ role: UserRole.USER, emailVerified: false }, 'GET'),
      ),
    ).toBe(true);
  });

  it('allows verified users on write requests', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(
      guard.canActivate(
        makeContext({ role: UserRole.USER, emailVerified: true }),
      ),
    ).toBe(true);
  });

  it('allows unverified users when route is skipped', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(
      guard.canActivate(
        makeContext({ role: UserRole.USER, emailVerified: false }),
      ),
    ).toBe(true);
  });

  it('throws when an unverified user performs a write request', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(() =>
      guard.canActivate(
        makeContext({ role: UserRole.USER, emailVerified: false }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('checks the skip metadata from both handler and class', () => {
    guard.canActivate(
      makeContext({ role: UserRole.USER, emailVerified: true }),
    );
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      SKIP_EMAIL_VERIFICATION_KEY,
      [expect.anything(), expect.anything()],
    );
  });
});
