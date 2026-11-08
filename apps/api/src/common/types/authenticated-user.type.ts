import { PermissionScope } from '@school/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
  schoolId: string;
  roles: string[];
  permissions: string[];
  permissionScopes: Record<string, PermissionScope[]>;
}
