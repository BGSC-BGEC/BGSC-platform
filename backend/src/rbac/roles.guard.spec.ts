import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../users/user-role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
  });

  it('allows routes with no required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const request = { headers: {} };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request).toMatchObject({ user: { role: UserRole.GUEST } });
  });

  it('allows a matching role and attaches the current user', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.COORDINATOR]);
    const request = {
      headers: {
        'x-user-id': 'user-id',
        'x-user-role': UserRole.COORDINATOR,
      },
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request).toMatchObject({
      user: { id: 'user-id', role: UserRole.COORDINATOR },
    });
  });

  it('rejects users without the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.FOUNDER]);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(
        makeContext({ headers: { 'x-user-role': UserRole.COORDINATOR } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects invalid role headers', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.USER]);
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() =>
      guard.canActivate(makeContext({ headers: { 'x-user-role': 'admin' } })),
    ).toThrow(ForbiddenException);
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
