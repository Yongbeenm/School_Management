import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
