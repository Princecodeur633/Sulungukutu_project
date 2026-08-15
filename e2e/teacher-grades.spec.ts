/**
 * E2E — Saisie des notes (Enseignant)
 * Teste l'accès à la page notes, la grille et l'export XLSX.
 */
import { test, expect } from './helpers';

test.describe('Enseignant — Saisie des notes', () => {

  test('accès à la page saisie notes', async ({ teacherPage: page }) => {
    await page.goto('/teacher/grades');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText(/note/i);
  });

  test('sélecteur de classe visible', async ({ teacherPage: page }) => {
    await page.goto('/teacher/grades');
    await page.waitForTimeout(2000); // Wait for data
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
  });

  test('sélecteur trimestre T1/T2/T3 visible', async ({ teacherPage: page }) => {
    await page.goto('/teacher/grades');
    await page.waitForTimeout(1500);
    for (const t of ['T1', 'T2', 'T3']) {
      await expect(page.locator(`button:text("${t}")`)).toBeVisible();
    }
  });

  test('bouton export XLSX présent quand classe sélectionnée', async ({ teacherPage: page }) => {
    await page.goto('/teacher/grades');
    await page.waitForTimeout(2000);
    const select = page.locator('select').first();
    const options = await select.locator('option').count();
    if (options > 1) {
      // Select first real class
      await select.selectOption({ index: 1 });
      await page.waitForTimeout(1500);
      await expect(page.locator('button:text-matches(/xlsx|export/i)')).toBeVisible({ timeout: 3000 });
    }
  });

  test('grille de notes affiche les élèves', async ({ teacherPage: page }) => {
    await page.goto('/teacher/grades');
    await page.waitForTimeout(2000);
    const select = page.locator('select').first();
    const options = await select.locator('option').count();
    if (options > 1) {
      await select.selectOption({ index: 1 });
      await page.waitForTimeout(2000);
      // Should show a table
      const table = page.locator('table');
      await expect(table).toBeVisible({ timeout: 5000 });
    }
  });

  test('page emploi du temps enseignant charge', async ({ teacherPage: page }) => {
    await page.goto('/teacher/schedule');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText(/emploi/i);
  });

  test('page classes enseignant charge', async ({ teacherPage: page }) => {
    await page.goto('/teacher/classes');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();
  });

});
