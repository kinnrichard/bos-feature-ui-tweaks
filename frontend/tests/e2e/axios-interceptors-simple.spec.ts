import { test, expect } from '@playwright/test';

test.describe('Axios Interceptors - Simplified Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page after authentication
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle 401 errors by refreshing token', async ({ page }) => {
    // Arrange
    let tokenRefreshCalled = false;
    let apiCallCount = 0;

    // Mock token refresh endpoint
    await page.route('**/api/v1/zero_tokens', async route => {
      tokenRefreshCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          token: 'new-token-123',
          expires_at: new Date(Date.now() + 3600000).toISOString()
        })
      });
    });

    // Mock any API endpoint to return 401 first, then success
    await page.route('**/api/v1/**', async route => {
      if (route.request().url().includes('zero_tokens')) {
        return; // Let the zero_tokens route handle this
      }
      
      apiCallCount++;
      
      if (apiCallCount === 1) {
        // First call returns 401
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      } else {
        // Subsequent calls succeed
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    // Act - Trigger any API call by interacting with the page
    // Click on a job card to trigger API calls
    const jobCard = page.locator('.job-card').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Wait for the page to handle the request
    await page.waitForTimeout(2000);

    // Assert
    expect(tokenRefreshCalled).toBe(true);
    expect(apiCallCount).toBeGreaterThanOrEqual(2); // At least one 401 and one retry
  });

  test('should show toast notification on rate limiting', async ({ page }) => {
    // Mock API to return 429 rate limit error
    await page.route('**/api/v1/**', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'retry-after': '5' },
        body: JSON.stringify({ 
          error: 'Rate limit exceeded',
          retry_after: 5
        })
      });
    });

    // Act - Click on a job to trigger API call
    const jobCard = page.locator('.job-card').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Assert - Check for toast notification
    const toast = page.locator('.toast-notification, [role="alert"]').filter({ hasText: /rate limit|too many requests|please wait/i });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('should retry on 500 errors', async ({ page }) => {
    let apiCallCount = 0;

    // Mock API to fail twice then succeed
    await page.route('**/api/v1/**', async route => {
      apiCallCount++;
      
      if (apiCallCount <= 2) {
        // First two calls return 500
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      } else {
        // Third call succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    // Act - Click on a job to trigger API call
    const jobCard = page.locator('.job-card').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Wait for retries to complete
    await page.waitForTimeout(3000);

    // Assert
    expect(apiCallCount).toBeGreaterThanOrEqual(3); // Initial + 2 retries
  });

  test('should handle CSRF token errors', async ({ page }) => {
    let csrfRefreshCalled = false;
    let apiCallCount = 0;

    // Mock CSRF token refresh
    await page.route('**/api/auth/csrf-token', async route => {
      csrfRefreshCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrf_token: 'new-csrf-token' })
      });
    });

    // Mock API to return CSRF error first, then success
    await page.route('**/api/v1/**', async route => {
      if (route.request().url().includes('csrf-token')) {
        return; // Let the csrf-token route handle this
      }
      
      apiCallCount++;
      
      if (apiCallCount === 1) {
        // First call returns CSRF error
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'CSRF token validation failed',
            code: 'INVALID_CSRF_TOKEN'
          })
        });
      } else {
        // Second call succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });

    // Act - Click on a job to trigger API call
    const jobCard = page.locator('.job-card').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Wait for the page to handle the request
    await page.waitForTimeout(2000);

    // Assert
    expect(csrfRefreshCalled).toBe(true);
    expect(apiCallCount).toBeGreaterThanOrEqual(2);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock API to abort (simulate network error)
    await page.route('**/api/v1/**', async route => {
      await route.abort('failed');
    });

    // Act - Click on a job to trigger API call
    const jobCard = page.locator('.job-card').first();
    await expect(jobCard).toBeVisible({ timeout: 10000 });
    await jobCard.click();

    // Assert - Check for error handling (no crash, error message shown)
    const errorIndicator = page.locator('.error-message, [role="alert"], .toast-notification').filter({ hasText: /error|failed|network|connection/i });
    await expect(errorIndicator).toBeVisible({ timeout: 5000 });
  });
});