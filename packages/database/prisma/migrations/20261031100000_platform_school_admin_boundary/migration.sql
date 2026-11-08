-- Super Admin owns platform operations only.
DELETE FROM "RolePermission"
WHERE "roleId" = (SELECT "id" FROM "Role" WHERE "code" = 'SUPER_ADMIN');

INSERT INTO "RolePermission" ("roleId", "permissionId", "scope", "createdAt")
SELECT role_row."id", permission_row."id", 'GLOBAL'::"PermissionScope", CURRENT_TIMESTAMP
FROM "Role" role_row
JOIN "Permission" permission_row ON permission_row."code" IN (
  'dashboard.read',
  'school.read',
  'school.manage',
  'role.read',
  'role.manage',
  'permission.read',
  'permission.manage',
  'audit.read'
)
WHERE role_row."code" = 'SUPER_ADMIN'
ON CONFLICT ("roleId", "permissionId") DO UPDATE SET "scope" = EXCLUDED."scope";

-- School Admin owns all school operations and cannot administer the platform boundary.
UPDATE "Role" SET "name" = 'School Admin' WHERE "code" = 'ADMIN';

INSERT INTO "RolePermission" ("roleId", "permissionId", "scope", "createdAt")
SELECT role_row."id", permission_row."id", 'SCHOOL'::"PermissionScope", CURRENT_TIMESTAMP
FROM "Role" role_row
JOIN "Permission" permission_row ON permission_row."code" NOT IN (
  'school.manage',
  'role.manage',
  'permission.manage'
)
WHERE role_row."code" = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO UPDATE SET "scope" = EXCLUDED."scope";

DELETE FROM "RolePermission"
WHERE "roleId" = (SELECT "id" FROM "Role" WHERE "code" = 'ADMIN')
  AND "permissionId" IN (
    SELECT "id" FROM "Permission"
    WHERE "code" IN ('school.manage', 'role.manage', 'permission.manage')
  );

-- Existing sessions must refresh their authorization snapshot.
UPDATE "User"
SET "authorizationVersion" = "authorizationVersion" + 1
WHERE "id" IN (
  SELECT DISTINCT user_role."userId"
  FROM "UserRole" user_role
  JOIN "Role" role_row ON role_row."id" = user_role."roleId"
  WHERE role_row."code" IN ('SUPER_ADMIN', 'ADMIN')
);
