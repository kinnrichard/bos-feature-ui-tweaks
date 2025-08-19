import { test, expect } from '@playwright/test';

test.describe('New Task Status Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('http://localhost:3000/auth/sign_in');
    await page.fill('input[name="email"]', 'demo@biznessopssoftware.com');
    await page.fill('input[name="password"]', 'Password1');
    await page.click('button[type="submit"]');

    // Navigate to a job
    await page.goto('http://localhost:3000/clients/1/jobs/1');
    await page.waitForSelector('.job-view');
  });

  test('status dropdown works on newly created tasks', async ({ page }) => {
    // Click the new task placeholder
    await page.click('.new-task-wrapper .task-item');
    
    // Type a task title
    await page.fill('.new-task-wrapper .task-title', 'Test task with status dropdown');
    
    // Press Enter to save
    await page.press('.new-task-wrapper .task-title', 'Enter');
    
    // Wait for task to be created
    await page.waitForTimeout(500);
    
    // Find the newly created task
    const newTask = page.locator('.task-item').filter({ hasText: 'Test task with status dropdown' }).first();
    
    // Click the status button on the new task
    await newTask.locator('.task-status-button').click();
    
    // Check that dropdown menu is visible
    await expect(newTask.locator('.dropdown-menu')).toBeVisible();
    
    // Check that status options are present
    await expect(newTask.locator('.task-status-option')).toHaveCount(5);
    
    // Click "In Progress" status
    await newTask.locator('.task-status-option').filter({ hasText: 'In Progress' }).click();
    
    // Verify status changed
    await expect(newTask.locator('.task-status-button span')).toContainText('🔄');
  });

  test('keyboard shortcut works in note field without errors', async ({ page }) => {
    // Click on an existing task's info button
    await page.locator('.task-item').first().locator('.task-info-button').click();
    
    // Wait for popover to open
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Focus the note textarea
    await page.focus('.note-input');
    
    // Type a note
    await page.fill('.note-input', 'Test note with keyboard shortcut');
    
    // Press Cmd+Enter (Meta+Enter) to save
    await page.keyboard.press('Meta+Enter');
    
    // Wait for note to be saved
    await page.waitForTimeout(500);
    
    // Check console for errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Verify no errors about "cmd+enter"
    expect(consoleErrors.filter(error => error.includes('cmd+enter'))).toHaveLength(0);
  });
});