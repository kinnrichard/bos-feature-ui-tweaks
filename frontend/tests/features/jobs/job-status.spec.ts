import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../helpers/auth';
import { DataFactory } from '../../helpers/data-factories';

test.describe('Job Status Management', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);

    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');

    // Create test data (jobs) so the page has content
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      priority: 'high',
      client_id: client.id,
    });

    // Navigate to the specific job detail page (where JobStatusButton is shown)
    await page.goto(`/jobs/${job.id}`);

    // Wait for the job detail page to load and job status button to be visible
    await expect(page.locator('.popover-button[title*="Job Status"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test.describe('Status Button Display', () => {
    test('should display job status button with correct emoji', async ({ page }) => {
      // Find the job status button
      const statusButton = page.locator('.popover-button[title*="Job Status"]');
      await expect(statusButton).toBeVisible();

      // Check that it shows the correct emoji for in_progress status
      await expect(statusButton.locator('.job-status-emoji')).toContainText('🟢');

      // Check button has proper accessibility attributes
      await expect(statusButton).toHaveAttribute('title', /Job Status/);
    });
  });

  test.describe('Status Popover Interaction', () => {
    test('should open popover when status button is clicked', async ({ page }) => {
      // Click the job status button
      const statusButton = page.locator('.popover-button[title*="Job Status"]');
      await statusButton.click();

      // Check that popover panel appears
      const statusPanel = page.locator('.base-popover-panel');
      await expect(statusPanel).toBeVisible();

      // Check that popover contains title
      await expect(statusPanel.locator('.popover-title')).toContainText('Job Status');

      // Check that all status options are displayed
      const statusOptions = page.locator('.option-item');
      await expect(statusOptions).toHaveCount(7);

      // Check that status options contain correct labels
      await expect(page.locator('.option-item:has-text("Open")')).toBeVisible();
      await expect(page.locator('.option-item:has-text("In Progress")')).toBeVisible();
      await expect(page.locator('.option-item:has-text("Paused")')).toBeVisible();
      await expect(page.locator('.option-item:has-text("Waiting for Customer")')).toBeVisible();
      await expect(page.locator('.option-item:has-text("Scheduled")')).toBeVisible();
      await expect(page.locator('.option-item:has-text("Completed")')).toBeVisible();
      await expect(page.locator('.option-item:has-text("Cancelled")')).toBeVisible();
    });

    test('should highlight current status option', async ({ page }) => {
      // Open the status popover
      await page.locator('.popover-button[title="Job Status"]').click();

      // Check that current status (in_progress) is highlighted
      const currentOption = page.locator('.option-item.selected');
      await expect(currentOption).toBeVisible();
      await expect(currentOption).toContainText('In Progress');
    });
  });

  test.describe('Status Updates', () => {
    test('should update job status when different option is selected', async ({ page }) => {
      // Track PATCH requests to verify API call
      const patchRequests: { url: string; postData: string | null }[] = [];
      page.on('request', (request) => {
        if (request.method() === 'PATCH' && request.url().includes('/jobs/')) {
          patchRequests.push({
            url: request.url(),
            postData: request.postData(),
          });
        }
      });

      // Open status popover and select a different status
      await page.locator('.popover-button[title*="Job Status"]').click();
      await page.locator('.option-item:has-text("Completed")').click();

      // Wait for API request
      await expect(async () => {
        expect(patchRequests.length).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });

      // Verify API request was made
      expect(patchRequests[0].url).toMatch(/\/api\/v1\/jobs\/\d+/);

      // Verify request contains status update
      const requestData = JSON.parse(patchRequests[0].postData || '{}');
      expect(requestData.status).toBe('successfully_completed');

      // Verify UI updates to show new status
      await expect(page.locator('.job-status-emoji')).toContainText('✅');
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API to return error
      await page.route('**/api/v1/jobs/*', async (route) => {
        if (route.request().method() === 'PATCH') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.continue();
        }
      });

      // Try to update status
      await page.locator('.popover-button[title*="Job Status"]').click();
      await page.locator('.option-item:has-text("Completed")').click();

      // Should show error message or revert status
      // Note: Exact error handling depends on implementation
      await expect(page.locator('.error-message, .alert-error, .toast-error')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should show loading state during update', async ({ page }) => {
      // Mock API with delay to see loading state
      await page.route('**/api/v1/jobs/*', async (route) => {
        if (route.request().method() === 'PATCH') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.continue();
        } else {
          await route.continue();
        }
      });

      // Open popover and select status
      await page.locator('.popover-button[title*="Job Status"]').click();
      await page.locator('.option-item:has-text("Completed")').click();

      // Should show loading indicator
      await expect(page.locator('.loading-spinner, .updating-status')).toBeVisible({
        timeout: 1000,
      });
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support keyboard navigation in status popover', async ({ page }) => {
      // Open popover
      await page.locator('.popover-button[title*="Job Status"]').click();

      // Use arrow keys to navigate options
      await page.keyboard.press('ArrowDown');

      // Verify focus moves between options
      const focusedOption = page.locator('.option-item:focus');
      await expect(focusedOption).toBeVisible();

      // Press Enter to select
      await page.keyboard.press('Enter');

      // Verify popover closes and status updates
      await expect(page.locator('.base-popover-panel')).not.toBeVisible({ timeout: 2000 });
    });

    test('should close popover with Escape key', async ({ page }) => {
      // Open popover
      await page.locator('.popover-button[title*="Job Status"]').click();
      await expect(page.locator('.base-popover-panel')).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Verify popover closes
      await expect(page.locator('.base-popover-panel')).not.toBeVisible({ timeout: 2000 });
    });
  });
});
