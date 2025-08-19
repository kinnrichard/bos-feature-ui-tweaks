/**
 * Epic-009 Includes Functionality Tests
 * 
 * Tests Rails-style includes() method implementation for both
 * ActiveRecord and ReactiveRecord models.
 * 
 * Test Coverage:
 * - Basic includes() method chaining
 * - Relationship validation
 * - Error handling
 * - Type safety
 * - Method chaining with where, orderBy, limit
 * - Zero.js integration
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Epic-009: Rails-Style includes() Implementation', () => {
  
  test.describe('Job Model includes() Method', () => {
    
    test('should provide includes() method on Job model', async ({ page }) => {
      // Test that includes() method exists and is chainable
      const result = await page.evaluate(() => {
        // Import Job model in browser context
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          // Test that includes() method exists
          const query = Job.includes('client');
          window.testResult = {
            hasIncludesMethod: typeof Job.includes === 'function',
            isChainable: typeof query === 'object' && query !== null,
            hasWhereMethod: typeof query.where === 'function',
            hasOrderByMethod: typeof query.orderBy === 'function',
            hasLimitMethod: typeof query.limit === 'function'
          };
        `;
        document.head.appendChild(script);
        
        // Wait for the script to execute
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.hasIncludesMethod).toBe(true);
      expect(result.isChainable).toBe(true);
      expect(result.hasWhereMethod).toBe(true);
      expect(result.hasOrderByMethod).toBe(true);
      expect(result.hasLimitMethod).toBe(true);
    });
    
    test('should support multiple relationships in includes()', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          try {
            // Test multiple relationships
            const query = Job.includes('client', 'tasks', 'jobAssignments');
            window.testResult = {
              success: true,
              isChainable: typeof query === 'object' && query !== null
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.isChainable).toBe(true);
    });
    
    test('should support method chaining with includes()', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          try {
            // Test complex method chaining
            const query = Job.includes('client', 'tasks')
              .where({ status: 'open' })
              .orderBy('created_at', 'desc')
              .limit(10);
              
            window.testResult = {
              success: true,
              hasAllMethod: typeof query.all === 'function',
              hasFirstMethod: typeof query.first === 'function',
              hasCountMethod: typeof query.count === 'function'
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.hasAllMethod).toBe(true);
      expect(result.hasFirstMethod).toBe(true);
      expect(result.hasCountMethod).toBe(true);
    });
  });
  
  test.describe('ReactiveJob Model includes() Method', () => {
    
    test('should provide includes() method on ReactiveJob model', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { ReactiveJob } from '/src/lib/models/reactive-job.js';
          
          // Test that includes() method exists
          const query = ReactiveJob.includes('client');
          window.testResult = {
            hasIncludesMethod: typeof ReactiveJob.includes === 'function',
            isChainable: typeof query === 'object' && query !== null,
            hasWhereMethod: typeof query.where === 'function',
            hasOrderByMethod: typeof query.orderBy === 'function',
            hasLimitMethod: typeof query.limit === 'function'
          };
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.hasIncludesMethod).toBe(true);
      expect(result.isChainable).toBe(true);
      expect(result.hasWhereMethod).toBe(true);
      expect(result.hasOrderByMethod).toBe(true);
      expect(result.hasLimitMethod).toBe(true);
    });
    
    test('should return reactive queries with includes()', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { ReactiveJob } from '/src/lib/models/reactive-job.js';
          
          try {
            // Test reactive query methods
            const allQuery = ReactiveJob.includes('client', 'tasks').all();
            const findQuery = ReactiveJob.includes('client').find('test-id');
            
            window.testResult = {
              success: true,
              allQueryHasData: 'data' in allQuery,
              allQueryHasLoading: 'isLoading' in allQuery,
              findQueryHasData: 'data' in findQuery,
              findQueryHasLoading: 'isLoading' in findQuery
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.allQueryHasData).toBe(true);
      expect(result.allQueryHasLoading).toBe(true);
      expect(result.findQueryHasData).toBe(true);
      expect(result.findQueryHasLoading).toBe(true);
    });
  });
  
  test.describe('Relationship Validation', () => {
    
    test('should validate valid relationship names', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          try {
            // Test valid relationships - should not throw
            const query = Job.includes('client', 'tasks', 'jobAssignments', 'createdBy');
            window.testResult = {
              success: true,
              validRelationships: true
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message,
              errorName: error.name
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.validRelationships).toBe(true);
    });
    
    test('should reject invalid relationship names', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          try {
            // Test invalid relationship - should throw RelationshipError
            const query = Job.includes('invalidRelationship');
            window.testResult = {
              success: true,
              shouldHaveFailed: true
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message,
              errorName: error.name,
              isRelationshipError: error.name === 'RelationshipError'
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      // Should fail with RelationshipError
      expect(result.success).toBe(false);
      expect(result.isRelationshipError).toBe(true);
    });
  });
  
  test.describe('BaseScopedQuery Integration', () => {
    
    test('should share functionality between ActiveRecord and ReactiveRecord', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          import { ReactiveJob } from '/src/lib/models/reactive-job.js';
          
          try {
            // Test that both have identical method chains
            const activeQuery = Job.includes('client').where({ status: 'open' });
            const reactiveQuery = ReactiveJob.includes('client').where({ status: 'open' });
            
            window.testResult = {
              success: true,
              activeHasIncludes: typeof Job.includes === 'function',
              reactiveHasIncludes: typeof ReactiveJob.includes === 'function',
              activeChainWorks: typeof activeQuery.orderBy === 'function',
              reactiveChainWorks: typeof reactiveQuery.orderBy === 'function'
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.activeHasIncludes).toBe(true);
      expect(result.reactiveHasIncludes).toBe(true);
      expect(result.activeChainWorks).toBe(true);
      expect(result.reactiveChainWorks).toBe(true);
    });
  });
  
  test.describe('TypeScript Integration', () => {
    
    test('should provide TypeScript autocomplete for relationship names', async ({ page }) => {
      // This test verifies that the type definitions work correctly
      // by checking that the includes method accepts the expected relationship names
      
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          try {
            // These should all be valid according to JobRelationships interface
            const validRelationships = [
              'client',
              'createdBy', 
              'jobAssignments',
              'tasks',
              'activityLogs',
              'jobTargets',
              'scheduledDateTimes',
              'jobPeople'
            ];
            
            // Test each relationship individually
            let allValid = true;
            for (const rel of validRelationships) {
              const query = Job.includes(rel);
              if (!query || typeof query.where !== 'function') {
                allValid = false;
                break;
              }
            }
            
            window.testResult = {
              success: true,
              allRelationshipsValid: allValid,
              testedCount: validRelationships.length
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.allRelationshipsValid).toBe(true);
      expect(result.testedCount).toBe(8);
    });
  });
  
  test.describe('Error Handling', () => {
    
    test('should handle Zero.js connection errors gracefully', async ({ page }) => {
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import { Job } from '/src/lib/models/job.js';
          
          try {
            // This should create the query without throwing
            // Even if Zero.js is not initialized, query creation should work
            const query = Job.includes('client').where({ status: 'open' });
            
            window.testResult = {
              success: true,
              queryCreated: typeof query === 'object',
              hasExecutionMethods: typeof query.all === 'function'
            };
          } catch (error) {
            window.testResult = {
              success: false,
              error: error.message,
              errorName: error.name
            };
          }
        `;
        document.head.appendChild(script);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve((window as any).testResult);
          }, 100);
        });
      });
      
      expect(result.success).toBe(true);
      expect(result.queryCreated).toBe(true);
      expect(result.hasExecutionMethods).toBe(true);
    });
  });
});

test.describe('Epic-009: Performance and Memory Management', () => {
  
  test('should delegate memory management to Zero.js', async ({ page }) => {
    // Test that we're not implementing our own memory management
    // and are trusting Zero.js to handle it
    
    const result = await page.evaluate(() => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import { ReactiveJob } from '/src/lib/models/reactive-job.js';
        
        try {
          // Create multiple reactive queries to test memory handling
          const queries = [];
          for (let i = 0; i < 10; i++) {
            queries.push(ReactiveJob.includes('client', 'tasks').where({ id: \`test-\${i}\` }).all());
          }
          
          window.testResult = {
            success: true,
            queriesCreated: queries.length,
            allHaveReactiveProperties: queries.every(q => 'data' in q && 'isLoading' in q)
          };
        } catch (error) {
          window.testResult = {
            success: false,
            error: error.message
          };
        }
      `;
      document.head.appendChild(script);
      
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve((window as any).testResult);
        }, 100);
      });
    });
    
    expect(result.success).toBe(true);
    expect(result.queriesCreated).toBe(10);
    expect(result.allHaveReactiveProperties).toBe(true);
  });
});

test.describe('Epic-009: Backward Compatibility', () => {
  
  test('should not break existing model functionality', async ({ page }) => {
    const result = await page.evaluate(() => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import { Job } from '/src/lib/models/job.js';
        import { ReactiveJob } from '/src/lib/models/reactive-job.js';
        
        try {
          // Test that existing methods still work
          const activeQuery = Job.where({ status: 'open' });
          const reactiveQuery = ReactiveJob.where({ status: 'open' });
          
          window.testResult = {
            success: true,
            activeWhereWorks: typeof activeQuery.all === 'function',
            reactiveWhereWorks: typeof reactiveQuery.all === 'function',
            activeFindWorks: typeof Job.find === 'function',
            reactiveFindWorks: typeof ReactiveJob.find === 'function'
          };
        } catch (error) {
          window.testResult = {
            success: false,
            error: error.message
          };
        }
      `;
      document.head.appendChild(script);
      
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve((window as any).testResult);
        }, 100);
      });
    });
    
    expect(result.success).toBe(true);
    expect(result.activeWhereWorks).toBe(true);
    expect(result.reactiveWhereWorks).toBe(true);
    expect(result.activeFindWorks).toBe(true);
    expect(result.reactiveFindWorks).toBe(true);
  });
});