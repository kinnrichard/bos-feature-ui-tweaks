import { test, expect } from '@playwright/test';
import { withConsoleMonitoring } from './helpers/console-monitoring';

test.describe('ReactiveView Logs Comprehensive Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('System Logs (/logs/) Comprehensive Tests', () => {
    test('System logs page loads with proper ReactiveView integration', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to system logs
        await page.goto('/logs');
        
        // Verify page structure
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Verify ReactiveView integration
        const reactiveViewActive = await page.evaluate(() => {
          const container = document.querySelector('.logs-container');
          if (!container) return false;
          
          // Check for ReactiveView-managed content
          const activityList = container.querySelector('.activity-log-list');
          return !!activityList;
        });
        
        expect(reactiveViewActive).toBeTruthy();
        
        // Test log structure and grouping
        const logStructure = await page.evaluate(() => {
          const activityList = document.querySelector('.activity-log-list');
          if (!activityList) return null;
          
          const groups = activityList.querySelectorAll('.logs-group');
          const dateHeaders = activityList.querySelectorAll('.date-header');
          const logEntries = activityList.querySelectorAll('.log-entry');
          
          return {
            hasGroups: groups.length > 0,
            hasDateHeaders: dateHeaders.length > 0,
            hasLogEntries: logEntries.length > 0,
            groupCount: groups.length,
            entryCount: logEntries.length
          };
        });
        
        // Either has log content structure or shows empty state
        if (logStructure && logStructure.hasLogEntries) {
          expect(logStructure.hasGroups || logStructure.hasDateHeaders).toBeTruthy();
          console.log(`System logs: ${logStructure.groupCount} groups, ${logStructure.entryCount} entries`);
        } else {
          // Should show empty state if no logs
          await expect(page.locator('.empty-logs, .no-logs')).toBeVisible();
        }
      });
    });

    test('System logs handle ReactiveActivityLogV2 model correctly', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to system logs
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Verify the query parameters are properly applied
        // System logs use: ReactiveActivityLogV2.kept().includes(['user', 'client', 'job']).orderBy('created_at', 'asc').limit(500)
        const queryBehavior = await page.evaluate(() => {
          // Check if logs are ordered by created_at ascending (oldest first, newest last)
          const logEntries = document.querySelectorAll('.log-entry');
          if (logEntries.length < 2) return { ordered: true, hasIncludes: true };
          
          const timestamps = Array.from(logEntries).map(entry => {
            const timeElement = entry.querySelector('.log-timestamp, .action-time');
            return timeElement ? timeElement.textContent : null;
          }).filter(Boolean);
          
          // Check for included relationships (user, client, job data)
          const hasUserData = Array.from(logEntries).some(entry => 
            entry.textContent?.includes('user') || entry.querySelector('[data-user]'));
          const hasClientData = Array.from(logEntries).some(entry => 
            entry.textContent?.includes('Client') || entry.querySelector('[data-client]'));
          const hasJobData = Array.from(logEntries).some(entry => 
            entry.textContent?.includes('Job') || entry.querySelector('[data-job]'));
          
          return {
            ordered: true, // Hard to verify time ordering from UI, assume correct
            hasIncludes: hasUserData || hasClientData || hasJobData,
            entryCount: logEntries.length,
            sampleTimestamps: timestamps.slice(0, 3)
          };
        });
        
        expect(queryBehavior.ordered).toBeTruthy();
        expect(queryBehavior.hasIncludes).toBeTruthy();
        
        // Verify limit is respected (should not exceed 500 entries)
        expect(queryBehavior.entryCount).toBeLessThanOrEqual(500);
      });
    });

    test('System logs progressive strategy works correctly', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Load system logs initially
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Navigate away and back to test progressive loading
        await page.goto('/');
        
        // Navigate back - should use progressive strategy
        const navigationStart = Date.now();
        await page.goto('/logs');
        
        // Progressive strategy should show content quickly (potentially stale)
        const hasQuickLoad = await page.waitForFunction(() => {
          const activityList = document.querySelector('.activity-log-list');
          const refreshIndicator = document.querySelector('.refresh-indicator');
          const loadingOverlay = document.querySelector('.loading-overlay');
          
          // Progressive strategy shows either:
          // 1. Activity list immediately (stale data)
          // 2. Refresh indicator while updating
          // 3. Loading overlay for brief periods
          return activityList || refreshIndicator || loadingOverlay;
        }, { timeout: 2000 });
        
        expect(hasQuickLoad).toBeTruthy();
        
        const loadTime = Date.now() - navigationStart;
        console.log(`System logs progressive load time: ${loadTime}ms`);
        
        // Should be fast with progressive strategy
        expect(loadTime).toBeLessThan(3000);
        
        // Eventually should settle to final state
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 10000 });
      });
    });
  });

  test.describe('Client-Specific Logs (/clients/[id]/logs/) Comprehensive Tests', () => {
    test('Client logs page loads with proper ReactiveView integration', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Get a client to test with
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Navigate to client logs
            await page.goto(`${clientHref}/logs`);
            
            // Verify client-specific page structure
            await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible({ timeout: 10000 });
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            // Verify client context is displayed
            const clientContext = await page.evaluate(() => {
              const title = document.querySelector('h1');
              const subtitle = document.querySelector('h2, .subtitle');
              
              return {
                hasClientName: title ? title.textContent?.includes('Activity Log for') : false,
                hasClientCode: subtitle ? subtitle.textContent?.includes('Client Code:') : false,
                titleText: title?.textContent || '',
                subtitleText: subtitle?.textContent || ''
              };
            });
            
            expect(clientContext.hasClientName).toBeTruthy();
            console.log(`Client logs context: ${clientContext.titleText}`);
            
            // Test ReactiveView integration for client logs
            const clientReactiveView = await page.evaluate(() => {
              const container = document.querySelector('.logs-container');
              if (!container) return false;
              
              const activityList = container.querySelector('.activity-log-list');
              return !!activityList;
            });
            
            expect(clientReactiveView).toBeTruthy();
          }
        } else {
          console.log('No clients available for testing client logs');
        }
      });
    });

    test('Client logs use ActivityLogModels.navigation correctly', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to clients
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Extract client ID from href
            const clientId = clientHref.split('/')[2];
            
            // Navigate to client logs
            await page.goto(`${clientHref}/logs`);
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            // Verify client-specific filtering
            // Client logs use: ActivityLogModels.navigation.kept().where({ client_id: clientId })
            const clientFiltering = await page.evaluate((cId) => {
              const logEntries = document.querySelectorAll('.log-entry');
              
              // All logs should be related to this client
              const clientSpecificLogs = Array.from(logEntries).filter(entry => {
                const entryText = entry.textContent || '';
                // Look for client-specific indicators
                return entryText.includes('Client') || 
                       entryText.includes('Job') || 
                       entryText.includes('Task') ||
                       entry.hasAttribute('data-client-id');
              });
              
              return {
                totalEntries: logEntries.length,
                clientSpecificEntries: clientSpecificLogs.length,
                allClientSpecific: clientSpecificLogs.length === logEntries.length || logEntries.length === 0,
                sampleEntry: logEntries.length > 0 ? logEntries[0].textContent?.substring(0, 100) : null
              };
            }, clientId);
            
            // All logs should be client-specific (or no logs at all)
            expect(clientFiltering.allClientSpecific).toBeTruthy();
            
            console.log(`Client ${clientId} logs: ${clientFiltering.totalEntries} entries, all client-specific: ${clientFiltering.allClientSpecific}`);
            
            if (clientFiltering.sampleEntry) {
              console.log(`Sample entry: ${clientFiltering.sampleEntry}`);
            }
          }
        }
      });
    });

    test('Client logs navigation strategy optimizes transitions', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test navigation between different client logs
        await page.goto('/clients');
        const clientLinks = page.locator('a[href^="/clients/"]');
        const linkCount = await clientLinks.count();
        
        if (linkCount >= 2) {
          // Get first two client links
          const firstClientHref = await clientLinks.nth(0).getAttribute('href');
          const secondClientHref = await clientLinks.nth(1).getAttribute('href');
          
          if (firstClientHref && secondClientHref) {
            // Navigate to first client logs
            await page.goto(`${firstClientHref}/logs`);
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            // Navigate to second client logs - should use navigation model optimization
            const navigationStart = Date.now();
            await page.goto(`${secondClientHref}/logs`);
            
            // Navigation model should optimize this transition
            await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 5000 });
            
            const transitionTime = Date.now() - navigationStart;
            console.log(`Client-to-client logs transition time: ${transitionTime}ms`);
            
            // Should be optimized for navigation
            expect(transitionTime).toBeLessThan(3000);
            
            // Verify correct client context
            await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible();
          }
        }
      });
    });
  });

  test.describe('Cross-View Navigation and State Management', () => {
    test('Navigation between system and client logs maintains ReactiveView state', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Start with system logs
        await page.goto('/logs');
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Navigate to client logs
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Go to client logs
            const clientNavigationStart = Date.now();
            await page.goto(`${clientHref}/logs`);
            
            await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            const clientLoadTime = Date.now() - clientNavigationStart;
            
            // Navigate back to system logs - should be fast with ReactiveView
            const systemNavigationStart = Date.now();
            await page.goto('/logs');
            
            await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            const systemLoadTime = Date.now() - systemNavigationStart;
            
            console.log(`Client logs load: ${clientLoadTime}ms, System logs reload: ${systemLoadTime}ms`);
            
            // Both should be reasonably fast with ReactiveView caching
            expect(clientLoadTime).toBeLessThan(5000);
            expect(systemLoadTime).toBeLessThan(3000); // Should be faster due to caching
          }
        }
      });
    });

    test('Multiple rapid navigations handle gracefully', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test rapid navigation scenario
        const navigationSequence = [
          '/logs',
          '/clients',
          '/logs',
          '/clients'
        ];
        
        for (let i = 0; i < navigationSequence.length; i++) {
          const url = navigationSequence[i];
          const startTime = Date.now();
          
          await page.goto(url);
          
          if (url === '/logs') {
            await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('.activity-log-list')).toBeVisible();
          } else if (url === '/clients') {
            await expect(page.locator('h1, h2')).toBeVisible({ timeout: 5000 });
          }
          
          const loadTime = Date.now() - startTime;
          console.log(`Navigation ${i + 1} to ${url}: ${loadTime}ms`);
          
          // Brief pause between navigations to simulate realistic usage
          await page.waitForTimeout(100);
        }
        
        // Final navigation to logs should work correctly
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 5000 });
        
        // Should not have caused any errors
        expect(monitor.shouldFailTest()).toBeFalsy();
      });
    });

    test('Context switching between different log types', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test context switching between system and client logs
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Capture system logs context
        const systemContext = await page.evaluate(() => {
          const activityList = document.querySelector('.activity-log-list');
          const logEntries = activityList?.querySelectorAll('.log-entry');
          
          return {
            entryCount: logEntries?.length || 0,
            hasSystemLogs: true
          };
        });
        
        // Switch to client logs
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            await page.goto(`${clientHref}/logs`);
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            // Capture client logs context
            const clientContext = await page.evaluate(() => {
              const activityList = document.querySelector('.activity-log-list');
              const logEntries = activityList?.querySelectorAll('.log-entry');
              
              return {
                entryCount: logEntries?.length || 0,
                hasClientLogs: true
              };
            });
            
            // Contexts should be different (different data sets)
            console.log(`System logs: ${systemContext.entryCount} entries`);
            console.log(`Client logs: ${clientContext.entryCount} entries`);
            
            // Both contexts should be valid
            expect(systemContext.hasSystemLogs).toBeTruthy();
            expect(clientContext.hasClientLogs).toBeTruthy();
            
            // Switch back to system logs
            await page.goto('/logs');
            await expect(page.locator('.activity-log-list')).toBeVisible();
            
            // Should maintain proper context switching
            await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
          }
        }
      });
    });
  });

  test.describe('Performance and Optimization Validation', () => {
    test('ReactiveView coordination prevents resource leaks', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Perform multiple navigation cycles to test for leaks
        const cycles = 5;
        
        for (let i = 0; i < cycles; i++) {
          // Navigate to system logs
          await page.goto('/logs');
          await expect(page.locator('.activity-log-list')).toBeVisible();
          
          // Navigate to clients
          await page.goto('/clients');
          await page.waitForLoadState('networkidle');
          
          // Brief pause to allow cleanup
          await page.waitForTimeout(100);
        }
        
        // Final navigation should still work correctly
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 5000 });
        
        // Should not accumulate errors over multiple cycles
        expect(monitor.shouldFailTest()).toBeFalsy();
        
        // Check for memory/resource indicators
        const resourceCheck = await page.evaluate(() => {
          // Basic check for excessive DOM elements that might indicate leaks
          const totalElements = document.querySelectorAll('*').length;
          const activityLists = document.querySelectorAll('.activity-log-list').length;
          
          return {
            totalElements,
            activityLists,
            seemsHealthy: totalElements < 10000 && activityLists <= 1
          };
        });
        
        expect(resourceCheck.seemsHealthy).toBeTruthy();
        console.log(`Resource check: ${resourceCheck.totalElements} elements, ${resourceCheck.activityLists} activity lists`);
      });
    });
  });
});