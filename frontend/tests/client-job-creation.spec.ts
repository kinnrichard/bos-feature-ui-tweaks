/**
 * Client Job Creation Feature Test Suite
 *
 * Tests the complete workflow for creating jobs from client pages:
 * - Navigation from client jobs page to creation form
 * - Client validation and error handling
 * - Job creation form functionality
 * - UI states and interactions
 * - Form validation and success flows
 * - Integration with existing job view infrastructure
 */

import { test, expect } from '@playwright/test';
import { DataFactory } from './helpers/data-factories';

test.describe('Client Job Creation Feature', () => {
  let dataFactory: DataFactory;

  test.beforeEach(async ({ page }) => {
    dataFactory = new DataFactory(page);

    // Start with fresh data for each test
    await page.goto('/clients');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Route Navigation Tests', () => {
    test('should navigate from client jobs page to new job creation page', async ({ page }) => {
      // Create test client
      const timestamp = Date.now();
      const client = await dataFactory.createClient({
        name: `Test Client ${timestamp}`,
        client_type: 'residential',
      });

      // Navigate to client jobs page
      await page.goto(`/clients/${client.id}/jobs`);
      await page.waitForLoadState('domcontentloaded');

      // Verify we're on the correct page
      await expect(page.locator('h1')).toContainText(`Jobs for ${client.name}`);

      // Click "New Job" button
      const newJobButton = page.locator('a[href="/jobs/new?clientId=' + client.id + '"]').first();
      await expect(newJobButton).toBeVisible();
      await expect(newJobButton).toContainText('New Job');

      await newJobButton.click();

      // Verify navigation to creation page
      await expect(page).toHaveURL(`/jobs/new?clientId=${client.id}`);
      await expect(page.locator('title')).toContainText(`New Job for ${client.name}`);
    });

    test('should provide "Create First Job" button in empty state', async ({ page }) => {
      // Create client with no jobs
      const timestamp = Date.now();
      const client = await dataFactory.createClient({
        name: `Empty Client ${timestamp}`,
        client_type: 'business',
      });

      await page.goto(`/clients/${client.id}/jobs`);
      await page.waitForLoadState('networkidle');

      // Should show empty state
      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.locator('text=No jobs yet for this client')).toBeVisible();

      // Should have "Create First Job" button
      const createFirstJobButton = page.locator('a[href="/jobs/new?clientId=' + client.id + '"]', {
        hasText: 'Create First Job',
      });
      await expect(createFirstJobButton).toBeVisible();

      await createFirstJobButton.click();
      await expect(page).toHaveURL(`/jobs/new?clientId=${client.id}`);
    });

    test('should handle direct navigation to creation route', async ({ page }) => {
      // Create test client
      const client = await dataFactory.createClient({
        name: 'Direct Navigation Client',
        client_type: 'residential',
      });

      // Navigate directly to the creation URL
      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Verify page loads correctly
      await expect(page.locator('title')).toContainText('New Job for Direct Navigation Client');
      await expect(page.locator('.job-detail-view')).toBeVisible();
    });
  });

  test.describe('Client Validation Tests', () => {
    test('should show 404 error for invalid client ID', async ({ page }) => {
      const invalidClientId = 'invalid-client-id-12345';

      await page.goto(`/jobs/new?clientId=${invalidClientId}`);
      await page.waitForLoadState('domcontentloaded');

      // Should show client not found error
      await expect(page.locator('.error-state')).toBeVisible();
      await expect(page.locator('h2')).toContainText('Client not found');
      await expect(page.locator('text=The specified client could not be found')).toBeVisible();

      // Should have back to clients button
      const backButton = page.locator('button', { hasText: 'Back to Clients' });
      await expect(backButton).toBeVisible();

      await backButton.click();
      await expect(page).toHaveURL('/clients');
    });

    test('should show loading state while fetching client data', async ({ page }) => {
      // Create client but intercept request with delay
      const client = await dataFactory.createClient({
        name: 'Loading Test Client',
        client_type: 'residential',
      });

      // Add delay to client API request
      await page.route(`**/api/v1/clients/${client.id}`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);

      // Should show loading skeleton initially
      await expect(page.locator('.job-detail-loading')).toBeVisible();
      await expect(
        page.locator('[data-testid="job-card-skeleton"], .loading-skeleton')
      ).toBeVisible();

      // Should eventually load the content
      await expect(page.locator('.job-detail-view')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Job Creation Flow Tests', () => {
    test('should auto-focus on job title field in creation mode', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Auto Focus Test Client',
        client_type: 'residential',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for the editable title to be visible
      const editableTitle = page.locator(
        '.job-title input, .job-title textarea, [contenteditable="true"]'
      );
      await expect(editableTitle.first()).toBeVisible();

      // Check that the title field is focused (or focus-able)
      const isJobTitleFocused = await page.evaluate(() => {
        const activeElement = document.activeElement;
        return activeElement?.closest('.job-title') !== null;
      });

      // The auto-focus should be on the job title input
      expect(isJobTitleFocused).toBe(true);
    });

    test('should validate job title and show error for empty submission', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Validation Test Client',
        client_type: 'business',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for the job detail view to load
      await expect(page.locator('.job-detail-view')).toBeVisible();

      // Try to submit without entering a title
      const titleElement = page.locator('.job-title');
      await expect(titleElement).toBeVisible();

      // Trigger save with empty title (simulate clicking outside or pressing Enter)
      await titleElement.focus();
      await page.keyboard.press('Enter');

      // Should show error toast
      await expect(page.locator('.toast-error, [data-testid="toast-error"]')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('text=Please give this job a name')).toBeVisible();

      // Should remain on the same page
      await expect(page).toHaveURL(`/jobs/new?clientId=${client.id}`);
    });

    test('should successfully create job and navigate to job page', async ({ page }) => {
      const timestamp = Date.now();
      const client = await dataFactory.createClient({
        name: `Success Test Client ${timestamp}`,
        client_type: 'residential',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Wait for the job detail view to load
      await expect(page.locator('.job-detail-view')).toBeVisible();

      // Enter a job title
      const jobTitle = `Test Job Creation ${timestamp}`;
      const titleElement = page
        .locator('.job-title input, .job-title [contenteditable="true"]')
        .first();
      await expect(titleElement).toBeVisible();

      await titleElement.fill(jobTitle);
      await page.keyboard.press('Enter');

      // Should navigate to the newly created job
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);

      // Verify the job was created with correct title
      await expect(page.locator('.job-title')).toContainText(jobTitle);

      // Verify client information is displayed
      await expect(page.locator('text=' + client.name)).toBeVisible();
    });

    test('should handle API errors during job creation gracefully', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Error Test Client',
        client_type: 'business',
      });

      // Mock job creation API to return error
      await page.route('**/api/v1/jobs', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Enter a job title and attempt to save
      const titleElement = page
        .locator('.job-title input, .job-title [contenteditable="true"]')
        .first();
      await expect(titleElement).toBeVisible();

      await titleElement.fill('Test Job That Will Fail');
      await page.keyboard.press('Enter');

      // Should show error toast
      await expect(page.locator('.toast-error, [data-testid="toast-error"]')).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('text=Failed to create job')).toBeVisible();

      // Should remain on creation page
      await expect(page).toHaveURL(`/jobs/new?clientId=${client.id}`);
    });
  });

  test.describe('UI State Tests', () => {
    test('should disable toolbar buttons in creation mode', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Toolbar Test Client',
        client_type: 'residential',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Toolbar should be visible but disabled in new job mode
      const toolbar = page.locator('.toolbar');
      await expect(toolbar).toBeVisible();

      // Job-specific buttons should be visible but disabled
      const jobStatusButton = page.locator('[data-testid="job-status-button"], .job-status-button');
      const technicianButton = page.locator(
        '[data-testid="technician-assignment-button"], .technician-assignment-button'
      );
      const filterButton = page.locator('[data-testid="filter-popover"], .filter-popover');

      // Check that buttons exist and are disabled
      if ((await jobStatusButton.count()) > 0) {
        await expect(jobStatusButton).toBeDisabled();
      }
      if ((await technicianButton.count()) > 0) {
        await expect(technicianButton).toBeDisabled();
      }
      if ((await filterButton.count()) > 0) {
        await expect(filterButton).toBeDisabled();
      }
    });

    test('should disable search box in creation mode', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Search Test Client',
        client_type: 'business',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Search should be visible but disabled in new job mode
      const searchBox = page.locator('input[placeholder*="search"], input[type="search"]');
      await expect(searchBox).toBeVisible();
      await expect(searchBox).toBeDisabled();

      // Search placeholder should indicate disabled state
      await expect(searchBox).toHaveAttribute('placeholder', /Search disabled/i);
    });

    test('should show "Creating New Job" empty state with cancel link', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Empty State Test Client',
        client_type: 'residential',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should show new job empty state
      await expect(page.locator('.empty-state--new-job')).toBeVisible();
      await expect(page.locator('h3')).toContainText('Creating New Job');
      await expect(page.locator('text=Give your job a name to get started')).toBeVisible();

      // Should have cancel link
      const cancelLink = page.locator('.cancel-link, button[onclick*="cancel"]').first();
      await expect(cancelLink).toBeVisible();
    });

    test('should handle cancel functionality and return to client jobs page', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Cancel Test Client',
        client_type: 'business',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Click cancel link
      const cancelLink = page.locator('.cancel-link, button[onclick*="cancel"]').first();
      await expect(cancelLink).toBeVisible();
      await cancelLink.click();

      // Should navigate back to client jobs page
      await expect(page).toHaveURL(`/clients/${client.id}/jobs`);
      await expect(page.locator('h1')).toContainText(`Jobs for ${client.name}`);
    });
  });

  test.describe('Integration Tests', () => {
    test('should complete end-to-end workflow from client page to job creation to job view', async ({
      page,
    }) => {
      const timestamp = Date.now();
      const client = await dataFactory.createClient({
        name: `E2E Test Client ${timestamp}`,
        client_type: 'residential',
      });

      // Start from client detail page
      await page.goto(`/clients/${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Navigate to client jobs
      await page.click('a[href="/clients/' + client.id + '/jobs"]');
      await expect(page).toHaveURL(`/clients/${client.id}/jobs`);

      // Click new job button
      await page.click('a[href="/jobs/new?clientId=' + client.id + '"]');
      await expect(page).toHaveURL(`/jobs/new?clientId=${client.id}`);

      // Create the job
      const jobTitle = `E2E Created Job ${timestamp}`;
      const titleElement = page
        .locator('.job-title input, .job-title [contenteditable="true"]')
        .first();
      await expect(titleElement).toBeVisible();
      await titleElement.fill(jobTitle);
      await page.keyboard.press('Enter');

      // Should be on job detail page
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);
      await expect(page.locator('.job-title')).toContainText(jobTitle);

      // Verify existing job view functionality still works
      await expect(page.locator('.task-list, .tasks-section')).toBeVisible();
    });

    test('should preserve existing job view behavior after implementing creation feature', async ({
      page,
    }) => {
      // Create an existing job to test normal job view
      const timestamp = Date.now();
      const client = await dataFactory.createClient({
        name: `Existing Job Test Client ${timestamp}`,
        client_type: 'business',
      });
      const job = await dataFactory.createJob({
        title: `Existing Job ${timestamp}`,
        client_id: client.id,
        status: 'active',
        priority: 'high',
      });

      // Navigate to existing job
      await page.goto(`/jobs/${job.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should show normal job view (not creation mode)
      await expect(page.locator('.job-detail-view')).toBeVisible();
      await expect(page.locator('.job-title')).toContainText(job.title);

      // Toolbar should be visible for existing jobs
      const toolbar = page.locator('.toolbar, .task-toolbar, .new-task-row');
      await expect(toolbar.first()).toBeVisible();

      // Should not show empty state for creation
      await expect(page.locator('.empty-state--new-job')).not.toBeVisible();
    });
  });

  test.describe('Responsive Tests', () => {
    test('should work correctly on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const client = await dataFactory.createClient({
        name: 'Mobile Test Client',
        client_type: 'residential',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should render properly on mobile
      await expect(page.locator('.job-detail-view')).toBeVisible();

      // Title should be editable
      const titleElement = page
        .locator('.job-title input, .job-title [contenteditable="true"]')
        .first();
      await expect(titleElement).toBeVisible();

      // Test job creation on mobile
      await titleElement.fill('Mobile Created Job');
      await page.keyboard.press('Enter');

      // Should navigate successfully
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);
    });

    test('should work correctly on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1200, height: 800 });

      const client = await dataFactory.createClient({
        name: 'Desktop Test Client',
        client_type: 'business',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Should render properly on desktop
      await expect(page.locator('.job-detail-view')).toBeVisible();

      // Test wider layout works
      const container = page.locator('.job-detail-container');
      await expect(container).toBeVisible();

      const boundingBox = await container.boundingBox();
      expect(boundingBox?.width).toBeGreaterThan(500);
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should support keyboard navigation and focus management', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'Accessibility Test Client',
        client_type: 'residential',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Title should be focusable and auto-focused
      const titleElement = page
        .locator('.job-title input, .job-title [contenteditable="true"]')
        .first();
      await expect(titleElement).toBeVisible();

      // Test tab navigation
      await page.keyboard.press('Tab');

      // Test keyboard job creation
      await titleElement.focus();
      await page.keyboard.type('Keyboard Created Job');
      await page.keyboard.press('Enter');

      // Should work with keyboard interaction
      await expect(page).toHaveURL(/\/jobs\/[a-f0-9-]+$/);
    });

    test('should have proper ARIA labels and semantic structure', async ({ page }) => {
      const client = await dataFactory.createClient({
        name: 'ARIA Test Client',
        client_type: 'business',
      });

      await page.goto(`/jobs/new?clientId=${client.id}`);
      await page.waitForLoadState('domcontentloaded');

      // Check for proper heading structure
      await expect(page.locator('h1, .job-title h1')).toBeVisible();

      // Check that interactive elements are accessible
      const titleElement = page
        .locator('.job-title input, .job-title [contenteditable="true"]')
        .first();
      await expect(titleElement).toBeVisible();

      // Test screen reader announcement areas
      const pageTitle = await page.locator('title').textContent();
      expect(pageTitle).toContain('New Job for');
    });
  });
});
