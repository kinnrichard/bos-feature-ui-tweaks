import { test, expect } from '@playwright/test';

test.describe('Task Positioning', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a job detail page
    await page.goto('/jobs/1');
    
    // Wait for tasks to load
    await page.waitForSelector('.task-item', { timeout: 5000 });
  });

  test('should insert tasks with integer positions', async ({ page }) => {
    // Get initial task count
    const initialTasks = await page.locator('.task-item').count();
    
    // Find the first task and click to select it
    const firstTask = page.locator('.task-item').first();
    await firstTask.click();
    
    // Press Enter to create inline task
    await page.keyboard.press('Enter');
    
    // Type new task title
    await page.keyboard.type('Inserted Task');
    
    // Press Enter to save
    await page.keyboard.press('Enter');
    
    // Verify task was created
    await expect(page.locator('.task-item')).toHaveCount(initialTasks + 1);
    
    // Verify the new task appears in the correct position
    const taskTitles = await page.locator('.task-title').allTextContents();
    const insertedIndex = taskTitles.findIndex(title => title.includes('Inserted Task'));
    
    // Should be after the first task (index 1 if we selected the first task)
    expect(insertedIndex).toBeGreaterThan(0);
  });

  test('should handle multiple insertions between same tasks', async ({ page }) => {
    // Get first two tasks
    const tasks = page.locator('.task-item');
    const firstTask = tasks.first();
    
    // Insert multiple tasks after the first one
    for (let i = 1; i <= 3; i++) {
      await firstTask.click();
      await page.keyboard.press('Enter');
      await page.keyboard.type(`Inserted Task ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100); // Small delay to ensure task is created
    }
    
    // Verify all tasks were created
    const taskTitles = await page.locator('.task-title').allTextContents();
    
    // Check that all inserted tasks exist
    expect(taskTitles.some(t => t.includes('Inserted Task 1'))).toBe(true);
    expect(taskTitles.some(t => t.includes('Inserted Task 2'))).toBe(true);
    expect(taskTitles.some(t => t.includes('Inserted Task 3'))).toBe(true);
    
    // They should all appear after the first task
    const firstTaskIndex = 0;
    const insertedIndices = taskTitles
      .map((title, index) => ({ title, index }))
      .filter(item => item.title.includes('Inserted Task'))
      .map(item => item.index);
    
    insertedIndices.forEach(index => {
      expect(index).toBeGreaterThan(firstTaskIndex);
    });
  });

  test('should add tasks at the bottom with proper spacing', async ({ page }) => {
    // Click the "New Task" button at the bottom
    await page.click('.task-item-add-new');
    
    // Type task title
    await page.keyboard.type('Bottom Task');
    
    // Press Enter or Tab to save
    await page.keyboard.press('Enter');
    
    // Verify task was added at the end
    const lastTask = page.locator('.task-item').last();
    const lastTaskTitle = await lastTask.locator('.task-title').textContent();
    
    expect(lastTaskTitle).toContain('Bottom Task');
  });

  test('should maintain order after page reload', async ({ page }) => {
    // Create a few tasks with integer positions
    const firstTask = page.locator('.task-item').first();
    
    await firstTask.click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Persistent Task 1');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(500);
    
    await firstTask.click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Persistent Task 2');
    await page.keyboard.press('Enter');
    
    // Get task order before reload
    const beforeReload = await page.locator('.task-title').allTextContents();
    
    // Reload the page
    await page.reload();
    await page.waitForSelector('.task-item');
    
    // Get task order after reload
    const afterReload = await page.locator('.task-title').allTextContents();
    
    // Order should be preserved
    expect(afterReload).toEqual(beforeReload);
  });
});