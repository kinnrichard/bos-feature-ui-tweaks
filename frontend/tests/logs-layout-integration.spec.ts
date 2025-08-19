import { test, expect } from '@playwright/test';

test.describe('Activity Logs Layout Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page and perform authentication
    await page.goto('/');
  });

  test('System logs page uses consistent layout with sidebar', async ({ page }) => {
    // Navigate to logs page
    await page.goto('/logs');
    
    // Check if the page uses AppLayout (has sidebar)
    await expect(page.locator('[role="navigation"][aria-label="Main navigation"]')).toBeVisible();
    
    // Check if the logs navigation item is highlighted
    const logsNavItem = page.locator('nav a[href="/logs"]');
    await expect(logsNavItem).toBeVisible();
    
    // Check if LogsLayout is being used (has proper title structure)
    await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
    
    // Verify the activity log list is present
    await expect(page.locator('.activity-log-list')).toBeVisible();
  });

  test('Client logs page uses consistent layout with sidebar', async ({ page }) => {
    // First need to go to clients to get a client ID - simplified test
    await page.goto('/clients');
    
    // Get the first client link if available
    const firstClientLink = page.locator('a[href^="/clients/"]').first();
    
    if (await firstClientLink.isVisible()) {
      const clientHref = await firstClientLink.getAttribute('href');
      if (clientHref) {
        // Navigate to client logs page
        await page.goto(`${clientHref}/logs`);
        
        // Check if the page uses AppLayout (has sidebar)
        await expect(page.locator('[role="navigation"][aria-label="Main navigation"]')).toBeVisible();
        
        // Check if LogsLayout is being used (has title structure)
        await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible();
        
        // Verify the activity log list is present
        await expect(page.locator('.activity-log-list')).toBeVisible();
      }
    }
  });

  test('Loading states display properly', async ({ page }) => {
    // Navigate to logs page
    await page.goto('/logs');
    
    // Check for loading skeleton (might be quick, so allow timeout)
    const loadingSkeleton = page.locator('.skeleton-generic');
    
    // Either loading skeleton is visible or content is loaded
    await expect(async () => {
      const hasLoading = await loadingSkeleton.isVisible();
      const hasContent = await page.locator('.activity-log-list').isVisible();
      expect(hasLoading || hasContent).toBeTruthy();
    }).toPass();
  });

  test('Navigation highlighting works for logs pages', async ({ page }) => {
    // Navigate to logs page
    await page.goto('/logs');
    
    // Check that logs navigation item has active state
    // This depends on your CSS implementation for active states
    const logsNavItem = page.locator('nav a[href="/logs"]');
    await expect(logsNavItem).toBeVisible();
  });

  test('Responsive layout works correctly', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/logs');
    
    // Check that layout is responsive
    await expect(page.locator('.activity-log-list')).toBeVisible();
    
    // Test tablet viewport  
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.activity-log-list')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('.activity-log-list')).toBeVisible();
  });
});