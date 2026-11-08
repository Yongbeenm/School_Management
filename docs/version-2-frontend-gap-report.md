# Version 2 Frontend Gap Report

Audit date: 2026-10-28. This report was prepared before the frontend completion work.

## Current structure

- Next.js App Router frontend in `apps/web/src/app`.
- An administration shell with permission-filtered sidebar navigation.
- Pages existed for authentication, admin setup/operations, notifications, and three role portals.
- TanStack Query was already used on most pages and the API client was centralized in
  `apps/web/src/lib/api.ts`.
- The initial portals only exposed compact dashboard summaries; there were no role-specific
  navigation paths to the full operational pages.

## Feature inventory

| Feature | Backend API | Existing page | Connected | Testable before work | Issue / priority |
| --- | --- | --- | --- | --- | --- |
| Authentication | `/auth/*` | Login, forgotten/reset password | Yes | Yes | Role landing decision omitted Principal and non-portal roles. High |
| Users / roles | `/users`, `/roles`, `/permissions` | `/admin/users` | Partial | Partial | Roles existed but permission-scope editing was not exposed. High |
| School profile | `/schools/current` | `/admin/settings` | Yes | Yes | No navigation/action feedback consistency. Medium |
| Students | `/students`, guardian endpoints | `/admin/students` | Partial | Partial | No search/filter/pagination/detail; guardian unlink absent. High |
| Parents | `/parents` | `/admin/parents` | Partial | Partial | No linked-child detail flow. High |
| Teachers/staff | `/teachers`, `/staff` | `/admin/teachers` | Partial | Partial | No profile detail, assignment or timetable view. High |
| Academic setup | Academic year/semester/grade/class/subject APIs | `/admin/academic` | Yes | Mostly | Large page was usable but not permission-action aware and lacked clear related links. Medium |
| Enrollment | `/enrollments`, class/student lookup | `/admin/enrollments` | Partial | Partial | No search/history guidance or student detail link. High |
| Class subjects | `/teaching-assignments` | `/admin/teaching-assignments` | Partial | Partial | Missing clear status/detail and related timetable links. High |
| Rooms | `/rooms` | `/admin/rooms` | Partial | Partial | Backend has no room type/building/floor fields; UI must not fake them. Medium |
| Timetable | `/timetable` | `/admin/timetable` | Partial | Partial | No weekly grouped view, filters, or useful related navigation. High |
| Attendance | `/attendance/*` | `/admin/attendance` | Partial | Partial | Does not expose notes/editing history/summary in a role-friendly way. High |
| Assignments / submissions | `/assignments/*` | `/admin/assignments` | Partial | Partial | Actions available but not properly separated by role or linked from dashboards. High |
| Exams / marks / grading | `/exams`, `/exam-subjects`, `/grading-scales` | `/admin/exams` | Partial | Partial | Dense all-in-one screen; missing clear result-review workflow and permission-aware controls. High |
| GPA / report cards | `/report-cards/*` | `/admin/report-cards`, portal cards | Partial | Partial | Publication/approval controls were missing from the visible workflow. High |
| Announcements | `/announcements` | `/admin/announcements` | Partial | Partial | No edit/publish API exists; create/archive only. Must be documented rather than faked. Medium |
| Notifications | `/notifications` | `/notifications` | Partial | Partial | No unread count/dropdown or resource link support in API response. Medium |
| Admin dashboard | `/dashboard/admin` | `/admin` | Partial | Partial | No quick actions, active-semester/upcoming activity, or links to workflows. High |
| Teacher dashboard | `/dashboard/teacher` | `/teacher` | Partial | Partial | Summary only; no direct route links to timetable, attendance, assignments, or marks. High |
| Student dashboard | `/dashboard/student` | `/student` | Partial | Partial | Summary and submission only; no navigable results/report-card/attendance views. High |
| Parent dashboard | `/dashboard/parent` | `/parent` | Partial | Partial | Summary only; no child-focused navigation or detailed academic views. High |
| Principal dashboard | `/dashboard/admin` | None | No | No | Principal had no intended landing/dashboard route. High |
| Development testing | Seed scripts | None | N/A | Partial | Demo data existed for one teacher/student/parent, not all roles; no visual test-account/checklist page. High |
| E2E browser tests | N/A | None | N/A | No | Playwright configuration and test suite absent. High |

## Backend constraints discovered

These are intentionally not fabricated in the UI:

1. Room type, building, floor, campus-management screens, homeroom teacher, subject credits,
   exam room/end time/passing score, report-card PDF export, announcement editing, notification
   resource URLs, and mark publish/lock endpoints are not present in Version 2 APIs.
2. Attendance sessions are upserted through the take-attendance endpoint. There is no distinct
   correction/override endpoint, so the UI labels the action as updating the selected register.
3. Finance, library, and cross-school administration permissions are seeded for future modules but
   have no Version 2 APIs. They remain outside this frontend task.

## Completion sequence

1. Make every existing operational page discoverable from role-aware navigation and dashboards.
2. Add detail panels, search/pagination, related-record links, clear loading/empty/error states,
   and missing guardian lifecycle controls.
3. Split the role portals into navigable real-data views for timetable, attendance, assignments,
   results, and report cards.
4. Improve the administrative dashboard, test-account/dev checklist, and API capability notes.
5. Add browser workflow coverage where the local browser/runtime permits it.
