import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DataFactory } from './helpers/data-factories';

test.describe('Popover Keyboard Isolation', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);
    
    // Authenticate
    await auth.setupAuthenticatedSession('admin');
  });

  test('task list should not respond to keyboard when popover is open', async ({ page }) => {
    // Create test data
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      client_id: client.id
    });
    
    // Create tasks
    for (let i = 1; i <= 3; i++) {
      await dataFactory.createTask({
        title: `Task ${i}`,
        job_id: job.id,
        position: i
      });
    }
    
    // Navigate to job detail page
    await page.goto(`/jobs/${job.id}`);
    
    // Wait for tasks to load
    await expect(page.locator('.task-item').first()).toBeVisible({ timeout: 10000 });
    
    // Select first task
    await page.locator('.task-item').first().click();
    await expect(page.locator('.task-item').first()).toHaveClass(/selected/);
    
    // Use arrow key to navigate to second task
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.task-item').nth(1)).toHaveClass(/selected/);
    
    // Open job status popover
    await page.locator('.popover-button[title="Job Status"]').click();
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    // Press arrow down - should navigate popover, NOT task list
    const secondTaskBefore = await page.locator('.task-item').nth(1).getAttribute('class');
    await page.keyboard.press('ArrowDown');
    
    // Verify task selection didn't change
    const secondTaskAfter = await page.locator('.task-item').nth(1).getAttribute('class');
    expect(secondTaskBefore).toBe(secondTaskAfter);
    
    // Verify popover navigation worked
    await expect(page.locator('.popover-menu-option.focused')).toBeVisible();
    
    // Press Enter - should select popover option, NOT create new task
    const taskCountBefore = await page.locator('.task-item').count();
    await page.keyboard.press('Enter');
    
    // Small delay to allow for any task creation
    await page.waitForTimeout(500);
    
    // Verify no new task was created
    const taskCountAfter = await page.locator('.task-item').count();
    expect(taskCountAfter).toBe(taskCountBefore);
    
    // Press Delete while popover is open - should not delete task
    await page.locator('.popover-button[title="Job Status"]').click();
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    
    // Verify task still exists
    const taskCountAfterDelete = await page.locator('.task-item').count();
    expect(taskCountAfterDelete).toBe(taskCountBefore);
    
    // Close popover
    await page.keyboard.press('Escape');
    await expect(page.locator('.base-popover-panel')).not.toBeVisible();
    
    // Now arrow keys should work on task list again
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.task-item').nth(2)).toHaveClass(/selected/);
  });

  test('multiple popovers should all block task list keyboard', async ({ page }) => {
    // Navigate to test page
    await page.goto('/test-popover-isolation');
    
    // Verify page loaded
    await expect(page.locator('h1:has-text("Popover Keyboard Isolation Test")')).toBeVisible();
    
    // Select first task
    await page.locator('.task-item').first().click();
    
    // Use arrow key - should work
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.event-item:has-text("Task list handled: ArrowDown")')).toBeVisible();
    
    // Open job status popover
    await page.locator('.popover-button').click();
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    // Check popover state indicator
    await expect(page.locator('.status-value').first()).toHaveText('YES');
    await expect(page.locator('.status-value').nth(1)).toHaveText('1');
    
    // Press arrow key - should be blocked
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.event-item:has-text("BLOCKED: ArrowDown")')).toBeVisible();
    
    // Press Enter - should be blocked
    await page.keyboard.press('Enter');
    await expect(page.locator('.event-item:has-text("BLOCKED: Enter")')).toBeVisible();
    
    // Press Delete - should be blocked
    await page.keyboard.press('Delete');
    await expect(page.locator('.event-item:has-text("BLOCKED: Delete")')).toBeVisible();
    
    // Close popover
    await page.keyboard.press('Escape');
    await expect(page.locator('.base-popover-panel')).not.toBeVisible();
    
    // Check popover state indicator
    await expect(page.locator('.status-value').first()).toHaveText('NO');
    await expect(page.locator('.status-value').nth(1)).toHaveText('0');
    
    // Arrow keys should work again
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.event-item:has-text("Task list handled: ArrowUp")')).toBeVisible();
  });

  test('popover keyboard navigation still works when task list is blocked', async ({ page }) => {
    // Create test data
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'open',
      client_id: client.id
    });
    
    // Navigate to job detail page
    await page.goto(`/jobs/${job.id}`);
    
    // Open job status popover
    await page.locator('.popover-button[title="Job Status"]').click();
    await expect(page.locator('.base-popover-panel')).toBeVisible();
    
    // Verify initial focus
    await expect(page.locator('.popover-menu-option').first()).toHaveClass(/focused/);
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.popover-menu-option').nth(1)).toHaveClass(/focused/);
    
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.popover-menu-option').nth(2)).toHaveClass(/focused/);
    
    // Navigate back up
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.popover-menu-option').nth(1)).toHaveClass(/focused/);
    
    // Select with Space key
    await page.keyboard.press(' ');
    
    // Popover should close and status should update
    await expect(page.locator('.base-popover-panel')).not.toBeVisible();
    await expect(page.locator('.job-status-emoji')).toContainText('🟢'); // in_progress emoji
  });
});