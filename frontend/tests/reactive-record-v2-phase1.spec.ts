/**
 * Integration tests for ReactiveRecord v2 Phase 1 implementation
 * 
 * Tests the core coordinator functionality and factory integration
 * in a real browser environment.
 */

import { test, expect } from '@playwright/test';

test.describe('ReactiveRecord v2 Phase 1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for authentication and initial setup
    await page.waitForSelector('[data-testid="authenticated"]', { 
      timeout: 10000 
    });
  });
  
  test('should create ReactiveCoordinator with proper state transitions', async ({ page }) => {
    // Test the coordinator in browser console
    const result = await page.evaluate(async () => {
      // Import the reactive module
      const { createReactiveCoordinator } = await import('/src/lib/reactive/coordinator.ts');
      
      // Create a mock query for testing
      class MockQuery {
        constructor() {
          this.subscribers = [];
          this.mockData = null;
          this.mockIsLoading = true;
          this.mockError = null;
          this.isDestroyed = false;
        }
        
        get data() { return this.mockData; }
        get isLoading() { return this.mockIsLoading; }
        get error() { return this.mockError; }
        get resultType() { return 'loading'; }
        get isCollection() { return false; }
        get present() { return this.mockData !== null; }
        get blank() { return this.mockData === null; }
        
        subscribe(callback) {
          this.subscribers.push(callback);
          callback(this.mockData, { 
            isLoading: this.mockIsLoading, 
            error: this.mockError 
          });
          
          return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
              this.subscribers.splice(index, 1);
            }
          };
        }
        
        async refresh() {}
        
        destroy() {
          this.isDestroyed = true;
          this.subscribers = [];
        }
        
        simulateDataChange(data, isLoading = false, error = null) {
          this.mockData = data;
          this.mockIsLoading = isLoading;
          this.mockError = error;
          
          this.subscribers.forEach(callback => {
            callback(data, { isLoading, error });
          });
        }
      }
      
      const mockQuery = new MockQuery();
      const coordinator = createReactiveCoordinator(mockQuery);
      
      // Test initial state
      const initialState = coordinator.visualState;
      const results = {
        initialState: initialState.state,
        shouldShowLoading: initialState.shouldShowLoading,
        isInitialLoad: initialState.isInitialLoad
      };
      
      // Simulate data arriving
      mockQuery.simulateDataChange('test data', false);
      
      const finalState = coordinator.visualState;
      results.finalState = finalState.state;
      results.displayData = finalState.displayData;
      results.shouldShowLoadingAfter = finalState.shouldShowLoading;
      
      // Clean up
      coordinator.destroy();
      
      return results;
    });
    
    // Verify the coordinator works correctly
    expect(result.initialState).toBe('initializing');
    expect(result.shouldShowLoading).toBe(true);
    expect(result.isInitialLoad).toBe(true);
    expect(result.finalState).toBe('ready');
    expect(result.displayData).toBe('test data');
    expect(result.shouldShowLoadingAfter).toBe(false);
  });
  
  test('should create enhanced ReactiveRecord with factory', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Import the factory
        const { ReactiveRecordFactory } = await import('/src/lib/reactive/factory.ts');
        
        // Create an enhanced reactive record
        const ReactiveTest = ReactiveRecordFactory.create({
          tableName: 'test_table',
          className: 'TestModel'
        });
        
        // Verify it has the expected methods
        const methods = {
          hasFind: typeof ReactiveTest.find === 'function',
          hasFindBy: typeof ReactiveTest.findBy === 'function',
          hasAll: typeof ReactiveTest.all === 'function',
          hasWhere: typeof ReactiveTest.where === 'function',
          hasKept: typeof ReactiveTest.kept === 'function'
        };
        
        return { success: true, methods };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.methods.hasFind).toBe(true);
    expect(result.methods.hasFindBy).toBe(true);
    expect(result.methods.hasAll).toBe(true);
    expect(result.methods.hasWhere).toBe(true);
    expect(result.methods.hasKept).toBe(true);
  });
  
  test('should support different factory contexts', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const { ReactiveRecordFactory } = await import('/src/lib/reactive/factory.ts');
        
        // Test different factory methods
        const standard = ReactiveRecordFactory.create({
          tableName: 'test',
          className: 'Test'
        });
        
        const navigation = ReactiveRecordFactory.createForNavigation({
          tableName: 'test',
          className: 'Test'
        });
        
        const initialLoad = ReactiveRecordFactory.createForInitialLoad({
          tableName: 'test',
          className: 'Test'
        });
        
        return {
          success: true,
          hasStandard: !!standard,
          hasNavigation: !!navigation,
          hasInitialLoad: !!initialLoad
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.hasStandard).toBe(true);
    expect(result.hasNavigation).toBe(true);
    expect(result.hasInitialLoad).toBe(true);
  });
  
  test('should preserve backward compatibility', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Test that enhanced queries maintain the same API
        const { ReactiveRecordFactory } = await import('/src/lib/reactive/factory.ts');
        
        const ReactiveTest = ReactiveRecordFactory.create({
          tableName: 'test_table',
          className: 'TestModel'
        });
        
        // Test chaining API (same as original)
        const query = ReactiveTest.kept().where({ status: 'active' }).orderBy('created_at', 'desc');
        
        // Should have all the expected methods
        const hasTerminalMethods = {
          hasAll: typeof query.all === 'function',
          hasFirst: typeof query.first === 'function',
          hasLast: typeof query.last === 'function',
          hasCount: typeof query.count === 'function',
          hasExists: typeof query.exists === 'function'
        };
        
        return { success: true, hasTerminalMethods };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.hasTerminalMethods.hasAll).toBe(true);
    expect(result.hasTerminalMethods.hasFirst).toBe(true);
    expect(result.hasTerminalMethods.hasLast).toBe(true);
    expect(result.hasTerminalMethods.hasCount).toBe(true);
    expect(result.hasTerminalMethods.hasExists).toBe(true);
  });
  
  test('should support integration utilities', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const { withCoordinator, ReactiveQueryFactory, TypeGuards } = await import('/src/lib/reactive/integration.ts');
        
        // Test utilities are available
        return {
          success: true,
          hasWithCoordinator: typeof withCoordinator === 'function',
          hasReactiveQueryFactory: !!ReactiveQueryFactory,
          hasTypeGuards: !!TypeGuards
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.hasWithCoordinator).toBe(true);
    expect(result.hasReactiveQueryFactory).toBe(true);
    expect(result.hasTypeGuards).toBe(true);
  });
  
  test('should export all Phase 1 components from index', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        const reactiveModule = await import('/src/lib/reactive/index.ts');
        
        return {
          success: true,
          hasReactiveCoordinator: !!reactiveModule.ReactiveCoordinator,
          hasReactiveRecordFactory: !!reactiveModule.ReactiveRecordFactory,
          hasReactiveQueryFactory: !!reactiveModule.ReactiveQueryFactory,
          hasQuickStart: !!reactiveModule.QuickStart,
          hasMigrationGuide: !!reactiveModule.MigrationGuide
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.hasReactiveCoordinator).toBe(true);
    expect(result.hasReactiveRecordFactory).toBe(true);
    expect(result.hasReactiveQueryFactory).toBe(true);
    expect(result.hasQuickStart).toBe(true);
    expect(result.hasMigrationGuide).toBe(true);
  });
});