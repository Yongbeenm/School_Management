import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@school/database';
import { jest } from '@jest/globals';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('rejects disabled users before attaching an authenticated context', async () => {
    const findSession = jest.fn<() => Promise<unknown>>().mockResolvedValue({
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { status: UserStatus.DEACTIVATED, authorizationVersion: 1 },
    });
    const prisma = {
      authSession: {
        findUnique: findSession,
      },
    } as unknown as PrismaService;
    const users = { buildAuthenticatedUser: jest.fn() } as unknown as UsersService;
    const config = { getOrThrow: jest.fn().mockReturnValue('test-only-secret') } as unknown as ConfigService;
    const strategy = new JwtStrategy(config, prisma, users);

    await expect(strategy.validate({ sub: 'user-1', sid: 'session-1', schoolId: 'school-1', av: 1, type: 'access' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.buildAuthenticatedUser).not.toHaveBeenCalled();
  });
});
