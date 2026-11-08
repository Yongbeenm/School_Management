export interface AccessTokenPayload {
  sub: string;
  sid: string;
  schoolId: string;
  av: number;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  schoolId: string;
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}
