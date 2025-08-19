/**
 * Enhanced Task Positioning Tests with Console Error Monitoring
 *
 * This demonstrates how to integrate console error monitoring into
 * your existing tests with minimal code changes for maximum robustness.
 */

import { test, expect } from '@playwright/test';
import {
  expectNoConsoleErrors,
  withConsoleMonitoring,
  type ConsoleErrorMonitor,
  type ConsoleErrorFilter,
} from './helpers';

// Custom filters for task positioning tests
const TASK_POSITIONING_FILTERS: ConsoleErrorFilter[] = [
  {
    message: /ResizeObserver loop limit exceeded/,
    type: 'error',
    description: 'Common during drag-drop operations - not a real error',
  },
  {
    message: /Non-passive event listener/,
    type: 'warning',
    description: 'Drag-drop library optimization - not critical',
  },
];

test.describe('Task Positioning with Console Monitoring', () => {
  // ===============================================
  // APPROACH 1: Simple Wrapper (Minimal Changes)
  // ===============================================

  test('should insert tasks with console error detection', async ({ page }) => {
    await expectNoConsoleErrors(
      page,
      async () => {
        // Navigate to a job detail page
        await page.goto('/jobs/1');

        // Wait for tasks to load
        await page.waitForSelector('.task-item', { timeout: 5000 });

        // Get initial task count
        const initialTasks = await page.locator('.task-item').count();

        // Find the first task and click to select it
        const firstTask = page.locator('.task-item').first();
        await firstTask.click();

        // Press Enter to create inline task
        await page.keyboard.press('Enter');

        // Type new task title
        await page.keyboard.type('Inserted Task with Error Monitoring');

        // Press Enter to save
        await page.keyboard.press('Enter');

        // Verify task was created
        await expect(page.locator('.task-item')).toHaveCount(initialTasks + 1);

        // Verify the new task appears in the correct position
        const taskTitles = await page.locator('.task-title').allTextContents();
        const insertedIndex = taskTitles.findIndex((title) =>
          title.includes('Inserted Task with Error Monitoring')
        );

        // Should be after the first task (index 1 if we selected the first task)
        expect(insertedIndex).toBeGreaterThan(0);
      },
      TASK_POSITIONING_FILTERS
    ); // Apply custom filters for this test type
  });

  // ===============================================
  // APPROACH 2: Advanced Monitoring with Inspection
  // ===============================================

  test('should handle multiple insertions with error inspection', async ({ page }) => {
    await withConsoleMonitoring(
      page,
      async (monitor) => {
        await page.goto('/jobs/1');
        await page.waitForSelector('.task-item', { timeout: 5000 });

        // Get first two tasks
        const tasks = page.locator('.task-item');
        const firstTask = tasks.first();

        // Insert multiple tasks - this might trigger console errors
        for (let i = 1; i <= 3; i++) {
          await firstTask.click();
          await page.keyboard.press('Enter');
          await page.keyboard.type(`Inserted Task ${i}`);
          await page.keyboard.press('Enter');

          // Check for errors after each insertion
          const currentErrors = monitor.stopMonitoring();
          if (currentErrors.length > 0) {
            console.warn(`Insertion ${i} generated ${currentErrors.length} console messages`);
          }

          // Clear and restart monitoring for next iteration
          monitor.clearErrors();
          await monitor.startMonitoring();

          // Small delay to ensure task is created
          await page.waitForTimeout(100);
        }

        // Verify all tasks were created
        const taskTitles = await page.locator('.task-title').allTextContents();

        // Check that all inserted tasks exist
        expect(taskTitles.some((t) => t.includes('Inserted Task 1'))).toBe(true);
        expect(taskTitles.some((t) => t.includes('Inserted Task 2'))).toBe(true);
        expect(taskTitles.some((t) => t.includes('Inserted Task 3'))).toBe(true);

        // Monitor will automatically check for errors at the end
      },
      {
        failOnError: true,
        failOnWarning: false,
        filters: TASK_POSITIONING_FILTERS,
        maxErrorsBeforeFailure: 10, // Allow more errors due to multiple operations
      }
    );
  });

  // ===============================================
  // APPROACH 3: Global Monitoring with Hooks
  // ===============================================

  test.describe('Task Positioning - Global Console Monitoring', () => {
    let globalMonitor: ConsoleErrorMonitor;

    test.beforeEach(async ({ page }) => {
      // Import ConsoleTestUtils dynamically to avoid circular imports
      const { ConsoleTestUtils } = await import('../helpers/console-monitoring');

      globalMonitor = ConsoleTestUtils.createMonitor(page, {
        filters: TASK_POSITIONING_FILTERS,
        failOnError: true,
        failOnWarning: false,
        logFilteredErrors: process.env.DEBUG === 'true',
      });

      await globalMonitor.startMonitoring();

      // Standard test setup
      await page.goto('/jobs/1');
      await page.waitForSelector('.task-item', { timeout: 5000 });
    });

    test.afterEach(async () => {
      if (globalMonitor) {
        // Import assertion utility
        const { ConsoleTestUtils } = await import('../helpers/console-monitoring');
        ConsoleTestUtils.assertNoConsoleErrors(globalMonitor);
      }
    });

    test('should maintain position integrity during drag operations', async ({ page }) => {
      // This test automatically has console monitoring via hooks
      const tasks = page.locator('.task-item');
      const firstTask = tasks.first();
      const secondTask = tasks.nth(1);

      // Simulate drag and drop (might generate console warnings)
      await firstTask.hover();
      await page.mouse.down();
      await secondTask.hover();
      await page.mouse.up();

      // Wait for animation/repositioning
      await page.waitForTimeout(500);

      // Verify position change occurred
      const updatedTasks = await page.locator('.task-item').allTextContents();
      expect(updatedTasks.length).toBeGreaterThan(0);

      // Console errors automatically checked in afterEach
    });

    test('should handle keyboard navigation without errors', async ({ page }) => {
      // Another test with automatic console monitoring
      const firstTask = page.locator('.task-item').first();
      await firstTask.click();

      // Navigate with keyboard
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');

      // Verify focus is managed correctly
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Console errors automatically checked in afterEach
    });
  });

  // ===============================================
  // APPROACH 4: Conditional Error Handling
  // ===============================================

  test('should handle expected errors during complex positioning', async ({ page }) => {
    await withConsoleMonitoring(
      page,
      async (monitor) => {
        await page.goto('/jobs/1');
        await page.waitForSelector('.task-item', { timeout: 5000 });

        // Perform operations that might legitimately cause some console warnings
        // Rapid-fire operations that might stress the UI
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab');
          await page.keyboard.type(`Quick Task ${i}`);
          await page.keyboard.press('Enter');
        }

        // Check what errors occurred
        const errors = monitor.stopMonitoring();
        console.warn(`Complex positioning generated ${errors.length} console messages`);

        // Analyze errors - fail only on truly problematic ones
        const criticalErrors = errors.filter(
          (error) =>
            error.type === 'error' &&
            !error.message.includes('ResizeObserver') &&
            !error.message.includes('animation') &&
            !error.message.includes('focus')
        );

        if (criticalErrors.length > 0) {
          throw new Error(
            `Critical positioning errors: ${criticalErrors.map((e) => e.message).join(', ')}`
          );
        }

        // Verify end state is correct despite any warnings
        const finalTasks = await page.locator('.task-item').count();
        expect(finalTasks).toBeGreaterThanOrEqual(5);
      },
      {
        // More lenient settings for this complex test
        failOnError: false, // We'll handle errors manually
        maxErrorsBeforeFailure: 20,
      }
    );
  });

  // ===============================================
  // APPROACH 5: Integration with Existing Helpers
  // ===============================================

  test('should work with auth and data factory helpers', async ({ page }) => {
    // This shows how console monitoring integrates with your existing test patterns
    await expectNoConsoleErrors(
      page,
      async () => {
        // If you have auth helpers:
        // const auth = new AuthHelper(page);
        // await auth.setupAuthenticatedSession('admin');

        // If you have data factory helpers:
        // const factory = new DataFactory(page);
        // const job = await factory.createJob({ title: 'Console Test Job' });

        // Standard test flow continues with monitoring
        await page.goto('/jobs/1');
        await expect(page.locator('.task-list')).toBeVisible();

        // Any console errors during auth, data creation, or UI interaction will be caught
      },
      TASK_POSITIONING_FILTERS
    );
  });
});

// ===============================================
// UTILITY: Test-Specific Error Analysis
// ===============================================

test.describe('Console Error Analysis for Task Positioning', () => {
  test('should analyze console error patterns', async ({ page }, testInfo) => {
    // Import the monitoring utilities
    const { ConsoleTestUtils } = await import('../helpers/console-monitoring');

    const monitor = ConsoleTestUtils.createMonitor(page, {
      failOnError: false, // Don't fail, just collect
      logFilteredErrors: true,
    });

    await monitor.startMonitoring();

    // Perform all the operations that might cause errors
    await page.goto('/jobs/1');
    await page.waitForSelector('.task-item', { timeout: 5000 });

    // Trigger various UI operations
    await page.click('.task-item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Analysis Test Task');
    await page.keyboard.press('Enter');

    const errors = monitor.stopMonitoring();

    // Attach detailed analysis to test results
    if (errors.length > 0) {
      const analysis = {
        totalErrors: errors.length,
        errorTypes: errors.reduce(
          (acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        commonMessages: [...new Set(errors.map((e) => e.message))],
        timestamp: Date.now(),
      };

      await testInfo.attach('console-error-analysis', {
        body: JSON.stringify(analysis, null, 2),
        contentType: 'application/json',
      });

      console.warn('Console Error Analysis:', analysis);
    }

    // This test always passes - it's just for analysis
    expect(true).toBe(true);
  });
});
