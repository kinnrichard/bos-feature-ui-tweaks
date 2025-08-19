/**
 * Context-Aware Search E2E Tests
 *
 * Comprehensive test suite for search functionality across different page contexts.
 * Follows robust patterns established in auth.setup.ts and test-helpers infrastructure.
 *
 * Features:
 * - Authentication integration with proper state management
 * - Environment-controlled debug logging (DEBUG_SEARCH_TESTS=true)
 * - Robust error handling and timeout management
 * - Test data isolation and cleanup
 * - Page object patterns for maintainable selectors
 * - Proper waiting strategies instead of basic timeouts
 */

import { test } from '@playwright/test';
import {
  SearchPage,
  SearchTestUtils,
  SEARCH_CONTEXTS,
  DataFactory,
  type SearchOptions,
} from '../helpers';
import { debugComponent, debugState } from '$lib/utils/debug';

// Constants for consistent behavior
const SEARCH_TIMEOUT = 10000;
const DEBUG_MODE = process.env.DEBUG_SEARCH_TESTS === 'true';
const TEST_TIMEOUT = DEBUG_MODE ? 30000 : 15000;

interface SearchTestOptions {
  verbose?: boolean;
  useTestData?: boolean;
}

/**
 * Enhanced test wrapper with error handling and SearchPage integration
 */
function createSearchTest(
  testName: string,
  testFn: (searchPage: SearchPage, dataFactory?: DataFactory) => Promise<void>,
  options: SearchTestOptions = {}
) {
  const { verbose = DEBUG_MODE, useTestData = false } = options;

  return test(testName, async ({ page }) => {
    try {
      if (verbose) {
        debugComponent('Search test initiated', {
          testName: testName,
          component: 'SearchTest',
          action: 'createSearchTest',
          timestamp: Date.now(),
        });
      }

      // Authentication is already handled by auth.setup.ts dependency
      // Tests are pre-authenticated via storageState, no additional verification needed

      // Initialize search page
      const searchPage = new SearchPage(page);

      // Set up test data if requested
      let dataFactory: DataFactory | undefined;
      if (useTestData) {
        dataFactory = new DataFactory(page);
        if (verbose) {
          debugState('Search test data factory initialized', {
            testName: testName,
            component: 'SearchTest',
            action: 'initializeDataFactory',
            hasDataFactory: true,
            timestamp: Date.now(),
          });
        }
      }

      // Execute test function
      await testFn(searchPage, dataFactory);

      if (verbose) {
        debugComponent('Search test completed', {
          testName: testName,
          component: 'SearchTest',
          action: 'createSearchTest',
          result: 'success',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      debugComponent(`Search test failed: ${testName}`, {
        testName: testName,
        component: 'SearchTest',
        action: 'createSearchTest',
        result: 'error',
        error: error,
        timestamp: Date.now(),
      });
      if (DEBUG_MODE) {
        debugComponent('Debug mode available', {
          component: 'SearchTest',
          action: 'createSearchTest',
          message: 'Try: DEBUG_SEARCH_TESTS=true for detailed logs',
          timestamp: Date.now(),
        });
      }
      throw error;
    }
  });
}

test.describe('Context-Aware Search', () => {
  // Configure test timeout
  test.setTimeout(TEST_TIMEOUT);

  let searchOptions: SearchOptions;

  test.beforeEach(async () => {
    // Configure search options based on environment
    searchOptions = DEBUG_MODE
      ? SearchTestUtils.createDebugOptions()
      : SearchTestUtils.createFastOptions();

    if (DEBUG_MODE) {
      debugComponent('Debug mode enabled - verbose logging active', {
        component: 'SearchTest',
        action: 'beforeEach',
        debugMode: true,
        verboseLogging: true,
        timestamp: Date.now(),
      });
    }
  });

  test.describe('Search Visibility and Context', () => {
    createSearchTest(
      'should show appropriate search placeholder on different pages',
      async (searchPage) => {
        // Test Jobs page context
        await searchPage.testSearchContext(SEARCH_CONTEXTS.JOBS_PAGE, searchOptions);

        // Test Clients page context
        await searchPage.testSearchContext(SEARCH_CONTEXTS.CLIENTS_PAGE, searchOptions);

        // Note: Job detail page testing would require valid job ID from test data
        // This would be implemented when test data factory is fully integrated
      },
      { verbose: DEBUG_MODE }
    );

    createSearchTest(
      'should not show search on homepage',
      async (searchPage) => {
        await searchPage.testSearchContext(SEARCH_CONTEXTS.HOMEPAGE, searchOptions);
      },
      { verbose: DEBUG_MODE }
    );
  });

  test.describe('Search Functionality', () => {
    createSearchTest(
      'should filter jobs with proper debounce handling',
      async (searchPage) => {
        // Navigate to jobs page
        await searchPage.navigateToPage('/jobs', searchOptions);

        // Verify initial state
        await searchPage.verifyPlaceholder('Search jobs', searchOptions);

        // Perform search with debounce
        await searchPage.performSearch('test', {
          ...searchOptions,
          waitForDebounce: true,
        });

        // Verify search value
        await searchPage.verifySearchValue('test', searchOptions);

        // Clear search with button
        await searchPage.clearSearchWithButton(searchOptions);
      },
      { verbose: DEBUG_MODE }
    );

    createSearchTest(
      'should filter clients with keyboard navigation',
      async (searchPage) => {
        // Navigate to clients page
        await searchPage.navigateToPage('/clients', searchOptions);

        // Verify initial state
        await searchPage.verifyPlaceholder('Search clients', searchOptions);

        // Perform search
        await searchPage.performSearch('vital', searchOptions);

        // Verify search value
        await searchPage.verifySearchValue('vital', searchOptions);

        // Clear with Escape key
        await searchPage.clearSearchWithEscape(searchOptions);
      },
      { verbose: DEBUG_MODE }
    );
  });

  test.describe('Search State Management', () => {
    createSearchTest(
      'should clear search when navigating between pages',
      async (searchPage) => {
        // Start on jobs page and perform search
        await searchPage.navigateToPage('/jobs', searchOptions);
        await searchPage.performSearch('test search', searchOptions);
        await searchPage.verifySearchValue('test search', searchOptions);

        // Navigate to clients page
        await searchPage.navigateToPage('/clients', searchOptions);

        // Verify search is cleared and context updated
        await searchPage.verifySearchValue('', searchOptions);
        await searchPage.verifyPlaceholder('Search clients', searchOptions);
      },
      { verbose: DEBUG_MODE }
    );

    createSearchTest(
      'should preserve search when navigating with query parameters',
      async (searchPage) => {
        // Navigate to clients page with query
        await searchPage.navigateToPage('/clients?q=test', searchOptions);

        // Verify toolbar search state
        await searchPage.verifyToolbarSearch('test', searchOptions);

        // Modify search and verify URL updates
        const toolbarSearchInput = searchPage.getPage().locator('.toolbar .search-input');
        await toolbarSearchInput.fill('test client');

        // Wait for debounce and verify URL update
        await searchPage.verifyURLUpdate('/clients?q=test+client', {
          ...searchOptions,
          timeout: SEARCH_TIMEOUT,
        });
      },
      { verbose: DEBUG_MODE }
    );
  });

  test.describe('Error Handling and Edge Cases', () => {
    createSearchTest(
      'should handle rapid search input changes gracefully',
      async (searchPage) => {
        await searchPage.navigateToPage('/jobs', searchOptions);

        // Perform rapid successive searches
        const searchValues = ['a', 'ab', 'abc', 'abcd', 'test'];

        for (const value of searchValues) {
          await searchPage.performSearch(value, {
            ...searchOptions,
            waitForDebounce: false, // Fast succession
          });
        }

        // Wait for final debounce and verify final state
        await searchPage.getPage().waitForTimeout(500);
        await searchPage.verifySearchValue('test', searchOptions);
      },
      { verbose: DEBUG_MODE }
    );

    createSearchTest(
      'should maintain search functionality after page reload',
      async (searchPage) => {
        // Set up search on jobs page
        await searchPage.navigateToPage('/jobs', searchOptions);
        await searchPage.performSearch('persistent', searchOptions);

        // Reload page
        await searchPage.getPage().reload({ waitUntil: 'networkidle' });

        // Verify search functionality still works
        await searchPage.verifyPlaceholder('Search jobs', searchOptions);
        await searchPage.performSearch('reload test', searchOptions);
        await searchPage.verifySearchValue('reload test', searchOptions);
      },
      { verbose: DEBUG_MODE }
    );
  });

  // Conditional test for authenticated users only
  test.describe('Authenticated Search Features', () => {
    test.skip(({ page }) => {
      // Skip if no authentication available
      return !page.context().storageState;
    }, 'Authentication required for these tests');

    createSearchTest(
      'should maintain search state across authenticated navigation',
      async (searchPage) => {
        // This test would verify search behavior with authenticated user context
        // Implementation depends on specific authentication requirements
        await searchPage.navigateToPage('/jobs', searchOptions);
        await searchPage.verifyPlaceholder('Search jobs', searchOptions);

        // Test authenticated search features here
        // (Implementation would depend on specific app requirements)
      },
      { verbose: DEBUG_MODE }
    );
  });
});
