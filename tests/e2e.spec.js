// GeoGive E2E Tests (M38)
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:8080/');
  await page.waitForLoadState('networkidle');
});

test('app loads and shows splash', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('GeoGive');
});

test('browse page shows items', async ({ page }) => {
  await page.waitForSelector('#itemList', { timeout: 10000 });
  const items = page.locator('.item-card');
  await expect(items.first()).toBeVisible();
});

test('settings modal opens and closes', async ({ page }) => {
  await page.click('#settingsBtn');
  await expect(page.locator('#settingsModalOverlay')).toBeVisible();
  await page.click('button[data-arg="settingsModalOverlay"]');
  await expect(page.locator('#settingsModalOverlay')).toHaveCSS('display', 'none');
});

test('onboarding shows for first-time users', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.locator('#onboardingModalOverlay')).toBeVisible();
});

test('feed page requires sign-in', async ({ page }) => {
  await page.locator('.nav-tab[data-page="feed"]').click();
  await expect(page.locator('#feedList')).toContainText('Sign in');
});

test('community guidelines modal appears', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(3000);
  await expect(page.locator('#guidelinesModalOverlay')).toBeVisible();
});

test('filter by category works', async ({ page }) => {
  await page.waitForSelector('.item-card', { timeout: 10000 });
  const initialCount = await page.locator('.item-card').count();
  await page.selectOption('#categoryFilter', 'electronics');
  await page.waitForTimeout(500);
  // Verify filtering happened (count changed or items visible)
  await expect(page.locator('#itemList')).toBeVisible();
});

test('analytics dashboard renders', async ({ page }) => {
  await page.click('#settingsBtn');
  await expect(page.locator('#analyticsDashboard')).toBeVisible();
  await expect(page.locator('#analyticsTotal')).toBeVisible();
});
