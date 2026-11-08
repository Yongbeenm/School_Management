# Security and authorization verification

## Security controls

- JWT validation checks token type, session revocation/expiry, active account status, and the
  user's authorization version before attaching request context.
- The global permission guard requires every permission declared by the endpoint.
- Scope policies constrain queries in the database rather than filtering broad result sets in the
  browser.
- Mutating teacher operations prove ownership of the related `TeachingAssignment`.
- Student and parent access is derived from profile ownership or the `StudentParent` relationship,
  never from a submitted URL ID alone.
- Student/parent views only return published assignments/exams/results and published or approved
  report cards.
- Sensitive actions create audit events, including role assignment, permission changes, account
  status changes, mark changes, report-card publication/approval, and attendance updates.

## Verification coverage

Automated tests cover the following denial paths:

| Scenario                                                             | Expected result                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| Teacher reads unrelated class student                                | `403` policy rejection / no matching scoped row      |
| Teacher takes attendance for another teacher                         | `403` assignment policy rejection                    |
| Teacher updates another teacher's mark                               | `403` assignment policy rejection                    |
| Student requests another student's marks, attendance, or report card | `403` student policy rejection                       |
| Parent requests an unlinked child                                    | `403` parent-child policy rejection                  |
| Parent modifies marks                                                | Permission guard denial                              |
| Accountant reads marks                                               | Permission guard denial                              |
| Librarian reads report cards/GPA                                     | Permission guard denial                              |
| Admin tries to override marks without grant                          | Scope/grant check returns false, write is rejected   |
| Deactivated user sends a protected request                           | JWT strategy rejects before user context is attached |

Run them with:

```bash
npm run typecheck
npm test --workspace @school/api
```

## Operational guidance

1. Run database migrations before deploying application code.
2. Run `npm run db:seed` after deployment to add new standard permissions and roles. Existing
   role grants are preserved so administrator edits are not reset.
3. Review `RolePermission` scope changes as privileged security changes.
4. Give override permissions individually; they are intentionally absent from the standard Admin
   template.
5. Keep audit logs and database backups according to school retention requirements.
6. Test direct API calls with users from each role after changing custom grants; hidden UI controls
   are never a substitute for the backend policy.

## Limits and future modules

Student fee and manually recorded payment APIs enforce school scope, positive amounts, remaining
balances, idempotent payment requests, and audited void operations. Library permissions remain
reserved for a future library module.
