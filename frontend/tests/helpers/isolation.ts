/**
 * Test Isolation Utilities
 * 
 * Provides mechanisms for isolating tests and managing database state
 */

import { type Page, test as baseTest } from '@playwright/test';
import { testDb, DatabaseLifecycle, DatabaseTransaction } from './database';
import { AuthHelper } from './auth';
import { DataFactory, TestScenarios } from './data-factories';
import { getTestStrategy } from './database';

export interface TestContext {
  db: typeof testDb;
  auth: AuthHelper;
  factory: DataFactory;
  scenarios: TestScenarios;
  transaction?: DatabaseTransaction;
  cleanup: Array<() => Promise<void>>;
}

/**
 * Test isolation strategies
 */
export type IsolationStrategy = 'none' | 'cleanup' | 'transaction' | 'reset';

export interface TestOptions {
  isolation: IsolationStrategy;
  useRealDatabase: boolean;
  authenticateAs?: 'owner' | 'admin' | 'technician' | 'technician_lead';
  skipDatabaseSetup?: boolean;
}

/**
 * Enhanced test context with database utilities
 */
export const test = baseTest.extend<TestContext>({
  db: async ({}, use) => {
    await use(testDb);
  },

  auth: async ({ page }, use) => {
    const auth = new AuthHelper(page);
    await use(auth);
  },

  factory: async ({ page }, use) => {
    const factory = new DataFactory(page);
    await use(factory);
  },

  scenarios: async ({ page }, use) => {
    const scenarios = new TestScenarios(page);
    await use(scenarios);
  },

  cleanup: async ({}, use) => {
    const cleanupTasks: Array<() => Promise<void>> = [];
    await use(cleanupTasks);
    
    // Execute cleanup tasks in reverse order
    for (const cleanup of cleanupTasks.reverse()) {
      try {
        await cleanup();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    }
  }
});

/**
 * Database isolation manager
 */
export class TestIsolation {
  private strategy: IsolationStrategy;
  private dbLifecycle: DatabaseLifecycle;
  private page: Page;
  private transaction?: DatabaseTransaction;
  private createdEntities: Array<{ type: string; id: string }> = [];

  constructor(page: Page, strategy: IsolationStrategy = 'cleanup') {
    this.page = page;
    this.strategy = strategy;
    this.dbLifecycle = new DatabaseLifecycle();
  }

  /**
   * Setup isolation before test
   */
  async setup(): Promise<void> {
    switch (this.strategy) {
      case 'reset':
        await this.dbLifecycle.beforeSuite();
        break;
      
      case 'transaction':
        this.transaction = new DatabaseTransaction();
        await this.transaction.begin();
        break;
      
      case 'cleanup':
        // Track entities for cleanup later
        this.createdEntities = [];
        break;
      
      case 'none':
      default:
        // No isolation
        break;
    }
  }

  /**
   * Cleanup isolation after test
   */
  async cleanup(): Promise<void> {
    switch (this.strategy) {
      case 'transaction':
        if (this.transaction) {
          await this.transaction.rollback();
        }
        break;
      
      case 'cleanup':
        await this.cleanupCreatedEntities();
        break;
      
      case 'reset':
        await this.dbLifecycle.afterSuite();
        break;
      
      case 'none':
      default:
        // No cleanup
        break;
    }
  }

  /**
   * Track entity for cleanup
   */
  trackEntity(type: string, id: string): void {
    if (this.strategy === 'cleanup') {
      this.createdEntities.push({ type, id });
    }
  }

  /**
   * Cleanup tracked entities
   */
  private async cleanupCreatedEntities(): Promise<void> {
    const factory = new DataFactory(this.page);
    
    for (const entity of this.createdEntities.reverse()) {
      try {
        await factory.deleteEntity(entity.type as any, entity.id);
      } catch (error) {
        console.warn(`Failed to cleanup ${entity.type}/${entity.id}:`, error);
      }
    }
    
    this.createdEntities = [];
  }
}

/**
 * Test configuration helper
 */
export class TestConfig {
  /**
   * Create test with specific options
   */
  static withOptions(options: Partial<TestOptions> = {}) {
    const config: TestOptions = {
      isolation: 'cleanup',
      useRealDatabase: getTestStrategy() !== 'mocked',
      ...options
    };

    return test.extend<{ testConfig: TestOptions; isolation: TestIsolation }>({
      testConfig: async ({}, use) => {
        await use(config);
      },

      isolation: async ({ page, testConfig }, use) => {
        if (!testConfig.useRealDatabase) {
          // No isolation needed for mocked tests
          await use(new TestIsolation(page, 'none'));
          return;
        }

        const isolation = new TestIsolation(page, testConfig.isolation);
        
        try {
          await isolation.setup();
          await use(isolation);
        } finally {
          await isolation.cleanup();
        }
      }
    });
  }

  /**
   * Create test with database reset before each test
   */
  static withDatabaseReset() {
    return this.withOptions({
      isolation: 'reset',
      useRealDatabase: true
    });
  }

  /**
   * Create test with transaction isolation
   */
  static withTransactionIsolation() {
    return this.withOptions({
      isolation: 'transaction',
      useRealDatabase: true
    });
  }

  /**
   * Create test with entity cleanup
   */
  static withCleanup() {
    return this.withOptions({
      isolation: 'cleanup',
      useRealDatabase: true
    });
  }

  /**
   * Create test with authentication
   */
  static withAuth(role: TestOptions['authenticateAs'] = 'admin') {
    return this.withOptions({
      authenticateAs: role,
      useRealDatabase: true
    });
  }

  /**
   * Create test using mocked APIs (default behavior)
   */
  static withMocks() {
    return this.withOptions({
      useRealDatabase: false,
      isolation: 'none'
    });
  }
}

/**
 * Specialized test creators for common patterns
 */
export const testWithRealDB = TestConfig.withCleanup();
export const testWithAuth = TestConfig.withAuth();
export const testWithReset = TestConfig.withDatabaseReset();
export const testWithTransaction = TestConfig.withTransactionIsolation();
export const testWithMocks = TestConfig.withMocks();

/**
 * Test lifecycle hooks for database management
 */
export class TestLifecycle {
  private static dbLifecycle: DatabaseLifecycle | null = null;

  /**
   * Setup database before all tests
   */
  static async setupSuite(): Promise<void> {
    if (getTestStrategy() === 'mocked') {
      console.log('🎭 Using mocked API responses for tests');
      return;
    }

    console.log('🔄 Setting up test database for frontend tests...');
    
    this.dbLifecycle = new DatabaseLifecycle();
    await this.dbLifecycle.beforeSuite();
    
    console.log('✅ Test database ready for frontend tests');
  }

  /**
   * Cleanup after all tests
   */
  static async teardownSuite(): Promise<void> {
    if (this.dbLifecycle) {
      await this.dbLifecycle.afterSuite();
    }
  }

  /**
   * Reset database to clean state
   */
  static async resetDatabase(): Promise<void> {
    if (getTestStrategy() === 'mocked') {
      return;
    }

    await testDb.setupCleanState();
  }
}

/**
 * Conditional test helpers based on strategy
 */
export function skipIfMocked(testFn: () => void): void {
  if (getTestStrategy() === 'mocked') {
    test.skip('Skipped - using mocked APIs', testFn);
  } else {
    testFn();
  }
}

export function skipIfRealDB(testFn: () => void): void {
  if (getTestStrategy() !== 'mocked') {
    test.skip('Skipped - using real database', testFn);
  } else {
    testFn();
  }
}

export function runOnlyWith(strategy: 'mocked' | 'real_db', testFn: () => void): void {
  const currentStrategy = getTestStrategy();
  const shouldRun = (strategy === 'mocked' && currentStrategy === 'mocked') ||
                   (strategy === 'real_db' && currentStrategy !== 'mocked');

  if (shouldRun) {
    testFn();
  } else {
    test.skip(`Skipped - requires ${strategy} strategy`, testFn);
  }
}

/**
 * Test environment detection
 */
export function isUsingRealDatabase(): boolean {
  return getTestStrategy() !== 'mocked';
}

export function isUsingMocks(): boolean {
  return getTestStrategy() === 'mocked';
}

/**
 * Debug utilities for tests
 */
export class TestDebug {
  /**
   * Log test environment info
   */
  static logEnvironment(): void {
    const strategy = getTestStrategy();
    const dbUrl = testDb.getRailsUrl();
    
    console.log('\n🧪 Test Environment:');
    console.log(`   Strategy: ${strategy}`);
    console.log(`   Database: ${isUsingRealDatabase() ? 'Real DB' : 'Mocked APIs'}`);
    console.log(`   Rails URL: ${dbUrl}`);
    console.log('');
  }

  /**
   * Take screenshot with test context
   */
  static async screenshot(page: Page, name: string): Promise<void> {
    if (process.env.DEBUG === 'true') {
      await page.screenshot({ 
        path: `test-results/${name}-${Date.now()}.png`,
        fullPage: true 
      });
    }
  }

  /**
   * Log test data state
   */
  static async logDatabaseState(page: Page): Promise<void> {
    if (!isUsingRealDatabase()) {
      console.log('📊 Database State: Using mocked data');
      return;
    }

    try {
      const verification = await testDb.verifyTestData();
      console.log(`📊 Database State: ${verification.message}`);
    } catch (error) {
      console.log(`📊 Database State: Error checking - ${error}`);
    }
  }
}