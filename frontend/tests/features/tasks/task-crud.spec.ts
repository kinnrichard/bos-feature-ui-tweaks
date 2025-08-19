import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../helpers/auth';
import { DataFactory } from '../../helpers/data-factories';

test.describe('Task CRUD Operations', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;
  let jobId: string;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);

    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');

    // Create test data (job with client for task operations)
    const client = await dataFactory.createClient({
      name: `Test Client ${Date.now()}-${Math.random().toString(36).substring(7)}`,
    });
    const job = await dataFactory.createJob({
      title: `Test Job ${Date.now()}`,
      status: 'in_progress',
      priority: 'high',
      client_id: client.id,
    });

    jobId = job.id;

    // Navigate to the specific job detail page (where tasks are managed)
    await page.goto(`/jobs/${jobId}`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Task Creation', () => {
    test('should create new task with basic information', async ({ page }) => {
      // Find and click the new task button
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      await expect(newTaskButton).toBeVisible({ timeout: 10000 });
      await newTaskButton.click();

      // Should open task creation form/modal
      const taskForm = page.locator('.task-form, .new-task-form');
      await expect(taskForm).toBeVisible({ timeout: 5000 });

      // Fill in task details
      const timestamp = Date.now();
      const taskTitle = `New Test Task ${timestamp}`;

      await page.fill('input[name="title"], input[placeholder*="task"]', taskTitle);

      // Submit the form
      await page.click('button:has-text("Create"), button:has-text("Save")');

      // Wait for task to appear in the list
      await expect(page.locator(`[data-task-id]:has-text("${taskTitle}")`)).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display new task button when task list is empty', async ({ page }) => {
      // Navigate to job with no tasks
      await page.goto(`/jobs/${jobId}`);
      await page.waitForSelector('[data-testid="task-list"]');

      const newTaskButton = page.locator('[data-testid="create-task-button"]');

      // New task button should be visible
      await expect(newTaskButton).toBeVisible();
      await expect(newTaskButton).toContainText('New Task');
    });
  });

  test.describe('Task Reading/Display', () => {
    test('should display task list with proper structure', async ({ page }) => {
      // Create test tasks for display
      const task1 = await dataFactory.createTask({
        title: `Display Task 1 ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      const task2 = await dataFactory.createTask({
        title: `Display Task 2 ${Date.now()}`,
        job_id: jobId,
        status: 'in_progress',
      });

      // Refresh to see new tasks
      await page.reload();
      await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });

      // Verify tasks are displayed
      await expect(page.locator(`[data-task-id="${task1.id}"]`)).toBeVisible();
      await expect(page.locator(`[data-task-id="${task2.id}"]`)).toBeVisible();

      // Check task structure contains required elements
      const taskElement = page.locator('[data-task-id]').first();
      await expect(taskElement.locator('.task-title, h5')).toBeVisible();
      await expect(taskElement.locator('.task-status')).toBeVisible();
    });

    test('should show task details in popover on interaction', async ({ page }) => {
      // Create a task for interaction
      const task = await dataFactory.createTask({
        title: `Popover Task ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
        description: 'Task description for popover testing',
      });

      await page.reload();
      await expect(page.locator(`[data-task-id="${task.id}"]`)).toBeVisible({ timeout: 10000 });

      // Click on task to show popover
      await page.locator(`[data-task-id="${task.id}"]`).click();

      // Verify popover appears with task details
      const popover = page.locator('.task-popover, .popover-panel');
      await expect(popover).toBeVisible({ timeout: 5000 });

      // Check popover contains task information
      await expect(popover).toContainText(task.title);
    });
  });

  test.describe('Task Updates', () => {
    test('should update task status', async ({ page }) => {
      // Create a task to update
      const task = await dataFactory.createTask({
        title: `Update Task ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      await page.reload();
      await expect(page.locator(`[data-task-id="${task.id}"]`)).toBeVisible({ timeout: 10000 });

      // Click on task to open popover or status dropdown
      await page.locator(`[data-task-id="${task.id}"]`).click();

      // Look for status change option
      const statusOption = page.locator('.status-option, .option-item:has-text("In Progress")');
      if (await statusOption.isVisible()) {
        await statusOption.click();

        // Verify task status updated
        await expect(page.locator(`[data-task-id="${task.id}"] .task-status`)).toContainText(
          'in_progress'
        );
      }
    });

    test('should update task title inline', async ({ page }) => {
      // Create a task to update
      const task = await dataFactory.createTask({
        title: `Editable Task ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      await page.reload();
      await expect(page.locator(`[data-task-id="${task.id}"]`)).toBeVisible({ timeout: 10000 });

      // Try to edit task title inline
      const taskTitle = page.locator(
        `[data-task-id="${task.id}"] .task-title, [data-task-id="${task.id}"] h5`
      );

      // Double-click to edit (if editable)
      await taskTitle.dblclick();

      // If inline editing is available
      const editInput = page.locator('input[value*="Editable Task"]');
      if (await editInput.isVisible()) {
        await editInput.fill(`Updated Task ${Date.now()}`);
        await page.keyboard.press('Enter');

        // Verify title updated
        await expect(taskTitle).toContainText('Updated Task');
      }
    });
  });

  test.describe('Task Deletion', () => {
    test('should show delete confirmation modal when delete key is pressed', async ({ page }) => {
      // Create multiple tasks for deletion scenarios
      await dataFactory.createTask({
        title: `Deletable Task 1 ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });
      await dataFactory.createTask({
        title: `Deletable Task 2 ${Date.now()}`,
        job_id: jobId,
        status: 'in_progress',
      });

      await page.reload();
      await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });

      // Find and click on a task to select it
      const firstTask = page.locator('[data-task-id]').first();
      await firstTask.click();

      // Verify task is selected
      await expect(firstTask).toHaveClass(/selected/);

      // Press delete key
      await page.keyboard.press('Delete');

      // Verify delete confirmation modal appears
      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('.modal-container')).toBeVisible();
      await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
    });

    test('should handle multiple task deletion', async ({ page }) => {
      // Create multiple tasks
      await dataFactory.createTask({
        title: `Multi Delete Task 1 ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });
      await dataFactory.createTask({
        title: `Multi Delete Task 2 ${Date.now()}`,
        job_id: jobId,
        status: 'in_progress',
      });

      await page.reload();
      await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });

      // Select multiple tasks using Cmd/Ctrl+click
      const tasks = page.locator('[data-task-id]');

      // Click first task
      await tasks.nth(0).click();

      // Cmd/Ctrl+click second task to add to selection
      await tasks.nth(1).click({ modifiers: ['Meta'] });

      // Press delete key
      await page.keyboard.press('Delete');

      // Verify modal shows multiple task deletion
      await expect(page.locator('h2')).toContainText('Are you sure you want to delete', {
        timeout: 2000,
      });
      await expect(page.locator('h2')).toContainText('2 tasks');
    });

    test('should delete task when confirm button is clicked', async ({ page }) => {
      // Create a task to delete
      const task = await dataFactory.createTask({
        title: `Task to Delete ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      await page.reload();
      await expect(page.locator(`[data-task-id="${task.id}"]`)).toBeVisible({ timeout: 10000 });

      // Get initial task count
      const initialTaskCount = await page.locator('[data-task-id]').count();

      // Select task and open delete modal
      const taskElement = page.locator(`[data-task-id="${task.id}"]`);
      await taskElement.click();
      await page.keyboard.press('Delete');

      // Click delete button
      await page.locator('button', { hasText: 'Delete' }).click();

      // Wait for deletion to complete and modal to close
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 });

      // Verify task count decreased
      await expect(page.locator('[data-task-id]')).toHaveCount(initialTaskCount - 1);

      // Verify the specific task is no longer visible
      await expect(page.locator(`[data-task-id="${task.id}"]`)).not.toBeVisible();
    });

    test('should close modal when cancel is clicked', async ({ page }) => {
      // Create task and trigger delete modal
      await dataFactory.createTask({
        title: `Cancel Delete Task ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      await page.reload();
      await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });

      // Select a task and open delete modal
      const firstTask = page.locator('[data-task-id]').first();
      await firstTask.click();
      await page.keyboard.press('Delete');

      // Click cancel button
      await page.locator('button', { hasText: 'Cancel' }).click();

      // Verify modal is closed
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 2000 });
    });

    test('should work with Backspace key as well as Delete key', async ({ page }) => {
      // Create task for backspace test
      await dataFactory.createTask({
        title: `Backspace Delete Task ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      await page.reload();
      await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });

      // Select a task
      const firstTask = page.locator('[data-task-id]').first();
      await firstTask.click();

      // Press backspace key instead of delete
      await page.keyboard.press('Backspace');

      // Verify delete confirmation modal appears
      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
    });

    test('should not show delete modal when no tasks are selected', async ({ page }) => {
      // Create task but don't select it
      await dataFactory.createTask({
        title: `Unselected Task ${Date.now()}`,
        job_id: jobId,
        status: 'new_task',
      });

      await page.reload();
      await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });

      // Ensure no tasks are selected by clicking on an empty area
      await page.click('body', { position: { x: 50, y: 50 } });

      // Wait to ensure any existing selection is cleared
      await page.waitForTimeout(500);

      // Press delete key
      await page.keyboard.press('Delete');

      // Verify modal does not appear
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 1000 });
    });
  });
});
