/**
 * Console Error Monitoring - Usage Examples
 *
 * Demonstrates different ways to integrate console error monitoring
 * into your test suite for improved robustness.
 */

import { test, expect } from '@playwright/test';
import {
  ConsoleErrorMonitor,
  ConsoleTestUtils,
  withConsoleMonitoring,
  expectNoConsoleErrors,
  type ConsoleErrorFilter,
} from '../helpers/console-monitoring';

test.describe('Console Error Monitoring Examples', () => {
  // ==========================================
  // APPROACH 1: Manual Monitor Management
  // Best for: Tests that need fine-grained control
  // ==========================================

  test('Manual monitor - full control', async ({ page }) => {
    // Create and start monitor
    const monitor = ConsoleTestUtils.createMonitor(page, {
      failOnError: true,
      failOnWarning: false,
      logFilteredErrors: true,
    });

    await monitor.startMonitoring();

    try {
      // Your test actions
      await page.goto('/jobs');
      await page.click('.some-button');

      // Optional: Check errors during test
      if (monitor.shouldFailTest()) {
        console.warn('Errors detected:', monitor.getErrorSummary());
      }

      // Your assertions
      await expect(page.locator('.job-list')).toBeVisible();
    } finally {
      // Assert no console errors at end of test
      ConsoleTestUtils.assertNoConsoleErrors(monitor);
    }
  });

  // ==========================================
  // APPROACH 2: Wrapper Function (Recommended)
  // Best for: Most tests - clean and automatic
  // ==========================================

  test('Simple wrapper - automatic handling', async ({ page }) => {
    await expectNoConsoleErrors(page, async () => {
      await page.goto('/jobs');
      await expect(page.locator('.job-list')).toBeVisible();

      // All console errors automatically caught and cause test failure
    });
  });

  test('Wrapper with custom filters', async ({ page }) => {
    const customFilters: ConsoleErrorFilter[] = [
      {
        message: /specific error we want to ignore in this test/,
        type: 'error',
        description: 'This specific error is expected in this test scenario',
      },
    ];

    await expectNoConsoleErrors(
      page,
      async () => {
        await page.goto('/jobs');
        // This test allows the specific filtered error but fails on others
      },
      customFilters
    );
  });

  // ==========================================
  // APPROACH 3: Advanced Wrapper with Monitor Access
  // Best for: Tests that need to inspect errors during execution
  // ==========================================

  test('Advanced wrapper - monitor access', async ({ page }) => {
    await withConsoleMonitoring(
      page,
      async (monitor) => {
        await page.goto('/jobs');

        // Trigger some action that might cause errors
        await page.click('.problematic-button');

        // Check for specific errors during test
        const errors = monitor.stopMonitoring();
        const hasSpecificError = errors.some((e) => e.message.includes('expected error'));

        if (hasSpecificError) {
          console.warn('Expected error occurred, continuing test');
          monitor.clearErrors(); // Don't fail test for this expected error
          await monitor.startMonitoring(); // Resume monitoring
        }

        // Continue with test
        await expect(page.locator('.result')).toBeVisible();

        // Monitor automatically asserts no errors at end
      },
      {
        failOnError: true,
        maxErrorsBeforeFailure: 3,
      }
    );
  });

  // ==========================================
  // APPROACH 4: Per-Test Custom Configuration
  // Best for: Tests with specific error tolerance
  // ==========================================

  test('Custom error tolerance per test', async ({ page }) => {
    const monitor = ConsoleTestUtils.createMonitor(page, {
      failOnError: true,
      failOnWarning: true, // Strict: fail on warnings too
      maxErrorsBeforeFailure: 1, // Fail immediately on first error
      logFilteredErrors: true,
    });

    // Add test-specific filter
    ConsoleTestUtils.withCustomFilter(monitor, {
      message: 'ResizeObserver loop limit exceeded',
      description: 'Known browser quirk in this specific test',
    });

    await monitor.startMonitoring();

    try {
      await page.goto('/complex-ui');
      await expect(page.locator('.complex-component')).toBeVisible();
    } finally {
      ConsoleTestUtils.assertNoConsoleErrors(monitor);
    }
  });

  // ==========================================
  // APPROACH 5: Integration with Existing Test Helpers
  // Best for: Integration with your current test patterns
  // ==========================================

  test('Integration with auth helpers', async ({ page }) => {
    // Import your existing helpers
    // const { AuthHelper, DataFactory } = require('../helpers');

    await expectNoConsoleErrors(page, async () => {
      // Use your existing test helpers
      // const auth = new AuthHelper(page);
      // await auth.setupAuthenticatedSession('admin');

      // const factory = new DataFactory(page);
      // const job = await factory.createJob({ title: 'Test Job' });

      await page.goto('/jobs');
      await expect(page.locator('.authenticated-content')).toBeVisible();
    });
  });

  // ==========================================
  // APPROACH 6: Conditional Error Handling
  // Best for: Tests that may legitimately cause errors in some scenarios
  // ==========================================

  test('Conditional error handling', async ({ page }) => {
    const monitor = ConsoleTestUtils.createMonitor(page);
    await monitor.startMonitoring();

    // Test scenario that might legitimately cause errors
    await page.goto('/error-prone-page');

    const errors = monitor.stopMonitoring();

    if (errors.length > 0) {
      // Check if errors are the expected ones
      const hasOnlyExpectedErrors = errors.every(
        (error) =>
          error.message.includes('expected network failure') ||
          error.message.includes('deliberate test error')
      );

      if (!hasOnlyExpectedErrors) {
        throw new Error(`Unexpected console errors: ${monitor.getErrorSummary()}`);
      }

      console.warn('Expected errors occurred, test passes');
    }

    await expect(page.locator('.error-handled')).toBeVisible();
  });
});

// ==========================================
// GLOBAL SETUP EXAMPLES
// ==========================================

test.describe('Global Console Monitoring Setup', () => {
  let globalMonitor: ConsoleErrorMonitor;

  test.beforeEach(async ({ page }) => {
    // Option 1: Start monitoring in beforeEach for all tests in describe block
    globalMonitor = ConsoleTestUtils.createMonitor(page);
    await globalMonitor.startMonitoring();
  });

  test.afterEach(async () => {
    // Check for errors after each test
    if (globalMonitor) {
      try {
        ConsoleTestUtils.assertNoConsoleErrors(globalMonitor);
      } catch (error) {
        console.error('Console errors detected in test:', error);
        throw error;
      }
    }
  });

  test('Test 1 with global monitoring', async ({ page }) => {
    await page.goto('/page1');
    await expect(page.locator('.content')).toBeVisible();
    // Console errors automatically monitored and checked in afterEach
  });

  test('Test 2 with global monitoring', async ({ page }) => {
    await page.goto('/page2');
    await expect(page.locator('.other-content')).toBeVisible();
    // Console errors automatically monitored and checked in afterEach
  });
});

// ==========================================
// ERROR FILTERING EXAMPLES
// ==========================================

test.describe('Error Filtering Strategies', () => {
  test('Multiple filter types', async ({ page }) => {
    const customFilters: ConsoleErrorFilter[] = [
      // Filter by exact message
      {
        message: 'Specific error message to ignore',
        type: 'error',
        description: 'Known issue with third-party library',
      },

      // Filter by regex pattern
      {
        message: /^Network.*timeout$/,
        type: 'error',
        description: 'Network timeout errors are acceptable in this test',
      },

      // Filter by source file
      {
        source: /vendor\/problematic-library/,
        description: 'All errors from problematic vendor library',
      },

      // Filter warnings only
      {
        message: /deprecated/i,
        type: 'warning',
        description: 'Deprecation warnings are not critical',
      },
    ];

    await expectNoConsoleErrors(
      page,
      async () => {
        await page.goto('/page-with-known-issues');
        await expect(page.locator('.main-content')).toBeVisible();
      },
      customFilters
    );
  });

  test('Dynamic filter based on test conditions', async ({ page }) => {
    // Determine filters based on environment or test conditions
    const isProduction = process.env.NODE_ENV === 'production';
    const customFilters: ConsoleErrorFilter[] = [];

    if (isProduction) {
      // In production, be more lenient with certain errors
      customFilters.push({
        message: /analytics.*failed/,
        description: 'Analytics failures acceptable in production tests',
      });
    }

    await expectNoConsoleErrors(
      page,
      async () => {
        await page.goto('/environment-specific-page');
        await expect(page.locator('.content')).toBeVisible();
      },
      customFilters
    );
  });
});

// ==========================================
// DEBUGGING AND REPORTING EXAMPLES
// ==========================================

test.describe('Console Error Debugging', () => {
  test('Detailed error reporting', async ({ page }, testInfo) => {
    const monitor = ConsoleTestUtils.createMonitor(page, {
      logFilteredErrors: true, // Log even filtered errors for debugging
      failOnError: false, // Don't fail immediately, collect all errors
    });

    await monitor.startMonitoring();

    await page.goto('/problematic-page');
    await page.click('.trigger-errors');

    const errors = monitor.stopMonitoring();

    // Attach detailed error report to test results
    if (errors.length > 0) {
      await testInfo.attach('console-errors-detail', {
        body: JSON.stringify(errors, null, 2),
        contentType: 'application/json',
      });

      await testInfo.attach('console-errors-summary', {
        body: monitor.getErrorSummary(),
        contentType: 'text/plain',
      });
    }

    // Decide whether to fail based on error analysis
    const criticalErrors = errors.filter(
      (e) => e.type === 'error' && !e.message.includes('non-critical')
    );

    if (criticalErrors.length > 0) {
      throw new Error(`Critical console errors detected: ${criticalErrors.length}`);
    }
  });
});
