import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../src/users/enums/user-role.enum';
import { RolesGuard } from '../src/rbac/roles.guard';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
  });

  it('allows routes with no required roles regardless of auth state', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(makeContext({ user: undefined }))).toBe(true);
    expect(guard.canActivate(makeContext({ user: { id: 'u1', role: UserRole.USER } }))).toBe(true);
  });

  it('allows a user whose role matches the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.COORDINATOR]);
    const request = { user: { id: 'user-id', role: UserRole.COORDINATOR } };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(makeContext(request))).toBe(true);
  });

  it('throws ForbiddenException when user role is insufficient', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.FOUNDER]);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(makeContext({ user: { id: 'u1', role: UserRole.COORDINATOR } })),
    ).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when no authenticated user is present', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(makeContext({ user: undefined })),
    ).toThrow(UnauthorizedException);
  });
});

function makeContext(request: object): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  } as unknown as ExecutionContext;
}
