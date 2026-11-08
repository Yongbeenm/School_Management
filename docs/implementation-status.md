# Implementation status

## Completed Version 1

- npm workspaces for API, web, database, shared types, and validation.
- Docker Compose services for PostgreSQL and Redis.
- Prisma Version 1 schema for tenancy, identity, RBAC, people, academic setup, enrollment, documents, settings, and audit logs.
- Secure NestJS API baseline with versioned endpoints, Swagger, validation, CORS, Helmet, rate limiting, and consistent API/error responses.
- JWT access tokens, refresh-token rotation, session revocation, SMTP/console password-reset delivery, and audit logging for login events.
- Initial RBAC roles and permissions seed data, user administration, status control, custom roles, and permission assignment APIs.
- School settings; academic years, semesters, grades, subjects, and classes.
- Student, parent/guardian, staff, teacher, enrollment-history, dashboard, and document-management APIs.
- Admin portal screens for every Version 1 operational workflow, including edit/archive controls for operational records.
- Local and S3-compatible document storage with MIME/signature validation and authorization checks.
- Automated API unit tests for permission enforcement and document storage behavior, executed in CI.
- Runtime validation of login, token rotation, RBAC, academic setup, people management, guardian links, enrollment, dashboard, and document upload/download/archive.

## Completed after Version 1

- Version 2 academic delivery: teaching assignments, timetables, attendance, assignments,
  submissions, examinations, marks, grading, report cards, announcements, and teacher, student,
  parent, principal, admin, and super admin dashboards.
- Multi-school platform administration: Super Admin can register and suspend schools, create each
  school’s first School Admin, review platform activity, and manage global role templates. School
  Admin owns users, staff, learners, academics, settings, and finance within one school.
- Super Admin business intelligence for platform accounts, students, staff, active enrollment,
  USD/KHR billing and collections, outstanding and overdue receivables, six-month collection
  trends, and cross-school performance comparison.
- Accountant fee and payment records per student, including USD/KHR balances, partial payments,
  payment voids, audit history, and school-scoped API checks.

The Accountant payment screen records payments already received. Online payment processing,
invoice PDFs, discounts, scholarships, and library borrowing remain separate modules.
