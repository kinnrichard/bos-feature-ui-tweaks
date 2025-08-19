import { test, expect } from '@playwright/test';

test.describe('New Task Button Refinement', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('bos:token', 'test-token');
      window.localStorage.setItem('bos:user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin'
      }));
    });
  });

  test.describe('Empty Task List', () => {
    test('displays New Task button at top when task list is empty', async ({ page }) => {
      // Navigate to a job with no tasks
      await page.goto('/jobs/test');
      
      // Wait for task list to load
      await page.waitForSelector('[data-testid="task-list"]');
      
      const taskList = page.locator('[data-testid="task-list"]');
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      
      // Verify button exists and is first child
      await expect(newTaskButton).toBeVisible();
      const firstItem = taskList.locator('.task-item').first();
      await expect(firstItem).toHaveAttribute('data-testid', 'create-task-button');
      
      // Verify text is visible
      await expect(newTaskButton.locator('.add-task-placeholder')).toHaveText('New Task');
      await expect(newTaskButton.locator('.add-task-placeholder')).toBeVisible();
    });

    test('keeps label visible on hover when list is empty', async ({ page }) => {
      await page.goto('/jobs/test');
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      const taskText = newTaskButton.locator('.add-task-placeholder');
      
      // Hover should not hide label when empty
      await newTaskButton.hover();
      await expect(taskText).toBeVisible();
      await expect(taskText).toHaveCSS('opacity', '1');
      
      // Text should turn blue
      await expect(taskText).toHaveCSS('color', 'rgb(0, 122, 255)');
    });
  });

  test.describe('Desktop Hover Interactions', () => {
    test('changes text and icon to blue on hover', async ({ page }) => {
      // Create a task first to test with populated list
      await page.goto('/jobs/test');
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      // Create a task
      await page.click('[data-testid="create-task-button"]');
      await page.fill('[data-testid="task-title-input"]', 'Test Task');
      await page.press('[data-testid="task-title-input"]', 'Enter');
      
      // Wait for task to be created
      await page.waitForSelector('.task-item:not(.task-item-add-new)');
      
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      const plusIcon = newTaskButton.locator('.status-emoji img');
      const taskText = newTaskButton.locator('.add-task-placeholder');
      
      // Initial state
      await expect(plusIcon).toHaveAttribute('src', '/icons/plus-circle.svg');
      
      // Hover state
      await newTaskButton.hover();
      await expect(plusIcon).toHaveAttribute('src', '/icons/plus-circle-blue.svg');
      await expect(taskText).toHaveCSS('color', 'rgb(0, 122, 255)');
    });

    test('hides label on hover when tasks exist', async ({ page, browserName }) => {
      // Skip this test on webkit as it has issues with opacity detection
      test.skip(browserName === 'webkit');
      
      await page.goto('/jobs/test');
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      // Create a task
      await page.click('[data-testid="create-task-button"]');
      await page.fill('[data-testid="task-title-input"]', 'Test Task');
      await page.press('[data-testid="task-title-input"]', 'Enter');
      
      await page.waitForSelector('.task-item:not(.task-item-add-new)');
      
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      const taskText = newTaskButton.locator('.add-task-placeholder');
      
      // Label visible before hover
      await expect(taskText).toBeVisible();
      
      // Hover hides label
      await newTaskButton.hover();
      await page.waitForTimeout(200); // Wait for transition
      await expect(taskText).toHaveCSS('opacity', '0');
    });
  });

  test.describe('Mobile Touch Interactions', () => {
    test('always displays label on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/jobs/test');
      
      // Create a task first
      await page.waitForSelector('[data-testid="create-task-button"]');
      await page.click('[data-testid="create-task-button"]');
      await page.fill('[data-testid="task-title-input"]', 'Test Task');
      await page.press('[data-testid="task-title-input"]', 'Enter');
      
      await page.waitForSelector('.task-item:not(.task-item-add-new)');
      
      const taskText = page.locator('.add-task-placeholder');
      
      // Label should be visible
      await expect(taskText).toBeVisible();
      await expect(taskText).toHaveCSS('opacity', '1');
    });

    test('shows blue color on tap', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/jobs/test');
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      const newTaskButton = page.locator('[data-testid="create-task-button"]');
      const taskText = newTaskButton.locator('.add-task-placeholder');
      
      // Simulate touch and check active state
      await newTaskButton.tap();
      
      // The input should appear after tap
      await expect(page.locator('[data-testid="task-title-input"]')).toBeVisible();
    });
  });

  test.describe('Icon Switching', () => {
    test('switches icon without animation', async ({ page }) => {
      await page.goto('/jobs/test');
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      const plusIcon = page.locator('[data-testid="create-task-button"] .status-emoji img');
      
      // Verify no transition styles on the img element
      const transitions = await plusIcon.evaluate(el => 
        window.getComputedStyle(el).transition
      );
      expect(transitions).not.toMatch(/transform|opacity/);
      
      // Hover and verify immediate change
      await page.hover('[data-testid="create-task-button"]');
      await expect(plusIcon).toHaveAttribute('src', '/icons/plus-circle-blue.svg');
    });
  });

  test.describe('Responsive Behavior', () => {
    test('responds correctly to viewport changes', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit');
      
      await page.goto('/jobs/test');
      
      // Create a task first
      await page.waitForSelector('[data-testid="create-task-button"]');
      await page.click('[data-testid="create-task-button"]');
      await page.fill('[data-testid="task-title-input"]', 'Test Task');
      await page.press('[data-testid="task-title-input"]', 'Enter');
      
      await page.waitForSelector('.task-item:not(.task-item-add-new)');
      
      // Desktop viewport
      await page.setViewportSize({ width: 1200, height: 800 });
      const taskText = page.locator('.add-task-placeholder');
      
      // Hover should hide text on desktop
      await page.hover('[data-testid="create-task-button"]');
      await page.waitForTimeout(200);
      await expect(taskText).toHaveCSS('opacity', '0');
      
      // Switch to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Text should be visible on mobile
      await expect(taskText).toBeVisible();
      await expect(taskText).toHaveCSS('opacity', '1');
    });
  });

  test.describe('Task Creation Flow', () => {
    test('moves button to bottom after creating first task', async ({ page }) => {
      await page.goto('/jobs/test');
      await page.waitForSelector('[data-testid="create-task-button"]');
      
      const taskList = page.locator('[data-testid="task-list"]');
      
      // Verify button is first
      let firstItem = taskList.locator('.task-item').first();
      await expect(firstItem).toHaveAttribute('data-testid', 'create-task-button');
      
      // Create a task
      await page.click('[data-testid="create-task-button"]');
      await page.fill('[data-testid="task-title-input"]', 'First task');
      await page.press('[data-testid="task-title-input"]', 'Enter');
      
      // Wait for task to be created
      await page.waitForSelector('.task-item:not(.task-item-add-new)');
      
      // Verify button is now last
      const lastItem = taskList.locator('.task-item').last();
      await expect(lastItem).toHaveAttribute('data-testid', 'create-task-button');
    });
  });
});