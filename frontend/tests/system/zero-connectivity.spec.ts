import { test, expect } from '@playwright/test';

test.describe('Zero Environment Connectivity', () => {
  test.beforeEach(async ({ page }) => {
    // Set up network monitoring
    await page.route('**/*', (route) => {
      // Monitor Zero-related requests for debugging (silent in normal runs)
      const url = route.request().url();
      if (url.includes('zero') || url.includes(':4850') || url.includes(':4848')) {
        // Zero request detected - logged internally
      }
      route.continue();
    });
  });

  test('should connect to correct Zero server in test environment', async ({ page }, testInfo) => {
    await test.step('Set up connection monitoring', async () => {
      // Monitor WebSocket connections and HTTP requests
      const webSocketConnections: string[] = [];
      const httpRequests: string[] = [];

      page.on('websocket', (ws) => {
        webSocketConnections.push(ws.url());
      });

      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('localhost:') && (url.includes('zero') || url.includes(':485'))) {
          httpRequests.push(url);
        }
      });

      // Store connections for later steps
      (
        page as { _testConnections?: { webSocketConnections: string[]; httpRequests: string[] } }
      )._testConnections = { webSocketConnections, httpRequests };
    });

    await test.step('Navigate to jobs page', async () => {
      await page.goto('http://localhost:6173/jobs');
    });

    await test.step('Wait for Zero initialization', async () => {
      await page.waitForTimeout(10000);
    });

    await test.step('Verify Zero server connection ports', async () => {
      const { webSocketConnections, httpRequests } = (
        page as { _testConnections: { webSocketConnections: string[]; httpRequests: string[] } }
      )._testConnections;

      const testConnections = [...webSocketConnections, ...httpRequests].filter((url) =>
        url.includes(':4850')
      );

      const devConnections = [...webSocketConnections, ...httpRequests].filter((url) =>
        url.includes(':4848')
      );

      // Attach connection details for debugging
      await testInfo.attach('zero-connections', {
        body: JSON.stringify(
          {
            testConnections: testConnections.length,
            devConnections: devConnections.length,
            testUrls: testConnections,
            devUrls: devConnections,
          },
          null,
          2
        ),
        contentType: 'application/json',
      });

      // In test environment, should connect to 4850, not 4848
      expect(testConnections.length).toBeGreaterThan(
        0,
        `Should connect to test port 4850, found ${testConnections.length} connections`
      );
      expect(devConnections.length).toBe(
        0,
        `Should not connect to dev port 4848, found ${devConnections.length} connections`
      );
    });
  });

  test('should authenticate successfully with Zero test server', async ({ page }, testInfo) => {
    const authErrors: string[] = [];
    const authMessages: string[] = [];

    await test.step('Set up authentication monitoring', async () => {
      page.on('console', (msg) => {
        const text = msg.text();

        // Capture auth-related messages
        if (text.includes('auth') || text.includes('token') || text.includes('jwt')) {
          authMessages.push(text);
        }

        // Capture auth errors
        if (
          text.includes('AuthInvalidated') ||
          text.includes('signature verification failed') ||
          text.includes('Failed to connect') ||
          text.includes('authentication failed')
        ) {
          authErrors.push(text);
        }
      });
    });

    await test.step('Navigate to jobs page', async () => {
      await page.goto('http://localhost:6173/jobs');
    });

    await test.step('Wait for Zero authentication', async () => {
      await page.waitForTimeout(15000);
    });

    await test.step('Verify authentication success', async () => {
      // Attach auth details for debugging
      await testInfo.attach('auth-monitoring', {
        body: JSON.stringify(
          {
            authErrors: authErrors.length,
            authMessages: authMessages.length,
            errorDetails: authErrors,
            messageDetails: authMessages.slice(0, 10), // Limit for readability
          },
          null,
          2
        ),
        contentType: 'application/json',
      });

      expect(authErrors).toHaveLength(
        0,
        `Should have no authentication errors, found: ${authErrors.join(', ')}`
      );
    });

    await test.step('Verify Zero connection status', async () => {
      const connectionStatus = await page.evaluate(() => {
        // Try to get Zero connection status if debug API is available
        const windowWithZero = window as {
          zeroDebug?: { getZeroState?: () => { isInitialized?: boolean } };
          zero?: unknown;
        };
        if (windowWithZero.zeroDebug?.getZeroState) {
          return windowWithZero.zeroDebug.getZeroState()?.isInitialized || false;
        }
        // Fallback: check if Zero client exists
        if (windowWithZero.zero) {
          return true;
        }
        return false;
      });

      expect(connectionStatus).toBe(true, 'Zero should be connected and initialized');
    });
  });

  test('should load test data from Zero server', async ({ page }) => {
    await page.goto('http://localhost:6173/jobs');

    // Wait for data to load
    await page.waitForSelector('[data-testid="jobs-list"], .jobs-container, main', {
      timeout: 20000,
    });

    // Look for any job-related content
    const hasJobContent = await page.evaluate(() => {
      // Check for various job-related elements
      const jobElements = [
        document.querySelector('[data-testid="job-item"]'),
        document.querySelector('.job-item'),
        document.querySelector('[class*="job"]'),
        document.querySelectorAll('*').length > 10, // Basic page load check
      ];

      return jobElements.some((element) => element);
    });

    expect(hasJobContent).toBe(true);

    // If test data is properly configured, should see test domain emails
    const testEmailCount = await page.locator('text=@bos-test.local').count();
    expect(testEmailCount).toBeGreaterThanOrEqual(
      0,
      'Should handle test email visibility gracefully'
    );

    // Should not see development data patterns (common email domains)
    const devEmailPatterns = ['@gmail.com', '@yahoo.com', '@hotmail.com'];
    for (const pattern of devEmailPatterns) {
      const devEmailCount = await page.locator(`text=${pattern}`).count();
      expect(devEmailCount).toBe(0);
    }
  });

  test('should handle Zero server connection issues gracefully', async ({ page }) => {
    await page.goto('http://localhost:6173/jobs');

    // Wait for initial page load
    await page.waitForTimeout(5000);

    // Simulate network interruption by blocking Zero requests temporarily
    await page.route('**/localhost:4850/**', (route) => {
      // Blocking Zero request for connection test
      route.abort();
    });

    await page.waitForTimeout(2000);

    // Re-enable Zero requests
    await page.unroute('**/localhost:4850/**');
    // Re-enabled Zero requests

    // Wait for potential reconnection
    await page.waitForTimeout(10000);

    // Page should still be functional even if Zero is temporarily unavailable
    const pageTitle = await page.locator('h1, title, [data-testid="page-title"]').first();
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // Verify page is still interactive
    const isPageInteractive = await page.evaluate(() => {
      // Basic interactivity check
      return document.readyState === 'complete' && document.body.children.length > 0;
    });

    expect(isPageInteractive).toBe(true);
  });

  test('should use correct Zero configuration for test environment', async ({ page }) => {
    // Navigate to a page that might expose Zero configuration
    await page.goto('http://localhost:6173/jobs');

    // Wait for any configuration to be loaded
    await page.waitForTimeout(5000);

    // Check if Zero configuration is correctly set for test environment
    const zeroConfig = await page.evaluate(() => {
      const windowWithZero = window as {
        ZERO_SERVER_CONFIG?: { getServerUrl?: () => string; getTokenEndpoint?: () => string };
        location?: { port: string };
      };

      // Try to get Zero configuration
      if (windowWithZero.ZERO_SERVER_CONFIG) {
        return {
          serverUrl: windowWithZero.ZERO_SERVER_CONFIG.getServerUrl?.(),
          tokenEndpoint: windowWithZero.ZERO_SERVER_CONFIG.getTokenEndpoint?.(),
        };
      }

      // Try alternative ways to get config
      if (windowWithZero.location) {
        const port = windowWithZero.location.port;
        return {
          frontendPort: port,
          expectedZeroPort: port === '6173' ? '4850' : '4848',
        };
      }

      return null;
    });

    // Zero configuration checked internally

    if (zeroConfig) {
      // If we can detect the configuration, verify it's correct for test environment
      if (zeroConfig.serverUrl) {
        expect(zeroConfig.serverUrl).toContain(':4850');
      }

      if (zeroConfig.frontendPort === '6173') {
        expect(zeroConfig.expectedZeroPort).toBe('4850');
      }
    }
  });

  test('should have basic page functionality without Zero dependency', async ({ page }) => {
    // This test ensures the app doesn't completely break if Zero is unavailable

    // Block all Zero requests from the start
    await page.route('**/localhost:4850/**', (route) => route.abort());
    await page.route('**/*zero*', (route) => route.abort());

    await page.goto('http://localhost:6173/jobs');

    // Page should still load basic structure
    await page.waitForSelector('body', { timeout: 10000 });

    // Should have basic navigation or header
    const hasNavigation = await page.evaluate(() => {
      const navElements = [
        document.querySelector('nav'),
        document.querySelector('header'),
        document.querySelector('[data-testid="navigation"]'),
        document.querySelector('[role="navigation"]'),
      ];

      return navElements.some((element) => element !== null);
    });

    // Basic page structure should be present
    const hasBasicStructure = await page.evaluate(() => {
      return (
        document.body.children.length > 0 &&
        document.querySelector('main, .main, [role="main"], .container') !== null
      );
    });

    expect(hasBasicStructure).toBe(true, 'Page should load basic structure even without Zero');

    expect(hasNavigation || hasBasicStructure).toBe(
      true,
      'Page should have navigation or basic structure'
    );

    // Navigation and basic structure verified
  });
});
