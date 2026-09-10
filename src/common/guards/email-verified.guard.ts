import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_EMAIL_VERIFICATION_KEY } from '../decorators/skip-email-verification.decorator';

interface RequestUser {
  id?: string;
  email?: string;
  role?: string;
  emailVerified?: boolean;
}

/** Blocks authenticated mutations until the user's email has been verified. */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: RequestUser; method?: string }>();
    const user = request.user;

    // Public and optional-auth routes have no authenticated user.
    if (!user) return true;
    // Admins are system-provisioned and trusted.
    if (user.role === 'ADMIN') return true;
    // Reads are always allowed.
    if (request.method === 'GET') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    if (user.emailVerified) return true;

    throw new ForbiddenException({
      errorCode: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email to perform this action',
    });
  }
}
