import { test, expect } from '@playwright/test';

test.describe('New Task Text Glitch Fix', () => {
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

  test('should clear input immediately without text ghosting', async ({ page }) => {
    await page.goto('/jobs/test');
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="task-list"]');
    
    // Click New Task button
    const newTaskButton = page.locator('[data-testid="create-task-button"]');
    await newTaskButton.click();
    
    // Type task text
    const input = page.locator('[data-testid="task-title-input"]');
    await expect(input).toBeVisible();
    await input.fill('Test task that should not ghost');
    
    // Press Enter and immediately check if input is cleared
    await Promise.all([
      input.press('Enter'),
      // The input should be hidden immediately after Enter
      expect(input).toBeHidden({ timeout: 100 })
    ]);
    
    // Verify task was created
    await expect(page.locator('.task-title').filter({ hasText: 'Test task that should not ghost' })).toBeVisible();
    
    // Verify New Task row shows default text with no ghosting
    const newTaskText = page.locator('[data-testid="create-task-button"] .add-task-placeholder');
    await expect(newTaskText).toHaveText('New Task');
  });

  test('should handle rapid task creation without glitches', async ({ page }) => {
    await page.goto('/jobs/test');
    await page.waitForSelector('[data-testid="task-list"]');
    
    // Create multiple tasks rapidly
    for (let i = 1; i <= 3; i++) {
      await page.locator('[data-testid="create-task-button"]').click();
      
      const input = page.locator('[data-testid="task-title-input"]');
      await input.fill(`Rapid task ${i}`);
      
      // Press Enter and verify immediate clearing
      await Promise.all([
        input.press('Enter'),
        expect(input).toBeHidden({ timeout: 100 })
      ]);
      
      // Small delay to ensure task is created
      await page.waitForTimeout(100);
    }
    
    // Verify all tasks were created
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator('.task-title').filter({ hasText: `Rapid task ${i}` })).toBeVisible();
    }
  });
});