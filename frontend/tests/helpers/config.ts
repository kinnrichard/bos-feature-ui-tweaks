/**
 * Test Configuration
 *
 * Central configuration for hybrid testing strategy
 */

import { PlaywrightTestConfig, defineConfig } from '@playwright/test';

export interface HybridTestConfig {
  // Test strategy selection
  defaultStrategy: 'mocked' | 'real_db' | 'hybrid';

  // Database configuration
  database: {
    host: string;
    port: number;
    resetBetweenTests: boolean;
    isolationStrategy: 'none' | 'cleanup' | 'transaction' | 'reset';
    seedData: boolean;
  };

  // Rails server configuration
  rails: {
    host: string;
    port: number;
    startCommand?: string;
    waitTimeout: number;
  };

  // Test categorization
  testCategories: {
    unit: { strategy: 'mocked'; pattern: string };
    integration: { strategy: 'real_db'; pattern: string };
    e2e: { strategy: 'real_db'; pattern: string };
  };

  // Console error monitoring
  consoleMonitoring: {
    enabled: boolean;
    failOnError: boolean;
    failOnWarning: boolean;
    logFilteredErrors: boolean;
    maxErrorsBeforeFailure: number;
  };

  // Performance settings
  performance: {
    parallelWorkers: number;
    retries: number;
    timeout: number;
  };
}

/**
 * Default hybrid test configuration
 */
export const HYBRID_CONFIG: HybridTestConfig = {
  defaultStrategy: 'hybrid',

  database: {
    host: process.env.RAILS_TEST_HOST || 'localhost',
    port: parseInt(process.env.RAILS_TEST_PORT || '4000'), // Test port default
    resetBetweenTests: false,
    isolationStrategy: 'cleanup',
    seedData: true,
  },

  rails: {
    host: process.env.RAILS_TEST_HOST || 'localhost',
    port: parseInt(process.env.RAILS_TEST_PORT || '4000'), // Test port default
    startCommand: process.env.RAILS_START_COMMAND,
    waitTimeout: 30000,
  },

  testCategories: {
    unit: {
      strategy: 'mocked',
      pattern: '**/*.unit.spec.ts',
    },
    integration: {
      strategy: 'real_db',
      pattern: '**/*.integration.spec.ts',
    },
    e2e: {
      strategy: 'real_db',
      pattern: '**/*.e2e.spec.ts',
    },
  },

  consoleMonitoring: {
    enabled: process.env.CONSOLE_MONITORING !== 'false',
    failOnError: process.env.CONSOLE_FAIL_ON_ERROR !== 'false',
    failOnWarning: process.env.CONSOLE_FAIL_ON_WARNING === 'true',
    logFilteredErrors: process.env.DEBUG === 'true',
    maxErrorsBeforeFailure: parseInt(process.env.CONSOLE_MAX_ERRORS || '5'),
  },

  performance: {
    parallelWorkers: process.env.CI ? 1 : 2,
    retries: process.env.CI ? 2 : 0,
    timeout: 30000,
  },
};

/**
 * Environment-specific configuration overrides
 */
export function getEnvironmentConfig(): Partial<HybridTestConfig> {
  if (process.env.CI) {
    return {
      performance: {
        parallelWorkers: 1,
        retries: 2,
        timeout: 60000,
      },
      database: {
        ...HYBRID_CONFIG.database,
        resetBetweenTests: true,
        isolationStrategy: 'reset',
      },
    };
  }

  if (process.env.DEBUG === 'true') {
    return {
      performance: {
        parallelWorkers: 1,
        retries: 0,
        timeout: 0, // No timeout in debug mode
      },
    };
  }

  return {};
}

/**
 * Create Playwright configuration for hybrid testing
 */
export function createHybridPlaywrightConfig(
  overrides: Partial<PlaywrightTestConfig> = {}
): PlaywrightTestConfig {
  const config = { ...HYBRID_CONFIG, ...getEnvironmentConfig() };

  return defineConfig({
    testDir: 'tests',
    testMatch: /(.+\.)?(test|spec)\.[jt]s/,
    timeout: config.performance.timeout,

    expect: {
      timeout: 5000,
    },

    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: config.performance.retries,
    workers: config.performance.parallelWorkers,

    reporter: process.env.CI ? 'github' : 'list',

    use: {
      ...overrides.use,
      baseURL: 'http://localhost:6173', // Frontend test server
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      // Override API URL for tests to point to test Rails server
      extraHTTPHeaders: overrides.use?.extraHTTPHeaders || {},
    },

    // Environment variables for test execution
    env: {
      PUBLIC_API_URL: 'http://localhost:4000/api/v1', // FORCE test API URL
      ...process.env,
    },

    projects: [
      // Unit tests - fast, mocked APIs
      {
        name: 'unit',
        testMatch: config.testCategories.unit.pattern,
        use: {
          // No special setup needed for unit tests
        },
      },

      // Integration tests - real database
      {
        name: 'integration',
        testMatch: config.testCategories.integration.pattern,
        use: {
          // Will use real database connection
        },
      },

      // E2E tests - full real database
      {
        name: 'e2e',
        testMatch: config.testCategories.e2e.pattern,
        use: {
          // Full browser context with real backend
        },
      },

      // Default tests - hybrid strategy
      {
        name: 'hybrid',
        testMatch: /(?<!\.(?:unit|integration|e2e))\.spec\.ts$/,
        use: {
          // Dynamic strategy based on test content
        },
      },
    ],

    webServer:
      process.env.SKIP_WEB_SERVER === 'true'
        ? []
        : [
            // All test servers (Rails, Zero, Frontend) via bin/test-servers
            {
              command: 'bin/test-servers',
              cwd: '..', // Run from project root directory
              url: 'http://localhost:6173', // Frontend test port
              timeout: 120 * 1000,
              reuseExistingServer: !process.env.CI, // Gracefully handle existing servers
              stdout: 'frontend/test-results/test-servers.log', // Redirect verbose server logs to file
              stderr: 'frontend/test-results/test-servers-errors.log', // Redirect server errors to file
              env: {
                ...process.env,
                // Ensure test environment
                RAILS_ENV: 'test',
                NODE_ENV: 'test',
                RAILS_TEST_PORT: '4000', // Explicit test port
                ZERO_TEST_PORT: '4850', // Zero test port from config/zero.yml
                FRONTEND_TEST_PORT: '6173', // Explicit test port
                // FORCE test API URL
                PUBLIC_API_URL: 'http://localhost:4000/api/v1',
              },
            },
          ],

    ...overrides,
  });
}

/**
 * Get test strategy for current test file
 */
export function getTestStrategyForFile(testFilePath: string): 'mocked' | 'real_db' {
  const config = { ...HYBRID_CONFIG, ...getEnvironmentConfig() };

  // Check if file matches specific category patterns
  if (testFilePath.match(config.testCategories.unit.pattern)) {
    return config.testCategories.unit.strategy;
  }

  if (testFilePath.match(config.testCategories.integration.pattern)) {
    return config.testCategories.integration.strategy;
  }

  if (testFilePath.match(config.testCategories.e2e.pattern)) {
    return config.testCategories.e2e.strategy;
  }

  // Default strategy based on environment
  if (process.env.TEST_STRATEGY === 'mocked') {
    return 'mocked';
  }

  if (process.env.TEST_STRATEGY === 'real_db') {
    return 'real_db';
  }

  // Hybrid default: prefer mocked for speed unless specifically requested
  return process.env.USE_REAL_DB === 'true' ? 'real_db' : 'mocked';
}

/**
 * Test environment utilities
 */
export class TestEnvironment {
  /**
   * Check if environment is configured for hybrid testing
   */
  static isHybridConfigured(): boolean {
    return process.env.TEST_STRATEGY === 'hybrid' || HYBRID_CONFIG.defaultStrategy === 'hybrid';
  }

  /**
   * Get current test strategy from environment
   */
  static getCurrentStrategy(): 'mocked' | 'real_db' | 'hybrid' {
    return (
      (process.env.TEST_STRATEGY as 'mocked' | 'real_db' | 'hybrid') ||
      HYBRID_CONFIG.defaultStrategy
    );
  }

  /**
   * Check if Rails server should be available
   */
  static shouldHaveRailsServer(): boolean {
    const strategy = this.getCurrentStrategy();
    return strategy === 'real_db' || strategy === 'hybrid';
  }

  /**
   * Get configuration for current environment
   */
  static getConfig(): HybridTestConfig {
    return { ...HYBRID_CONFIG, ...getEnvironmentConfig() };
  }

  /**
   * Validate test environment setup
   */
  static async validateEnvironment(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check required environment variables
    if (this.shouldHaveRailsServer()) {
      const config = this.getConfig();

      // Check if Rails server is running
      try {
        const response = await fetch(
          `http://${config.rails.host}:${config.rails.port}/api/v1/health`
        );
        if (!response.ok) {
          issues.push('Rails server not responding to health check');
        }
      } catch {
        issues.push('Rails server not accessible');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Print current configuration
   */
  static printConfig(): void {
    const config = this.getConfig();

    // Import debug functions for configuration logging
    import('$lib/utils/debug')
      .then(({ debugComponent }) => {
        debugComponent('Hybrid Test Configuration', {
          component: 'TestEnvironment',
          action: 'printConfig',
          strategy: this.getCurrentStrategy(),
          railsServer: `${config.rails.host}:${config.rails.port}`,
          isolation: config.database.isolationStrategy,
          workers: config.performance.parallelWorkers,
          ciMode: !!process.env.CI,
          timestamp: Date.now(),
        });
      })
      .catch(() => {
        // Fallback for environments where debug utils aren't available
        console.warn('Test Configuration:', {
          strategy: this.getCurrentStrategy(),
          railsServer: `${config.rails.host}:${config.rails.port}`,
          isolation: config.database.isolationStrategy,
          workers: config.performance.parallelWorkers,
          ciMode: !!process.env.CI,
        });
      });
  }
}
