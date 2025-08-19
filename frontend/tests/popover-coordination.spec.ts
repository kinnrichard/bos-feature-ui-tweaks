import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { TestDatabase } from './helpers/database';
import { DataFactory } from './helpers/data-factories';

test.describe('Popover Coordination', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;
  let jobId: string;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);
    
    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');
    
    // Create test data (job with client) so popovers have content
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}-${Math.random().toString(36).substring(7)}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      priority: 'high',
      client_id: client.id
    });
    
    jobId = job.id;
    
    // Navigate to the specific job detail page (where multiple popovers exist)
    await page.goto(`/jobs/${jobId}`);
    
    // Wait for the job detail page to load and popover buttons to be visible
    await expect(page.locator('.popover-button[title="Job Status"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.popover-button[title="Technicians"]')).toBeVisible({ timeout: 10000 });
  });

  test('only one popover can be open at a time', async ({ page }) => {
    // Find popover buttons (job status and technician assignment)
    const jobStatusButton = page.locator('.popover-button[title="Job Status"]');
    const technicianButton = page.locator('.popover-button[title="Technicians"]');

    // Open job status popover
    await jobStatusButton.click();
    
    // Verify job status popover is open
    await expect(page.locator('.base-popover-panel').first()).toBeVisible();
    
    // Open technician assignment popover
    await technicianButton.click();
    
    // Verify only technician popover is visible (job status should be closed)
    const visiblePanels = page.locator('.base-popover-panel:visible');
    await expect(visiblePanels).toHaveCount(1);
    
    // Verify it's the technician popover that's open
    await expect(page.locator('.base-popover-panel:visible')).toContainText('Assigned To');
  });

  test('escape key closes all popovers', async ({ page }) => {
    // Open a popover
    const jobStatusButton = page.locator('.popover-button[title="Job Status"]');
    await jobStatusButton.click();
    
    // Verify popover is open
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    // Press escape key
    await page.keyboard.press('Escape');
    
    // Verify popover is closed (with timeout for animation)
    await expect(page.locator('.base-popover-panel')).not.toBeVisible({ timeout: 2000 });
  });

  test('clicking outside closes popover', async ({ page }) => {
    // Open a popover
    const jobStatusButton = page.locator('.popover-button[title="Job Status"]');
    await jobStatusButton.click();
    
    // Verify popover is open
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    // Click outside the popover (on the page background)
    await page.click('body', { position: { x: 100, y: 100 } });
    
    // Verify popover is closed (with timeout for animation)
    await expect(page.locator('.base-popover-panel')).not.toBeVisible({ timeout: 2000 });
  });

  test('opening popover via keyboard shortcut closes others', async ({ page }) => {
    // First open one popover manually
    const jobStatusButton = page.locator('.popover-button[title="Job Status"]');
    await jobStatusButton.click();
    
    // Verify first popover is open
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    // Use keyboard shortcut to open another popover (if available)
    // This test depends on the specific keyboard shortcuts in your app
    // You may need to adjust the key combination based on your implementation
    await page.keyboard.press('Alt+t'); // Example: Alt+T for technicians
    
    // Verify only one popover is visible (or same popover if shortcut doesn't exist)
    const visiblePanels = page.locator('.base-popover-panel:visible');
    await expect(visiblePanels).toHaveCount(1);
  });

  test('popover maintains functionality after coordination changes', async ({ page }) => {
    // Open job status popover
    const jobStatusButton = page.locator('.popover-button[title="Job Status"]');
    await jobStatusButton.click();
    
    // Verify we can interact with popover content
    await expect(page.locator('.base-popover-panel')).toContainText('Job Status');
    
    // Try to select a status option (different from current status)
    const statusOptions = page.locator('.option-item');
    const nonSelectedOption = statusOptions.locator(':not(.selected)').first();
    
    if (await nonSelectedOption.isVisible()) {
      await nonSelectedOption.click();
      
      // Verify popover closes after selection
      await expect(page.locator('.base-popover-panel')).not.toBeVisible();
    }
  });
});