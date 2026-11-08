# School Management System

A production-oriented School Management System monorepo built with Next.js, NestJS, PostgreSQL, Prisma, and TypeScript.

## Current implementation

The first foundation slice is implemented:

- Modular npm-workspace monorepo.
- PostgreSQL and Redis Docker development services.
- Prisma schema and migration for Version 1 foundation data.
- Authentication with Argon2id, JWT access tokens, rotating refresh tokens, session revocation, and password-reset structure.
- School-scoped RBAC with seeded roles and permissions.
- Audit log foundation, API versioning, Swagger, validation, rate limiting, CORS, and secure headers.
- Next.js admin portal for dashboard, school settings, academic setup, students, guardians, parents, teachers, staff, enrollments, users, roles, and documents.
- Historical student enrollment workflow with capacity and academic-year validation.
- Local and S3-compatible (AWS S3 / Cloudflare R2) document storage adapters with MIME, size, signature, authorization, and metadata checks.
- Password-reset email delivery via console links locally and SMTP in production.
- Automated API unit tests in CI for permission enforcement and document storage behavior.

Version 2 academic workflows now include timetables, attendance, assignments and submissions,
examinations, marks and GPA, report cards, announcements, and role-specific dashboards.

The tenancy boundary separates platform and school operations. **Super Admin** registers schools,
creates each school’s first **School Admin**, suspends or reactivates schools, and manages global
role templates. **School Admin** manages users, staff, students, academics, settings, fees, and
payments only inside its assigned school. Inactive schools cannot sign in, and platform accounts
do not inherit school operational permissions.

Super Admin also receives read-only [platform business intelligence](docs/platform-business-intelligence.md)
covering accounts, learners, staffing, enrollment, USD/KHR collections, receivables, trends, and
school comparison without exposing school-level payment-entry controls.

The Accountant workspace covers school fee collection. It includes a role-specific home with
currency-separated balances, receivables aging, six-month collection trends, payment-method
breakdowns, and overdue student priorities. Accountants can charge every active student in a
class in one operation, manage individual student fees, record full or partial payments,
review filtered receivables and collections, export CSV reports, and print payment receipts.
Corrections are audited; class charges and payments use request keys to prevent duplicates
when a submission is retried. Amounts in USD and KHR are always reported separately.

To use it, open **My dashboard** as an Accountant. Choose **Charge a class** or open **Student
ledger** to create an individual fee. Record each received payment in the student's ledger,
then open its receipt from the payment history. Use **Receivables** for follow-up and
**Collections** for reconciliation and CSV export. These records reflect payments entered by
staff; the system does not process cards, import bank statements, or provide a general ledger,
tax accounting, or statutory financial statements.

## Prerequisites

- Node.js 24+
- npm 11+
- Docker Desktop for the included PostgreSQL/Redis containers, or a local PostgreSQL instance

## Local setup

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Applications:

```text
Web:     http://localhost:3000
API:     http://localhost:4000/api/v1
Swagger: http://localhost:4000/api/docs
```

Development seed account:

```text
Email:    admin@school.local
Password: ChangeMe123!
```

Change the seed password and every secret before deploying outside local development.

## Useful commands

```bash
npm run build
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
npm run test --workspace @school/api
```

## Documentation

- [Implementation status](docs/implementation-status.md)
- [Production deployment guide](docs/deployment-guide.md)
- The approved architecture blueprint defines the full Version 1–3 plan.
# School_Management
