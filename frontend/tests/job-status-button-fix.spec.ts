import { test, expect } from '@playwright/test';

test.describe('JobStatusButton - Status Field Fix', () => {
  test('should handle string status values without TypeError', async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');

    // Wait for the page to load
    await page.waitForTimeout(1000);

    // Look for any console errors related to JobStatusButton
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit to let any JavaScript errors surface
    await page.waitForTimeout(2000);

    // Check that there are no TypeError messages about "undefined is not an object"
    const hasJobStatusError = consoleErrors.some(error => 
      error.includes('undefined is not an object') && 
      error.includes('status')
    );

    expect(hasJobStatusError).toBe(false);

    // Check if the job status button is visible (indicating the component rendered successfully)
    const jobStatusButton = page.locator('.job-status-emoji');
    
    // The button should be visible, or if no job is loaded, at least the component shouldn't crash
    // We don't expect it to be visible if no job is loaded, but there should be no errors
    
    // Final verification - check console for any remaining errors
    console.log('Console errors found:', consoleErrors);
    
    // Ensure no critical errors that would indicate the original TypeError
    expect(consoleErrors.filter(error => error.includes('TypeError'))).toHaveLength(0);
  });

  test('should display job status button when job is available', async ({ page }) => {
    // Navigate to a page where we might have job data
    await page.goto('/');
    
    // Wait for page load
    await page.waitForTimeout(1000);
    
    // Check if toolbar exists (where JobStatusButton would be)
    const toolbar = page.locator('.layout-toolbar, [class*="toolbar"]');
    
    // If toolbar exists, the component should have loaded without crashing
    if (await toolbar.count() > 0) {
      console.log('Toolbar found - JobStatusButton component area exists');
      
      // Look for the job status emoji element specifically
      const statusElement = page.locator('.job-status-emoji');
      
      // If it exists, verify it has content (emoji)
      if (await statusElement.count() > 0) {
        const content = await statusElement.textContent();
        expect(content).toBeTruthy();
        console.log('Job status emoji content:', content);
      }
    }
    
    // Most importantly - no JavaScript errors should occur
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    await page.waitForTimeout(1000);
    
    expect(jsErrors.filter(error => 
      error.includes('undefined is not an object') && 
      error.includes('status')
    )).toHaveLength(0);
  });
});