import { test, expect } from '@playwright/test';

test('quick keyboard navigation test', async ({ page }) => {
  // Go to test page
  await page.goto('/test-popover');
  
  // Click button to open popover
  await page.click('.test-button');
  await page.waitForSelector('.popover-menu');
  
  // Check initial state
  console.log('Initial state - checking for focused elements...');
  let focusedCount = await page.locator('.popover-menu-option.focused').count();
  console.log('Initial focused elements:', focusedCount);
  
  // Press arrow down
  console.log('Pressing ArrowDown...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  
  // Check for focused element
  focusedCount = await page.locator('.popover-menu-option.focused').count();
  console.log('After ArrowDown - focused elements:', focusedCount);
  
  if (focusedCount > 0) {
    const focusedText = await page.locator('.popover-menu-option.focused').first().textContent();
    console.log('Focused option:', focusedText);
  }
  
  // Press arrow down again
  console.log('Pressing ArrowDown again...');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  
  focusedCount = await page.locator('.popover-menu-option.focused').count();
  console.log('After second ArrowDown - focused elements:', focusedCount);
  
  // Try to select with Space
  console.log('Pressing Space to select...');
  await page.keyboard.press(' ');
  await page.waitForTimeout(100);
  
  // Check if popover closed
  const popoverVisible = await page.locator('.popover-menu').isVisible().catch(() => false);
  console.log('Popover still visible:', popoverVisible);
});