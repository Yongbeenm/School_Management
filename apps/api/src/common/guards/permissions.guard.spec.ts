import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import { PermissionsGuard } from './permissions.guard';

const contextFor = (permissions: string[]): ExecutionContext => ({
  getHandler: () => undefined,
  getClass: () => undefined,
  switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
} as unknown as ExecutionContext);

describe('PermissionsGuard', () => {
  it('allows routes that do not declare permissions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(contextFor([]))).toBe(true);
  });

  it('allows a user who has every granular permission required by a route', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['student.read', 'student.update']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(contextFor(['student.update', 'student.read']))).toBe(true);
  });

  it.each([
    ['parent', ['mark.read'], 'mark.update'],
    ['accountant', ['fee.read'], 'mark.read'],
    ['librarian', ['library.book.read'], 'report_card.read'],
  ])('denies %s when the academic permission %s is missing', (_role, granted, required) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([required]) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(contextFor(granted))).toBe(false);
  });
});
