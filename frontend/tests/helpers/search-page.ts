/**
 * SearchPage - Page Object for Context-Aware Search Testing
 *
 * Provides consistent interface for testing search functionality across different pages,
 * following the robust patterns established in auth.setup.ts and other test helpers.
 */

import { Page, Locator, expect } from '@playwright/test';
import { debugComponent, debugAPI, debugState } from '$lib/utils/debug';

// Constants for consistent behavior
const SEARCH_TIMEOUT = 10000;
const DEBOUNCE_WAIT = 400; // Wait for 300ms debounce + buffer
const DEBUG_MODE = process.env.DEBUG_SEARCH_TESTS === 'true';

export interface SearchOptions {
  timeout?: number;
  waitForDebounce?: boolean;
  verbose?: boolean;
}

export interface SearchContext {
  page: string;
  expectedPlaceholder: string;
  searchValue?: string;
  shouldBeVisible?: boolean;
}

export class SearchPage {
  constructor(private page: Page) {}

  // Selectors - centralized for consistency
  private get searchContainer(): Locator {
    return this.page.locator('.search-container');
  }

  private get toolbarSearchContainer(): Locator {
    return this.page.locator('.toolbar .search-container');
  }

  private get searchInput(): Locator {
    return this.page.locator('.search-input');
  }

  private get toolbarSearchInput(): Locator {
    return this.page.locator('.toolbar .search-input');
  }

  private get clearButton(): Locator {
    return this.page.locator('.search-clear');
  }

  /**
   * Navigate to a specific page and wait for it to be ready
   */
  async navigateToPage(path: string, options: SearchOptions = {}): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugComponent('SearchPage navigation initiated', {
        component: 'SearchPage',
        action: 'navigateToPage',
        path: path,
        timestamp: Date.now(),
      });
    }

    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');

    if (verbose) {
      debugComponent('SearchPage navigation completed', {
        component: 'SearchPage',
        action: 'navigateToPage',
        path: path,
        loadState: 'networkidle',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Verify search container visibility based on context
   */
  async verifySearchVisibility(
    shouldBeVisible: boolean,
    options: SearchOptions = {}
  ): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugState('SearchPage visibility verification', {
        component: 'SearchPage',
        action: 'verifySearchVisibility',
        shouldBeVisible: shouldBeVisible,
        timestamp: Date.now(),
      });
    }

    if (shouldBeVisible) {
      await expect(this.searchContainer).toBeVisible();
    } else {
      await expect(this.searchContainer).not.toBeVisible();
    }
  }

  /**
   * Verify search placeholder text for the current context
   */
  async verifyPlaceholder(expectedPlaceholder: string, options: SearchOptions = {}): Promise<void> {
    const { timeout = SEARCH_TIMEOUT, verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugComponent('SearchPage placeholder verification initiated', {
        component: 'SearchPage',
        action: 'verifyPlaceholder',
        expectedPlaceholder: expectedPlaceholder,
        timeout: timeout,
        timestamp: Date.now(),
      });
    }

    // Wait for search input to be visible first
    await this.searchInput.waitFor({ state: 'visible', timeout });

    // Verify placeholder
    await expect(this.searchInput).toHaveAttribute('placeholder', expectedPlaceholder, { timeout });

    if (verbose) {
      debugComponent('SearchPage placeholder verification completed', {
        component: 'SearchPage',
        action: 'verifyPlaceholder',
        expectedPlaceholder: expectedPlaceholder,
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Perform search with proper waiting and debounce handling
   */
  async performSearch(searchValue: string, options: SearchOptions = {}): Promise<void> {
    const { waitForDebounce = true, verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugAPI('SearchPage search operation initiated', {
        component: 'SearchPage',
        action: 'performSearch',
        searchValue: searchValue,
        waitForDebounce: waitForDebounce,
        timestamp: Date.now(),
      });
    }

    // Wait for search input to be ready
    await this.searchInput.waitFor({ state: 'visible' });

    // Clear any existing value first
    await this.searchInput.clear();

    // Type the search value
    await this.searchInput.fill(searchValue);

    // Wait for debounce if requested
    if (waitForDebounce) {
      if (verbose) {
        debugAPI('SearchPage debounce wait initiated', {
          component: 'SearchPage',
          action: 'performSearch',
          debounceWait: `${DEBOUNCE_WAIT}ms`,
          searchValue: searchValue,
          timestamp: Date.now(),
        });
      }
      await this.page.waitForTimeout(DEBOUNCE_WAIT);
    }

    if (verbose) {
      debugAPI('SearchPage search operation completed', {
        component: 'SearchPage',
        action: 'performSearch',
        searchValue: searchValue,
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clear search using the clear button
   */
  async clearSearchWithButton(options: SearchOptions = {}): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugComponent('SearchPage clear button operation initiated', {
        component: 'SearchPage',
        action: 'clearSearchWithButton',
        method: 'button_click',
        timestamp: Date.now(),
      });
    }

    await this.clearButton.waitFor({ state: 'visible' });
    await this.clearButton.click();

    // Verify cleared
    await expect(this.searchInput).toHaveValue('');

    if (verbose) {
      debugComponent('SearchPage clear button operation completed', {
        component: 'SearchPage',
        action: 'clearSearchWithButton',
        method: 'button_click',
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clear search using Escape key
   */
  async clearSearchWithEscape(options: SearchOptions = {}): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugComponent('SearchPage escape key operation initiated', {
        component: 'SearchPage',
        action: 'clearSearchWithEscape',
        method: 'keyboard_escape',
        timestamp: Date.now(),
      });
    }

    await this.searchInput.focus();
    await this.searchInput.press('Escape');

    // Verify cleared
    await expect(this.searchInput).toHaveValue('');

    if (verbose) {
      debugComponent('SearchPage escape key operation completed', {
        component: 'SearchPage',
        action: 'clearSearchWithEscape',
        method: 'keyboard_escape',
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Verify search input value
   */
  async verifySearchValue(expectedValue: string, options: SearchOptions = {}): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugState('SearchPage value verification initiated', {
        component: 'SearchPage',
        action: 'verifySearchValue',
        expectedValue: expectedValue,
        timestamp: Date.now(),
      });
    }

    await expect(this.searchInput).toHaveValue(expectedValue);

    if (verbose) {
      debugState('SearchPage value verification completed', {
        component: 'SearchPage',
        action: 'verifySearchValue',
        expectedValue: expectedValue,
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Verify toolbar search for pages with query parameters
   */
  async verifyToolbarSearch(expectedValue: string, options: SearchOptions = {}): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugComponent('SearchPage toolbar verification initiated', {
        component: 'SearchPage',
        action: 'verifyToolbarSearch',
        expectedValue: expectedValue,
        timestamp: Date.now(),
      });
    }

    await expect(this.toolbarSearchContainer).toBeVisible();
    await expect(this.toolbarSearchInput).toHaveValue(expectedValue);

    if (verbose) {
      debugComponent('SearchPage toolbar verification completed', {
        component: 'SearchPage',
        action: 'verifyToolbarSearch',
        expectedValue: expectedValue,
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Verify URL updates after search with debounce
   */
  async verifyURLUpdate(expectedURL: string, options: SearchOptions = {}): Promise<void> {
    const { timeout = SEARCH_TIMEOUT, verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugAPI('SearchPage URL update verification initiated', {
        component: 'SearchPage',
        action: 'verifyURLUpdate',
        expectedURL: expectedURL,
        timeout: timeout,
        timestamp: Date.now(),
      });
    }

    // Wait for URL to update after debounce
    await expect(this.page).toHaveURL(expectedURL, { timeout });

    if (verbose) {
      debugAPI('SearchPage URL update verification completed', {
        component: 'SearchPage',
        action: 'verifyURLUpdate',
        expectedURL: expectedURL,
        result: 'success',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Test complete search context - combines navigation, verification, and search
   */
  async testSearchContext(context: SearchContext, options: SearchOptions = {}): Promise<void> {
    const { verbose = DEBUG_MODE } = options;

    if (verbose) {
      debugComponent('SearchPage context test initiated', {
        component: 'SearchPage',
        action: 'testSearchContext',
        contextPage: context.page,
        expectedPlaceholder: context.expectedPlaceholder,
        shouldBeVisible: context.shouldBeVisible,
        hasSearchValue: !!context.searchValue,
        timestamp: Date.now(),
      });
    }

    // Navigate to page
    await this.navigateToPage(context.page, options);

    // Verify visibility if specified
    if (context.shouldBeVisible !== undefined) {
      await this.verifySearchVisibility(context.shouldBeVisible, options);
    }

    // If search should be visible, verify placeholder
    if (context.shouldBeVisible !== false) {
      await this.verifyPlaceholder(context.expectedPlaceholder, options);
    }

    // Perform search if value provided
    if (context.searchValue) {
      await this.performSearch(context.searchValue, options);
      await this.verifySearchValue(context.searchValue, options);
    }

    if (verbose) {
      debugComponent('SearchPage context test completed', {
        component: 'SearchPage',
        action: 'testSearchContext',
        contextPage: context.page,
        result: 'success',
        testsExecuted: [
          context.shouldBeVisible !== undefined ? 'visibility' : null,
          context.shouldBeVisible !== false ? 'placeholder' : null,
          context.searchValue ? 'search_value' : null,
        ].filter(Boolean),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get the current page instance for advanced operations
   */
  getPage(): Page {
    return this.page;
  }
}

/**
 * Common search contexts for testing
 */
export const SEARCH_CONTEXTS = {
  JOBS_PAGE: {
    page: '/jobs',
    expectedPlaceholder: 'Search jobs',
    shouldBeVisible: true,
  } as SearchContext,

  CLIENTS_PAGE: {
    page: '/clients',
    expectedPlaceholder: 'Search clients',
    shouldBeVisible: true,
  } as SearchContext,

  HOMEPAGE: {
    page: '/',
    expectedPlaceholder: '',
    shouldBeVisible: false,
  } as SearchContext,

  CLIENTS_WITH_QUERY: {
    page: '/clients?q=test',
    expectedPlaceholder: 'Search clients',
    shouldBeVisible: true,
    searchValue: 'test',
  } as SearchContext,
} as const;

/**
 * Search test utilities
 */
export const SearchTestUtils = {
  /**
   * Create verbose options for debugging
   */
  createDebugOptions(): SearchOptions {
    return {
      verbose: true,
      timeout: SEARCH_TIMEOUT * 2, // Extended timeout for debugging
      waitForDebounce: true,
    };
  },

  /**
   * Create fast options for CI environments
   */
  createFastOptions(): SearchOptions {
    return {
      verbose: false,
      timeout: SEARCH_TIMEOUT / 2,
      waitForDebounce: false,
    };
  },
};
