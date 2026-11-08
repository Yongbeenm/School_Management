-- Adds scopes to existing grants. The default preserves the previous school-bound
-- behaviour until the idempotent authorization seed assigns explicit scopes.
CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'SCHOOL', 'ASSIGNED', 'LINKED', 'OWN');

ALTER TABLE "Permission"
  ADD COLUMN "action" TEXT,
  ADD COLUMN "module" TEXT;

ALTER TABLE "RolePermission"
  ADD COLUMN "scope" "PermissionScope" NOT NULL DEFAULT 'SCHOOL';
