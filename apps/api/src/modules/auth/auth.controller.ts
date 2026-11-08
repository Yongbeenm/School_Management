import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, this.requestMetadata(request));
    this.setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);
    return {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
      user: this.toClientUser(result.context),
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = dto.refreshToken ?? request.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('Refresh token is required');

    const result = await this.authService.refresh(refreshToken, this.requestMetadata(request));
    this.setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);
    return {
      accessToken: result.tokens.accessToken,
      accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
      user: this.toClientUser(result.context),
    };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user);
    response.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getPublicProfile(user.id, user.schoolId).then((profile) => ({
      ...profile,
      roles: user.roles,
      permissions: user.permissions,
      permissionScopes: user.permissionScopes,
    }));
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: 'If the account exists, password reset instructions will be sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(204)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }

  private setRefreshCookie(response: Response, token: string, expires: Date): void {
    response.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      expires,
      path: '/api/v1/auth',
    });
  }

  private requestMetadata(request: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }

  private toClientUser(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      schoolId: user.schoolId,
      roles: user.roles,
      permissions: user.permissions,
      permissionScopes: user.permissionScopes,
    };
  }
}
