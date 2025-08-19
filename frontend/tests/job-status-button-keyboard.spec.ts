import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { TestDatabase } from './helpers/database';
import { DataFactory } from './helpers/data-factories';

test.describe('JobStatusButton Keyboard Navigation', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;
  let jobId: string;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);
    
    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');
    
    // Create test data
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'open',
      priority: 'normal',
      client_id: client.id
    });
    jobId = job.id;
    
    // Navigate to the jobs listing page where JobStatusButton appears in the toolbar
    await page.goto(`/jobs/${jobId}`);
    
    // Wait for the job detail page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for the toolbar with JobStatusButton to be visible
    await page.waitForSelector('.toolbar', { timeout: 10000 });
  });

  test('should navigate job status options with arrow keys', async ({ page }) => {
    // Find the first job status button
    const statusButton = page.locator('.popover-button').first();
    await expect(statusButton).toBeVisible();
    
    // Click to open the popover
    await statusButton.click();
    
    // Wait for popover menu to be visible
    const popoverMenu = page.locator('.popover-menu');
    await expect(popoverMenu).toBeVisible();
    
    // Check that no option has blue focus outline
    const focusedOption = page.locator('.popover-menu-option.focused');
    if (await focusedOption.count() > 0) {
      // Check that the focused option doesn't have a blue outline
      const outline = await focusedOption.evaluate(el => 
        window.getComputedStyle(el).outline
      );
      expect(outline).not.toContain('blue');
      expect(outline).toBe('none');
    }
    
    // Press down arrow to navigate
    await page.keyboard.press('ArrowDown');
    
    // Check that an option is now highlighted (has focused class)
    await expect(page.locator('.popover-menu-option.focused')).toBeVisible();
    
    // Press down arrow multiple times to test navigation
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowDown');
    }
    
    // Press up arrow to navigate back
    await page.keyboard.press('ArrowUp');
    
    // Verify navigation works
    await expect(page.locator('.popover-menu-option.focused')).toBeVisible();
  });

  test('should select status with Space key', async ({ page }) => {
    // Find the first job status button
    const statusButton = page.locator('.popover-button').first();
    
    // Get initial status emoji
    const initialEmoji = await statusButton.locator('.job-status-emoji').textContent();
    
    // Click to open the popover
    await statusButton.click();
    
    // Wait for popover menu
    const popoverMenu = page.locator('.popover-menu');
    await expect(popoverMenu).toBeVisible();
    
    // Navigate to a different status
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    
    // Select with Space key
    await page.keyboard.press(' ');
    
    // Verify popover closed
    await expect(popoverMenu).not.toBeVisible();
    
    // Verify status changed (emoji should be different)
    const newEmoji = await statusButton.locator('.job-status-emoji').textContent();
    expect(newEmoji).not.toBe(initialEmoji);
  });

  test('should select status with Enter key', async ({ page }) => {
    // Find a job status button
    const statusButton = page.locator('.popover-button').first();
    
    // Get initial status
    const initialEmoji = await statusButton.locator('.job-status-emoji').textContent();
    
    // Click to open
    await statusButton.click();
    
    // Wait for popover
    const popoverMenu = page.locator('.popover-menu');
    await expect(popoverMenu).toBeVisible();
    
    // Navigate and select with Enter
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Verify popover closed
    await expect(popoverMenu).not.toBeVisible();
    
    // Verify status changed
    const newEmoji = await statusButton.locator('.job-status-emoji').textContent();
    expect(newEmoji).not.toBe(initialEmoji);
  });

  test('should close popover with Escape key', async ({ page }) => {
    // Open a job status popover
    const statusButton = page.locator('.popover-button').first();
    await statusButton.click();
    
    // Verify popover is open
    const popoverMenu = page.locator('.popover-menu');
    await expect(popoverMenu).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify popover closed
    await expect(popoverMenu).not.toBeVisible();
  });

  test('should have no blue focus rings on menu items', async ({ page }) => {
    // Open a job status popover
    const statusButton = page.locator('.popover-button').first();
    await statusButton.click();
    
    // Wait for popover
    await page.waitForSelector('.popover-menu');
    
    // Navigate through all options
    const optionCount = await page.locator('.popover-menu-option').count();
    
    for (let i = 0; i < optionCount; i++) {
      await page.keyboard.press('ArrowDown');
      
      // Check the focused option for blue outline
      const focusedOption = page.locator('.popover-menu-option.focused');
      const outline = await focusedOption.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow
        };
      });
      
      // Verify no blue outline or focus ring
      expect(outline.outline).not.toContain('blue');
      expect(outline.outlineColor).not.toContain('blue');
      expect(outline.boxShadow).not.toContain('rgb(0, 163, 255)'); // The blue color used in focus rings
    }
  });

  test('should wrap around when navigating past last item', async ({ page }) => {
    // Open popover
    const statusButton = page.locator('.popover-button').first();
    await statusButton.click();
    
    await page.waitForSelector('.popover-menu');
    
    // Get total number of options
    const optionCount = await page.locator('.popover-menu-option').count();
    
    // Navigate to last item
    for (let i = 0; i < optionCount - 1; i++) {
      await page.keyboard.press('ArrowDown');
    }
    
    // Get the label of the last focused item
    let focusedLabel = await page.locator('.popover-menu-option.focused .popover-menu-label').textContent();
    
    // Press down once more - should wrap to first
    await page.keyboard.press('ArrowDown');
    
    // Verify we're at the first item
    const firstLabel = await page.locator('.popover-menu-option.focused .popover-menu-label').textContent();
    expect(firstLabel).toBe('Open'); // First status in the list
    
    // Press up - should wrap to last
    await page.keyboard.press('ArrowUp');
    
    // Verify we're at the last item
    focusedLabel = await page.locator('.popover-menu-option.focused .popover-menu-label').textContent();
    expect(focusedLabel).toBe('Cancelled'); // Last status in the list
  });
});