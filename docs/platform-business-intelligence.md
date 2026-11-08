# Platform business intelligence

The Super Admin dashboard provides executive, read-only intelligence across schools. It does not
grant access to student ledgers or school payment-entry workflows; those remain the responsibility
of each School Admin and Accountant.

## Metrics

- **User accounts** counts non-deleted users with a membership in a current school. Active accounts
  are shown separately.
- **Students and staff** count non-deleted profiles across all schools.
- **Billed** is the total value of non-voided fee charges.
- **Collected** is the value of non-voided payments allocated to non-voided charges.
- **Outstanding** is billed value not yet covered by active payments, never below zero.
- **Overdue** is outstanding value on charges whose due date is before the current date.
- **Collection rate** is collected divided by billed value.
- **Six-month collections** groups active payments by received month and currency.

USD and KHR are always reported independently. The platform does not perform an implicit exchange
rate conversion, which prevents misleading combined totals. These figures describe tuition and fee
receivables, not accounting profit or net income. A future general-ledger module would be required
for expenses, budgets, financial aid, discounts, and true operating-income reporting.

## School comparison

The school-performance table compares registered users, student profiles, active enrollments,
staff, collection rates, and outstanding balances. Super Admin can use these signals to identify a
school that needs attention, then coordinate with its School Admin without editing operational
records directly.
