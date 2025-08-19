import { test, expect } from '@playwright/test';

test.describe('Zero E2E Tests', () => {
  test('Zero client initializes and connects successfully', async ({ page }) => {
    // Navigate to our test page
    await page.goto('/zero-test');
    
    // Wait for the page to load and tests to run
    await page.waitForSelector('h1:has-text("Zero E2E Test Results")');
    
    // Wait a bit for tests to complete
    await page.waitForTimeout(3000);
    
    // Check initialization test result
    const initializationStatus = await page.locator('div:has-text("Client Initialization") + div').textContent();
    expect(initializationStatus).toContain('success');
    
    // Check schema loading test result
    const schemaStatus = await page.locator('div:has-text("Schema Loading") + div').textContent();
    expect(schemaStatus).toContain('success');
    
    // Check query construction test result
    const queryStatus = await page.locator('div:has-text("Query Construction") + div').textContent();
    expect(queryStatus).toContain('success');
    
    // Check relationships test result
    const relationshipsStatus = await page.locator('div:has-text("Relationships") + div').textContent();
    expect(relationshipsStatus).toContain('success');
    
    // Verify some expected log messages appear
    await expect(page.locator('text=Zero client initialized successfully')).toBeVisible();
    await expect(page.locator('text=Schema loaded successfully')).toBeVisible();
    
    console.log('✅ All Zero E2E tests passed!');
  });
  
  test('Zero schema has expected tables', async ({ page }) => {
    await page.goto('/zero-test');
    
    // Wait for tests to complete
    await page.waitForTimeout(3000);
    
    // Check that logs show expected tables
    const logsSection = page.locator('div:has-text("Test Logs")');
    
    // Verify key tables are present
    await expect(logsSection).toContainText('clients');
    await expect(logsSection).toContainText('jobs'); 
    await expect(logsSection).toContainText('tasks');
    await expect(logsSection).toContainText('users');
    
    console.log('✅ Schema contains expected tables');
  });
});