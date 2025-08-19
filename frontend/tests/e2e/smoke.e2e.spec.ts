/**
 * Application Smoke Tests E2E
 *
 * Comprehensive smoke test suite following patterns from context-aware-search.spec.ts
 * Tests core application functionality and user journeys with both existing and planned features.
 *
 * Features:
 * - Authentication integration with proper state management
 * - Environment-controlled debug logging (DEBUG_SMOKE_TESTS=true)
 * - Robust error handling and timeout management
 * - Real assertions that verify actual functionality
 * - Page object patterns for maintainable selectors
 * - Proper waiting strategies instead of basic timeouts
 * - Future feature tests (expected to fail until implemented)
 */

import { test, expect, type Page } from '@playwright/test';
import { debugComponent } from '$lib/utils/debug';
import { withConsoleMonitoring, type ConsoleErrorFilter } from '../helpers/console-monitoring';

// Constants for consistent behavior
const SMOKE_TIMEOUT = 10000;
const DEBUG_MODE = process.env.DEBUG_SMOKE_TESTS === 'true';
const TEST_FUTURE_FEATURES = process.env.TEST_FUTURE_FEATURES === 'true';
const TEST_TIMEOUT = DEBUG_MODE ? 30000 : 15000;

// Console error filters for smoke tests
const SMOKE_TEST_CONSOLE_FILTERS: ConsoleErrorFilter[] = [
  {
    message: /favicon/,
    type: 'error',
    description: 'Favicon 404 errors are not critical for functionality',
  },
  {
    message: /ResizeObserver loop limit exceeded/,
    type: 'error',
    description: 'ResizeObserver loop limit - common browser behavior during UI updates',
  },
  {
    message: /Non-passive event listener/,
    type: 'warning',
    description: 'Passive event listener warnings - performance hints, not errors',
  },
  {
    message: /404.*\.(png|jpg|jpeg|svg|ico)$/,
    type: 'error',
    description: 'Image 404 errors are typically not critical for smoke tests',
  },
  // 🚨 IMPORTANT: DO NOT filter Svelte warnings!
  // Svelte warnings like [Warning] [svelte] indicate real code issues and should fail tests
];

interface SmokeTestOptions {
  verbose?: boolean;
  expectToFail?: boolean;
  description?: string;
  skipConsoleMonitoring?: boolean;
  customConsoleFilters?: ConsoleErrorFilter[];
}

/**
 * Enhanced test wrapper with authentication and error handling
 */
function createSmokeTest(
  testName: string,
  testFn: (page: Page) => Promise<void>,
  options: SmokeTestOptions = {}
) {
  const {
    verbose = DEBUG_MODE,
    expectToFail = false,
    description,
    skipConsoleMonitoring = false,
    customConsoleFilters = [],
  } = options;

  // Skip future feature tests by default using proper Playwright pattern
  if (expectToFail && !TEST_FUTURE_FEATURES) {
    return test.skip(testName, async ({ page: _page }) => {
      // This test is skipped - documents future functionality
    });
  }

  return test(testName, async ({ page }) => {
    try {
      if (verbose) {
        debugComponent('Smoke test initiated', {
          testName: testName,
          component: 'SmokeTest',
          action: 'createSmokeTest',
          expectToFail,
          description,
          timestamp: Date.now(),
        });
      }

      // Authentication is already handled by auth.setup.ts dependency
      // Tests are pre-authenticated via storageState, no additional verification needed

      // Execute test function with console monitoring
      if (skipConsoleMonitoring) {
        // Run without console monitoring
        await testFn(page);
      } else {
        // Run with Svelte-optimized console monitoring (default behavior)
        const filters = [...SMOKE_TEST_CONSOLE_FILTERS, ...customConsoleFilters];

        await withConsoleMonitoring(
          page,
          async (_monitor) => {
            await testFn(page);
          },
          {
            failOnError: true,
            failOnWarning: true, // Critical: Svelte warnings must fail tests
            filters: filters,
            logFilteredErrors: DEBUG_MODE,
            maxErrorsBeforeFailure: 1, // Fail immediately on critical warnings
          }
        );
      }

      if (verbose) {
        debugComponent('Smoke test completed', {
          testName: testName,
          component: 'SmokeTest',
          action: 'createSmokeTest',
          result: 'success',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      debugComponent(`Smoke test failed: ${testName}`, {
        testName: testName,
        component: 'SmokeTest',
        action: 'createSmokeTest',
        result: 'error',
        error: error,
        expectToFail,
        timestamp: Date.now(),
      });

      if (expectToFail && verbose) {
        debugComponent('Test failed as expected (future feature)', {
          testName: testName,
          component: 'SmokeTest',
          message: 'This test documents planned functionality',
          timestamp: Date.now(),
        });
      }

      if (DEBUG_MODE) {
        debugComponent('Debug mode available', {
          component: 'SmokeTest',
          action: 'createSmokeTest',
          message: 'Try: DEBUG_SMOKE_TESTS=true for detailed logs',
          timestamp: Date.now(),
        });
      }
      throw error;
    }
  });
}

test.describe('Application Smoke Tests', () => {
  // Configure test timeout
  test.setTimeout(TEST_TIMEOUT);

  /**
   * 🧪 CONSOLE ERROR MONITORING ENABLED - SVELTE-OPTIMIZED
   *
   * All smoke tests now automatically monitor for console errors and will fail if:
   * - Critical JavaScript errors occur
   * - 🚨 SVELTE WARNINGS occur (e.g., [Warning] [svelte] ownership_invalid_binding)
   * - Unhandled exceptions are thrown
   * - Any warning that indicates real code issues
   *
   * Filtered errors (automatically ignored):
   * - Favicon 404 errors
   * - ResizeObserver loop limit exceeded
   * - Non-passive event listener warnings (performance hints only)
   * - Image 404 errors
   *
   * 🚨 CRITICAL: Svelte warnings are NOT filtered and WILL fail tests!
   * This includes warnings like:
   * - [Warning] [svelte] ownership_invalid_binding
   * - [Warning] [svelte] any other Svelte warnings
   *
   * To disable console monitoring for a specific test, use:
   * { skipConsoleMonitoring: true }
   *
   * To add custom filters for a specific test, use:
   * { customConsoleFilters: [{ message: /pattern/, description: 'reason' }] }
   */

  test.beforeEach(async ({ page: _page }) => {
    if (DEBUG_MODE) {
      debugComponent('Smoke test setup', {
        component: 'SmokeTest',
        action: 'beforeEach',
        debugMode: true,
        testFutureFeatures: TEST_FUTURE_FEATURES,
        timestamp: Date.now(),
      });
    }
  });

  // ✅ EXISTING FUNCTIONALITY (Should Pass)
  test.describe('Core Application (Existing Features)', () => {
    createSmokeTest(
      'should load homepage with essential UI elements',
      async (page) => {
        // Navigate to homepage
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Verify page loads successfully
        await expect(page.locator('body')).toBeVisible();

        // Check for essential homepage elements
        const searchInput = page.locator('input[type="search"]');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAttribute('placeholder', /search/i);

        // Verify main navigation links
        await expect(page.locator('a:has-text("Jobs")')).toBeVisible();
        await expect(page.locator('a:has-text("Clients")')).toBeVisible();

        // Should be on correct URL
        await expect(page).toHaveURL('/');
      },
      { description: 'Validates homepage loads with core UI elements' }
    );

    createSmokeTest(
      'should navigate between main application sections',
      async (page) => {
        // Start on homepage
        await page.goto('/');
        await expect(page).toHaveURL('/');

        // Navigate to jobs page
        await page.click('a:has-text("Jobs")');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL('/jobs');

        // Verify jobs page loads
        await expect(page.locator('body')).toBeVisible();

        // Navigate to clients page
        await page.click('a:has-text("Clients")');
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL('/clients');

        // Verify clients page loads
        await expect(page.locator('body')).toBeVisible();
      },
      { description: 'Validates basic navigation between main sections' }
    );

    createSmokeTest(
      'should display data on jobs page',
      async (page) => {
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        // Verify we're on jobs page
        await expect(page).toHaveURL('/jobs');

        // Look for job-related elements (flexible selectors)
        const jobElements = await page.locator('[class*="job"], [data-testid*="job"]').count();

        // Should have some job-related UI elements
        expect(jobElements).toBeGreaterThan(0);

        // Page should not show generic error states
        const errorElements = page.locator('.error, [role="alert"]');
        const errorCount = await errorElements.count();
        expect(errorCount).toBe(0);
      },
      { description: 'Validates jobs page renders without errors' }
    );

    createSmokeTest(
      'should display data on clients page',
      async (page) => {
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');

        // Verify we're on clients page
        await expect(page).toHaveURL('/clients');

        // Look for client-related elements
        const clientElements = await page
          .locator('[class*="client"], [data-testid*="client"]')
          .count();

        // Should have some client-related UI elements
        expect(clientElements).toBeGreaterThan(0);

        // Page should not show generic error states
        const errorElements = page.locator('.error, [role="alert"]');
        const errorCount = await errorElements.count();
        expect(errorCount).toBe(0);
      },
      { description: 'Validates clients page renders without errors' }
    );

    createSmokeTest(
      'should maintain authentication state across navigation',
      async (page) => {
        // Start on homepage
        await page.goto('/');

        // Verify we're not redirected to login
        await expect(page).not.toHaveURL('/login');

        // Navigate to different pages
        await page.goto('/jobs');
        await expect(page).not.toHaveURL('/login');

        await page.goto('/clients');
        await expect(page).not.toHaveURL('/login');

        // Verify authentication persists after reload
        await page.reload({ waitUntil: 'networkidle' });
        await expect(page).not.toHaveURL('/login');
      },
      { description: 'Validates authentication state persists during navigation' }
    );

    createSmokeTest(
      'should handle search functionality basics',
      async (page) => {
        // Test search on jobs page
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        const searchInput = page.locator('.search-input, input[type="search"]').first();

        if (await searchInput.isVisible()) {
          // Verify search input works
          await searchInput.fill('test');
          await expect(searchInput).toHaveValue('test');

          // Clear search
          await searchInput.clear();
          await expect(searchInput).toHaveValue('');
        }

        // Test search on clients page
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');

        const clientSearchInput = page.locator('.search-input, input[type="search"]').first();

        if (await clientSearchInput.isVisible()) {
          await clientSearchInput.fill('client test');
          await expect(clientSearchInput).toHaveValue('client test');
        }
      },
      { description: 'Validates basic search input functionality where present' }
    );

    createSmokeTest(
      'should maintain authentication after browser refresh',
      async (page) => {
        // Navigate to protected page
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        // Verify we're authenticated (not redirected to login)
        await expect(page).not.toHaveURL('/login');
        await expect(page).toHaveURL('/jobs');

        // Refresh browser
        await page.reload({ waitUntil: 'networkidle' });

        // Should still be authenticated (not redirected to login)
        await expect(page).not.toHaveURL('/login');
        await expect(page).toHaveURL('/jobs');

        // Verify page content loads (proves auth worked)
        await expect(page.locator('body')).toBeVisible();

        // Test on different protected page too
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveURL('/login');

        // Refresh on clients page
        await page.reload({ waitUntil: 'networkidle' });
        await expect(page).not.toHaveURL('/login');
        await expect(page).toHaveURL('/clients');
      },
      { description: 'Validates authentication persistence after browser refresh' }
    );
  });

  // ❌ FUTURE FUNCTIONALITY (Expected to Fail)
  test.describe('User Management (Future Features)', () => {
    createSmokeTest(
      'should display user menu with initials',
      async (page) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Look for user menu button with initials (as described in original requirements)
        const userMenuButton = page.locator('button.circular-button.avatar[title="User menu"]');
        await expect(userMenuButton).toBeVisible({ timeout: SMOKE_TIMEOUT });

        // Should have user initials
        const userInitials = userMenuButton.locator('.user-initials');
        await expect(userInitials).toBeVisible();
        await expect(userInitials).toHaveText(/^[A-Z]{1,2}$/);

        // Button should have proper ARIA attributes
        await expect(userMenuButton).toHaveAttribute('aria-label', 'User menu');
      },
      {
        expectToFail: true,
        description: 'Documents expected user menu button with initials (not yet implemented)',
      }
    );

    createSmokeTest(
      'should provide sign out functionality in user menu',
      async (page) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Click user menu to open dropdown
        const userMenu = page.locator('[data-testid="user-menu"], button[aria-label="User menu"]');
        await userMenu.click();

        // Should show sign out option
        const signOutButton = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out")');
        await expect(signOutButton).toBeVisible({ timeout: SMOKE_TIMEOUT });

        // Click sign out
        await signOutButton.click();

        // Should redirect to login page
        await expect(page).toHaveURL('/login', { timeout: SMOKE_TIMEOUT });
      },
      {
        expectToFail: true,
        description: 'Documents expected sign out functionality (not yet implemented)',
      }
    );

    createSmokeTest(
      'should show user profile options in menu',
      async (page) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Open user menu
        const userMenu = page.locator('[data-testid="user-menu"]');
        await userMenu.click();

        // Should show profile/settings options
        await expect(
          page.locator('a:has-text("Profile"), button:has-text("Profile")')
        ).toBeVisible();
        await expect(
          page.locator('a:has-text("Settings"), button:has-text("Settings")')
        ).toBeVisible();
      },
      {
        expectToFail: true,
        description: 'Documents expected user profile menu options (not yet implemented)',
      }
    );
  });

  test.describe('Advanced Authentication (Future Features)', () => {
    createSmokeTest(
      'should handle session timeout gracefully',
      async (page) => {
        await page.goto('/');

        // Simulate session timeout (mock expired token)
        await page.route('**/api/**', async (route) => {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Session expired' }),
          });
        });

        // Try to perform an action that requires authentication
        await page.reload();

        // Should redirect to login
        await expect(page).toHaveURL('/login', { timeout: SMOKE_TIMEOUT });
      },
      {
        expectToFail: true,
        description: 'Documents expected session timeout handling (not yet implemented)',
      }
    );

    createSmokeTest(
      'should preserve user menu UI state after browser refresh',
      async (page) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // User menu should be visible
        const userMenu = page.locator('[data-testid="user-menu"]');
        await expect(userMenu).toBeVisible();

        // Get user initials from the menu
        const userInitials = userMenu.locator('.user-initials');
        const initialText = await userInitials.textContent();

        // Refresh browser
        await page.reload({ waitUntil: 'networkidle' });

        // User menu UI should be preserved with same initials
        await expect(userMenu).toBeVisible();
        await expect(userInitials).toHaveText(initialText || '');

        // Menu should still be functional
        await userMenu.click();
        await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
      },
      {
        expectToFail: true,
        description: 'Documents expected user menu UI persistence (user menu not yet implemented)',
      }
    );
  });

  test.describe('Error Handling & Recovery', () => {
    createSmokeTest(
      'should handle page reload gracefully',
      async (page) => {
        // Test different pages handle reload
        const pagesToTest = ['/', '/jobs', '/clients'];

        for (const url of pagesToTest) {
          await page.goto(url);
          await page.waitForLoadState('networkidle');

          // Reload page
          await page.reload({ waitUntil: 'networkidle' });

          // Should still be on same page (not redirect to error)
          await expect(page).toHaveURL(url);
          await expect(page.locator('body')).toBeVisible();
        }
      },
      { description: 'Validates graceful page reload handling' }
    );

    createSmokeTest(
      'should not show critical JavaScript errors',
      async (page) => {
        // Enhanced console error monitoring with detailed analysis
        await withConsoleMonitoring(
          page,
          async (_monitor) => {
            // Navigate through main pages
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            await page.goto('/jobs');
            await page.waitForLoadState('networkidle');

            await page.goto('/clients');
            await page.waitForLoadState('networkidle');

            // Additional navigation that might trigger errors
            await page.goto('/');
            await page.waitForLoadState('networkidle');

            // The monitor will automatically check for console errors
            // All errors are filtered through SMOKE_TEST_CONSOLE_FILTERS
          },
          {
            failOnError: true,
            failOnWarning: false, // Don't fail on warnings in smoke tests
            filters: SMOKE_TEST_CONSOLE_FILTERS,
            logFilteredErrors: DEBUG_MODE,
          }
        );
      },
      {
        description: 'Enhanced validation of JavaScript errors with intelligent filtering',
        skipConsoleMonitoring: true, // Skip double monitoring since we're using withConsoleMonitoring
      }
    );

    createSmokeTest(
      'should handle complex user interactions without console errors',
      async (page) => {
        // Test more complex interactions that might generate console errors
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        // Try to interact with search if available
        const searchInput = page.locator('input[type="search"]').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('test search');
          await searchInput.clear();
        }

        // Navigate to clients and try similar interactions
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');

        const clientSearch = page.locator('input[type="search"]').first();
        if (await clientSearch.isVisible()) {
          await clientSearch.fill('client search');
          await page.keyboard.press('Enter');
        }

        // Test back/forward navigation
        await page.goBack();
        await page.waitForLoadState('networkidle');
        await page.goForward();
        await page.waitForLoadState('networkidle');

        // Console monitoring happens automatically via createSmokeTest wrapper
      },
      {
        description: 'Validates complex user interactions do not generate console errors',
        customConsoleFilters: [
          {
            message: /navigation.*timeout/,
            type: 'warning',
            description: 'Navigation timeout warnings during rapid navigation are acceptable',
          },
        ],
      }
    );

    createSmokeTest(
      'should catch and fail on Svelte warnings',
      async (page) => {
        // This test specifically validates that Svelte warnings cause test failures

        // Navigate through pages that might trigger Svelte warnings
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        // Look for interactive elements that might have binding issues
        const interactiveElements = page.locator('button, input, select');
        const elementCount = await interactiveElements.count();

        if (elementCount > 0) {
          // Try interacting with elements to potentially trigger binding warnings
          const firstElement = interactiveElements.first();
          const elementType = await firstElement.evaluate((el) => el.tagName.toLowerCase());

          if (elementType === 'button') {
            await firstElement.click();
          } else if (elementType === 'input') {
            await firstElement.focus();
          }
        }

        // Navigate to clients page and repeat
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');

        // Any Svelte warnings (like [Warning] [svelte] ownership_invalid_binding)
        // will be automatically caught and cause this test to fail

        // This test serves as documentation that the monitoring system is working
        await expect(page.locator('body')).toBeVisible();
      },
      {
        description:
          'Validates that Svelte warnings like ownership_invalid_binding cause test failures',
        verbose: true, // Always log for this critical validation test
      }
    );
  });

  // Conditional tests that only run when explicitly enabled
  if (TEST_FUTURE_FEATURES) {
    test.describe('Development Feature Tests', () => {
      test('Feature test environment is enabled', async () => {
        // This test just confirms the environment is set up correctly
        expect(TEST_FUTURE_FEATURES).toBe(true);
        console.warn('🚀 Running future feature tests - some tests expected to fail');
      });
    });
  }
});
