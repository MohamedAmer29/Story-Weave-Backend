import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Access the passport base class so we can spy on super.canActivate.
const passportAuthGuardPrototype = Object.getPrototypeOf(
  Object.getPrototypeOf(new JwtAuthGuard({} as any)),
);

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let superCanActivateSpy: jest.SpyInstance;

  const makeContext = () =>
    ({ getHandler: () => ({}), getClass: () => ({}) }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
    superCanActivateSpy = jest
      .spyOn(passportAuthGuardPrototype, 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => {
    superCanActivateSpy.mockRestore();
  });

  it('bypasses authentication for public handlers', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(makeContext())).toBe(true);
    expect(superCanActivateSpy).not.toHaveBeenCalled();
  });

  it('delegates to the passport guard for non-public handlers', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = makeContext();
    expect(guard.canActivate(ctx)).toBe(true);
    expect(superCanActivateSpy).toHaveBeenCalledWith(ctx);
  });
});
