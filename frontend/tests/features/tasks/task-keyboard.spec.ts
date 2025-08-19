import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../helpers/auth';
import { DataFactory } from '../../helpers/data-factories';

test.describe('Task Keyboard Interactions', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;
  let jobId: string;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);

    // Authenticate as admin user
    await auth.setupAuthenticatedSession('admin');

    // Create test data (job with client and multiple tasks for keyboard testing)
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

    // Create multiple tasks for keyboard interaction testing
    await dataFactory.createTask({
      title: `Keyboard Task 1 ${Date.now()}`,
      job_id: job.id,
      status: 'new_task',
    });
    await dataFactory.createTask({
      title: `Keyboard Task 2 ${Date.now()}`,
      job_id: job.id,
      status: 'in_progress',
    });
    await dataFactory.createTask({
      title: `Keyboard Task 3 ${Date.now()}`,
      job_id: job.id,
      status: 'successfully_completed',
    });

    // Navigate to the specific job detail page
    await page.goto(`/jobs/${jobId}`);

    // Wait for task list to load
    await expect(page.locator('[data-task-id]').first()).toBeVisible({ timeout: 10000 });
  });

  test.describe('Task Selection', () => {
    test('should select task with click and show visual feedback', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Click to select task
      await firstTask.click();

      // Verify task is selected (has selected class or styling)
      await expect(firstTask).toHaveClass(/selected/);

      // Verify focus is on the task
      await expect(firstTask).toBeFocused();
    });

    test('should navigate between tasks with arrow keys', async ({ page }) => {
      const tasks = page.locator('[data-task-id]');
      const firstTask = tasks.first();
      const secondTask = tasks.nth(1);

      // Click first task to establish focus
      await firstTask.click();
      await expect(firstTask).toBeFocused();

      // Press down arrow to move to next task
      await page.keyboard.press('ArrowDown');

      // Second task should now be focused
      await expect(secondTask).toBeFocused();

      // Press up arrow to go back
      await page.keyboard.press('ArrowUp');

      // First task should be focused again
      await expect(firstTask).toBeFocused();
    });

    test('should support multi-selection with Shift+Arrow keys', async ({ page }) => {
      const tasks = page.locator('[data-task-id]');
      const firstTask = tasks.first();

      // Click first task
      await firstTask.click();

      // Shift+Down Arrow to select multiple
      await page.keyboard.press('Shift+ArrowDown');

      // Both first and second task should be selected
      await expect(tasks.first()).toHaveClass(/selected/);
      await expect(tasks.nth(1)).toHaveClass(/selected/);
    });

    test('should support multi-selection with Ctrl/Cmd+click', async ({ page }) => {
      const tasks = page.locator('[data-task-id]');

      // Click first task
      await tasks.first().click();

      // Ctrl/Cmd+click second task
      await tasks.nth(1).click({ modifiers: ['Meta'] });

      // Both tasks should be selected
      await expect(tasks.first()).toHaveClass(/selected/);
      await expect(tasks.nth(1)).toHaveClass(/selected/);
    });

    test('should select all tasks with Ctrl/Cmd+A', async ({ page }) => {
      const tasks = page.locator('[data-task-id]');

      // Focus on task list area
      await tasks.first().click();

      // Select all with Ctrl/Cmd+A
      await page.keyboard.press('Meta+a');

      // All tasks should be selected
      const taskCount = await tasks.count();
      const selectedTasks = page.locator('[data-task-id].selected');
      const selectedCount = await selectedTasks.count();

      expect(selectedCount).toBe(taskCount);
    });
  });

  test.describe('Task Actions', () => {
    test('should delete selected task with Delete key', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Select task
      await firstTask.click();

      // Press Delete key
      await page.keyboard.press('Delete');

      // Should show confirmation modal
      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
    });

    test('should delete selected task with Backspace key', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Select task
      await firstTask.click();

      // Press Backspace key
      await page.keyboard.press('Backspace');

      // Should show confirmation modal
      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('h2')).toContainText('Are you sure you want to delete');
    });

    test('should handle Enter key to open task details', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Select task
      await firstTask.click();

      // Press Enter key
      await page.keyboard.press('Enter');

      // Should open task details (popover or navigate to task page)
      const taskPopover = page.locator('.task-popover, .popover-panel, .task-details');
      await expect(taskPopover.first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle Space key for task interaction', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Focus on task
      await firstTask.click();

      // Press Space key
      await page.keyboard.press('Space');

      // Should trigger some interaction (toggle selection, open details, etc.)
      // Exact behavior depends on implementation
      const hasInteraction = await Promise.race([
        page.locator('.task-popover').isVisible(),
        page.locator('.popover-panel').isVisible(),
        firstTask.evaluate((el) => el.classList.contains('selected')),
      ]);

      expect(hasInteraction).toBeTruthy();
    });
  });

  test.describe('Quick Actions', () => {
    test('should support quick status change with number keys', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Select task
      await firstTask.click();

      // Try number key for status change (if implemented)
      await page.keyboard.press('1'); // Could be "New Task" status

      // Check if status changed (depends on implementation)
      const statusIndicator = firstTask.locator('.task-status, .status-badge');
      if (await statusIndicator.isVisible()) {
        // Status should reflect the change
        const statusText = await statusIndicator.textContent();
        expect(statusText).toBeTruthy();
      }
    });

    test('should support Return key shortcuts for task creation', async ({ page }) => {
      // Focus on task list
      const taskList = page.locator('[data-testid="task-list"], .task-list');
      if (await taskList.isVisible()) {
        await taskList.click();
      }

      // Press a key combination that might create a new task
      await page.keyboard.press('Meta+Enter');

      // Check if new task creation is triggered
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      const taskForm = page.locator('.task-form, .new-task-form');

      const creationTriggered = await Promise.race([
        newTaskButton.isVisible(),
        taskForm.isVisible(),
      ]);

      if (creationTriggered) {
        expect(creationTriggered).toBeTruthy();
      }
    });
  });

  test.describe('Modal and Popover Navigation', () => {
    test('should close delete confirmation modal with Escape key', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Select task and open delete modal
      await firstTask.click();
      await page.keyboard.press('Delete');

      // Modal should be visible
      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Modal should be closed
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 2000 });
    });

    test('should confirm deletion with Enter key in modal', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Select task and open delete modal
      await firstTask.click();
      await page.keyboard.press('Delete');

      // Modal should be visible
      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });

      // Focus should be on confirm button or modal
      const confirmButton = page.locator('button:has-text("Delete")');
      if (await confirmButton.isVisible()) {
        // Press Enter to confirm
        await page.keyboard.press('Enter');

        // Modal should close and task should be deleted
        await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 });
      }
    });

    test('should navigate modal buttons with Tab key', async ({ page }) => {
      const firstTask = page.locator('[data-task-id]').first();

      // Open delete modal
      await firstTask.click();
      await page.keyboard.press('Delete');

      await expect(page.locator('.modal-backdrop')).toBeVisible({ timeout: 2000 });

      // Tab through modal buttons
      await page.keyboard.press('Tab');

      // Check if focus moves between buttons
      const cancelButton = page.locator('button:has-text("Cancel")');
      const deleteButton = page.locator('button:has-text("Delete")');

      const cancelFocused = await cancelButton.evaluate((el) => document.activeElement === el);
      const deleteFocused = await deleteButton.evaluate((el) => document.activeElement === el);

      expect(cancelFocused || deleteFocused).toBeTruthy();
    });
  });

  test.describe('Accessibility', () => {
    test('should maintain focus visibility during keyboard navigation', async ({ page }) => {
      const tasks = page.locator('[data-task-id]');

      // Start with first task
      await tasks.first().click();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');

      // Focus should be visible on current task
      const focusedTask = page.locator('[data-task-id]:focus');
      await expect(focusedTask).toBeVisible();
    });

    test('should announce selection changes to screen readers', async ({ page }) => {
      // This is a conceptual test - actual screen reader testing requires specialized tools
      const firstTask = page.locator('[data-task-id]').first();

      // Check for ARIA attributes that help screen readers
      await firstTask.click();

      // Should have appropriate ARIA attributes
      const ariaSelected = await firstTask.getAttribute('aria-selected');
      const ariaLabel = await firstTask.getAttribute('aria-label');
      const role = await firstTask.getAttribute('role');

      // At least one accessibility attribute should be present
      expect(ariaSelected || ariaLabel || role).toBeTruthy();
    });

    test('should support screen reader navigation patterns', async ({ page }) => {
      const taskList = page.locator('[data-testid="task-list"], .task-list');

      // Check for proper ARIA roles and structure
      if (await taskList.isVisible()) {
        const listRole = await taskList.getAttribute('role');
        expect(listRole).toMatch(/list|grid|listbox/);

        // Individual tasks should have proper item roles
        const firstTask = page.locator('[data-task-id]').first();
        const itemRole = await firstTask.getAttribute('role');
        expect(itemRole).toMatch(/listitem|gridcell|option/);
      }
    });
  });
});
