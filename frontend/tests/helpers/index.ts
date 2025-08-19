/**
 * Frontend Test Helpers
 *
 * Central export for all test utilities supporting hybrid testing strategy
 */

// Database utilities
export {
  testDb,
  TestDatabase,
  DatabaseLifecycle,
  DatabaseTransaction,
  shouldUseRealDatabase,
  getTestStrategy,
  DEFAULT_DB_CONFIG,
} from './database';

// Authentication utilities
export {
  AuthHelper,
  ContextAuthHelper,
  UserFactory,
  AuthTestUtils,
  type TestUser,
  type AuthTokens,
} from './auth';

// Data factories
export {
  DataFactory,
  TestScenarios,
  TestDataUtils,
  type JobData,
  type TaskData,
  type ClientData,
  type UserData,
} from './data-factories';

// Test isolation and lifecycle
export {
  test,
  testWithRealDB,
  testWithAuth,
  testWithReset,
  testWithTransaction,
  testWithMocks,
  skipIfMocked,
  skipIfRealDB,
  runOnlyWith,
  type TestContext,
  type IsolationStrategy,
  type TestOptions,
} from './isolation';

// Configuration
export {
  HYBRID_CONFIG,
  createHybridPlaywrightConfig,
  getTestStrategyForFile,
  TestEnvironment,
  type HybridTestConfig,
} from './config';

// User menu verification utilities
export {
  verifyUserMenu,
  assertUserMenuVisible,
  verifyAuthenticationFallback,
  verifyAuthentication,
  type UserMenuVerificationResult,
} from './user-menu-verification';

// Page Objects
export { LoginPage, type LoginCredentials } from './login-page';

export {
  SearchPage,
  SearchTestUtils,
  SEARCH_CONTEXTS,
  type SearchOptions,
  type SearchContext,
} from './search-page';

// Console error monitoring
export {
  ConsoleErrorMonitor,
  ConsoleTestUtils,
  consoleFixtures,
  withConsoleMonitoring,
  expectNoConsoleErrors,
  DEFAULT_CONSOLE_FILTERS,
  type ConsoleError,
  type ConsoleErrorFilter,
  type ConsoleMonitoringOptions,
  type ConsoleMonitoringFixtures,
} from './console-monitoring';

/**
 * Quick setup utilities for common test patterns
 */

// Convenience re-exports for most common usage
export { expect } from '@playwright/test';

/**
 * Test setup helper - call this in your test files for automatic configuration
 */
export function setupTestEnvironment() {
  // This can be called in test files to automatically configure the environment
  // Currently just exports the configuration, but could be extended
  if (process.env.DEBUG === 'true') {
    console.warn('[TEST ENV] Debug mode enabled');
  }
}

/**
 * Quick test creators for common patterns
 * Note: Available patterns for test configuration
 */
export const quickTests = {
  /**
   * Basic test configuration
   */
  basic: 'Use standard test() from @playwright/test',

  /**
   * Search-specific test configuration
   */
  withSearchPage: 'Use SearchPage class for search testing',
};

/**
 * Assertion helpers for common patterns
 */
export const assertions = {
  /**
   * Basic search assertions - use SearchPage class methods
   */
  searchPage: 'Use SearchPage.verifyPlaceholder(), verifySearchValue(), etc.',

  /**
   * Authentication assertions - use verifyAuthentication from user-menu-verification
   */
  authentication: 'Use verifyAuthentication() from user-menu-verification',
};

/**
 * Common test data patterns
 */
export const testData = {
  /**
   * Test data creation guidance
   */
  guidance: 'Use DataFactory class when available, or create minimal test data inline',
};

/**
 * Environment detection helpers
 */
export const env = {
  isCI: !!process.env.CI,
  isDebug: process.env.DEBUG === 'true',
  isSearchDebug: process.env.DEBUG_SEARCH_TESTS === 'true',
};
