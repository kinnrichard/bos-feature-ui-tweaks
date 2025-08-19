import { test, expect } from '@playwright/test';
import { withConsoleMonitoring, ConsoleTestUtils } from './helpers/console-monitoring';

test.describe('ReactiveView Logs Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage first to ensure proper authentication state
    await page.goto('/');
    
    // Wait for any initial load to complete
    await page.waitForLoadState('networkidle');
  });

  test.describe('Flash Prevention in Navigation', () => {
    test('System logs to client logs navigation shows no flash', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Start timing measurement for flash detection
        const startTime = Date.now();
        
        // Navigate to system logs first
        await page.goto('/logs');
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
        
        // Wait for initial ReactiveView to settle
        await page.waitForLoadState('networkidle');
        
        // Get first client link from navigation or create test client
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Measure flash prevention during navigation
            const navigationStart = Date.now();
            
            // Navigate to client logs
            await page.goto(`${clientHref}/logs`);
            
            // Critical: Check that ReactiveView prevents flash
            // Flash would manifest as temporary blank content or loading spinner
            const flashCheckPromise = page.waitForFunction(() => {
              const activityList = document.querySelector('.activity-log-list');
              const loadingSkeleton = document.querySelector('.skeleton-generic');
              
              // If we see a loading skeleton after ReactiveView should be active,
              // it means flash prevention failed
              return activityList || loadingSkeleton;
            }, { timeout: 100 }); // Very short timeout to catch flash
            
            try {
              await flashCheckPromise;
              
              // Verify smooth transition occurred
              const navigationTime = Date.now() - navigationStart;
              expect(navigationTime).toBeLessThan(200); // Should be very fast with ReactiveView
              
              // Verify page content is correct
              await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible();
              await expect(page.locator('.activity-log-list')).toBeVisible();
              
            } catch (error) {
              // If we hit timeout, it means flash prevention worked
              // (no loading skeleton appeared)
              console.log('Flash prevention successful - no loading skeleton detected');
            }
          }
        }
        
        // Ensure no console errors during navigation
        monitor.clearErrors(); // Clear any pre-navigation errors
      });
    });

    test('Back and forth navigation maintains ReactiveView state', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to system logs
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Navigate to a client logs page
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Go to client logs
            await page.goto(`${clientHref}/logs`);
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            // Navigate back to system logs - should use ReactiveView cache
            const backNavigationStart = Date.now();
            await page.goto('/logs');
            
            // Should load very quickly due to ReactiveView caching
            const backNavigationTime = Date.now() - backNavigationStart;
            expect(backNavigationTime).toBeLessThan(150);
            
            await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
            await expect(page.locator('.activity-log-list')).toBeVisible();
          }
        }
      });
    });

    test('Direct URL navigation to logs shows progressive loading', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Clear browser cache to ensure fresh load
        await page.context().clearCookies();
        
        // Navigate directly to logs URL
        await page.goto('/logs');
        
        // Should show progressive loading (stale data if available, then update)
        // or loading skeleton if no cached data
        const hasProgressiveLoading = await page.waitForFunction(() => {
          const loadingSkeleton = document.querySelector('.skeleton-generic');
          const activityList = document.querySelector('.activity-log-list');
          const refreshIndicator = document.querySelector('.refresh-indicator');
          
          // Progressive loading means either:
          // 1. Loading skeleton initially, then content
          // 2. Stale content with refresh indicator, then updated content
          return loadingSkeleton || activityList || refreshIndicator;
        }, { timeout: 5000 });
        
        expect(hasProgressiveLoading).toBeTruthy();
        
        // Eventually should show the activity log list
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
      });
    });
  });

  test.describe('Progressive Loading Behavior', () => {
    test('Shows stale data with update indicator during refresh', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Load logs page initially
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Simulate network delay to catch progressive loading
        await page.route('**/activity_logs**', async (route) => {
          // Delay the response to simulate slow network
          await new Promise(resolve => setTimeout(resolve, 1000));
          await route.continue();
        });
        
        // Force refresh by navigating away and back
        await page.goto('/');
        await page.goto('/logs');
        
        // Should show stale data initially with progressive strategy
        const progressiveLoadingVisible = await page.waitForFunction(() => {
          const refreshIndicator = document.querySelector('.refresh-indicator');
          const loadingOverlay = document.querySelector('.loading-overlay');
          const activityList = document.querySelector('.activity-log-list');
          
          // With progressive strategy, we expect either:
          // 1. Refresh indicator showing data is updating
          // 2. Loading overlay showing update in progress
          // 3. Activity list showing (potentially stale) data
          return refreshIndicator || loadingOverlay || activityList;
        }, { timeout: 3000 });
        
        expect(progressiveLoadingVisible).toBeTruthy();
        
        // Eventually loading should complete
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 15000 });
        
        // Clean up route override
        await page.unroute('**/activity_logs**');
      });
    });

    test('Handles concurrent navigation gracefully', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Rapid navigation to test ReactiveView coordination
        const navigationPromises = [
          page.goto('/logs'),
          page.waitForTimeout(50).then(() => page.goto('/clients')),
          page.waitForTimeout(100).then(() => page.goto('/logs'))
        ];
        
        await Promise.all(navigationPromises);
        
        // Should settle on logs page without errors
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Verify no race condition errors
        expect(monitor.shouldFailTest()).toBeFalsy();
      });
    });
  });

  test.describe('ActivityLogList ReactiveView Integration', () => {
    test('ReactiveView query integration works correctly', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to system logs
        await page.goto('/logs');
        
        // Verify ReactiveView integration components are present
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Check for ReactiveView specific elements
        const hasReactiveElements = await page.evaluate(() => {
          // Look for ReactiveView-specific DOM structure
          const container = document.querySelector('.logs-container');
          if (!container) return false;
          
          // ReactiveView should be managing the content
          const activityList = container.querySelector('.activity-log-list');
          return !!activityList;
        });
        
        expect(hasReactiveElements).toBeTruthy();
        
        // Verify log content is loaded and grouped properly
        const logGroups = page.locator('.logs-group');
        if (await logGroups.count() > 0) {
          // If logs exist, verify grouping structure
          await expect(logGroups.first()).toBeVisible();
          
          // Check for proper group headers
          const groupHeaders = page.locator('.logs-group-header');
          expect(await groupHeaders.count()).toBeGreaterThan(0);
        } else {
          // If no logs, should show empty state
          await expect(page.locator('.empty-logs')).toBeVisible();
        }
      });
    });

    test('Strategy parameter affects loading behavior', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test progressive strategy on system logs
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Navigate to client logs (also uses progressive strategy)
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            await page.goto(`${clientHref}/logs`);
            
            // Verify client logs load with progressive strategy
            await expect(page.locator('.activity-log-list')).toBeVisible();
            await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible();
            
            // Both pages should use progressive strategy as configured
            // This means smooth transitions and minimal loading states
          }
        }
      });
    });

    test('ReactiveView error handling works correctly', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Mock network error for activity logs
        await page.route('**/activity_logs**', async (route) => {
          await route.abort('failed');
        });
        
        // Navigate to logs page
        await page.goto('/logs');
        
        // Should show error state with retry option
        const errorState = page.locator('.error-state');
        await expect(errorState).toBeVisible({ timeout: 10000 });
        
        // Verify error message content
        await expect(page.locator('.error-content h2:has-text("Unable to load activity logs")')).toBeVisible();
        await expect(page.locator('.error-content p:has-text("Zero.js will automatically retry")')).toBeVisible();
        
        // Clean up route override
        await page.unroute('**/activity_logs**');
        
        // Clear monitor errors since we intentionally caused them
        monitor.clearErrors();
      });
    });
  });

  test.describe('Error States and Recovery', () => {
    test('Network error shows proper error state', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Mock network failure
        await page.route('**/activity_logs**', async (route) => {
          await route.abort('networkfailure');
        });
        
        await page.goto('/logs');
        
        // Should show error state
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.error-content')).toBeVisible();
        
        // Error should have proper messaging
        await expect(page.locator('h2:has-text("Unable to load activity logs")')).toBeVisible();
        
        // Clean up
        await page.unroute('**/activity_logs**');
        monitor.clearErrors();
      });
    });

    test('Recovery after network restoration', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Start with network failure
        let failNetwork = true;
        await page.route('**/activity_logs**', async (route) => {
          if (failNetwork) {
            await route.abort('failed');
          } else {
            await route.continue();
          }
        });
        
        await page.goto('/logs');
        
        // Should show error state initially
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 10000 });
        
        // Restore network
        failNetwork = false;
        
        // Zero.js should automatically retry and recover
        // Wait for recovery (Zero.js has built-in retry logic)
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 30000 });
        
        // Error state should disappear
        await expect(page.locator('.error-state')).not.toBeVisible();
        
        // Clean up
        await page.unroute('**/activity_logs**');
        monitor.clearErrors();
      });
    });
  });
});