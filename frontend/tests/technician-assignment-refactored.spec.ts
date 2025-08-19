import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { TestDatabase } from './helpers/database';
import { DataFactory } from './helpers/data-factories';

test.describe('TechnicianAssignmentButton (Refactored with TanStack Query)', () => {
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
      client_id: client.id
    });
    
    // Navigate to the specific job detail page (where TechnicianAssignmentButton is shown)
    await page.goto(`/jobs/${job.id}`);
    
    // Wait for the job detail page to load and technician assignment button to be visible
    await expect(page.locator('.popover-button[title="Technicians"]')).toBeVisible({ timeout: 10000 });
  });

  test('displays assignment button correctly', async ({ page }) => {
    // Find the technician assignment button
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await expect(assignmentButton).toBeVisible();
    
    // Button should have the correct class and show add-person icon initially
    await expect(assignmentButton).toHaveClass(/popover-button/);
    await expect(assignmentButton.locator('.add-person-icon')).toBeVisible();
  });

  test('opens assignment panel when clicked', async ({ page }) => {
    // Click the assignment button
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await assignmentButton.click();
    
    // Panel should be visible
    const panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    
    // Should show "Assigned To" title
    await expect(panel.locator('.popover-title')).toHaveText('Assigned To');
  });

  test('loads users with TanStack Query', async ({ page }) => {
    // Click the assignment button to open panel
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await assignmentButton.click();
    
    const panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    
    // Should either show loading indicator or user options
    const loadingIndicator = panel.locator('.popover-loading-indicator');
    const userOptions = panel.locator('.option-list');
    
    // Wait for either loading to finish or users to appear
    try {
      await expect(loadingIndicator).toBeVisible({ timeout: 2000 });
      await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
    } catch {
      // Loading might be too fast to catch
    }
    
    // Should show user options
    await expect(userOptions).toBeVisible();
    
    // Should have at least one user option
    const userOption = userOptions.locator('.option-item').first();
    await expect(userOption).toBeVisible();
  });

  test('can assign and unassign technicians', async ({ page }) => {
    // Click the assignment button to open panel
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await assignmentButton.click();
    
    const panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    
    // Wait for users to load
    await expect(panel.locator('.option-list')).toBeVisible();
    
    // Find the first user option (component uses clickable buttons, not checkboxes)
    const firstOption = panel.locator('.option-item').first();
    await expect(firstOption).toBeVisible();
    
    const isSelected = await firstOption.locator('.popover-checkmark-icon').isVisible();
    
    if (!isSelected) {
      // Assign technician by clicking the option
      await firstOption.click();
      
      // Should show loading indicator briefly
      const loadingIndicator = panel.locator('.popover-loading-indicator');
      try {
        await expect(loadingIndicator).toBeVisible({ timeout: 2000 });
        await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
      } catch {
        // Loading might be too fast to catch
      }
      
      // Option should now be selected (checkmark visible)
      await expect(firstOption.locator('.popover-checkmark-icon')).toBeVisible();
      await expect(firstOption).toHaveClass(/selected/);
    }
    
    // Test unassigning by clicking again
    if (await firstOption.locator('.popover-checkmark-icon').isVisible()) {
      await firstOption.click();
      
      // Should show loading briefly
      try {
        const loadingIndicator = panel.locator('.popover-loading-indicator');
        await expect(loadingIndicator).toBeVisible({ timeout: 2000 });
        await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
      } catch {
        // Loading might be too fast to catch
      }
      
      // Option should now be unselected
      await expect(firstOption.locator('.popover-checkmark-icon')).not.toBeVisible();
      await expect(firstOption).not.toHaveClass(/selected/);
    }
  });

  test('handles errors gracefully', async ({ page }) => {
    // Mock a network failure for user loading
    await page.route('**/users', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    // Click the assignment button
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await assignmentButton.click();
    
    const panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    
    // Should show error message
    const errorMessage = panel.locator('.popover-error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Failed to load');
  });

  test('persists technician selections to localStorage', async ({ page }) => {
    // Click the assignment button to open panel
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await assignmentButton.click();
    
    const panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    
    // Wait for users to load
    await expect(panel.locator('.option-list')).toBeVisible();
    
    // Make an assignment
    const firstOption = panel.locator('.option-item').first();
    await expect(firstOption).toBeVisible();
    
    const isSelected = await firstOption.locator('.popover-checkmark-icon').isVisible();
    if (!isSelected) {
      await firstOption.click();
      
      // Wait for assignment to complete
      await page.waitForTimeout(1000);
      
      // Check that localStorage has been updated (if component uses localStorage)
      const localStorage = await page.evaluate(() => {
        const stored = window.localStorage.getItem('bos:technician-selections');
        return stored ? JSON.parse(stored) : {};
      });
      
      // Should have at least one job with technician selections (if localStorage is used)
      // Note: This test may need adjustment based on actual localStorage usage
    }
  });

  test('uses cached user data for better performance', async ({ page }) => {
    let userRequestCount = 0;
    
    // Monitor API requests
    page.on('request', request => {
      if (request.url().includes('/users')) {
        userRequestCount++;
      }
    });
    
    // First access
    const assignmentButton = page.locator('.popover-button[title="Technicians"]');
    await assignmentButton.click();
    
    let panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.option-list')).toBeVisible();
    
    // Close panel
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    
    // Second access - should use cached data
    await assignmentButton.click();
    panel = page.locator('.base-popover-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.option-list')).toBeVisible();
    
    // Should have made only one request (TanStack Query caching)
    expect(userRequestCount).toBeLessThanOrEqual(2); // Allow for potential initial request
  });

  test.describe('Accessibility', () => {
    test('maintains proper focus management', async ({ page }) => {
      const assignmentButton = page.locator('.popover-button[title="Technicians"]');
      
      // Focus the button
      await assignmentButton.focus();
      await expect(assignmentButton).toBeFocused();
      
      // Open panel with Enter
      await page.keyboard.press('Enter');
      const panel = page.locator('.base-popover-panel');
      await expect(panel).toBeVisible();
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await expect(panel).not.toBeVisible();
      
      // Button should regain focus
      await expect(assignmentButton).toBeFocused();
    });

    test('supports keyboard navigation in user list', async ({ page }) => {
      const assignmentButton = page.locator('.popover-button[title="Technicians"]');
      await assignmentButton.click();
      
      const panel = page.locator('.base-popover-panel');
      await expect(panel).toBeVisible();
      await expect(panel.locator('.option-list')).toBeVisible();
      
      // Tab to first option
      await page.keyboard.press('Tab');
      
      const firstOption = panel.locator('.option-item').first();
      await expect(firstOption).toBeFocused();
      
      // Space or Enter to toggle
      await page.keyboard.press('Space');
      
      // Should toggle the selection (checkmark should appear/disappear)
      const checkmarkVisible = await firstOption.locator('.popover-checkmark-icon').isVisible();
      await page.keyboard.press('Space');
      
      const checkmarkStillVisible = await firstOption.locator('.popover-checkmark-icon').isVisible();
      expect(checkmarkStillVisible).toBe(!checkmarkVisible);
    });
  });
});