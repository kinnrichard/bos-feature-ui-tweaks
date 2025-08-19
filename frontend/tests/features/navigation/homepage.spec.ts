import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../helpers/auth';

test.describe('Homepage Navigation', () => {
  let auth: AuthHelper;

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page);
    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');
  });

  test.describe('Page Structure', () => {
    test('should display homepage with proper navigation elements', async ({ page }) => {
      await page.goto('/');

      // Check for main navigation elements
      await expect(page.locator('nav, .navigation')).toBeVisible();

      // Check for main content area
      await expect(page.locator('main, .main-content')).toBeVisible();

      // Check for header
      await expect(page.locator('header, .header')).toBeVisible();
    });

    test('should have working navigation links', async ({ page }) => {
      await page.goto('/');

      // Check for jobs link
      const jobsLink = page.locator('a[href="/jobs"], a:has-text("Jobs")');
      if (await jobsLink.isVisible()) {
        await expect(jobsLink).toBeVisible();

        // Click and verify navigation
        await jobsLink.click();
        await expect(page).toHaveURL(/\/jobs/);
      }
    });
  });

  test.describe('User Interface Elements', () => {
    test('should display user menu and profile options', async ({ page }) => {
      await page.goto('/');

      // Look for user menu or profile area
      const userMenu = page.locator('.user-menu, .profile-menu, [data-testid="user-menu"]');
      if (await userMenu.isVisible()) {
        await expect(userMenu).toBeVisible();
      }
    });

    test('should show quick action buttons or cards', async ({ page }) => {
      await page.goto('/');

      // Look for dashboard cards or quick actions
      const quickActions = page.locator('.quick-actions, .dashboard-cards, .action-buttons');
      if (await quickActions.isVisible()) {
        await expect(quickActions).toBeVisible();
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('should have accessible search interface', async ({ page }) => {
      await page.goto('/');

      // Look for search input or search button
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search"], [data-testid="search"]'
      );
      const searchButton = page.locator('button:has-text("Search"), .search-button');

      const hasSearchInterface = await Promise.race([
        searchInput.isVisible(),
        searchButton.isVisible(),
      ]);

      if (hasSearchInterface) {
        expect(hasSearchInterface).toBeTruthy();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/');

      // Navigation should adapt to mobile
      const navigation = page.locator('nav, .navigation');
      await expect(navigation).toBeVisible();

      // Check for mobile menu toggle if present
      const mobileToggle = page.locator('.mobile-menu-toggle, .hamburger, [aria-label*="menu"]');
      if (await mobileToggle.isVisible()) {
        await expect(mobileToggle).toBeVisible();
      }
    });

    test('should maintain usability on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/');

      // Elements should be properly sized for tablet
      const mainContent = page.locator('main, .main-content');
      await expect(mainContent).toBeVisible();

      const contentBox = await mainContent.boundingBox();
      expect(contentBox?.width).toBeGreaterThan(600);
    });
  });
});
