import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SchoolStatus, UserStatus } from '@school/database';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessTokenPayload, RefreshTokenPayload, TokenPair } from './auth.types';

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
    private readonly mailer: MailerService,
  ) {}

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const user = await this.users.findForAuthentication(dto.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordMatches) throw new UnauthorizedException('Invalid email or password');

    const membership = dto.schoolId
      ? user.schoolMemberships.find((item) => item.schoolId === dto.schoolId)
      : (user.schoolMemberships.find((item) => item.isDefault) ?? user.schoolMemberships[0]);

    if (!membership) throw new UnauthorizedException('No school access is available for this user');
    const isPlatformAdmin = user.userRoles.some(
      (assignment) =>
        assignment.schoolId === membership.schoolId && assignment.role.code === 'SUPER_ADMIN',
    );
    if (membership.school.status !== SchoolStatus.ACTIVE && !isPlatformAdmin) {
      throw new UnauthorizedException('This school is inactive');
    }

    const expiresAt = new Date(Date.now() + this.getDurationMilliseconds('JWT_REFRESH_EXPIRES_IN'));
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenFamilyId: randomUUID(),
        tokenId: randomUUID(),
        refreshTokenHash: 'pending',
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    const context = await this.users.buildAuthenticatedUser(
      user.id,
      session.id,
      membership.schoolId,
    );
    const tokens = await this.issueTokenPair(
      context,
      session.tokenId,
      session.expiresAt,
      user.authorizationVersion,
    );

    await this.prisma.$transaction([
      this.prisma.authSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: await argon2.hash(tokens.refreshToken, { type: argon2.argon2id }),
        },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);

    await this.auditLogs.record({
      schoolId: membership.schoolId,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    return { context, tokens };
  }

  async refresh(refreshToken: string, metadata: RequestMetadata) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }

    if (
      session.tokenId !== payload.jti ||
      !(await argon2.verify(session.refreshTokenHash, refreshToken))
    ) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const newTokenId = randomUUID();
    const context = await this.users.buildAuthenticatedUser(
      session.userId,
      session.id,
      payload.schoolId,
    );
    const tokens = await this.issueTokenPair(
      context,
      newTokenId,
      session.expiresAt,
      session.user.authorizationVersion,
    );

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        tokenId: newTokenId,
        refreshTokenHash: await argon2.hash(tokens.refreshToken, { type: argon2.argon2id }),
        lastUsedAt: new Date(),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    return { context, tokens };
  }

  async logout(user: AuthenticatedUser): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: user.sessionId, userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || user.status !== UserStatus.ACTIVE) return;

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(rawToken, { type: argon2.argon2id });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      await this.mailer.sendPasswordReset(user.email, rawToken);
    } catch (error) {
      // Do not disclose delivery failures or account existence to the requester.
      this.logger.error(
        'Password-reset email delivery failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        user: { email: dto.email.toLowerCase() },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token || !(await argon2.verify(token.tokenHash, dto.token))) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash, authorizationVersion: { increment: 1 } },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokenPair(
    user: AuthenticatedUser,
    refreshTokenId: string,
    refreshTokenExpiresAt: Date,
    authorizationVersion: number,
  ): Promise<TokenPair> {
    const accessTokenExpiresIn = this.getDurationSeconds('JWT_ACCESS_EXPIRES_IN');
    const refreshTokenExpiresIn = Math.max(
      1,
      Math.floor((refreshTokenExpiresAt.getTime() - Date.now()) / 1000),
    );

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      sid: user.sessionId,
      schoolId: user.schoolId,
      av: authorizationVersion,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      sid: user.sessionId,
      jti: refreshTokenId,
      schoolId: user.schoolId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(Date.now() + accessTokenExpiresIn * 1000),
      refreshTokenExpiresAt,
    };
  }

  private getDurationMilliseconds(key: string): number {
    return this.getDurationSeconds(key) * 1000;
  }

  private getDurationSeconds(key: string): number {
    const value = this.config.getOrThrow<string>(key);
    const match = /^(\d+)(s|m|h|d)$/.exec(value);
    if (!match) throw new Error(`${key} must be a duration such as 15m or 14d`);

    const amount = Number(match[1]);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * multipliers[match[2]];
  }
}
