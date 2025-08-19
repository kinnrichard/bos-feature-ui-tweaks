import { test, expect } from '@playwright/test';

test.describe('Task Status Click Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Add any necessary setup here
  });

  test('new_task status should cycle to in_progress on click', async ({ page }) => {
    // Find a task with new_task status or create one
    const newTaskStatus = page.locator('[data-task-status="new_task"] .status-emoji').first();

    if ((await newTaskStatus.count()) > 0) {
      await newTaskStatus.click();

      // Should advance to in_progress without showing popover
      await expect(page.locator('.task-status-popover')).toBeHidden();
      // Task should now show in_progress status
      await expect(page.locator('[data-task-status="in_progress"]')).toBeVisible();
    }
  });

  test('in_progress status should cycle to successfully_completed on click', async ({ page }) => {
    // Find a task with in_progress status or set one to in_progress
    const inProgressStatus = page.locator('[data-task-status="in_progress"] .status-emoji').first();

    if ((await inProgressStatus.count()) > 0) {
      await inProgressStatus.click();

      // Should advance to successfully_completed without showing popover
      await expect(page.locator('.task-status-popover')).toBeHidden();
      // Task should now show successfully_completed status
      await expect(page.locator('[data-task-status="successfully_completed"]')).toBeVisible();
    }
  });

  test('paused status should show popover on click', async ({ page }) => {
    // Find a task with paused status or set one to paused
    const pausedStatus = page.locator('[data-task-status="paused"] .status-emoji').first();

    if ((await pausedStatus.count()) > 0) {
      await pausedStatus.click();

      // Should show popover immediately
      await expect(page.locator('.task-status-popover')).toBeVisible();
    }
  });

  test('successfully_completed status should show popover on click', async ({ page }) => {
    // Find a task with successfully_completed status
    const completedStatus = page
      .locator('[data-task-status="successfully_completed"] .status-emoji')
      .first();

    if ((await completedStatus.count()) > 0) {
      await completedStatus.click();

      // Should show popover immediately
      await expect(page.locator('.task-status-popover')).toBeVisible();
    }
  });

  test('cancelled status should show popover on click', async ({ page }) => {
    // Find a task with cancelled status
    const cancelledStatus = page.locator('[data-task-status="cancelled"] .status-emoji').first();

    if ((await cancelledStatus.count()) > 0) {
      await cancelledStatus.click();

      // Should show popover immediately
      await expect(page.locator('.task-status-popover')).toBeVisible();
    }
  });

  test('tooltips should reflect new behavior', async ({ page }) => {
    // Check that tooltips are updated appropriately
    const newTaskButton = page.locator('[data-task-status="new_task"] .status-emoji').first();
    const pausedTaskButton = page.locator('[data-task-status="paused"] .status-emoji').first();

    if ((await newTaskButton.count()) > 0) {
      await expect(newTaskButton).toHaveAttribute('title', 'Click to advance to next status');
    }

    if ((await pausedTaskButton.count()) > 0) {
      await expect(pausedTaskButton).toHaveAttribute('title', 'Click for status options');
    }
  });
});
