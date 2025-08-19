import { devices } from '@playwright/test';
import { createHybridPlaywrightConfig } from './tests/helpers/config';

const authFile = 'playwright/.auth/user.json';

// Use the hybrid configuration with browser device overrides
export default createHybridPlaywrightConfig({
  // Global setup - runs once before all tests
  globalSetup: './tests/global.setup.ts',

  projects: [
    // Global setup tasks - run first in sequence
    {
      name: 'global-setup',
      testMatch: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Legacy auth setup (will be deprecated after global setup is verified)
    {
      name: 'auth-setup-legacy',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Safari'] },
      dependencies: ['global-setup'],
    },

    // Unit tests - fast, mocked APIs (no auth needed)
    {
      name: 'unit-chromium',
      testMatch: '**/*.unit.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'unit-firefox',
      testMatch: '**/*.unit.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },

    // Integration tests - real database (with auth)
    {
      name: 'integration-chromium',
      testMatch: '**/*.integration.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['global-setup'],
    },
    {
      name: 'integration-firefox',
      testMatch: '**/*.integration.spec.ts',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['global-setup'],
    },

    // E2E tests - full real database (with auth)
    {
      name: 'e2e-chromium',
      testMatch: '**/*.e2e.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['global-setup'],
    },

    // API tests - backend testing (no browser auth needed)
    {
      name: 'api-tests',
      testMatch: '**/*.api.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // Default tests - hybrid strategy based on content (with auth)
    {
      name: 'hybrid-chromium',
      testMatch: /(?<!\.(unit|integration|e2e|api|setup))\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['global-setup'],
    },
    {
      name: 'hybrid-firefox',
      testMatch: /(?<!\.(unit|integration|e2e|api|setup))\.spec\.ts$/,
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['global-setup'],
    },
    {
      name: 'hybrid-webkit',
      testMatch: /(?<!\.(unit|integration|e2e|api|setup))\.spec\.ts$/,
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['global-setup'],
    },
  ],
});
