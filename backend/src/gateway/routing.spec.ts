import {
  isAuthAttempt,
  isAuthServiceRoute,
  isProtectedRoute,
  isUserServiceRoute,
} from './routing';

describe('routing', () => {
  describe('isProtectedRoute', () => {
    it.each([
      '/users',
      '/users/me',
      '/users/123',
      '/account',
      '/account/delete',
      '/auth/logout',
      '/auth/logout-all',
      '/auth/change-password',
      '/auth/sessions',
      '/auth/sessions/abc',
      '/users/me?foo=bar',
    ])('treats %s as protected', (url) => {
      expect(isProtectedRoute(url)).toBe(true);
    });

    it.each([
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/google',
      '/auth/google/callback',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/totp/verify',
      '/health',
      '/',
    ])('treats %s as public', (url) => {
      expect(isProtectedRoute(url)).toBe(false);
    });

    it('does not treat lookalike prefixes as protected', () => {
      expect(isProtectedRoute('/users-export')).toBe(false);
      expect(isProtectedRoute('/accounts')).toBe(false);
    });
  });

  describe('isAuthAttempt', () => {
    it('flags POST login/register only', () => {
      expect(isAuthAttempt('POST', '/auth/login')).toBe(true);
      expect(isAuthAttempt('post', '/auth/register')).toBe(true);
      expect(isAuthAttempt('POST', '/auth/login?x=1')).toBe(true);
    });

    it('ignores non-POST and other paths', () => {
      expect(isAuthAttempt('GET', '/auth/login')).toBe(false);
      expect(isAuthAttempt('POST', '/auth/refresh')).toBe(false);
      expect(isAuthAttempt('POST', '/users')).toBe(false);
    });
  });

  describe('service routing', () => {
    it('routes auth + account to the auth service', () => {
      expect(isAuthServiceRoute('/auth/login')).toBe(true);
      expect(isAuthServiceRoute('/account/delete')).toBe(true);
      expect(isAuthServiceRoute('/users/me')).toBe(false);
    });

    it('routes users to the user service', () => {
      expect(isUserServiceRoute('/users/me')).toBe(true);
      expect(isUserServiceRoute('/auth/login')).toBe(false);
    });
  });
});
