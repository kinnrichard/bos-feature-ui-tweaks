// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Task Info Popover', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'ux@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to job with tasks
    await page.goto('http://localhost:3000/clients/2/jobs/1');
    await page.waitForSelector('.task-item');
  });

  test('should show info button for each task', async ({ page }) => {
    const infoButtons = await page.locator('.task-info-button').count();
    expect(infoButtons).toBeGreaterThan(0);
  });

  test('should open popover when clicking info button', async ({ page }) => {
    // Click the first info button
    await page.click('.task-info-button');
    
    // Wait for popover to appear
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Check popover content
    await expect(page.locator('.task-info-popover h3')).toContainText('Task Info');
    await expect(page.locator('.task-info-popover')).toBeVisible();
  });

  test('should display task duration in popover', async ({ page }) => {
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Check duration section exists
    const durationSection = page.locator('.task-info-popover').locator('text=Duration').first();
    await expect(durationSection).toBeVisible();
    
    // Timer should not be shown inline in task list
    const inlineTimers = await page.locator('.task-item .task-timer').count();
    expect(inlineTimers).toBe(0);
  });

  test('should allow adding notes', async ({ page }) => {
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Fill note input
    const noteText = 'Test note from Playwright';
    await page.fill('.note-input', noteText);
    
    // Click add note button
    await page.click('.task-info-popover button.button--primary');
    
    // Wait for note to appear
    await page.waitForSelector('.note-item');
    
    // Check note content
    await expect(page.locator('.note-content')).toContainText(noteText);
  });

  test('should display status history', async ({ page }) => {
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Check status history section exists
    const statusSection = page.locator('.task-info-popover').locator('text=Status History').first();
    await expect(statusSection).toBeVisible();
    
    // Should show at least one status change or created status
    const statusItems = page.locator('.status-change-item');
    await expect(statusItems).toHaveCount(await statusItems.count());
  });

  test('should close popover when clicking outside', async ({ page }) => {
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Click outside the popover
    await page.click('.job-title');
    
    // Popover should be hidden
    await page.waitForSelector('.task-info-popover.hidden');
  });

  test('should close popover when clicking close button', async ({ page }) => {
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Click close button
    await page.click('.task-info-popover .close-button');
    
    // Popover should be hidden
    await page.waitForSelector('.task-info-popover.hidden');
  });

  test('should position popover correctly', async ({ page }) => {
    // Click info button
    const infoButton = page.locator('.task-info-button').first();
    const buttonBox = await infoButton.boundingBox();
    await infoButton.click();
    
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Get popover position
    const popover = page.locator('.task-info-popover');
    const popoverBox = await popover.boundingBox();
    
    // Popover should be positioned below the button
    expect(popoverBox.y).toBeGreaterThan(buttonBox.y + buttonBox.height);
  });

  test('should handle multiple notes', async ({ page }) => {
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    // Add first note
    await page.fill('.note-input', 'First note');
    await page.click('.task-info-popover button.button--primary');
    await page.waitForSelector('.note-item');
    
    // Add second note
    await page.fill('.note-input', 'Second note');
    await page.click('.task-info-popover button.button--primary');
    
    // Should have multiple notes
    const noteItems = page.locator('.note-item');
    await expect(noteItems).toHaveCount(await noteItems.count());
    
    // Most recent note should be first
    await expect(noteItems.first().locator('.note-content')).toContainText('Second note');
  });

  test('should preserve note indicator after closing popover', async ({ page }) => {
    // Open popover and add a note
    await page.click('.task-info-button');
    await page.waitForSelector('.task-info-popover:not(.hidden)');
    
    await page.fill('.note-input', 'Test note for indicator');
    await page.click('.task-info-popover button.button--primary');
    await page.waitForSelector('.note-item');
    
    // Close popover
    await page.click('.job-title');
    await page.waitForSelector('.task-info-popover.hidden');
    
    // Note indicator should be visible in task list
    const noteIndicator = page.locator('.task-item .note-indicator').first();
    await expect(noteIndicator).toBeVisible();
  });
});