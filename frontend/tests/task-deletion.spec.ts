import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { TestDatabase } from './helpers/database';
import { DataFactory } from './helpers/data-factories';

test.describe('Task Deletion', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;
  let jobId: string;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);
    
    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');
    
    // Create test data (job with client and multiple tasks for deletion)
    const client = await dataFactory.createClient({ name: `Test Client ${Date.now()}-${Math.random().toString(36).substring(7)}` });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      priority: 'high',
      client_id: client.id
    });
    
    jobId = job.id;
    
    // Create multiple tasks for deletion scenarios
    await dataFactory.createTask({
      title: `Deletable Task 1 ${Date.now()}`,
      job_id: job.id,
      status: 'new_task'
    });
    await dataFactory.createTask({
      title: `Deletable Task 2 ${Date.now()}`,
      job_id: job.id,
      status: 'in_progress'
    });
    await dataFactory.createTask({
      title: `Deletable Task 3 ${Date.now()}`,
      job_id: job.id,
      status: 'successfully_completed'
    });
    
    // Navigate to the specific job detail page (where tasks can be deleted)
    await page.goto(`/jobs/${jobId}`);
    
    // Wait for task list to load
    await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show delete confirmation modal when delete key is pressed with selected task', async ({ page }) => {
    // Find and click on a task to select it
    const firstTask = page.locator('[data-task-id]').first();
    await firstTask.click();
    
    // Verify task is selected
    await expect(firstTask).toHaveClass(/selected/);
    
    // Press delete key
    await page.keyboard.press('Delete');
    
    // Verify delete confirmation modal appears (with timeout for animation)
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.modal-container')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
    
    // Verify confirmation message is shown
    await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
  });

  test('should handle multiple task deletion', async ({ page }) => {
    // Select multiple tasks using Cmd/Ctrl+click
    const tasks = page.locator('[data-task-id]');
    
    // Click first task
    await tasks.nth(0).click();
    
    // Cmd/Ctrl+click second task to add to selection
    await tasks.nth(1).click({ modifiers: ['Meta'] }); // Meta for macOS, could also use 'ControlOrMeta'
    
    // Press delete key
    await page.keyboard.press('Delete');
    
    // Verify modal shows multiple task deletion (with timeout for animation)
    await expect(page.locator('h2')).toContainText('Are you sure you want to delete', { timeout: 2000 });
    await expect(page.locator('h2')).toContainText('2 tasks');
  });

  test('should close modal when cancel is clicked', async ({ page }) => {
    // Select a task and open delete modal
    const firstTask = page.locator('[data-task-id]').first();
    await firstTask.click();
    await page.keyboard.press('Delete');
    
    // Click cancel button
    await page.locator('button', { hasText: 'Cancel' }).click();
    
    // Verify modal is closed (with timeout for animation)
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 2000 });
  });

  test('should close modal when escape key is pressed', async ({ page }) => {
    // Select a task and open delete modal
    const firstTask = page.locator('[data-task-id]').first();
    await firstTask.click();
    await page.keyboard.press('Delete');
    
    // Press escape key
    await page.keyboard.press('Escape');
    
    // Verify modal is closed (with timeout for animation)
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 });
  });

  test('should delete task when confirm button is clicked', async ({ page }) => {
    // Get initial task count
    const initialTaskCount = await page.locator('[data-task-id]').count();
    
    // Select a task and open delete modal
    const firstTask = page.locator('[data-task-id]').first();
    const taskTitle = await firstTask.locator('.task-title').textContent();
    await firstTask.click();
    await page.keyboard.press('Delete');
    
    // Click delete button
    await page.locator('button', { hasText: 'Delete' }).click();
    
    // Wait for deletion to complete and modal to close
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 });
    
    // Verify task count decreased
    await expect(page.locator('[data-task-id]')).toHaveCount(initialTaskCount - 1);
    
    // Verify the specific task is no longer visible
    if (taskTitle) {
      await expect(page.locator('h5', { hasText: taskTitle })).not.toBeVisible();
    }
    
    // Verify success message is shown (may be temporary)
    // Check for success feedback without masking real failures
    const feedbackMessage = page.locator('.feedback-message, .alert-success, .toast-success');
    const hasFeedback = await feedbackMessage.isVisible().catch(() => false);
    if (hasFeedback) {
      await expect(feedbackMessage).toContainText(/deleted|success/i, { timeout: 3000 });
    }
  });

  test('should not show delete modal when no tasks are selected', async ({ page }) => {
    // Ensure no tasks are selected by clicking on an empty area
    await page.click('body', { position: { x: 50, y: 50 } });
    
    // Wait to ensure any existing selection is cleared
    await page.waitForTimeout(500);
    
    // Press delete key
    await page.keyboard.press('Delete');
    
    // Verify modal does not appear
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 1000 });
  });

  test('should work with Backspace key as well as Delete key', async ({ page }) => {
    // Select a task
    const firstTask = page.locator('[data-task-id]').first();
    await firstTask.click();
    
    // Press backspace key instead of delete
    await page.keyboard.press('Backspace');
    
    // Verify delete confirmation modal appears (with timeout for animation)
    await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
  });
});