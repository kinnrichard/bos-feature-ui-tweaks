const { test, expect } = require('@playwright/test');

test.describe('Task Creation Bug Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'admin@admin.com');
    await page.fill('input[name="password"]', 'P@ssw0rd1!');
    await page.click('button[type="submit"]');
    
    // Navigate to a job
    await page.goto('http://localhost:3000/clients');
    await page.click('text=Test Client', { timeout: 10000 });
    await page.click('text=Test Job', { timeout: 10000 });
  });

  test('should prevent duplicate task creation', async ({ page }) => {
    // Click on NEW TASK placeholder
    await page.click('.new-task-placeholder');
    
    // Type task title
    await page.keyboard.type('Test Task');
    
    // Trigger blur multiple times rapidly (simulating duplicate saves)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Wait for task creation
    await page.waitForTimeout(1000);
    
    // Count tasks with the same title
    const taskCount = await page.locator('.task-title:has-text("Test Task")').count();
    
    // Should only have one task, not duplicates
    expect(taskCount).toBe(1);
  });

  test('should be able to click and select newly created tasks', async ({ page }) => {
    // Click on NEW TASK placeholder
    await page.click('.new-task-placeholder');
    
    // Type task title and save
    await page.keyboard.type('Clickable Task');
    await page.keyboard.press('Enter');
    
    // Wait for task to be created
    await page.waitForSelector('.task-item:has-text("Clickable Task")');
    
    // Try to click on the newly created task
    const newTask = page.locator('.task-item:has-text("Clickable Task")');
    await newTask.click();
    
    // Check if task is selected (should have data-selected="true")
    const isSelected = await newTask.getAttribute('data-selected');
    expect(isSelected).toBe('true');
    
    // Also check if it has the selected class
    const hasSelectedClass = await newTask.evaluate(el => el.classList.contains('selected'));
    expect(hasSelectedClass).toBe(true);
  });

  test('should handle Enter key without creating duplicates', async ({ page }) => {
    // Click on NEW TASK placeholder
    await page.click('.new-task-placeholder');
    
    // Type task title
    await page.keyboard.type('Enter Key Task');
    
    // Press Enter multiple times rapidly
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    
    // Wait for task creation
    await page.waitForTimeout(1000);
    
    // Count tasks with the same title
    const taskCount = await page.locator('.task-title:has-text("Enter Key Task")').count();
    
    // Should only have one task
    expect(taskCount).toBe(1);
  });

  test('should properly initialize dropdown for new tasks', async ({ page }) => {
    // Click on NEW TASK placeholder
    await page.click('.new-task-placeholder');
    
    // Type task title and save
    await page.keyboard.type('Dropdown Test Task');
    await page.keyboard.press('Enter');
    
    // Wait for task to be created
    await page.waitForSelector('.task-item:has-text("Dropdown Test Task")');
    
    // Click on the status dropdown button
    const statusButton = page.locator('.task-item:has-text("Dropdown Test Task") .task-status-button');
    await statusButton.click();
    
    // Check if dropdown menu appears
    const dropdownMenu = page.locator('.task-item:has-text("Dropdown Test Task") .dropdown-menu');
    await expect(dropdownMenu).toBeVisible();
    
    // Click on a status option
    await page.click('.task-status-option:has-text("In Progress")');
    
    // Verify status changed
    const statusEmoji = await statusButton.locator('span').textContent();
    expect(statusEmoji).toBe('🔄'); // In Progress emoji
  });

  test('should make task title editable for new tasks', async ({ page }) => {
    // Click on NEW TASK placeholder
    await page.click('.new-task-placeholder');
    
    // Type task title and save
    await page.keyboard.type('Editable Task');
    await page.keyboard.press('Enter');
    
    // Wait for task to be created
    await page.waitForSelector('.task-item:has-text("Editable Task")');
    
    // Click on the task title to edit
    const taskTitle = page.locator('.task-item:has-text("Editable Task") .task-title');
    await taskTitle.click();
    
    // Clear and type new title
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Edited Task Title');
    await page.keyboard.press('Enter');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Verify title changed
    await expect(taskTitle).toHaveText('Edited Task Title');
  });
});