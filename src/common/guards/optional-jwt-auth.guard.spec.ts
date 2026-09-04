import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  describe('handleRequest', () => {
    it('returns undefined user when no user present (anonymous access)', () => {
      expect(guard.handleRequest(null, undefined)).toBeUndefined();
      expect(guard.handleRequest(undefined, null)).toBeUndefined();
    });

    it('returns undefined when an error occurs', () => {
      expect(
        guard.handleRequest(new Error('boom'), { id: 'u1' }),
      ).toBeUndefined();
    });

    it('returns the user when authentication succeeds', () => {
      const user = { id: 'u1', role: 'USER' };
      expect(guard.handleRequest(null, user)).toBe(user);
    });
  });
});
