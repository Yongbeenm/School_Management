-- A platform Super Admin must not also inherit a school operational role.
DELETE FROM "UserRole"
WHERE "userId" IN (
  SELECT DISTINCT super_assignment."userId"
  FROM "UserRole" super_assignment
  JOIN "Role" super_role ON super_role."id" = super_assignment."roleId"
  WHERE super_role."code" = 'SUPER_ADMIN'
)
AND "roleId" <> (SELECT "id" FROM "Role" WHERE "code" = 'SUPER_ADMIN');

UPDATE "User"
SET "authorizationVersion" = "authorizationVersion" + 1
WHERE "id" IN (
  SELECT DISTINCT user_role."userId"
  FROM "UserRole" user_role
  JOIN "Role" role_row ON role_row."id" = user_role."roleId"
  WHERE role_row."code" = 'SUPER_ADMIN'
);
