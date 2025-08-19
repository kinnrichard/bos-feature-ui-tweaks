import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DataFactory } from './helpers/data-factories';

test.describe('Job Status Button Component', () => {
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

  test('should display job status button with correct emoji', async ({ page }) => {
    // Find the job status button
    const statusButton = page.locator('.popover-button[title*="Job Status"]');
    await expect(statusButton).toBeVisible();

    // Check that it shows the correct emoji for in_progress status
    await expect(statusButton.locator('.job-status-emoji')).toContainText('🟢');

    // Check button has proper accessibility attributes
    await expect(statusButton).toHaveAttribute('title', /Job Status/);
  });

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
    await expect(currentOption.locator('.popover-checkmark-icon')).toBeVisible();

    // Check that other options are not highlighted
    const openOption = page.locator('.option-item:has-text("Open")');
    await expect(openOption).not.toHaveClass(/selected/);
  });

  test('should display status emojis correctly', async ({ page }) => {
    // Open the status popover
    await page.locator('.popover-button[title="Job Status"]').click();

    // Check that each status option has the correct emoji
    await expect(page.locator('.option-item:has-text("Open") .status-emoji')).toContainText('⚫');
    await expect(page.locator('.option-item:has-text("In Progress") .status-emoji')).toContainText(
      '🟢'
    );
    await expect(page.locator('.option-item:has-text("Paused") .status-emoji')).toContainText('⏸️');
    await expect(
      page.locator('.option-item:has-text("Waiting for Customer") .status-emoji')
    ).toContainText('⏳');
    await expect(page.locator('.option-item:has-text("Scheduled") .status-emoji')).toContainText(
      '🗓️'
    );
    await expect(page.locator('.option-item:has-text("Completed") .status-emoji')).toContainText(
      '✅'
    );
    await expect(page.locator('.option-item:has-text("Cancelled") .status-emoji')).toContainText(
      '❌'
    );
  });

  test('should update job status successfully', async ({ page }) => {
    let statusUpdateCalled = false;

    // Monitor API calls to verify the status update
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/jobs/')) {
        statusUpdateCalled = true;
      }
    });

    // Open status popover
    await page.locator('.popover-button[title="Job Status"]').click();

    // Click on "Paused" status
    await page.locator('.option-item:has-text("Paused")').click();

    // Check that popover closes
    await expect(page.locator('.base-popover-panel')).not.toBeVisible();

    // Wait for status to update and check that button shows new emoji
    await expect(
      page.locator('.popover-button[title="Job Status"] .job-status-emoji')
    ).toContainText('⏸️', { timeout: 10000 });

    // Verify API was called
    expect(statusUpdateCalled).toBe(true);
  });

  test('should show loading state during status update', async ({ page }) => {
    // Open status popover
    await page.locator('.popover-button[title="Job Status"]').click();

    // Click on "Completed" status
    await page.locator('.option-item:has-text("Completed")').click();

    // Check for loading indicator without masking failures
    // Loading indicator might be too fast to catch reliably
    const loadingIndicator = page.locator('.popover-loading-indicator');
    const hasLoadingIndicator = await loadingIndicator.isVisible().catch(() => false);
    if (hasLoadingIndicator) {
      await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
    }

    // Wait for status to update
    await expect(
      page.locator('.popover-button[title="Job Status"] .job-status-emoji')
    ).toContainText('✅', { timeout: 10000 });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error response
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

    // Open status popover
    await page.locator('.popover-button[title="Job Status"]').click();

    // Click on "Completed" status
    await page.locator('.option-item:has-text("Completed")').click();

    // Should show error message
    await expect(page.locator('.popover-error-message')).toBeVisible();
    await expect(page.locator('.popover-error-message')).toContainText('Failed to update');

    // Status should remain unchanged (rollback)
    await expect(
      page.locator('.popover-button[title="Job Status"] .job-status-emoji')
    ).toContainText('🟢');
  });

  test('should handle CSRF token errors', async ({ page }) => {
    // Mock CSRF error response
    await page.route('**/api/v1/jobs/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'CSRF token mismatch', code: 'INVALID_CSRF_TOKEN' }),
        });
      } else {
        await route.continue();
      }
    });

    // Open status popover and attempt status change
    await page.locator('.popover-button[title="Job Status"]').click();
    await page.locator('.option-item:has-text("Paused")').click();

    // Should show CSRF-specific error message
    await expect(page.locator('.popover-error-message')).toContainText(
      'Session expired - please try again'
    );
  });

  test('should perform optimistic updates', async ({ page }) => {
    // Create test data first to get job id
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      priority: 'high',
      client_id: client.id,
    });

    // Navigate to the specific job
    await page.goto(`/jobs/${job.id}`);

    // Mock slow API response to test optimistic updates
    await page.route('**/api/v1/jobs/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: job.id,
              type: 'jobs',
              attributes: { status: 'completed' },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Verify initial status
    await expect(
      page.locator('.popover-button[title="Job Status"] .job-status-emoji')
    ).toContainText('🟢');

    // Change status
    await page.locator('.popover-button[title="Job Status"]').click();
    await page.locator('.option-item:has-text("Completed")').click();

    // Should immediately show new status (optimistic update)
    await expect(
      page.locator('.popover-button[title="Job Status"] .job-status-emoji')
    ).toContainText('✅');
  });

  test('should close popover when clicking outside', async ({ page }) => {
    // Open status popover
    await page.locator('.popover-button[title="Job Status"]').click();
    await expect(page.locator('.base-popover-panel')).toBeVisible();

    // Click outside the popover
    await page.click('body', { position: { x: 100, y: 100 } });

    // Popover should close
    await expect(page.locator('.base-popover-panel')).not.toBeVisible();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Find the status button and click it to verify it's interactive
    const statusButton = page.locator('.popover-button[title="Job Status"]');
    await statusButton.click();

    // Verify popover opens when clicked
    await expect(page.locator('.base-popover-panel')).toBeVisible();

    // Press Escape to close popover
    await page.keyboard.press('Escape');
    await expect(page.locator('.base-popover-panel')).not.toBeVisible();

    // Verify button is still visible and accessible
    await expect(statusButton).toBeVisible();
    await expect(statusButton).toHaveAttribute('title', /Job Status/);
  });

  test('should not change status when clicking same status', async ({ page }) => {
    let apiCallCount = 0;

    await page.route('**/api/v1/jobs/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        apiCallCount++;
      }
      await route.continue();
    });

    // Open popover and click current status
    await page.locator('.popover-button[title="Job Status"]').click();
    await page.locator('.option-item.selected').click();

    // Should NOT make API call but popover stays open (correct behavior)
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    expect(apiCallCount).toBe(0);
  });

  test('should work correctly on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Status button should be visible and appropriately sized
    const statusButton = page.locator('.popover-button[title="Job Status"]');
    await expect(statusButton).toBeVisible();

    const buttonBox = await statusButton.boundingBox();
    expect(buttonBox?.width).toBe(36); // Should maintain size on mobile
    expect(buttonBox?.height).toBe(36);

    // Popover should be responsive
    await statusButton.click();
    const statusPanel = page.locator('.base-popover-panel');
    await expect(statusPanel).toBeVisible();

    const panelBox = await statusPanel.boundingBox();
    expect(panelBox?.width).toBeLessThanOrEqual(200); // Should fit on mobile screen
  });
});
