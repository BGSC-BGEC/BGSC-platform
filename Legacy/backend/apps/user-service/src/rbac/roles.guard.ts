import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../users/enums/user-role.enum';
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

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    if (requiredRoles.includes(user.role ?? UserRole.GUEST)) {
      return true;
    }

    throw new ForbiddenException('Insufficient role for this action');
  }
}
