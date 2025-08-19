import { test, expect } from '@playwright/test';

test.describe('TaskRow Keyboard Events Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the jobs page where TaskList/TaskRow components are used
    await page.goto('http://localhost:5177/jobs/test');
    
    // Wait for the page to load and tasks to be visible
    await page.waitForSelector('[data-task-id]', { timeout: 10000 });
  });

  test('spacebar during title editing should add space, not trigger task selection', async ({ page }) => {
    // Find the first task
    const firstTask = page.locator('[data-task-id]').first();
    await expect(firstTask).toBeVisible();

    // Click on the task title to start editing
    const taskTitle = firstTask.locator('.task-title');
    await taskTitle.click();
    
    // Verify we're in editing mode (contenteditable should be focused)
    await expect(taskTitle).toBeFocused();
    
    // Clear existing content and type with spacebar
    await taskTitle.fill(''); // Clear content
    await page.keyboard.type('test content with spaces');
    
    // Verify that the content includes spaces and the task isn't selected
    const titleText = await taskTitle.textContent();
    expect(titleText).toContain('test content with spaces');
    
    // Verify the task doesn't have the selected class
    await expect(firstTask).not.toHaveClass(/selected/);
  });

  test('enter during title editing should save title, not create new task', async ({ page }) => {
    // Find the first task
    const firstTask = page.locator('[data-task-id]').first();
    await expect(firstTask).toBeVisible();

    // Count initial number of tasks
    const initialTaskCount = await page.locator('[data-task-id]').count();

    // Click on the task title to start editing
    const taskTitle = firstTask.locator('.task-title');
    await taskTitle.click();
    
    // Verify we're in editing mode
    await expect(taskTitle).toBeFocused();
    
    // Change the title and press Enter
    await taskTitle.fill('');
    await page.keyboard.type('Updated Title');
    await page.keyboard.press('Enter');
    
    // Verify title was saved
    await expect(taskTitle).toHaveText('Updated Title');
    
    // Verify no new task was created
    const finalTaskCount = await page.locator('[data-task-id]').count();
    expect(finalTaskCount).toBe(initialTaskCount);
    
    // Verify we're no longer in editing mode
    await expect(taskTitle).not.toBeFocused();
  });

  test('escape during title editing should cancel edit without side effects', async ({ page }) => {
    // Find the first task
    const firstTask = page.locator('[data-task-id]').first();
    await expect(firstTask).toBeVisible();

    // Get the original title
    const taskTitle = firstTask.locator('.task-title');
    const originalTitle = await taskTitle.textContent();

    // Click on the task title to start editing
    await taskTitle.click();
    
    // Verify we're in editing mode
    await expect(taskTitle).toBeFocused();
    
    // Change the title and press Escape
    await taskTitle.fill('');
    await page.keyboard.type('Changed Title');
    await page.keyboard.press('Escape');
    
    // Verify title was reverted to original
    await expect(taskTitle).toHaveText(originalTitle || '');
    
    // Verify we're no longer in editing mode
    await expect(taskTitle).not.toBeFocused();
    
    // Verify task selection state wasn't affected
    await expect(firstTask).not.toHaveClass(/selected/);
  });

  test('keyboard events work normally when not editing', async ({ page }) => {
    // Find the first task
    const firstTask = page.locator('[data-task-id]').first();
    await expect(firstTask).toBeVisible();

    // Make sure we're not editing (click elsewhere first)
    await page.click('body');
    
    // Click on task (not title) to focus it
    await firstTask.click();
    
    // Verify task is focused but not editing
    await expect(firstTask).toBeFocused();
    const taskTitle = firstTask.locator('.task-title');
    await expect(taskTitle).not.toBeFocused();
    
    // Press spacebar - should select the task
    await page.keyboard.press('Space');
    
    // Verify task is selected
    await expect(firstTask).toHaveClass(/selected/);
  });

  test('multiple keyboard events during editing are properly isolated', async ({ page }) => {
    // Find the first task
    const firstTask = page.locator('[data-task-id]').first();
    await expect(firstTask).toBeVisible();

    // Click on the task title to start editing
    const taskTitle = firstTask.locator('.task-title');
    await taskTitle.click();
    
    // Verify we're in editing mode
    await expect(taskTitle).toBeFocused();
    
    // Type content with various keyboard inputs that could trigger task actions
    await taskTitle.fill('');
    await page.keyboard.type('Testing: ');
    await page.keyboard.press('Space'); // Should add space, not select
    await page.keyboard.type('with spaces and');
    await page.keyboard.press('Space'); // Another space
    await page.keyboard.press('ArrowLeft'); // Should move cursor, not navigate tasks
    await page.keyboard.type('text '); // Insert text at cursor position
    
    // Verify the text content includes our changes
    const titleText = await taskTitle.textContent();
    expect(titleText).toContain('Testing: with spaces and text');
    
    // Verify the task wasn't selected or otherwise affected
    await expect(firstTask).not.toHaveClass(/selected/);
    
    // Save the edit with Enter
    await page.keyboard.press('Enter');
    
    // Verify we're no longer editing
    await expect(taskTitle).not.toBeFocused();
  });
});