import { test as base, expect, type Page } from '@playwright/test';

// ── Credentials (override via env) ──────────────────────────
export const CREDS = {
  admin:   { email: process.env.E2E_ADMIN_EMAIL   ?? 'admin@test.com',   password: process.env.E2E_ADMIN_PASSWORD   ?? 'Admin1234!' },
  teacher: { email: process.env.E2E_TEACHER_EMAIL  ?? 'prof@test.com',    password: process.env.E2E_TEACHER_PASSWORD  ?? 'Prof1234!' },
  parent:  { email: process.env.E2E_PARENT_EMAIL   ?? 'parent@test.com',  password: process.env.E2E_PARENT_PASSWORD   ?? 'Parent1234!' },
  student: { email: process.env.E2E_STUDENT_EMAIL  ?? 'eleve@test.com',   password: process.env.E2E_STUDENT_PASSWORD  ?? 'Eleve1234!' },
};

// ── Helpers ──────────────────────────────────────────────────
export async function login(page: Page, role: keyof typeof CREDS) {
  const { email, password } = CREDS[role];
  await page.goto('/auth/login');
  // Avant : sélecteur `input[type="email"]` — cassé depuis que le champ
  // de connexion accepte aussi identifiant/téléphone (type="text").
  // `name="identifiant"` est stable quel que soit le type affiché.
  await page.fill('input[name="identifiant"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for dashboard redirect
  await page.waitForURL(/\/(admin|teacher|parent|student)\/dashboard/, { timeout: 10_000 });
}

export async function logout(page: Page) {
  await page.click('[data-testid="logout-btn"]');
  await page.waitForURL('/auth/login');
}

// ── Custom test fixture with auto-login ──────────────────────
type Fixtures = {
  adminPage:   Page;
  teacherPage: Page;
  parentPage:  Page;
  studentPage: Page;
};

export const test = base.extend<Fixtures>({
  adminPage: async ({ page }, use) => {
    await login(page, 'admin');
    await use(page);
  },
  teacherPage: async ({ page }, use) => {
    await login(page, 'teacher');
    await use(page);
  },
  parentPage: async ({ page }, use) => {
    await login(page, 'parent');
    await use(page);
  },
  studentPage: async ({ page }, use) => {
    await login(page, 'student');
    await use(page);
  },
});

export { expect };
