# Permission catalog and default matrix

## Convention

Every code uses `resource.action`. `resource` is singular and stable; `action` is a narrowly
defined operation. There are no broad `academic.manage`, `marks.manage`, or `system.manage`
grants. The executable, canonical catalog and defaults are in
`packages/database/prisma/seed.ts`; running the seed is idempotent.

## Permission families

| Family                            | Codes                                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/security                 | `user.read/create/update/status.update/role.assign`, `role.read/manage`, `permission.read/manage`, `audit.read`, `school.read/manage`, `settings.manage` |
| People                            | `student.*`, `teacher.*`, `parent.*`, `enrollment.create/read/update`                                                                                    |
| Academic structure                | `academic_year.*`, `semester.create/read/update/close`, `grade.*`, `class.*`, `subject.*`, `class_subject.*`, `room.*`, `timetable.*`                    |
| Attendance                        | `attendance.create/read/update/override/report`                                                                                                          |
| Assignments                       | `assignment.create/read/update/publish/close/delete/submit/grade`                                                                                        |
| Assessment                        | `exam.create/read/update/publish/lock`, `mark.create/read/update/override/publish`, `grading_scale.read/manage`                                          |
| Reports                           | `report_card.read/generate/publish/approve/download`, `report.view`, `result.approve`                                                                    |
| Communication/files               | `announcement.create/read/update/archive`, `notification.read`, `document.read/manage`, `portal.read`                                                    |
| Finance                           | `fee.create/read/update`, `payment.create/read/void`; discount, scholarship, and financial-report grants remain reserved                                 |
| Library (ready for future module) | `library.book.*`, `library.copy.*`, `library.borrowing.create/read/update/return`                                                                        |

## Default role matrix

| Role         | Scope    | Granted families                                                                              | Restrictions                                                            |
| ------------ | -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Super Admin  | GLOBAL   | Platform dashboard, schools, global role templates, permissions, and platform audit           | Cannot manage school staff, learners, academics, or finance             |
| School Admin | SCHOOL   | School users, people, academics, attendance, assessment, finance, communication, and settings | Cannot create schools or change platform role/permission infrastructure |
| Principal    | SCHOOL   | School-wide read/review, report-card approval, result review                                  | No normal registration or mark entry                                    |
| Teacher      | ASSIGNED | Assigned learners, timetable, attendance, assignments, exams, mark entry, report reading      | Cannot reach another teacher's class subject; no override grant         |
| Student      | OWN      | Own profile/enrollment/timetable/attendance/assignments/submission/exams/marks/report card    | Only published learning content and own record                          |
| Parent       | LINKED   | Linked child profile/enrollment/timetable/attendance/assignments/exams/marks/report card      | Cannot write academic records                                           |
| Accountant   | SCHOOL   | Finance and minimum student/parent lookup                                                     | No marks, GPA, attendance-detail, assignment, or report-card permission |
| Librarian    | SCHOOL   | Library and limited student lookup                                                            | No marks, GPA, attendance-detail, assignment, or report-card permission |

## High-risk permissions

| Permission            | Intended grant                               | Additional rule                                                    |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `attendance.override` | Explicitly selected administrative role only | Audit old/new attendance data and actor                            |
| `mark.override`       | Explicitly selected administrative role only | Published mark changes are rejected without this grant and audited |
| `report_card.publish` | Admin                                        | Sets publication time and audit event                              |
| `report_card.approve` | Principal                                    | Sets approved status and audit event                               |
| `payment.void`        | Accountant or School Admin                   | Retains the record and captures reason, actor, and time            |
| `user.status.update`  | School Admin                                 | Increments authorization version and ends future protected access  |

## Custom staff roles

Custom staff roles are supported because roles and grants live in the database. A registrar, for
example, can be granted `student.create`, `student.read`, `student.update`, `enrollment.create`,
`enrollment.read`, and `enrollment.update` at `SCHOOL` scope without becoming an administrator.
