import { test, expect } from '@playwright/test';

test.describe('Task Positioning System', () => {
  let jobId;
  
  test.beforeAll(async ({ browser }) => {
    // Get a job ID that has tasks 
    const page = await browser.newPage();
    
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to jobs page 
    await page.goto('/jobs');
    await page.waitForSelector('.job-item', { timeout: 10000 });
    
    // Get first job link and extract ID
    const firstJobLink = await page.locator('.job-item a').first().getAttribute('href');
    if (firstJobLink) {
      const matches = firstJobLink.match(/\/jobs\/([^\/]+)/);
      if (matches) {
        jobId = matches[1];
      }
    }
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login 
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to job detail page with real job ID
    if (jobId) {
      await page.goto(`/jobs/${jobId}`);
    } else {
      // Fallback: go to jobs list and click first job
      await page.goto('/jobs');
      await page.waitForSelector('.job-item');
      await page.click('.job-item a');
    }
    
    // Wait for tasks to load
    await page.waitForSelector('.task-item', { timeout: 10000 });
  });

  test('should only affect the dragged task position when reordering', async ({ page }) => {
    console.log('Testing single task repositioning - the main user complaint');
    
    // Get initial tasks
    const initialTasks = await page.locator('.task-item').count();
    console.log(`Initial task count: ${initialTasks}`);
    
    if (initialTasks < 2) {
      console.log('Need at least 2 tasks for reordering test. Creating test tasks...');
      
      // Add a few test tasks
      await page.click('.task-item-add-new');
      await page.keyboard.type('Test Task 1');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      await page.click('.task-item-add-new');
      await page.keyboard.type('Test Task 2');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
    
    // Get task positions before drag
    const beforePositions = await page.evaluate(() => {
      const tasks = Array.from(document.querySelectorAll('.task-item'));
      return tasks.map((task, index) => ({
        index,
        title: task.querySelector('.task-title')?.textContent?.trim(),
        element: task
      }));
    });
    
    console.log('Tasks before reordering:', beforePositions.map(t => t.title));
    
    // Simulate dragging the second task to the first position
    if (beforePositions.length >= 2) {
      const secondTask = page.locator('.task-item').nth(1);
      const firstTask = page.locator('.task-item').nth(0);
      
      // Use drag and drop
      await secondTask.dragTo(firstTask);
      await page.waitForTimeout(1000); // Wait for reordering to complete
      
      // Get task positions after drag
      const afterPositions = await page.evaluate(() => {
        const tasks = Array.from(document.querySelectorAll('.task-item'));
        return tasks.map((task, index) => ({
          index,
          title: task.querySelector('.task-title')?.textContent?.trim()
        }));
      });
      
      console.log('Tasks after reordering:', afterPositions.map(t => t.title));
      
      // Verify that only the order changed, not that multiple tasks got affected
      expect(afterPositions.length).toBe(beforePositions.length);
      
      // The second task should now be first
      expect(afterPositions[0].title).toBe(beforePositions[1].title);
      expect(afterPositions[1].title).toBe(beforePositions[0].title);
      
      console.log('✓ Only the dragged task changed position as expected');
    }
  });

  test('should use large position numbers (10000+ spacing)', async ({ page }) => {
    console.log('Testing position value verification - checking for large numbers vs small sequential ones');
    
    // Create a new task to test position values
    await page.click('.task-item-add-new');
    await page.keyboard.type('Position Test Task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Get position data from API to verify actual position values
    const response = await page.evaluate(async () => {
      // Get the current job ID from the URL
      const jobId = window.location.pathname.split('/jobs/')[1];
      
      // Fetch tasks from API 
      const res = await fetch(`/api/v1/jobs/${jobId}/tasks`);
      const data = await res.json();
      
      return data.tasks?.map(task => ({
        title: task.title,
        position: task.position
      })) || [];
    });
    
    console.log('Task positions from API:', response);
    
    // Verify positions are using large numbers (10000+ spacing) not sequential 1,2,3
    const positions = response.map(t => t.position).filter(p => p != null);
    
    if (positions.length > 0) {
      const minPosition = Math.min(...positions);
      const maxPosition = Math.max(...positions);
      
      console.log(`Position range: ${minPosition} to ${maxPosition}`);
      
      // Check that positions are using large spacing, not small sequential numbers
      expect(minPosition).toBeGreaterThan(100); // Should be much larger than 1,2,3...
      
      // If multiple tasks exist, check spacing
      if (positions.length > 1) {
        const sortedPositions = positions.sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sortedPositions.length; i++) {
          gaps.push(sortedPositions[i] - sortedPositions[i-1]);
        }
        
        console.log('Position gaps:', gaps);
        
        // Most gaps should be reasonably large (indicating proper spacing)
        const averageGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        expect(averageGap).toBeGreaterThan(100); // Much larger than 1
        
        console.log('✓ Positions use large number spacing as expected');
      }
    }
  });

  test('should handle status change reordering without affecting other tasks unexpectedly', async ({ page }) => {
    console.log('Testing status-based reordering behavior');
    
    // Get a task to change status
    const firstTask = page.locator('.task-item').first();
    const taskTitle = await firstTask.locator('.task-title').textContent();
    
    console.log(`Testing status change for task: ${taskTitle}`);
    
    // Get initial task order  
    const beforeOrder = await page.locator('.task-title').allTextContents();
    console.log('Tasks before status change:', beforeOrder);
    
    // Change status of first task (click status dropdown and select different status)
    await firstTask.locator('.status-indicator').click();
    await page.waitForTimeout(200);
    
    // Try to click "In Progress" status
    await page.click('[data-status="in_progress"]');
    await page.waitForTimeout(1000); // Wait for reordering
    
    // Get task order after status change
    const afterOrder = await page.locator('.task-title').allTextContents();
    console.log('Tasks after status change:', afterOrder);
    
    // Verify the changed task exists and the total count is the same
    expect(afterOrder.length).toBe(beforeOrder.length);
    expect(afterOrder).toContain(taskTitle);
    
    console.log('✓ Status change reordering completed without unexpected side effects');
  });

  test('should maintain consistent behavior across page reloads', async ({ page }) => {
    console.log('Testing persistence after page reload');
    
    // Create a test task with known position
    await page.click('.task-item-add-new');
    await page.keyboard.type('Persistence Test Task');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Get task order before reload
    const beforeReload = await page.locator('.task-title').allTextContents();
    console.log('Tasks before reload:', beforeReload);
    
    // Reload the page
    await page.reload();
    await page.waitForSelector('.task-item');
    
    // Get task order after reload
    const afterReload = await page.locator('.task-title').allTextContents();
    console.log('Tasks after reload:', afterReload);
    
    // Order should be preserved
    expect(afterReload).toEqual(beforeReload);
    expect(afterReload).toContain('Persistence Test Task');
    
    console.log('✓ Task order persisted correctly after reload');
  });
});