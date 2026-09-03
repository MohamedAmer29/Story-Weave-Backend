import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../database/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const makeContext = (user: any) => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: UserRole.USER }))).toBe(true);
  });

  it('allows when required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeContext({ role: UserRole.USER }))).toBe(true);
  });

  it('throws when user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('throws when user has no role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('allows when user role is in the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
      UserRole.MANAGER,
    ]);
    expect(guard.canActivate(makeContext({ role: UserRole.MANAGER }))).toBe(
      true,
    );
  });

  it('throws when user role is not required', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() =>
      guard.canActivate(makeContext({ role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('looks up roles from both handler and class', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
    guard.canActivate(makeContext({ role: UserRole.USER }));
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });
});
