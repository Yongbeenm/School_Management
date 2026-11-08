# Development test accounts

Never run the demo seed in production. `prisma/demo-seed.ts` refuses to run when
`NODE_ENV=production`.

Run the local seed after database migrations:

```bash
npm run db:seed
npm run seed:demo --workspace @school/database
```

Set `DEMO_SEED_PASSWORD` in the local environment before seeding. For a fresh local developer
setup only, the fallback password is `ChangeMe123!`.

| Role | Email |
| --- | --- |
| Super Admin | `admin@school.local` |
| Admin | `admin.demo@school.local` |
| Principal | `principal.demo@school.local` |
| Teacher A | `teacher.demo@school.local` |
| Teacher B | `teacher.b.demo@school.local` |
| Student A | `student.demo@school.local` |
| Student B | `student.b.demo@school.local` |
| Parent A | `parent.demo@school.local` |
| Parent B | `parent.b.demo@school.local` |
| Accountant | `accountant.demo@school.local` |
| Librarian | `librarian.demo@school.local` |

Use `/dev/test-accounts` in a non-production build for the visual workflow checklist. It is not
rendered in production.
