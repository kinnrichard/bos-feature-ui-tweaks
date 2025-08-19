import { test, expect } from '@playwright/test';

test.describe('Task List Animations', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'owner@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/jobs');
    
    // Navigate to a job with tasks
    await page.click('.job-item:first-child a');
    await page.waitForSelector('.task-list');
  });

  test('should animate task reordering via drag and drop', async ({ page }) => {
    // Ensure we have multiple tasks
    const taskCount = await page.locator('.task-item').count();
    if (taskCount < 2) {
      // Create some tasks
      await page.click('text=New Task');
      await page.fill('input[placeholder="Enter task title"]', 'Task 1');
      await page.keyboard.press('Enter');
      
      await page.click('text=New Task');
      await page.fill('input[placeholder="Enter task title"]', 'Task 2');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(500);
    }
    
    // Get initial positions
    const firstTask = page.locator('.task-item').first();
    const secondTask = page.locator('.task-item').nth(1);
    
    const firstTaskId = await firstTask.getAttribute('data-task-id');
    const secondTaskId = await secondTask.getAttribute('data-task-id');
    
    // Perform drag and drop
    await firstTask.dragTo(secondTask);
    
    // Wait for animation to complete
    await page.waitForTimeout(400);
    
    // Verify order has changed
    const newFirstTaskId = await page.locator('.task-item').first().getAttribute('data-task-id');
    const newSecondTaskId = await page.locator('.task-item').nth(1).getAttribute('data-task-id');
    
    expect(newFirstTaskId).toBe(secondTaskId);
    expect(newSecondTaskId).toBe(firstTaskId);
  });

  test('should not animate when prefers-reduced-motion is set', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Ensure we have tasks
    const taskCount = await page.locator('.task-item').count();
    if (taskCount < 2) {
      await page.click('text=New Task');
      await page.fill('input[placeholder="Enter task title"]', 'Task 1');
      await page.keyboard.press('Enter');
      
      await page.click('text=New Task');
      await page.fill('input[placeholder="Enter task title"]', 'Task 2');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(500);
    }
    
    // Check that tasks don't have transition styles
    const firstTask = page.locator('.task-item').first();
    const transition = await firstTask.evaluate(el => 
      window.getComputedStyle(el).transition
    );
    
    expect(transition).toBe('none 0s ease 0s');
  });

  test('should animate server-side updates', async ({ page, context }) => {
    // Open two pages to simulate real-time updates
    const page2 = await context.newPage();
    
    // Login on second page
    await page2.goto('/login');
    await page2.fill('input[type="email"]', 'owner@example.com');
    await page2.fill('input[type="password"]', 'password');
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/jobs');
    
    // Navigate to same job
    await page2.click('.job-item:first-child a');
    await page2.waitForSelector('.task-list');
    
    // Ensure we have tasks
    const taskCount = await page.locator('.task-item').count();
    if (taskCount < 2) {
      await page.click('text=New Task');
      await page.fill('input[placeholder="Enter task title"]', 'Task A');
      await page.keyboard.press('Enter');
      
      await page.click('text=New Task');
      await page.fill('input[placeholder="Enter task title"]', 'Task B');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(500);
    }
    
    // Get initial order on page1
    const initialFirstTaskId = await page.locator('.task-item').first().getAttribute('data-task-id');
    
    // Reorder on page2
    const firstTask = page2.locator('.task-item').first();
    const secondTask = page2.locator('.task-item').nth(1);
    await firstTask.dragTo(secondTask);
    
    // Wait for Zero.js sync and animation
    await page.waitForTimeout(600);
    
    // Verify order changed on page1 (with animation)
    const newFirstTaskId = await page.locator('.task-item').first().getAttribute('data-task-id');
    expect(newFirstTaskId).not.toBe(initialFirstTaskId);
    
    await page2.close();
  });
});