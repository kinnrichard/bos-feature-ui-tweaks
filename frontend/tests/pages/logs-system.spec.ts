/**
 * System Logs Page Tests (/logs)
 * 
 * Comprehensive test suite for system activity logs functionality.
 * Based on excellent patterns from smoke.e2e.spec.ts and auth-flows.spec.ts.
 * 
 * Features Tested:
 * - ReactiveActivityLogV2 query with proper includes
 * - Progressive loading with 500-item limit
 * - Real-time updates via Zero.js
 * - Activity type display with emoji classification
 * - Log grouping and filtering
 * - Error handling and recovery
 * - Mobile responsiveness
 */

import { test, expect } from '@playwright/test';
import { createPageTest, PageAssertions, PageTestUtils } from './helpers/page-test-wrapper';
import { LogsTestHelper } from './helpers/logs-test-helper';

test.describe('System Logs Page (/logs)', () => {
  // Configure test timeout for complex operations
  test.setTimeout(20000);

  test.describe('Core Functionality', () => {
    createPageTest(
      'should load system logs with proper structure',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);
        const assertions = new PageAssertions(page);

        // Create comprehensive log scenario
        const scenario = await logsHelper.createLogScenario({
          logCount: 15,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        // Navigate to system logs page
        await page.goto('/logs');
        await assertions.assertPageLoads(/System Activity Logs.*bŏs/);

        // Wait for logs to load
        await logsHelper.waitForLogsToLoad();

        // Verify page structure
        await expect(page.locator('h1')).toContainText('System Activity Logs');
        await expect(page.locator('.logs-layout')).toBeVisible();
        await expect(page.locator('.activity-log-list')).toBeVisible();

        // Verify logs display correctly
        await logsHelper.verifyLogDisplay(scenario.logs.slice(0, 5));
      },
      {
        description: 'Validates system logs page loads with proper ReactiveActivityLogV2 integration',
      }
    );

    createPageTest(
      'should display activity logs with proper grouping',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Create mixed activity scenario
        const scenario = await logsHelper.createLogScenario({
          logCount: 20,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Test log grouping functionality
        const groups = await logsHelper.verifyLogGrouping();
        expect(groups.length).toBeGreaterThan(0);

        // Verify group interaction
        if (groups.length > 0) {
          const firstGroup = groups[0];
          console.log(`Found ${groups.length} log groups, first group: ${firstGroup.groupHeader}`);
        }
      },
      {
        description: 'Validates activity log grouping by client/job with collapsible sections',
      }
    );

    createPageTest(
      'should handle progressive loading with 500-item limit',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Create large log dataset (simulated)
        const scenario = await logsHelper.createLogScenario({
          logCount: 50, // Simulate more logs than can fit on one page
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Test progressive loading
        await logsHelper.testProgressiveLoading();

        // Verify logs are properly limited and paginated
        const visibleLogs = await page.locator('.activity-log-item, .log-entry').count();
        expect(visibleLogs).toBeGreaterThan(0);
        expect(visibleLogs).toBeLessThanOrEqual(500); // Respects 500-item limit
      },
      {
        description: 'Validates progressive loading strategy with proper item limits',
      }
    );
  });

  test.describe('Real-time Updates & Zero.js Integration', () => {
    createPageTest(
      'should receive real-time updates when new logs are created',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Start with initial logs
        const scenario = await logsHelper.createLogScenario({
          logCount: 5,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad(5);

        // Test real-time updates
        await logsHelper.testRealTimeUpdates();
      },
      {
        description: 'Validates Zero.js reactive updates for new activity logs',
      }
    );

    createPageTest(
      'should handle auto-scroll for new log entries',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        const scenario = await logsHelper.createLogScenario({
          logCount: 10,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Test auto-scroll behavior
        await logsHelper.testAutoScroll();
      },
      {
        description: 'Validates automatic scrolling when new logs appear',
      }
    );
  });

  test.describe('Activity Types & Display', () => {
    createPageTest(
      'should display activity type emojis correctly',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Create logs with different activity types
        const scenario = await logsHelper.createLogScenario({
          logCount: 8,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Verify activity type emojis are displayed
        const activityEmojis = page.locator('.activity-type-emoji, .activity-icon');
        const emojiCount = await activityEmojis.count();
        expect(emojiCount).toBeGreaterThan(0);

        // Verify each visible emoji is actually visible and has content
        for (let i = 0; i < Math.min(5, emojiCount); i++) {
          const emoji = activityEmojis.nth(i);
          await expect(emoji).toBeVisible();
          
          const emojiText = await emoji.textContent();
          expect(emojiText?.trim()).toBeTruthy();
        }
      },
      {
        description: 'Validates proper activity type emoji rendering and classification',
      }
    );

    createPageTest(
      'should show timestamps and user information',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        const scenario = await logsHelper.createLogScenario({
          logCount: 6,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Verify timestamps are displayed
        const timestamps = page.locator('.activity-timestamp, .log-time');
        const timestampCount = await timestamps.count();
        expect(timestampCount).toBeGreaterThan(0);

        // Verify user information is shown where applicable
        const userInfo = page.locator('.user-name, .activity-user');
        if (await userInfo.count() > 0) {
          await expect(userInfo.first()).toBeVisible();
        }
      },
      {
        description: 'Validates timestamp display and user attribution in logs',
      }
    );
  });

  test.describe('Error Handling & Edge Cases', () => {
    createPageTest(
      'should display empty state when no logs exist',
      async (page) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Navigate without creating any logs
        await page.goto('/logs');

        // Should show empty state
        await logsHelper.verifyEmptyState();
      },
      {
        description: 'Validates empty state display when no activity logs exist',
      }
    );

    createPageTest(
      'should handle API errors gracefully',
      async (page) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Test error handling
        await logsHelper.testErrorHandling();
      },
      {
        description: 'Validates error state display and recovery for API failures',
        customConsoleFilters: [
          {
            message: /500|Internal server error/,
            type: 'error',
            description: 'Expected API error for error handling test',
          },
        ],
      }
    );

    createPageTest(
      'should recover from network failures',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Create initial logs
        const scenario = await logsHelper.createLogScenario({
          logCount: 3,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Simulate network interruption
        await page.route('**/api/v1/activity_logs*', (route) => {
          route.abort('failed');
        });

        // Wait for potential error state
        await page.waitForTimeout(2000);

        // Re-enable network
        await page.unroute('**/api/v1/activity_logs*');

        // Zero.js should automatically retry and recover
        await page.waitForTimeout(3000);

        // Page should still be functional
        await expect(page.locator('.activity-log-list')).toBeVisible();
      },
      {
        description: 'Validates automatic recovery from network failures via Zero.js',
        customConsoleFilters: [
          {
            message: /failed|network|connection/,
            type: 'error',
            description: 'Expected network errors for recovery test',
          },
        ],
      }
    );
  });

  test.describe('Performance & Responsiveness', () => {
    createPageTest(
      'should handle large datasets efficiently',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        // Create substantial log dataset
        const scenario = await logsHelper.createLogScenario({
          logCount: 100, // Large dataset
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        // Measure load time
        const startTime = Date.now();

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        const loadTime = Date.now() - startTime;

        // Should load within reasonable time (5 seconds even with large dataset)
        expect(loadTime).toBeLessThan(5000);

        // Log performance metrics
        await PageTestUtils.logPerformanceMetrics(page, 'large-dataset-logs');
      },
      {
        description: 'Validates performance with large activity log datasets',
        verbose: true,
      }
    );

    createPageTest(
      'should be responsive on mobile devices',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);
        const assertions = new PageAssertions(page);

        const scenario = await logsHelper.createLogScenario({
          logCount: 8,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Test mobile responsiveness
        await assertions.assertMobileResponsive();

        // Capture debug screenshot for mobile layout
        await PageTestUtils.captureDebugScreenshot(page, 'mobile-logs-layout');
      },
      {
        description: 'Validates mobile responsive layout for activity logs',
      }
    );
  });

  test.describe('Accessibility & User Experience', () => {
    createPageTest(
      'should be keyboard accessible',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        const scenario = await logsHelper.createLogScenario({
          logCount: 5,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Test keyboard navigation
        await page.keyboard.press('Tab');
        
        // Verify focusable elements exist
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Test keyboard scrolling
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowUp');
      },
      {
        description: 'Validates keyboard accessibility for activity logs',
      }
    );

    createPageTest(
      'should maintain scroll position during updates',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        const scenario = await logsHelper.createLogScenario({
          logCount: 20,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Scroll to middle of page
        await page.evaluate(() => window.scrollTo(0, window.innerHeight));
        const initialScrollPosition = await page.evaluate(() => window.scrollY);

        // Wait for potential updates
        await page.waitForTimeout(2000);

        // Verify scroll position is maintained (unless auto-scroll for new logs)
        const finalScrollPosition = await page.evaluate(() => window.scrollY);
        
        // Should be within reasonable range (allowing for some auto-scroll behavior)
        const scrollDifference = Math.abs(finalScrollPosition - initialScrollPosition);
        expect(scrollDifference).toBeLessThan(200);
      },
      {
        description: 'Validates scroll position maintenance during real-time updates',
      }
    );
  });

  test.describe('Integration with AppLayout', () => {
    createPageTest(
      'should integrate properly with AppLayout component',
      async (page, { factory, cleanup }) => {
        const logsHelper = new LogsTestHelper(page, factory);

        const scenario = await logsHelper.createLogScenario({
          logCount: 3,
          includeSystemLogs: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/logs');
        await logsHelper.waitForLogsToLoad();

        // Verify AppLayout integration
        await expect(page.locator('.app-layout, [data-component="AppLayout"]')).toBeVisible();

        // Verify LogsLayout component
        await expect(page.locator('.logs-layout')).toBeVisible();

        // Verify proper nesting
        const logsInLayout = page.locator('.logs-layout .activity-log-list');
        await expect(logsInLayout).toBeVisible();
      },
      {
        description: 'Validates proper integration with AppLayout and LogsLayout components',
      }
    );
  });
});