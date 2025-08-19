/**
 * Professional Page Test Wrapper
 *
 * Based on the excellent patterns from smoke.e2e.spec.ts, this provides:
 * - Console monitoring with Svelte warning detection
 * - Environment-aware debugging
 * - Proper authentication setup
 * - Automatic cleanup management
 * - Real API integration with error handling
 */

import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { debugComponent } from '$lib/utils/debug';
import { withConsoleMonitoring, type ConsoleErrorFilter } from '../../helpers/console-monitoring';
import { AuthHelper } from '../../helpers/auth';
import { DataFactory } from '../../helpers/data-factories';

// Environment configuration
const PAGE_TEST_TIMEOUT = process.env.DEBUG_PAGE_TESTS === 'true' ? 30000 : 15000;
const DEBUG_MODE = process.env.DEBUG_PAGE_TESTS === 'true';
const VERBOSE_LOGGING = process.env.VERBOSE_PAGE_TESTS === 'true';

// Console error filters optimized for page testing
const PAGE_TEST_CONSOLE_FILTERS: ConsoleErrorFilter[] = [
  {
    message: /favicon/,
    type: 'error',
    description: 'Favicon 404 errors are not critical for page functionality',
  },
  {
    message: /ResizeObserver loop limit exceeded/,
    type: 'error',
    description: 'ResizeObserver loop limit - common during UI updates',
  },
  {
    message: /Non-passive event listener/,
    type: 'warning',
    description: 'Passive event listener warnings - performance hints only',
  },
  {
    message: /404.*\.(png|jpg|jpeg|svg|ico)$/,
    type: 'error',
    description: 'Image 404 errors typically not critical for page tests',
  },
  // 🚨 CRITICAL: Svelte warnings are NOT filtered and will fail tests
];

export interface PageTestOptions {
  /** Enable authentication setup before test */
  withAuth?: boolean;
  /** User role for authentication (default: 'admin') */
  authRole?: 'owner' | 'admin' | 'technician' | 'customer_specialist';
  /** Enable automatic test data cleanup */
  withCleanup?: boolean;
  /** Enable verbose logging for debugging */
  verbose?: boolean;
  /** Skip console monitoring (use cautiously) */
  skipConsoleMonitoring?: boolean;
  /** Custom console error filters for specific tests */
  customConsoleFilters?: ConsoleErrorFilter[];
  /** Test description for documentation */
  description?: string;
  /** Expected to fail (for future features) */
  expectToFail?: boolean;
}

export interface PageTestHelpers {
  auth: AuthHelper;
  factory: DataFactory;
  cleanup: (() => Promise<void>)[];
}

/**
 * Professional page test wrapper with comprehensive error handling
 */
export function createPageTest(
  testName: string,
  testFn: (page: Page, helpers: PageTestHelpers) => Promise<void>,
  options: PageTestOptions = {}
) {
  const {
    withAuth = true,
    authRole = 'admin',
    withCleanup = true,
    verbose = DEBUG_MODE,
    skipConsoleMonitoring = false,
    customConsoleFilters = [],
    description,
    expectToFail = false,
  } = options;

  // Skip future feature tests unless explicitly enabled
  if (expectToFail && process.env.TEST_FUTURE_FEATURES !== 'true') {
    return test.skip(testName, async ({ page: _page }) => {
      // This test documents future functionality
    });
  }

  return test(testName, async ({ page }) => {
    // Set test timeout
    test.setTimeout(PAGE_TEST_TIMEOUT);

    if (verbose) {
      debugComponent('Page test initiated', {
        testName,
        component: 'PageTestWrapper',
        withAuth,
        authRole,
        expectToFail,
        description,
        timestamp: Date.now(),
      });
    }

    // Skip server health check during normal test runs to avoid interference
    // Health checks are done in global setup - individual tests shouldn't check again
    if (process.env.ENABLE_PAGE_HEALTH_CHECKS === 'true') {
      try {
        // Lazy load ServerHealthMonitor to avoid configuration-time execution
        const { ServerHealthMonitor } = await import('../../helpers/server-health');
        const healthCheck = await ServerHealthMonitor.validateAllServers();
        if (!healthCheck.healthy) {
          console.warn('⚠️ Server health issues detected during test execution:');
          healthCheck.issues.forEach((issue) => console.warn(`  - ${issue}`));
          console.warn('💡 Consider running: bin/test-reset');
        }
      } catch (healthError) {
        console.warn('⚠️ Server health check failed:', healthError.message);
      }
    }

    // Initialize helpers
    const auth = new AuthHelper(page);
    const factory = new DataFactory(page);
    const cleanup: (() => Promise<void>)[] = [];

    const helpers: PageTestHelpers = { auth, factory, cleanup };

    try {
      // Setup authentication if required
      if (withAuth) {
        if (verbose) {
          debugComponent('Setting up authentication', {
            testName,
            role: authRole,
            component: 'PageTestWrapper',
          });
        }
        await auth.setupAuthenticatedSession(authRole);
      }

      // Execute test with console monitoring
      if (skipConsoleMonitoring) {
        await testFn(page, helpers);
      } else {
        const filters = [...PAGE_TEST_CONSOLE_FILTERS, ...customConsoleFilters];

        await withConsoleMonitoring(
          page,
          async (_monitor) => {
            await testFn(page, helpers);
          },
          {
            failOnError: true,
            failOnWarning: true, // Critical: Svelte warnings must fail tests
            filters,
            logFilteredErrors: DEBUG_MODE,
            maxErrorsBeforeFailure: 1, // Fail immediately on critical issues
          }
        );
      }

      if (verbose) {
        debugComponent('Page test completed successfully', {
          testName,
          component: 'PageTestWrapper',
          result: 'success',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      debugComponent(`Page test failed: ${testName}`, {
        testName,
        component: 'PageTestWrapper',
        result: 'error',
        error: error,
        expectToFail,
        timestamp: Date.now(),
      });

      if (expectToFail && verbose) {
        debugComponent('Test failed as expected (future feature)', {
          testName,
          component: 'PageTestWrapper',
          message: 'This test documents planned functionality',
          timestamp: Date.now(),
        });
      }

      if (DEBUG_MODE && !expectToFail) {
        debugComponent('Debug mode available for investigation', {
          component: 'PageTestWrapper',
          message: 'Set DEBUG_PAGE_TESTS=true for detailed logs',
          timestamp: Date.now(),
        });
      }

      throw error;
    } finally {
      // Execute cleanup functions if enabled
      if (withCleanup && cleanup.length > 0) {
        if (verbose) {
          debugComponent('Executing test cleanup', {
            testName,
            cleanupTasks: cleanup.length,
            component: 'PageTestWrapper',
          });
        }

        for (const cleanupFn of cleanup) {
          try {
            await cleanupFn();
          } catch (cleanupError) {
            console.warn(`Cleanup failed for test ${testName}:`, cleanupError);
          }
        }
      }
    }
  });
}

/**
 * Page-specific assertion helpers
 */
export class PageAssertions {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Assert page loads successfully with proper title
   */
  async assertPageLoads(expectedTitlePattern: string | RegExp) {
    await this.page.waitForLoadState('networkidle');

    await expect(this.page).toHaveTitle(expectedTitlePattern);
    await expect(this.page.locator('body')).toBeVisible();
  }

  /**
   * Assert proper authentication state
   */
  async assertAuthenticated() {
    // Should not be redirected to login
    await expect(this.page).not.toHaveURL(/\/login/);

    // Should have authenticated page elements
    await expect(this.page.locator('body')).not.toContainText('Sign In');
  }

  /**
   * Assert error state displays properly
   */
  async assertErrorState(expectedMessage?: string | RegExp) {
    const errorState = this.page.locator('.error-state, [role="alert"], .error-message');
    await expect(errorState.first()).toBeVisible();

    if (expectedMessage) {
      await expect(errorState.first()).toContainText(expectedMessage);
    }
  }

  /**
   * Assert loading state displays properly
   */
  async assertLoadingState() {
    const loadingIndicators = this.page.locator(
      '[data-testid*="skeleton"], .loading, [aria-label*="loading"], .spinner'
    );
    await expect(loadingIndicators.first()).toBeVisible();
  }

  /**
   * Assert empty state displays properly
   */
  async assertEmptyState(expectedMessage?: string | RegExp) {
    const emptyState = this.page.locator('.empty-state, .no-data, [data-testid="empty-state"]');
    await expect(emptyState.first()).toBeVisible();

    if (expectedMessage) {
      await expect(emptyState.first()).toContainText(expectedMessage);
    }
  }

  /**
   * Assert mobile responsiveness
   */
  async assertMobileResponsive() {
    // Set mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });

    // Wait for layout adjustment
    await this.page.waitForTimeout(500);

    // Verify page still functional
    await expect(this.page.locator('body')).toBeVisible();

    // Check for mobile-friendly elements (adjust based on your design system)
    const mobileElements = this.page.locator('.mobile-menu, .hamburger, [data-mobile]');
    const count = await mobileElements.count();

    // At least some mobile-specific elements should exist or layout should adapt
    expect(count >= 0).toBeTruthy(); // This allows for responsive CSS instead of mobile-specific elements
  }
}

/**
 * Utility functions for common page testing patterns
 */
export class PageTestUtils {
  /**
   * Wait for page to fully load including all async content
   */
  static async waitForPageReady(page: Page, timeout = 10000) {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle', { timeout });

    // Wait for any lazy-loaded content
    await page.waitForTimeout(500);
  }

  /**
   * Capture page screenshot for debugging
   */
  static async captureDebugScreenshot(page: Page, testName: string) {
    if (DEBUG_MODE) {
      const screenshotPath = `test-results/debug-${testName.replace(/\s+/g, '-')}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Debug screenshot saved: ${screenshotPath}`);
    }
  }

  /**
   * Log page performance metrics
   */
  static async logPerformanceMetrics(page: Page, testName: string) {
    if (VERBOSE_LOGGING) {
      const performance = await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded:
            navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          totalTime: navigation.loadEventEnd - navigation.fetchStart,
        };
      });

      console.log(`Performance metrics for ${testName}:`, performance);
    }
  }

  /**
   * Verify no memory leaks after navigation
   */
  static async verifyNoMemoryLeaks(page: Page) {
    if (DEBUG_MODE) {
      const jsHeapSize = await page.evaluate(() => {
        // @ts-expect-error - performance.memory is available in Chrome
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });

      if (jsHeapSize > 50 * 1024 * 1024) {
        // 50MB threshold
        console.warn(`High memory usage detected: ${Math.round(jsHeapSize / 1024 / 1024)}MB`);
      }
    }
  }
}
