import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const password = process.env.E2E_PASSWORD ?? 'ChangeMe123!';

async function signIn(page: Page, email: string, destination: string, accountPassword = password) {
  await page.goto('/auth/login');
  // Next's development server streams the initial form before hydration. Waiting for
  // the client to attach prevents a native GET form submission during test startup.
  await page.waitForTimeout(600);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(accountPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}

test.describe('Version 2 school workflows', () => {
  test('super admin sees schools and platform activity', async ({ page }) => {
    await signIn(
      page,
      'admin@school.local',
      '/admin/super',
      process.env.E2E_SUPER_ADMIN_PASSWORD ?? password,
    );
    await expect(page.getByRole('heading', { name: 'Super admin dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revenue and receivables' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Six-month collections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'School performance' })).toBeVisible();
    await expect(page.getByText('User accounts', { exact: true })).toBeVisible();
    await expect(page.getByText('USD collections', { exact: true })).toBeVisible();
    await expect(page.getByText('KHR collections', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recently added schools' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent changes' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Schools & administrators/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users & access' })).toHaveCount(0);
  });

  test('super admin can review and edit a role permission draft', async ({ page }) => {
    await signIn(
      page,
      'admin@school.local',
      '/admin/super',
      process.env.E2E_SUPER_ADMIN_PASSWORD ?? password,
    );
    await page.getByRole('link', { name: 'Role permissions' }).first().click();
    await expect(page.getByRole('heading', { name: 'Role permissions' })).toBeVisible();
    await page.getByLabel('Edit role').selectOption('TEACHER');
    await page.getByLabel('Find a permission').fill('assignment.grade');
    const grant = page.getByRole('checkbox', { name: 'Grant assignment.grade' });
    await expect(grant).toBeVisible();
    const original = await grant.isChecked();
    await grant.setChecked(!original);
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(grant).toBeChecked({ checked: original });
    await page.getByLabel('Edit role').selectOption('SUPER_ADMIN');
    await expect(page.getByRole('button', { name: 'Save permissions' })).toBeDisabled();
  });

  test('super admin manages schools without school operational access', async ({
    page,
    request,
  }) => {
    await signIn(
      page,
      'admin@school.local',
      '/admin/super',
      process.env.E2E_SUPER_ADMIN_PASSWORD ?? password,
    );
    await page.getByRole('link', { name: 'Schools & administrators' }).first().click();
    await expect(page.getByRole('heading', { name: 'Schools & administrators' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add a school' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Platform schools' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create school and admin' })).toBeVisible();

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
    const login = await request.post(`${apiBase}/auth/login`, {
      data: {
        email: 'admin@school.local',
        password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? password,
      },
    });
    const body = (await login.json()) as { data: { accessToken: string } };
    const denied = await request.get(`${apiBase}/users`, {
      headers: { Authorization: `Bearer ${body.data.accessToken}` },
    });
    expect(denied.status()).toBe(403);
  });

  test('administrator reaches the real overview and role-management entry point', async ({
    page,
  }) => {
    await signIn(page, 'admin.demo@school.local', '/admin');
    await expect(page.getByRole('heading', { name: 'School overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users & access' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'School settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Student ledger' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recommended setup order' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Role permissions' })).toHaveCount(0);
    await page.goto('/admin/access');
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('only Super Admin can update role grants through the API', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
    const login = await request.post(`${apiBase}/auth/login`, {
      data: { email: 'admin.demo@school.local', password },
    });
    expect(login.ok()).toBeTruthy();
    const body = (await login.json()) as { data: { accessToken: string } };
    const denied = await request.put(
      `${apiBase}/roles/00000000-0000-0000-0000-000000000000/permissions`,
      {
        headers: { Authorization: `Bearer ${body.data.accessToken}` },
        data: { grants: [] },
      },
    );
    expect(denied.status()).toBe(403);
  });

  test('teacher can reach the attendance, assignment, and marks workflows', async ({ page }) => {
    await signIn(page, 'teacher.demo@school.local', '/teacher');
    await expect(page.getByRole('heading', { name: 'Teacher dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your tools' })).toBeVisible();
    await page.getByRole('link', { name: 'Attendance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Attendance', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Assignments', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Assignments', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Exams & marks' }).click();
    await expect(page.getByRole('heading', { name: 'Exams, marks & GPA' })).toBeVisible();
  });

  test('student sees only the student workspace and personal academic data', async ({ page }) => {
    await signIn(page, 'student.demo@school.local', '/student');
    await expect(page.getByRole('heading', { name: 'Student dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My learning' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weekly timetable' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent marks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit work' })).toHaveCount(0);
  });

  test('parent can select a linked child and view scoped results', async ({ page }) => {
    await signIn(page, 'parent.demo@school.local', '/parent');
    await expect(page.getByRole('heading', { name: 'Parent dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: "My children's progress" })).toBeVisible();
    await expect(page.getByLabel('Select child')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Published results' })).toBeVisible();
  });

  test('read-only principal view does not expose student mutation controls', async ({ page }) => {
    await signIn(page, 'principal.demo@school.local', '/admin/principal');
    await expect(page.getByRole('heading', { name: 'Principal dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Awaiting your approval' })).toBeVisible();
    await page.getByRole('link', { name: 'Student directory' }).click();
    await expect(
      page.getByRole('heading', { name: 'Students', exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add student' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Unlink' })).toHaveCount(0);
  });

  test('dashboard API denies access across roles', async ({ request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
    const login = await request.post(`${apiBase}/auth/login`, {
      data: { email: 'principal.demo@school.local', password },
    });
    expect(login.ok()).toBeTruthy();
    const body = (await login.json()) as { data: { accessToken: string } };
    const headers = { Authorization: `Bearer ${body.data.accessToken}` };
    const principal = await request.get(`${apiBase}/dashboard/principal`, { headers });
    const superAdmin = await request.get(`${apiBase}/dashboard/super-admin`, { headers });
    expect(principal.status()).toBe(200);
    expect(superAdmin.status()).toBe(403);
  });

  test('accountant has a focused collection dashboard', async ({ page }) => {
    await signIn(page, 'accountant.demo@school.local', '/admin/accountant');
    await expect(page.getByRole('heading', { name: 'Accountant workspace' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Ready to start fee collection|Receivables aging/ }),
    ).toBeVisible();
    await page.getByRole('link', { name: /Follow up overdue fees/ }).click();
    await expect(page.getByRole('heading', { name: 'Receivables', exact: true })).toBeVisible();
    await expect(page.getByLabel('Status')).toHaveValue('OVERDUE');
    await page.getByLabel('Status').selectOption('ALL');
    await expect(page.getByRole('heading', { name: 'Fee work list' })).toBeVisible();
  });

  test('accountant can open student fees and payment history', async ({ page }) => {
    await signIn(page, 'accountant.demo@school.local', '/admin/accountant');
    await page.getByRole('link', { name: 'Student ledger', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Fees & payments' })).toBeVisible();
    await page.getByLabel('Search name or student code').fill('DEMO-2026-001');
    await page.getByRole('link', { name: /Alex Anderson 001/ }).click();
    await expect(page.getByRole('heading', { name: 'Alex Anderson 001' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Add a fee' })).toBeVisible();
  });

  test('accountant can review class charges and export collections', async ({ page }) => {
    await signIn(page, 'accountant.demo@school.local', '/admin/accountant');
    await page.goto('/admin/finance/bulk');
    await expect(page.getByRole('heading', { name: 'Charge a class' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ index: 1 });
    await expect(page.getByText(/100 active students/)).toBeVisible();
    await page.goto('/admin/finance/collections');
    await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^collections-\d{4}-\d{2}-\d{2}\.csv$/);
    const content = await readFile(await download.path(), 'utf8');
    expect(content).toContain('"Date received","Student code","Student"');
  });

  test('teacher cannot open the finance workspace or API', async ({ page, request }) => {
    await signIn(page, 'teacher.demo@school.local', '/teacher');
    await page.goto('/admin/finance');
    await expect(page).toHaveURL(/\/teacher$/);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
    const login = await request.post(`${apiBase}/auth/login`, {
      data: { email: 'teacher.demo@school.local', password },
    });
    const body = (await login.json()) as { data: { accessToken: string } };
    const denied = await request.get(`${apiBase}/finance/summary`, {
      headers: { Authorization: `Bearer ${body.data.accessToken}` },
    });
    expect(denied.status()).toBe(403);
    const deniedInsights = await request.get(`${apiBase}/finance/insights`, {
      headers: { Authorization: `Bearer ${body.data.accessToken}` },
    });
    expect(deniedInsights.status()).toBe(403);
  });

  test('librarian has student lookup without unavailable library actions', async ({ page }) => {
    await signIn(page, 'librarian.demo@school.local', '/admin/librarian');
    await expect(page.getByRole('heading', { name: 'Librarian dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Student lookup' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Student directory', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /borrow|checkout/i })).toHaveCount(0);
    await page.goto('/admin/super');
    await expect(page).toHaveURL(/\/admin\/librarian$/);
  });

  test('mobile school navigation opens, reaches a page, and closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, 'admin.demo@school.local', '/admin');
    const menu = page.getByRole('button', { name: 'Open navigation' });
    await expect(menu).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'School workspace' })).toBeHidden();
    await menu.click();
    await expect(page.getByRole('navigation', { name: 'School workspace' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'School workspace' })
      .getByRole('link', { name: 'Student directory' })
      .click();
    await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'School workspace' })).toBeHidden();
  });

  test('workspace search opens a permitted task', async ({ page }) => {
    await signIn(page, 'admin.demo@school.local', '/admin');
    const search = page.getByRole('searchbox', { name: 'Find a page or task' });
    await search.fill('student directory');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/admin\/students$/);
    await expect(
      page.getByRole('heading', { name: 'Students', exact: true, level: 1 }),
    ).toBeVisible();
  });

  test('academic setup shows one step at a time', async ({ page }) => {
    await signIn(page, 'admin.demo@school.local', '/admin');
    await page.getByRole('link', { name: 'Academic setup', exact: true }).click();
    await expect(page.getByRole('tab', { name: /Academic years/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: /Semesters/ }).click();
    await expect(page.getByRole('tab', { name: /Semesters/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Semesters', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create academic year' })).toHaveCount(0);
  });

  test('school admin can reach exam setup and mark entry', async ({ page }) => {
    await signIn(page, 'admin.demo@school.local', '/admin');
    await page.getByRole('link', { name: 'Exams & marks' }).click();
    await expect(page.getByRole('tab', { name: 'Exams & results' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Examination lifecycle' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create exam' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Exam setup' }).click();
    await expect(page.getByRole('heading', { name: 'Create exam' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Enter marks' })).toBeVisible();
  });

  test('teacher sees the mark entry task without exam setup controls', async ({ page }) => {
    await signIn(page, 'teacher.demo@school.local', '/teacher');
    await page.getByRole('link', { name: 'Exams & marks' }).click();
    await page.getByRole('tab', { name: 'Enter marks' }).click();
    await expect(page.getByRole('heading', { name: 'Exam subjects and marks' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Exam setup' })).toHaveCount(0);
  });
});
