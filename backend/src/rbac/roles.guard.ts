import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../users/user-role.enum';
import { ROLES_KEY } from './roles.decorator';

type RequestWithUser = Request & {
  user?: {
    id?: string;
    role?: UserRole;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const role = this.resolveRole(request);
    const userId = this.resolveHeader(request, 'x-user-id');

    // Temporary bridge until Auth Service attaches the authenticated user to the request.
    request.user = { id: userId, role };

    if (!requiredRoles?.length) {
      return true;
    }

    if (requiredRoles.includes(role)) {
      return true;
    }

    throw new ForbiddenException('Insufficient role for this action');
  }

  private resolveRole(request: Request): UserRole {
    const roleHeader = this.resolveHeader(request, 'x-user-role');

    if (!roleHeader) {
      return UserRole.GUEST;
    }

    if (Object.values(UserRole).includes(roleHeader as UserRole)) {
      return roleHeader as UserRole;
    }

    throw new ForbiddenException('Invalid user role');
  }

  private resolveHeader(request: Request, name: string): string | undefined {
    const value = request.headers[name];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }
}
