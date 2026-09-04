import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user.entity';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminStoriesController } from './controllers/admin-stories.controller';
import { AdminSystemController } from './controllers/admin-system.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

describe('Admin authorization', () => {
  describe('Admin controllers enforce @Roles(ADMIN)', () => {
    const controllers = [
      AdminDashboardController,
      AdminUsersController,
      AdminStoriesController,
      AdminSystemController,
    ];

    it.each(controllers)('%s requires ADMIN on every handler', (Controller) => {
      const reflector = new Reflector();
      const prototype = Controller.prototype;
      const classRoles = reflector.get<Array<UserRole>>(ROLES_KEY, Controller);
      Object.getOwnPropertyNames(prototype).forEach((key) => {
        if (key === 'constructor') return;
        const handler = prototype[key];
        if (typeof handler !== 'function') return;
        const handlerRoles = reflector.get<Array<UserRole>>(ROLES_KEY, handler);
        const roles =
          handlerRoles && handlerRoles.length > 0 ? handlerRoles : classRoles;
        expect(roles).toBeDefined();
        expect(roles).toContain(UserRole.ADMIN);
      });
    });
  });

  describe('RolesGuard with admin routes', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      guard = new RolesGuard(reflector);
    });

    function ctx(role?: UserRole) {
      const handler = AdminUsersController.prototype.updateRole;
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.ADMIN]);
      return {
        getHandler: () => handler,
        getClass: () => AdminUsersController,
        switchToHttp: () => ({
          getRequest: () => ({ user: role ? { role } : undefined }),
        }),
      } as any;
    }

    it('allows ADMIN users', () => {
      expect(guard.canActivate(ctx(UserRole.ADMIN))).toBe(true);
    });

    it('rejects USER users', () => {
      expect(() => guard.canActivate(ctx(UserRole.USER))).toThrow(
        ForbiddenException,
      );
    });

    it('rejects MANAGER users', () => {
      expect(() => guard.canActivate(ctx(UserRole.MANAGER))).toThrow(
        ForbiddenException,
      );
    });

    it('rejects unauthenticated (no role)', () => {
      expect(() => guard.canActivate(ctx(undefined))).toThrow(
        ForbiddenException,
      );
    });
  });
});
