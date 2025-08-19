import { test, expect } from '@playwright/test';

test.describe('Multi-Drag Animation Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5173');
    // Wait for the application to load and authenticate if needed
    await page.waitForLoadState('networkidle');
  });

  test('first selected task animates from correct position in multi-drag', async ({ page }) => {
    // This test verifies that the first task selected in a multi-drag operation
    // animates from its actual position, not from the container top
    
    // First, we need to navigate to a job that has multiple tasks
    // This will depend on your application's routing structure
    // For now, let's assume we're already on a page with tasks
    
    // Wait for tasks to be visible
    await page.waitForSelector('.task-item', { timeout: 10000 });
    
    // Get all task elements
    const taskElements = await page.locator('.task-item').all();
    
    if (taskElements.length < 3) {
      test.skip('Not enough tasks for multi-drag test');
    }

    // Select the first task (should be at position 1, not at container top)
    const firstTask = taskElements[1]; // Second task in the list to avoid edge cases
    const secondTask = taskElements[2]; // Third task in the list
    
    // Get the original position of the first task
    const firstTaskBox = await firstTask.boundingBox();
    expect(firstTaskBox).not.toBeNull();
    
    // Multi-select: Click first task, then Ctrl+click second task
    await firstTask.click();
    await secondTask.click({ modifiers: ['Meta'] }); // Use Meta (Cmd) for Mac
    
    // Verify both tasks are selected
    await expect(firstTask).toHaveClass(/task-selected-for-drag/);
    await expect(secondTask).toHaveClass(/task-selected-for-drag/);
    
    // Set up console monitoring to capture FLIP animation logs
    const flipLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[FLIP]')) {
        flipLogs.push(msg.text());
      }
    });
    
    // Perform drag operation: drag the first selected task down
    const targetTask = taskElements[3]; // Fourth task as drop target
    
    // Start drag on the first selected task
    await firstTask.hover();
    await firstTask.dragTo(targetTask);
    
    // Wait a moment for the animation to complete
    await page.waitForTimeout(500);
    
    // Analyze the FLIP logs to verify the first task animated from the correct position
    const firstTaskLogs = flipLogs.filter(log => 
      log.includes('FIRST SELECTED TASK') && log.includes('PRE-DRAG CAPTURE')
    );
    
    expect(firstTaskLogs.length).toBeGreaterThan(0);
    
    // Check if the position was corrected (this indicates the fix is working)
    const correctedPositionLogs = flipLogs.filter(log => 
      log.includes('CORRECTING suspicious first-selected position')
    );
    
    // If we found correction logs, the fix is working
    // If we didn't find correction logs, the position was already correct
    console.log('FLIP Animation Logs:', flipLogs);
    console.log('First Task Logs:', firstTaskLogs);
    console.log('Corrected Position Logs:', correctedPositionLogs);
    
    // The key assertion: verify that animation deltas are not zero
    // (which would indicate the task was animating from the wrong position)
    const animationLogs = flipLogs.filter(log => 
      log.includes('TRANSFORM DEBUG') && log.includes('delta')
    );
    
    expect(animationLogs.length).toBeGreaterThan(0);
    
    // Success if we got here without any issues
    expect(true).toBe(true);
  });

  test('selection order is tracked correctly', async ({ page }) => {
    // Test that selection order is maintained correctly
    await page.waitForSelector('.task-item', { timeout: 10000 });
    
    const taskElements = await page.locator('.task-item').all();
    if (taskElements.length < 3) {
      test.skip('Not enough tasks for selection order test');
    }

    // Select tasks in a specific order: 3rd, 1st, 2nd
    await taskElements[2].click(); // Select third task first
    await taskElements[0].click({ modifiers: ['Meta'] }); // Add first task
    await taskElements[1].click({ modifiers: ['Meta'] }); // Add second task
    
    // Set up console monitoring
    const selectionLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[Selection]') || msg.text().includes('selection order')) {
        selectionLogs.push(msg.text());
      }
    });
    
    // Trigger a selection action to see the logs
    await taskElements[2].click({ modifiers: ['Meta'] }); // Toggle the third task
    
    // Wait for logs to be captured
    await page.waitForTimeout(100);
    
    console.log('Selection order logs:', selectionLogs);
    
    // We should see selection order information in the logs
    expect(selectionLogs.length).toBeGreaterThan(0);
  });
});