# Version 2 browser checklist

Run the demo seed first in a non-production environment, then start the API and web app with
`npm run dev`. Open `/dev/test-accounts` to choose a development-only account. The seed password
is intentionally configured with `DEMO_SEED_PASSWORD`; it is never displayed by that page.

## Administrator

- Sign in as the Admin demo account and confirm the administration overview loads real counts,
  recent students, enrolment totals, active semesters, examinations, and announcements.
- Add or edit a student, link a guardian, then use **Unlink** with its confirmation prompt.
- Create an enrolment, teaching assignment, timetable slot, announcement, assignment, exam,
  mark, and report-card lifecycle transition using the appropriate screens.
- Confirm the Users & access area is reachable only for an account with the permissions shown.

## Teacher

- Sign in as a teacher and confirm the teacher workspace contains assigned class subjects,
  upcoming work, and timetable information.
- Open Attendance, choose the assigned class subject, and save a register.
- Create/publish an assignment, then review and grade a submission.
- Open Exams & marks and enter marks only for the teacher's assigned class subject.

## Student and parent

- Sign in as a student and confirm the dashboard shows only personal timetable, attendance,
  assignments, submitted-work status, published marks, GPA, and report cards.
- Submit an assignment from the student workspace and verify it appears for the teacher.
- Sign in as a parent, select each linked child, and verify timetable, attendance, assignments,
  published results, and report cards are child-scoped.

## Read-only and safety checks

- Sign in as a Principal and verify read-only student, timetable, exam, report-card, and
  announcement pages do not expose mutation controls.
- Open the browser network panel when switching users to confirm protected responses are scoped
  by the API. The server remains the authorization boundary; hidden UI controls are only a
  usability guard.
- The included browser suite covers Administrator, Teacher, Student, Parent, and read-only
  Principal workflows: `npm run test:e2e --workspace @school/web`.
- Cross-school isolation is unit-tested in the API authorization suite. A second-school browser
  fixture is deliberately not created by the normal demo seed, so it requires an isolated
  multi-school test database before it can be exercised as browser E2E coverage.
