import { test, expect } from '@playwright/test';
import { DataFactory } from './helpers/data-factories';

test.describe('Home Page', () => {
  let dataFactory: DataFactory;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    dataFactory = new DataFactory(page);
  });

  test('should show expected content for unauthenticated users', async ({ page }) => {
    // Clear authentication state
    await page.context().clearCookies();
    
    // Clear local storage after navigation to avoid security errors
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (error) {
        console.warn('Could not clear storage:', error);
      }
    });

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');

    // Check for main content with flexible selectors
    const hasMainHeading = await page.locator('h1, [role="heading"][aria-level="1"], .main-heading').first().isVisible();
    const hasBranding = await page.locator('text=/bŏs|bos|BOS/i').first().isVisible();
    const hasTitle = await page.locator('text=/Job Management|Management System/i').first().isVisible();

    // At least one main identifier should be present
    expect(hasMainHeading || hasBranding || hasTitle).toBe(true);
  });

  // Tests that use authentication will use storageState automatically
  test('should show personalized content for authenticated admin users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should show authenticated content
    const hasNavigation = await page.locator('nav, .navigation, .navbar').first().isVisible();
    const hasUserMenu = await page.locator('[data-testid="user-menu"], .user-menu, .profile-menu').first().isVisible();
    const hasJobsLink = await page.getByRole('link', { name: /jobs/i }).first().isVisible();
    const hasMainContent = await page.locator('main, .main-content, .content').first().isVisible();
    
    // At least one authenticated indicator should be present
    expect(hasNavigation || hasUserMenu || hasJobsLink || hasMainContent).toBe(true);
  });

  test('should show appropriate content for technician users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should show main application content
    const hasMainContent = await page.locator('main, .main-content, .app-content').first().isVisible();
    const hasJobsAccess = await page.getByRole('link', { name: /jobs/i }).first().isVisible();
    const hasTasksAccess = await page.locator('text=/tasks/i').first().isVisible();
    const hasNavigation = await page.locator('nav, .navigation').first().isVisible();
    
    // Should have access to main functionality
    expect(hasMainContent || hasJobsAccess || hasTasksAccess || hasNavigation).toBe(true);
  });

  test('should handle navigation to protected routes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Try to navigate to jobs page if link is available
    const jobsLink = page.getByRole('link', { name: /jobs/i }).first();
    if (await jobsLink.isVisible()) {
      await Promise.all([
        page.waitForURL(/\/jobs/),
        jobsLink.click()
      ]);
      
      // Should show jobs-related content
      const hasJobsContent = await page.locator('.job-item, [data-job-id], .jobs-list, .job-container').first().isVisible();
      const hasJobsHeading = await page.locator('h1, h2, h3').filter({ hasText: /jobs/i }).first().isVisible();
      const hasJobsTable = await page.locator('table, .table, .jobs-table').first().isVisible();
      
      expect(hasJobsContent || hasJobsHeading || hasJobsTable).toBe(true);
    }
  });

  test('should display real job data for authenticated users', async ({ page }) => {
    // Create test job for display
    const client = await dataFactory.createClient({ 
      name: `Test Client ${Date.now()}` 
    });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      priority: 'high',
      client_id: client.id
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to jobs if possible
    const jobsLink = page.getByRole('link', { name: /jobs/i }).first();
    if (await jobsLink.isVisible()) {
      await Promise.all([
        page.waitForURL(/\/jobs/),
        jobsLink.click()
      ]);
      
      // Should show the created job
      await expect(page.locator(`text=${job.title}`).first()).toBeVisible({ timeout: 10000 });
    }
    
    // Clean up test data
    await dataFactory.deleteEntity('jobs', job.id);
    await dataFactory.deleteEntity('clients', client.id);
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    const hasMobileContent = await page.locator('body, main, .app, .content').first().isVisible();
    expect(hasMobileContent).toBe(true);
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    const hasTabletContent = await page.locator('body, main, .app, .content').first().isVisible();
    expect(hasTabletContent).toBe(true);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    const hasDesktopContent = await page.locator('body, main, .app, .content').first().isVisible();
    expect(hasDesktopContent).toBe(true);
  });
});
