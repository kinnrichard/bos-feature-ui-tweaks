import { test, expect } from '@playwright/test';

test.describe('Task Positioning Fix', () => {
  test('should insert tasks between existing ones without collisions', async ({ page }) => {
    // Navigate to a job with existing tasks
    await page.goto('/jobs/test-job-id');
    
    // Wait for tasks to load
    await page.waitForSelector('[data-testid="task-list"]');
    
    // Get initial task positions
    const initialTasks = await page.evaluate(() => {
      const tasks = Array.from(document.querySelectorAll('[data-task-id]'));
      return tasks.map(el => ({
        id: el.getAttribute('data-task-id'),
        title: el.querySelector('.task-title')?.textContent,
        // Get position from data attribute or compute from order
        position: parseFloat(el.getAttribute('data-position') || '0')
      }));
    });
    
    console.log('Initial tasks:', initialTasks);
    
    // Click to add task after first task
    const firstTask = await page.locator('[data-task-id]').first();
    await firstTask.hover();
    await firstTask.locator('.add-task-after-button').click();
    
    // Type new task title
    await page.keyboard.type('Task inserted between 1 and 2');
    await page.keyboard.press('Enter');
    
    // Wait for task to be created
    await page.waitForTimeout(1000);
    
    // Get updated task list
    const updatedTasks = await page.evaluate(() => {
      const tasks = Array.from(document.querySelectorAll('[data-task-id]'));
      return tasks.map(el => ({
        id: el.getAttribute('data-task-id'),
        title: el.querySelector('.task-title')?.textContent,
        position: parseFloat(el.getAttribute('data-position') || '0')
      }));
    });
    
    console.log('Updated tasks:', updatedTasks);
    
    // Find the new task
    const newTask = updatedTasks.find(t => t.title?.includes('inserted between'));
    expect(newTask).toBeTruthy();
    
    // Verify it has a fractional position
    if (newTask) {
      expect(newTask.position % 1).not.toBe(0); // Should not be a whole number
      expect(newTask.position).toBeGreaterThan(1);
      expect(newTask.position).toBeLessThan(2);
    }
    
    // Verify no position collisions
    const positions = updatedTasks.map(t => t.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(positions.length);
  });
  
  test('should handle drag-and-drop between tasks with fractional positions', async ({ page }) => {
    await page.goto('/jobs/test-job-id');
    await page.waitForSelector('[data-testid="task-list"]');
    
    // Get task elements
    const task1 = await page.locator('[data-task-id]').nth(0);
    const task2 = await page.locator('[data-task-id]').nth(1);
    const task3 = await page.locator('[data-task-id]').nth(2);
    
    // Drag task3 between task1 and task2
    await task3.dragTo(task2, {
      targetPosition: { x: 0, y: -10 } // Drop above task2
    });
    
    // Wait for reorder
    await page.waitForTimeout(1000);
    
    // Verify the order and positions
    const reorderedTasks = await page.evaluate(() => {
      const tasks = Array.from(document.querySelectorAll('[data-task-id]'));
      return tasks.map(el => ({
        id: el.getAttribute('data-task-id'),
        position: parseFloat(el.getAttribute('data-position') || '0')
      }));
    });
    
    // Task that was moved should have fractional position
    const movedTask = reorderedTasks[1]; // Should now be in second position
    expect(movedTask.position % 1).not.toBe(0);
    
    // All positions should be unique
    const positions = reorderedTasks.map(t => t.position);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(positions.length);
  });
});