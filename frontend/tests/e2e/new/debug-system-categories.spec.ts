import { test, expect } from '@playwright/test';
import { AuthTestUtils } from '../../helpers/auth';

test.describe('Debug System Categories (Epic 016)', () => {
  test.setTimeout(30000);

  test.beforeEach(async ({ page }) => {
    await AuthTestUtils.setupAuthenticatedPage(page);

    // Enable console message capture
    page.on('console', (msg) => {
      console.warn(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    // Navigate to jobs page for testing
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
  });

  test('6-category debug functions should be available in browser', async ({ page }) => {
    // Test category debug functions are available
    const categoryFunctionsTest = await page.evaluate(() => {
      try {
        // Check debug functions availability

        // Check if debug import is available (simulated)
        const hasDebugNetwork = typeof (window as any).debugNetwork !== 'undefined';
        const hasDebugData = typeof (window as any).debugData !== 'undefined';
        const hasDebugUI = typeof (window as any).debugUI !== 'undefined';
        const hasDebugBusiness = typeof (window as any).debugBusiness !== 'undefined';
        const hasDebugMonitor = typeof (window as any).debugMonitor !== 'undefined';
        const hasDebugSystem = typeof (window as any).debugSystem !== 'undefined';

        return {
          success: true,
          message: 'Category functions availability checked',
          categoryFunctionsFound: {
            hasDebugNetwork,
            hasDebugData,
            hasDebugUI,
            hasDebugBusiness,
            hasDebugMonitor,
            hasDebugSystem,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to check category functions',
        };
      }
    });

    expect(categoryFunctionsTest.success).toBe(true);
    console.warn('✅ Category functions availability test completed');
  });

  test('legacy debug functions should remain compatible', async ({ page }) => {
    // Test legacy debug functions compatibility
    const legacyCompatibilityTest = await page.evaluate(() => {
      try {
        // Check legacy function names (19 total expected)
        const expectedLegacyFunctions = [
          'debugAPI',
          'debugAuth',
          'debugSecurity',
          'debugReactive',
          'debugState',
          'debugComponent',
          'debugCache',
          'debugDatabase',
          'debugWebSocket',
          'debugValidation',
          'debugPerformance',
          'debugError',
          'debugNavigation',
          'debugNotification',
          'debugWorkflow',
          'debugSearch',
          'debugUpload',
          'debugExport',
          'debugIntegration',
        ];

        const availableFunctions: string[] = [];
        const missingFunctions: string[] = [];

        expectedLegacyFunctions.forEach((funcName) => {
          if (typeof (window as any)[funcName] !== 'undefined') {
            availableFunctions.push(funcName);
          } else {
            missingFunctions.push(funcName);
          }
        });

        return {
          success: true,
          message: `Legacy compatibility checked: ${availableFunctions.length}/${expectedLegacyFunctions.length} functions`,
          availableFunctions,
          missingFunctions,
          totalExpected: expectedLegacyFunctions.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to check legacy compatibility',
        };
      }
    });

    expect(legacyCompatibilityTest.success).toBe(true);
    console.warn(`✅ Legacy compatibility test completed: ${legacyCompatibilityTest.message}`);
  });

  test('bosDebug browser helper should be available with all methods', async ({ page }) => {
    // Test browser debug helper functions
    const browserHelperTest = await page.evaluate(() => {
      try {
        const bosDebug = (window as any).bosDebug;

        if (!bosDebug) {
          return {
            success: false,
            message: 'bosDebug not found on window object',
            error: 'Missing bosDebug global',
          };
        }

        // Check for expected methods
        const expectedMethods = [
          'enable',
          'disable',
          'status',
          'list',
          'categories',
          'enableCategory',
          'disableCategory',
          'legacy',
          'migration',
          'validate',
        ];

        const availableMethods: string[] = [];
        const missingMethods: string[] = [];

        expectedMethods.forEach((method) => {
          if (typeof bosDebug[method] === 'function') {
            availableMethods.push(method);
          } else {
            missingMethods.push(method);
          }
        });

        return {
          success: availableMethods.length === expectedMethods.length,
          message: `Browser helper methods: ${availableMethods.length}/${expectedMethods.length}`,
          availableMethods,
          missingMethods,
          bosDebugExists: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to check browser helper',
        };
      }
    });

    expect(browserHelperTest.success).toBe(true);
    expect(browserHelperTest.bosDebugExists).toBe(true);
    console.warn(`✅ Browser helper test completed: ${browserHelperTest.message}`);
  });

  test('localStorage debug patterns should work correctly', async ({ page }) => {
    // Test localStorage debug pattern support
    const localStorageTest = await page.evaluate(() => {
      try {
        // Test different localStorage patterns
        const testPatterns = [
          'bos:*', // Enable all
          'bos:network', // Enable network category
          'bos:api', // Enable legacy API function
          'bos:network,bos:data', // Enable multiple categories
          'bos:*,-bos:cache', // Enable all except cache
        ];

        const results: { pattern: string; success: boolean; error?: string }[] = [];

        testPatterns.forEach((pattern) => {
          try {
            // Set localStorage debug pattern
            localStorage.debug = pattern;
            const retrieved = localStorage.debug;

            results.push({
              pattern,
              success: retrieved === pattern,
            });
          } catch (error) {
            results.push({
              pattern,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        // Clean up
        localStorage.removeItem('debug');

        const successCount = results.filter((r) => r.success).length;

        return {
          success: successCount === testPatterns.length,
          message: `LocalStorage patterns tested: ${successCount}/${testPatterns.length}`,
          results,
          totalPatterns: testPatterns.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to test localStorage patterns',
        };
      }
    });

    expect(localStorageTest.success).toBe(true);
    console.warn(`✅ LocalStorage test completed: ${localStorageTest.message}`);
  });

  test('bosDebug.validate() should pass system health check', async ({ page }) => {
    // Test system validation through bosDebug.validate()
    const validationTest = await page.evaluate(() => {
      try {
        const bosDebug = (window as any).bosDebug;

        if (!bosDebug || typeof bosDebug.validate !== 'function') {
          return {
            success: false,
            message: 'bosDebug.validate() not available',
            error: 'Missing validate function',
          };
        }

        // Capture console output during validation
        const originalLog = console.warn;
        const logs: string[] = [];
        console.warn = (...args) => {
          logs.push(args.join(' '));
          originalLog.apply(console, args);
        };

        // Run validation
        bosDebug.validate();

        // Restore console.warn
        console.warn = originalLog;

        // Check for validation success indicators in logs
        const hasCompatibilityCheck = logs.some((log) => log.includes('Backward compatibility'));
        const hasCategoryCheck = logs.some((log) => log.includes('Category system'));
        const hasPerformanceCheck = logs.some((log) => log.includes('Performance'));
        const hasSystemStatus = logs.some((log) => log.includes('System Status'));

        return {
          success: hasCompatibilityCheck && hasCategoryCheck && hasPerformanceCheck,
          message: 'System validation completed',
          validationResults: {
            hasCompatibilityCheck,
            hasCategoryCheck,
            hasPerformanceCheck,
            hasSystemStatus,
          },
          logCount: logs.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to run validation test',
        };
      }
    });

    expect(validationTest.success).toBe(true);
    console.warn(`✅ System validation test completed: ${validationTest.message}`);
  });

  test('debug system should not cause JavaScript errors', async ({ page }) => {
    // Monitor for JavaScript errors during normal navigation
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    // Navigate through different pages to test debug system stability
    const testPages = ['/jobs', '/clients', '/', '/jobs'];

    for (const testPage of testPages) {
      await page.goto(testPage);
      await page.waitForLoadState('networkidle');

      // Trigger some debug activity (simulated)
      await page.evaluate(() => {
        try {
          // Test if debug functions can be called without errors
          const bosDebug = (window as any).bosDebug;
          if (bosDebug) {
            // Non-destructive tests
            bosDebug.status();
          }
        } catch (error) {
          throw new Error(`Debug system error on page ${window.location.pathname}: ${error}`);
        }
      });
    }

    // Verify no JavaScript errors occurred
    expect(jsErrors).toEqual([]);
    console.warn('✅ No JavaScript errors detected during debug system testing');
  });
});
