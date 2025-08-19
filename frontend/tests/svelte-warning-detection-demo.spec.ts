/**
 * Svelte Warning Detection - Demonstration & Validation
 *
 * This file demonstrates how the console monitoring system catches
 * critical Svelte warnings and causes test failures.
 */

import { test, expect } from '@playwright/test';
import {
  withConsoleMonitoring,
  ConsoleTestUtils,
  expectNoConsoleErrors,
  type ConsoleErrorFilter,
} from './helpers/console-monitoring';

test.describe('Svelte Warning Detection System', () => {
  test('should demonstrate Svelte warning detection configuration', async ({ page }) => {
    // This test shows how the system is configured to catch Svelte warnings

    const monitor = ConsoleTestUtils.createSvelteOptimizedMonitor(page);
    await monitor.startMonitoring();

    console.warn('🧪 Svelte Warning Detection Enabled:');
    console.warn('- [Warning] [svelte] ownership_invalid_binding → WILL FAIL TEST');
    console.warn('- [Warning] [svelte] any-other-warning → WILL FAIL TEST');
    console.warn('- Regular warnings → WILL FAIL TEST');
    console.warn('- Only filtered warnings (favicon, ResizeObserver) → ignored');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This test will pass unless there are actual Svelte warnings
    const errors = monitor.stopMonitoring();

    // Check if any Svelte warnings were detected
    const svelteWarnings = errors.filter((error) =>
      ConsoleTestUtils.isCriticalSvelteWarning(error.message)
    );

    if (svelteWarnings.length > 0) {
      console.warn('🚨 SVELTE WARNINGS DETECTED:');
      svelteWarnings.forEach((warning, index) => {
        console.warn(`${index + 1}. ${warning.message}`);
      });

      throw new Error(
        `Svelte warnings detected! This demonstrates the system working: ${svelteWarnings.length} warnings found`
      );
    } else {
      console.warn('✅ No Svelte warnings detected - application is clean!');
    }

    expect(page.locator('body')).toBeVisible();
  });

  test('should catch specific ownership_invalid_binding warnings', async ({ page }) => {
    // This test specifically looks for the ownership_invalid_binding warning you mentioned

    await withConsoleMonitoring(
      page,
      async (_monitor) => {
        // Navigate to pages that might have the binding issue
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        // Look for elements that might trigger the binding warning
        // The Toolbar.svelte -> SchedulePriorityEditPopover.svelte -> AppLayout.svelte issue
        const toolbarElements = page.locator('[class*="toolbar"], [data-testid*="toolbar"]');
        const popoverTriggers = page.locator('button[aria-haspopup], button[aria-expanded]');

        // Try to interact with elements that might have binding issues
        if ((await toolbarElements.count()) > 0) {
          await toolbarElements.first().hover();
        }

        if ((await popoverTriggers.count()) > 0) {
          const firstTrigger = popoverTriggers.first();
          if (await firstTrigger.isVisible()) {
            await firstTrigger.click();
            await page.waitForTimeout(100); // Allow for popover to render
            await page.keyboard.press('Escape'); // Close popover
          }
        }

        // Navigate to other pages that might have similar issues
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');

        // If the specific ownership_invalid_binding warning occurs,
        // this test will automatically fail due to the monitoring system
      },
      {
        failOnError: true,
        failOnWarning: true, // Critical: This catches Svelte warnings
        maxErrorsBeforeFailure: 1, // Fail immediately on first warning
        logFilteredErrors: true,
      }
    );
  });

  test('should show how to temporarily allow Svelte warnings (if needed)', async ({ page }) => {
    // This demonstrates how to temporarily allow Svelte warnings
    // (Use this pattern ONLY during development/debugging)

    const temporaryFilters: ConsoleErrorFilter[] = [
      {
        message: /\[Warning\] \[svelte\] ownership_invalid_binding/,
        type: 'warning',
        description: 'TEMPORARY: Allow during development - REMOVE before production',
      },
    ];

    await expectNoConsoleErrors(
      page,
      async () => {
        await page.goto('/jobs');
        await page.waitForLoadState('networkidle');

        // With the temporary filter, the ownership_invalid_binding warning
        // would be ignored (but other Svelte warnings would still fail)
      },
      temporaryFilters
    );

    // 🚨 WARNING: The above pattern should ONLY be used temporarily!
    // Remove the filter once the binding issue is fixed.
  });

  test('should demonstrate filtered vs unfiltered warnings', async ({ page }) => {
    // This test shows which warnings are filtered and which cause failures

    const monitor = ConsoleTestUtils.createSvelteOptimizedMonitor(page);
    await monitor.startMonitoring();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const errors = monitor.stopMonitoring();

    if (errors.length > 0) {
      console.warn('\n📊 Console Message Analysis:');

      const filteredErrors = errors.filter(
        (e) =>
          e.message.includes('favicon') ||
          e.message.includes('ResizeObserver') ||
          e.message.includes('Non-passive')
      );

      const svelteWarnings = errors.filter((e) =>
        ConsoleTestUtils.isCriticalSvelteWarning(e.message)
      );

      const otherWarnings = errors.filter(
        (e) => !filteredErrors.includes(e) && !svelteWarnings.includes(e)
      );

      console.warn(`✅ Filtered (ignored): ${filteredErrors.length} messages`);
      filteredErrors.forEach((e) => console.warn(`   - ${e.message.substring(0, 60)}...`));

      console.warn(`🚨 Svelte warnings (FAIL): ${svelteWarnings.length} messages`);
      svelteWarnings.forEach((e) => console.warn(`   - ${e.message}`));

      console.warn(`⚠️  Other warnings (FAIL): ${otherWarnings.length} messages`);
      otherWarnings.forEach((e) => console.warn(`   - ${e.message.substring(0, 60)}...`));

      // If there are any non-filtered warnings, demonstrate the failure
      if (svelteWarnings.length > 0 || otherWarnings.length > 0) {
        throw new Error(`Console warnings detected that would cause test failure!`);
      }
    }

    expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Real-World Svelte Warning Scenarios', () => {
  test('should detect binding issues in toolbar components', async ({ page }) => {
    // Based on your specific example:
    // Toolbar.svelte → SchedulePriorityEditPopover.svelte → AppLayout.svelte

    await withConsoleMonitoring(
      page,
      async () => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Look specifically for toolbar-related elements
        const toolbar = page.locator('.toolbar, [data-testid="toolbar"], header');
        if ((await toolbar.count()) > 0) {
          // Try to trigger interactions that might show the binding warning
          await toolbar.first().hover();

          // Look for schedule/priority related buttons
          const scheduleButton = page.locator(
            'button:has-text("Schedule"), button:has-text("Priority")'
          );
          if ((await scheduleButton.count()) > 0) {
            await scheduleButton.first().click();
            await page.waitForTimeout(200); // Allow popover to render
            await page.keyboard.press('Escape');
          }
        }

        // The specific warning you mentioned would be caught here:
        // [Warning] [svelte] ownership_invalid_binding
        // "Toolbar.svelte passed property `currentJob` to SchedulePriorityEditPopover.svelte with `bind:`..."
      },
      {
        failOnWarning: true,
        maxErrorsBeforeFailure: 1,
        logFilteredErrors: true,
      }
    );
  });

  test('should provide clear failure messages for binding issues', async ({ page }, testInfo) => {
    // This test shows what happens when a binding warning occurs

    try {
      await withConsoleMonitoring(
        page,
        async (_monitor) => {
          await page.goto('/jobs');
          await page.waitForLoadState('networkidle');

          // Try to trigger binding-related interactions
          const editableElements = page.locator('input, select, textarea');
          const buttonElements = page.locator('button[aria-haspopup]');

          if ((await editableElements.count()) > 0) {
            await editableElements.first().focus();
            await editableElements.first().blur();
          }

          if ((await buttonElements.count()) > 0) {
            await buttonElements.first().click();
            await page.waitForTimeout(100);
            await page.keyboard.press('Escape');
          }
        },
        {
          failOnWarning: true,
          maxErrorsBeforeFailure: 1,
        }
      );

      console.warn('✅ No binding warnings detected in this test run');
    } catch (error) {
      // If a Svelte warning occurs, attach detailed information
      await testInfo.attach('svelte-warning-details', {
        body: `Svelte Warning Detected:\n${error.message}\n\nThis demonstrates the monitoring system working correctly.`,
        contentType: 'text/plain',
      });

      console.warn('🚨 Svelte warning was caught by monitoring system (this is expected behavior)');

      // Re-throw to show the system is working
      throw error;
    }
  });
});
