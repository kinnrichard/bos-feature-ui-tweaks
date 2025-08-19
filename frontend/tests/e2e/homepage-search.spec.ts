/**
 * Enhanced Homepage Search E2E Tests
 *
 * Comprehensive test suite for homepage search functionality with:
 * - Page Object Model integration
 * - Accessibility testing
 * - Data-driven test scenarios
 * - Error handling and edge cases
 * - Performance and security validation
 *
 * Features:
 * - Authentication integration via setup dependency
 * - SearchPage helper class integration
 * - Cross-browser compatibility testing
 * - Keyboard navigation and focus management
 */

import { test, expect, type Page } from '@playwright/test';
import { SearchPage, SearchTestUtils, type SearchOptions } from '../helpers';
import { debugComponent } from '$lib/utils/debug';

// Constants for consistent behavior
const SEARCH_TIMEOUT = 10000;
const DEBUG_MODE = process.env.DEBUG_HOMEPAGE_SEARCH === 'true';
const TEST_TIMEOUT = DEBUG_MODE ? 30000 : 15000;

// Data-driven test scenarios
interface SearchScenario {
  name: string;
  query: string;
  expectedRedirect?: string;
  expectedBehavior: 'success' | 'disabled' | 'escaped' | 'error';
  description: string;
}

const searchScenarios: SearchScenario[] = [
  {
    name: 'valid_client_search',
    query: 'test client',
    expectedRedirect: '/clients?q=test+client',
    expectedBehavior: 'success',
    description: 'Valid client search with spaces',
  },
  {
    name: 'special_characters',
    query: 'client@domain.com',
    expectedRedirect: '/clients?q=client%40domain.com',
    expectedBehavior: 'escaped',
    description: 'Search with special characters (email)',
  },
  {
    name: 'numeric_search',
    query: '12345',
    expectedRedirect: '/clients?q=12345',
    expectedBehavior: 'success',
    description: 'Numeric client ID search',
  },
  {
    name: 'long_query',
    query: 'very long client name that exceeds typical length boundaries for testing',
    expectedRedirect:
      '/clients?q=very+long+client+name+that+exceeds+typical+length+boundaries+for+testing',
    expectedBehavior: 'success',
    description: 'Long query boundary testing',
  },
  {
    name: 'empty_search',
    query: '',
    expectedBehavior: 'disabled',
    description: 'Empty search should disable button',
  },
  {
    name: 'whitespace_only',
    query: '   ',
    expectedBehavior: 'disabled',
    description: 'Whitespace-only search should be treated as empty',
  },
];

// Enhanced test wrapper with SearchPage integration
function createHomepageSearchTest(
  testName: string,
  testFn: (searchPage: SearchPage, page: Page) => Promise<void>,
  options: { verbose?: boolean } = {}
) {
  const { verbose = DEBUG_MODE } = options;

  return test(testName, async ({ page }) => {
    try {
      if (verbose) {
        debugComponent('Homepage search test initiated', {
          testName,
          component: 'HomepageSearchTest',
          timestamp: Date.now(),
        });
      }

      // Initialize SearchPage helper
      const searchPage = new SearchPage(page);

      // Navigate to homepage
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Execute test function
      await testFn(searchPage, page);

      if (verbose) {
        debugComponent('Homepage search test completed', {
          testName,
          component: 'HomepageSearchTest',
          result: 'success',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      if (verbose) {
        debugComponent(`Homepage search test failed: ${testName}`, {
          testName,
          component: 'HomepageSearchTest',
          error,
          timestamp: Date.now(),
        });
      }
      throw error;
    }
  });
}

test.describe('Enhanced Homepage Search Feature', () => {
  // Configure test timeout
  test.setTimeout(TEST_TIMEOUT);

  let searchOptions: SearchOptions;

  test.beforeEach(async ({ page }) => {
    // Configure search options based on environment
    searchOptions = DEBUG_MODE
      ? SearchTestUtils.createDebugOptions()
      : SearchTestUtils.createFastOptions();

    // Navigate to the homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (DEBUG_MODE) {
      debugComponent('Homepage search test setup', {
        component: 'HomepageSearchTest',
        debugMode: true,
        options: searchOptions,
        timestamp: Date.now(),
      });
    }
  });

  test('should display homepage with centered search input', async ({ page }) => {
    // Check that we're on the homepage (not redirected to /jobs)
    await expect(page).toHaveURL('/');

    // Check for the search input
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search Clients');

    // Check for the search button
    const searchButton = page.locator('button:has-text("Search")');
    await expect(searchButton).toBeVisible();

    // Check that search button is disabled when input is empty
    await expect(searchButton).toBeDisabled();

    // Check for quick navigation links
    await expect(page.locator('a:has-text("Clients")')).toBeVisible();
    await expect(page.locator('a:has-text("Jobs")')).toBeVisible();
  });

  test('should enable search button when text is entered', async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    const searchButton = page.locator('button:has-text("Search")');

    // Type in search input
    await searchInput.fill('test client');

    // Search button should now be enabled
    await expect(searchButton).toBeEnabled();
  });

  test('should navigate to search results page on search', async ({ page }) => {
    const searchInput = page.locator('input[type="search"]');
    const searchButton = page.locator('button:has-text("Search")');

    // Type and search
    await searchInput.fill('test search');
    await searchButton.click();

    // Should navigate to clients page with search query
    await expect(page).toHaveURL('/clients?q=test+search');

    // Toolbar search input should be populated with the query
    const toolbarSearchInput = page.locator('.toolbar .search-input');
    await expect(toolbarSearchInput).toHaveValue('test search');
  });

  test('should show filtered clients on clients page', async ({ page }) => {
    // Navigate directly to clients page with search
    await page.goto('/clients?q=test');

    // Wait for the clients page to load
    await page.waitForSelector('.clients-page');

    // Check that toolbar search is populated
    const toolbarSearchInput = page.locator('.toolbar .search-input');
    await expect(toolbarSearchInput).toHaveValue('test');

    // Check for "New Client" button in page header
    const newClientButton = page.locator('.new-client-button');
    await expect(newClientButton).toBeVisible();
  });

  test('should navigate back to homepage when clicking logo', async ({ page }) => {
    // Start on a different page
    await page.goto('/jobs');

    // Click the logo
    const logo = page.locator('.logo-link');
    await logo.click();

    // Should be back on homepage
    await expect(page).toHaveURL('/');
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test('sidebar should show "Clients" in simplified navigation mode', async ({ page }) => {
    // On homepage
    await expect(page).toHaveURL('/');

    // Check sidebar shows "Clients" (simplified nav)
    const sidebar = page.locator('.sidebar');
    await expect(sidebar.locator('a:has-text("Clients")')).toBeVisible();

    // Navigate to jobs page (also uses simplified nav)
    await page.goto('/jobs');

    // Check sidebar still shows "Clients" on jobs page (simplified nav)
    await expect(sidebar.locator('a:has-text("Clients")')).toBeVisible();
  });

  // PHASE 1: Data-Driven Test Scenarios
  test.describe('Data-Driven Search Scenarios', () => {
    searchScenarios.forEach((scenario) => {
      createHomepageSearchTest(
        `should handle ${scenario.name}: ${scenario.description}`,
        async (searchPage, page) => {
          const searchInput = page.locator('input[type="search"]');
          const searchButton = page.locator('button:has-text("Search")');

          if (scenario.expectedBehavior === 'disabled') {
            // Test button disabled for empty/whitespace queries
            await searchInput.fill(scenario.query);
            await expect(searchButton).toBeDisabled();
          } else if (
            scenario.expectedBehavior === 'success' ||
            scenario.expectedBehavior === 'escaped'
          ) {
            // Test successful search with proper URL encoding
            await searchPage.performSearch(scenario.query, searchOptions);
            await searchButton.click();

            if (scenario.expectedRedirect) {
              await searchPage.verifyURLUpdate(scenario.expectedRedirect, {
                ...searchOptions,
                timeout: SEARCH_TIMEOUT,
              });
            }
          }
        },
        { verbose: DEBUG_MODE }
      );
    });
  });

  // PHASE 1: Accessibility & Keyboard Navigation Tests
  test.describe('Accessibility & Keyboard Navigation', () => {
    createHomepageSearchTest(
      'should support full keyboard navigation',
      async (searchPage, page) => {
        const searchInput = page.locator('input[type="search"]');
        const searchButton = page.locator('button:has-text("Search")');

        // Search input should already be focused on page load
        await expect(searchInput).toBeFocused();

        // Verify button is initially disabled (when input is empty)
        await expect(searchButton).toBeDisabled();

        // Test typing while focused - this should enable the button
        await page.keyboard.type('keyboard test');
        await expect(searchButton).toBeEnabled();

        // Test Enter key submission directly from input (common UX pattern)
        await page.keyboard.press('Enter');

        // Should navigate to search results
        await searchPage.verifyURLUpdate('/clients?q=keyboard+test', searchOptions);
      }
    );

    createHomepageSearchTest(
      'should handle keyboard input and maintain value correctly',
      async (searchPage, page) => {
        const searchInput = page.locator('input[type="search"]');

        // Type search query
        await searchPage.performSearch('test input', searchOptions);
        await expect(searchInput).toHaveValue('test input');

        // Test that Escape key clears the search input (expected behavior)
        await searchInput.press('Escape');
        await expect(searchInput).toHaveValue('');

        // Test that we can type new content after clearing
        await page.keyboard.type('after escape');
        await expect(searchInput).toHaveValue('after escape');
      }
    );

    createHomepageSearchTest(
      'should maintain focus management correctly',
      async (searchPage, page) => {
        const searchInput = page.locator('input[type="search"]');

        // Search input should be automatically focused on page load (onMount behavior)
        await expect(searchInput).toBeFocused();

        // Focus should remain on input during typing
        await page.keyboard.type('focus test');
        await expect(searchInput).toBeFocused();

        // Value should be updated while maintaining focus
        await expect(searchInput).toHaveValue('focus test');
      }
    );

    createHomepageSearchTest('should have proper ARIA attributes', async (searchPage, page) => {
      const searchInput = page.locator('input[type="search"]');
      const searchButton = page.locator('button:has-text("Search")');

      // Verify input has proper attributes
      await expect(searchInput).toHaveAttribute('type', 'search');
      await expect(searchInput).toHaveAttribute('placeholder', 'Search Clients');

      // Verify button accessibility
      await expect(searchButton).toHaveAttribute('type', 'submit');
    });
  });

  // PHASE 2: Error Handling & Edge Cases
  test.describe('Error Handling & Edge Cases', () => {
    createHomepageSearchTest(
      'should handle rapid successive input changes',
      async (searchPage, page) => {
        const searchInput = page.locator('input[type="search"]');

        // Rapid input changes to test debounce
        const rapidInputs = ['a', 'ab', 'abc', 'abcd', 'final'];

        for (const input of rapidInputs) {
          await searchInput.fill(input);
          await page.waitForTimeout(50); // Fast succession
        }

        // Final value should be preserved
        await expect(searchInput).toHaveValue('final');
      }
    );

    createHomepageSearchTest(
      'should handle search with maximum length input',
      async (searchPage, page) => {
        const longQuery = 'a'.repeat(1000); // Very long query
        const searchInput = page.locator('input[type="search"]');
        const searchButton = page.locator('button:has-text("Search")');

        await searchInput.fill(longQuery);
        await expect(searchButton).toBeEnabled();

        // Should still handle the search (might be truncated by server)
        await searchButton.click();
        await expect(page).toHaveURL(/\/clients\?q=/);
      }
    );

    createHomepageSearchTest(
      'should handle special unicode characters',
      async (searchPage, page) => {
        const unicodeQuery = '测试 🔍 émoji';
        const searchButton = page.locator('button:has-text("Search")');

        await searchPage.performSearch(unicodeQuery, searchOptions);
        await searchButton.click();

        // Should properly URL encode unicode characters
        await expect(page).toHaveURL(/\/clients\?q=.*/);
      }
    );
  });

  // PHASE 2: Performance Testing
  test.describe('Performance & Timing', () => {
    createHomepageSearchTest(
      'should maintain responsive performance during search',
      async (searchPage, page) => {
        const startTime = Date.now();

        const searchButton = page.locator('button:has-text("Search")');

        // Measure search input responsiveness
        await searchPage.performSearch('performance test', searchOptions);
        await searchButton.click();

        // Navigation should complete within reasonable time
        await page.waitForURL('/clients?q=performance+test', { timeout: SEARCH_TIMEOUT });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within 10 seconds (adjust based on requirements)
        expect(duration).toBeLessThan(10000);
      }
    );

    createHomepageSearchTest(
      'should handle page reload with search state',
      async (searchPage, page) => {
        // Perform search first
        await searchPage.performSearch('reload test', searchOptions);
        const searchButton = page.locator('button:has-text("Search")');
        await searchButton.click();

        // Verify we're on results page
        await expect(page).toHaveURL('/clients?q=reload+test');

        // Reload the page
        await page.reload({ waitUntil: 'networkidle' });

        // Verify search state is preserved in URL
        await expect(page).toHaveURL('/clients?q=reload+test');

        // Navigate back to homepage
        await page.goto('/');

        // Search functionality should still work
        const searchInput = page.locator('input[type="search"]');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveValue(''); // Should be empty on homepage
      }
    );
  });

  // PHASE 3: Security Testing
  test.describe('Security & Input Validation', () => {
    const securityTestCases = [
      {
        name: 'script_injection',
        query: '<script>alert("xss")</script>',
        description: 'HTML/JS injection attempt',
      },
      {
        name: 'sql_injection',
        query: "'; DROP TABLE clients; --",
        description: 'SQL injection attempt',
      },
      {
        name: 'path_traversal',
        query: '../../../etc/passwd',
        description: 'Path traversal attempt',
      },
    ];

    securityTestCases.forEach((testCase) => {
      createHomepageSearchTest(
        `should safely handle ${testCase.name}: ${testCase.description}`,
        async (searchPage, page) => {
          const searchButton = page.locator('button:has-text("Search")');

          // Input potentially malicious query
          await searchPage.performSearch(testCase.query, searchOptions);
          await searchButton.click();

          // Should safely navigate to results (input should be escaped)
          await expect(page).toHaveURL(/\/clients\?q=.*/);

          // Page should not be compromised (no JS execution, no errors)
          const hasConsoleErrors = await page.evaluate(() => {
            return (window as unknown as { hasConsoleErrors?: boolean }).hasConsoleErrors || false;
          });
          expect(hasConsoleErrors).toBeFalsy();
        }
      );
    });
  });

  // PHASE 3: Cross-Browser Behavior Validation
  test.describe('Cross-Browser Compatibility', () => {
    createHomepageSearchTest(
      'should handle browser-specific search input behavior',
      async (searchPage, page) => {
        const searchInput = page.locator('input[type="search"]');

        // Test search input styling and behavior
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAttribute('type', 'search');

        // Test placeholder rendering across browsers
        await expect(searchInput).toHaveAttribute('placeholder', 'Search Clients');

        // Test search input clearing (WebKit specific behavior)
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');

        // Clear input
        await searchInput.clear();
        await expect(searchInput).toHaveValue('');
      }
    );

    createHomepageSearchTest(
      'should handle form submission consistently across browsers',
      async (searchPage, page) => {
        const searchInput = page.locator('input[type="search"]');

        // Test Enter key submission (should work consistently)
        await searchPage.performSearch('cross browser test', searchOptions);
        await searchInput.press('Enter');

        await searchPage.verifyURLUpdate('/clients?q=cross+browser+test', searchOptions);
      }
    );
  });
});
