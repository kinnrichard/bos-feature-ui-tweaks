/**
 * Console Error Monitoring for Test Suite
 *
 * Provides robust console error detection with configurable filtering
 * to improve test reliability and catch frontend errors.
 */

import type { Page, TestFixture } from '@playwright/test';

export interface ConsoleError {
  type: 'error' | 'warning';
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
  url: string;
}

export interface ConsoleErrorFilter {
  message?: string | RegExp;
  source?: string | RegExp;
  type?: 'error' | 'warning';
  description?: string; // For documentation
}

/**
 * Default filters for known acceptable console messages
 */
export const DEFAULT_CONSOLE_FILTERS: ConsoleErrorFilter[] = [
  {
    message: /^ResizeObserver loop limit exceeded/,
    type: 'error',
    description: 'ResizeObserver loop limit - common browser behavior, not a real error',
  },
  {
    message: /Non-passive event listener/,
    type: 'warning',
    description: 'Passive event listener warnings - performance hint, not critical',
  },
  // Note: DO NOT filter Svelte warnings - these indicate real code issues
  // Svelte warnings like [Warning] [svelte] should cause test failures
];

export interface ConsoleMonitoringOptions {
  filters?: ConsoleErrorFilter[];
  failOnError?: boolean;
  failOnWarning?: boolean;
  logFilteredErrors?: boolean;
  maxErrorsBeforeFailure?: number;
}

/**
 * Console Error Monitor - Core monitoring utility
 */
export class ConsoleErrorMonitor {
  private errors: ConsoleError[] = [];
  private filters: ConsoleErrorFilter[];
  private options: Required<ConsoleMonitoringOptions>;
  private isMonitoring = false;

  constructor(
    private page: Page,
    options: ConsoleMonitoringOptions = {}
  ) {
    this.filters = [...DEFAULT_CONSOLE_FILTERS, ...(options.filters || [])];
    this.options = {
      filters: this.filters,
      failOnError: options.failOnError ?? true,
      failOnWarning: options.failOnWarning ?? false,
      logFilteredErrors: options.logFilteredErrors ?? false,
      maxErrorsBeforeFailure: options.maxErrorsBeforeFailure ?? 5,
    };
  }

  /**
   * Start monitoring console messages
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.errors = [];

    // Monitor console errors
    this.page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const error: ConsoleError = {
          type: msg.type() as 'error' | 'warning',
          message: msg.text(),
          timestamp: Date.now(),
          url: this.page.url(),
        };

        if (!this.shouldFilterError(error)) {
          this.errors.push(error);

          if (this.options.logFilteredErrors) {
            console.warn(`[CONSOLE ${error.type.toUpperCase()}]`, error.message);
          }
        }
      }
    });

    // Monitor page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      const consoleError: ConsoleError = {
        type: 'error',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        url: this.page.url(),
      };

      if (!this.shouldFilterError(consoleError)) {
        this.errors.push(consoleError);
      }
    });
  }

  /**
   * Stop monitoring and return collected errors
   */
  stopMonitoring(): ConsoleError[] {
    this.isMonitoring = false;
    this.page.removeAllListeners('console');
    this.page.removeAllListeners('pageerror');
    return [...this.errors];
  }

  /**
   * Check if current errors should cause test failure
   */
  shouldFailTest(): boolean {
    const errorCount = this.errors.filter((e) => e.type === 'error').length;
    const warningCount = this.errors.filter((e) => e.type === 'warning').length;

    if (this.options.failOnError && errorCount > 0) return true;
    if (this.options.failOnWarning && warningCount > 0) return true;
    if (this.errors.length >= this.options.maxErrorsBeforeFailure) return true;

    return false;
  }

  /**
   * Get current error summary
   */
  getErrorSummary(): string {
    if (this.errors.length === 0) return 'No console errors detected';

    const errorCount = this.errors.filter((e) => e.type === 'error').length;
    const warningCount = this.errors.filter((e) => e.type === 'warning').length;

    let summary = `Console Issues Detected:\n`;
    summary += `  Errors: ${errorCount}\n`;
    summary += `  Warnings: ${warningCount}\n\n`;

    this.errors.slice(0, 10).forEach((error, index) => {
      summary += `${index + 1}. [${error.type.toUpperCase()}] ${error.message}\n`;
      if (error.stack) {
        summary += `   Stack: ${error.stack.split('\n')[0]}\n`;
      }
    });

    if (this.errors.length > 10) {
      summary += `... and ${this.errors.length - 10} more errors\n`;
    }

    return summary;
  }

  /**
   * Clear collected errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  private shouldFilterError(error: ConsoleError): boolean {
    return this.filters.some((filter) => {
      // Check message filter
      if (filter.message) {
        const messageMatch =
          typeof filter.message === 'string'
            ? error.message.includes(filter.message)
            : filter.message.test(error.message);

        if (!messageMatch) return false;
      }

      // Check source filter
      if (filter.source && error.source) {
        const sourceMatch =
          typeof filter.source === 'string'
            ? error.source.includes(filter.source)
            : filter.source.test(error.source);

        if (!sourceMatch) return false;
      }

      // Check type filter
      if (filter.type && filter.type !== error.type) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Test utility functions for console monitoring
 */
export class ConsoleTestUtils {
  /**
   * Create a console monitor with test-optimized defaults
   */
  static createMonitor(page: Page, options: ConsoleMonitoringOptions = {}): ConsoleErrorMonitor {
    return new ConsoleErrorMonitor(page, {
      failOnError: true,
      failOnWarning: true, // Changed to true - Svelte warnings should fail tests
      logFilteredErrors: process.env.DEBUG === 'true',
      ...options,
    });
  }

  /**
   * Create a monitor specifically configured for Svelte development
   * This configuration ensures Svelte warnings cause test failures
   */
  static createSvelteOptimizedMonitor(
    page: Page,
    options: ConsoleMonitoringOptions = {}
  ): ConsoleErrorMonitor {
    return new ConsoleErrorMonitor(page, {
      failOnError: true,
      failOnWarning: true, // Critical: Svelte warnings should fail tests
      logFilteredErrors: process.env.DEBUG === 'true',
      maxErrorsBeforeFailure: 1, // Fail immediately on first Svelte warning
      ...options,
    });
  }

  /**
   * Check if a console message is a critical Svelte warning
   */
  static isCriticalSvelteWarning(message: string): boolean {
    return message.startsWith('[Warning] [svelte]');
  }

  /**
   * Assert no console errors occurred during test
   */
  static assertNoConsoleErrors(monitor: ConsoleErrorMonitor): void {
    monitor.stopMonitoring();

    if (monitor.shouldFailTest()) {
      throw new Error(`Test failed due to console errors:\n${monitor.getErrorSummary()}`);
    }
  }

  /**
   * Add custom filter for a specific test
   */
  static withCustomFilter(
    monitor: ConsoleErrorMonitor,
    filter: ConsoleErrorFilter
  ): ConsoleErrorMonitor {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monitor as any).filters.push(filter);
    return monitor;
  }
}

/**
 * Playwright fixture extension for automatic console monitoring
 */
export type ConsoleMonitoringFixtures = {
  consoleMonitor: ConsoleErrorMonitor;
  withCleanConsole: TestFixture<void, Record<string, never>>;
};

export const consoleFixtures: TestFixture<ConsoleMonitoringFixtures, Record<string, never>> = {
  consoleMonitor: async ({ page }, use) => {
    const monitor = ConsoleTestUtils.createMonitor(page);
    await monitor.startMonitoring();

    await use(monitor);

    // Don't auto-fail here - let individual tests decide
    monitor.stopMonitoring();
  },

  withCleanConsole: async ({ page }, use, testInfo) => {
    const monitor = ConsoleTestUtils.createMonitor(page);
    await monitor.startMonitoring();

    await use();

    // Auto-fail test if console errors detected
    try {
      ConsoleTestUtils.assertNoConsoleErrors(monitor);
    } catch (error) {
      testInfo.attach('console-errors', {
        body: monitor.getErrorSummary(),
        contentType: 'text/plain',
      });
      throw error;
    }
  },
};

/**
 * Convenience functions for common usage patterns
 */

/**
 * Monitor console for the duration of a test function
 */
export async function withConsoleMonitoring<T>(
  page: Page,
  testFn: (monitor: ConsoleErrorMonitor) => Promise<T>,
  options: ConsoleMonitoringOptions = {}
): Promise<T> {
  const monitor = ConsoleTestUtils.createMonitor(page, options);
  await monitor.startMonitoring();

  try {
    const result = await testFn(monitor);
    ConsoleTestUtils.assertNoConsoleErrors(monitor);
    return result;
  } finally {
    monitor.stopMonitoring();
  }
}

/**
 * Simple wrapper to fail test on any console errors
 */
export async function expectNoConsoleErrors<T>(
  page: Page,
  testFn: () => Promise<T>,
  customFilters: ConsoleErrorFilter[] = []
): Promise<T> {
  return withConsoleMonitoring(page, async (_monitor) => await testFn(), {
    filters: customFilters,
  });
}
