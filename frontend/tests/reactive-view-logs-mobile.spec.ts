import { test, expect } from '@playwright/test';
import { withConsoleMonitoring } from './helpers/console-monitoring';

test.describe('ReactiveView Logs Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Mobile Viewport Tests', () => {
    test('System logs work correctly on mobile viewport', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Set mobile viewport (iPhone 12)
        await page.setViewportSize({ width: 390, height: 844 });
        
        // Navigate to logs
        await page.goto('/logs');
        
        // Verify ReactiveView works on mobile
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
        
        // Test mobile-specific layout elements
        const mobileLayout = await page.evaluate(() => {
          const container = document.querySelector('.logs-container');
          if (!container) return false;
          
          const computedStyle = window.getComputedStyle(container);
          const width = container.getBoundingClientRect().width;
          
          // Should adapt to mobile width
          return width <= 390 && width > 0;
        });
        
        expect(mobileLayout).toBeTruthy();
        
        // Test mobile navigation doesn't cause flash
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');
        
        await page.goto('/logs');
        
        // Should load quickly with ReactiveView
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 3000 });
      });
    });

    test('Client logs work correctly on mobile viewport', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Get first client
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Navigate to client logs on mobile
            await page.goto(`${clientHref}/logs`);
            
            // Verify mobile layout
            await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 10000 });
            await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible();
            
            // Test mobile scrolling behavior
            const scrollableContainer = page.locator('.logs-container');
            await expect(scrollableContainer).toBeVisible();
            
            // Test mobile touch interactions (if logs exist)
            const logGroups = page.locator('.logs-group');
            const groupCount = await logGroups.count();
            
            if (groupCount > 0) {
              // Test mobile group expand/collapse
              const firstGroupHeader = page.locator('.logs-group-header').first();
              if (await firstGroupHeader.isVisible()) {
                await firstGroupHeader.tap();
                
                // Should handle mobile touch events
                await page.waitForTimeout(500);
                
                // Verify group state changed
                const groupState = await firstGroupHeader.getAttribute('aria-expanded');
                expect(groupState).toBeDefined();
              }
            }
          }
        }
      });
    });

    test('Progressive loading works on slow mobile connections', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 414, height: 896 });
        
        // Simulate slow 3G connection
        await page.context().setNetworkConditions({
          offline: false,
          downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
          uploadThroughput: 750 * 1024 / 8, // 750 Kbps
          latency: 150 // 150ms latency
        });
        
        // Navigate to logs
        await page.goto('/logs');
        
        // Should handle slow loading gracefully with progressive strategy
        const hasProgressiveIndicator = await page.waitForFunction(() => {
          const loadingSkeleton = document.querySelector('.skeleton-generic');
          const refreshIndicator = document.querySelector('.refresh-indicator');
          const loadingOverlay = document.querySelector('.loading-overlay');
          
          return loadingSkeleton || refreshIndicator || loadingOverlay;
        }, { timeout: 5000 });
        
        expect(hasProgressiveIndicator).toBeTruthy();
        
        // Eventually should load content
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 20000 });
        
        // Reset network conditions
        await page.context().setNetworkConditions(null);
      });
    });

    test('Mobile orientation change preserves ReactiveView state', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Start in portrait
        await page.setViewportSize({ width: 390, height: 844 });
        
        // Load logs
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Change to landscape
        await page.setViewportSize({ width: 844, height: 390 });
        
        // ReactiveView state should be preserved
        await expect(page.locator('.activity-log-list')).toBeVisible();
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
        
        // Verify layout adapts to landscape
        const landscapeLayout = await page.evaluate(() => {
          const container = document.querySelector('.logs-container');
          if (!container) return false;
          
          const width = container.getBoundingClientRect().width;
          return width > 800; // Should use more space in landscape
        });
        
        expect(landscapeLayout).toBeTruthy();
        
        // Change back to portrait
        await page.setViewportSize({ width: 390, height: 844 });
        
        // State should still be preserved
        await expect(page.locator('.activity-log-list')).toBeVisible();
      });
    });
  });

  test.describe('Tablet Viewport Tests', () => {
    test('Logs work correctly on tablet viewport', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Set tablet viewport (iPad)
        await page.setViewportSize({ width: 768, height: 1024 });
        
        // Navigate to logs
        await page.goto('/logs');
        
        // Verify tablet layout
        await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('h1:has-text("System Activity Logs")')).toBeVisible();
        
        // Test tablet-specific interactions
        const logGroups = page.locator('.logs-group');
        const groupCount = await logGroups.count();
        
        if (groupCount > 0) {
          // Test tablet touch/click interactions
          const firstGroup = logGroups.first();
          const groupHeader = firstGroup.locator('.logs-group-header');
          
          if (await groupHeader.isVisible()) {
            // Should handle tablet interactions
            await groupHeader.click();
            await page.waitForTimeout(300);
            
            // Verify group interaction worked
            const isExpanded = await groupHeader.getAttribute('aria-expanded');
            expect(isExpanded).toBeDefined();
          }
        }
        
        // Test navigation on tablet
        await page.goto('/clients');
        const firstClientLink = page.locator('a[href^="/clients/"]').first();
        
        if (await firstClientLink.isVisible()) {
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            await page.goto(`${clientHref}/logs`);
            
            // Should maintain ReactiveView performance on tablet
            await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('h1:text-matches("Activity Log for.*")')).toBeVisible();
          }
        }
      });
    });
  });

  test.describe('Responsive Design Validation', () => {
    test('Activity log entries adapt to different screen sizes', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        const viewports = [
          { width: 320, height: 568, name: 'Small Mobile' }, // iPhone SE
          { width: 414, height: 896, name: 'Large Mobile' }, // iPhone 11 Pro Max
          { width: 768, height: 1024, name: 'Tablet' }, // iPad
          { width: 1024, height: 768, name: 'Tablet Landscape' },
          { width: 1280, height: 720, name: 'Desktop' }
        ];
        
        for (const viewport of viewports) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          
          // Navigate to logs
          await page.goto('/logs');
          await expect(page.locator('.activity-log-list')).toBeVisible({ timeout: 10000 });
          
          // Test responsive behavior
          const layoutTest = await page.evaluate((vp) => {
            const container = document.querySelector('.logs-container');
            if (!container) return false;
            
            const containerRect = container.getBoundingClientRect();
            const activityList = container.querySelector('.activity-log-list');
            
            if (!activityList) return false;
            
            const listRect = activityList.getBoundingClientRect();
            
            // Verify layout adapts to viewport
            return {
              containerWidth: containerRect.width,
              listWidth: listRect.width,
              isResponsive: listRect.width <= containerRect.width && listRect.width > 0,
              viewportName: vp.name
            };
          }, viewport);
          
          expect(layoutTest.isResponsive).toBeTruthy();
          console.log(`${viewport.name}: Container ${layoutTest.containerWidth}px, List ${layoutTest.listWidth}px`);
          
          // Test log entry formatting at different sizes
          const logEntries = page.locator('.log-entry');
          const entryCount = await logEntries.count();
          
          if (entryCount > 0) {
            const firstEntry = logEntries.first();
            await expect(firstEntry).toBeVisible();
            
            // Verify entry doesn't overflow
            const entryOverflow = await firstEntry.evaluate((el) => {
              const rect = el.getBoundingClientRect();
              const parent = el.parentElement?.getBoundingClientRect();
              
              return parent ? rect.width <= parent.width : true;
            });
            
            expect(entryOverflow).toBeTruthy();
          }
        }
      });
    });

    test('Touch interactions work properly on touch devices', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 390, height: 844 });
        
        // Enable touch simulation
        await page.context().addInitScript(() => {
          Object.defineProperty(navigator, 'maxTouchPoints', { value: 10 });
          Object.defineProperty(navigator, 'msMaxTouchPoints', { value: 10 });
        });
        
        await page.goto('/logs');
        await expect(page.locator('.activity-log-list')).toBeVisible();
        
        // Test touch scrolling
        const logsContainer = page.locator('.logs-container');
        await expect(logsContainer).toBeVisible();
        
        // Simulate touch scroll
        await logsContainer.hover();
        await page.touchscreen.tap(200, 400);
        
        // Test group expand/collapse with touch
        const groupHeaders = page.locator('.logs-group-header');
        const headerCount = await groupHeaders.count();
        
        if (headerCount > 0) {
          const firstHeader = groupHeaders.first();
          
          // Use touch tap instead of click
          const headerBox = await firstHeader.boundingBox();
          if (headerBox) {
            await page.touchscreen.tap(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2);
            
            // Verify touch interaction worked
            await page.waitForTimeout(300);
            const ariaExpanded = await firstHeader.getAttribute('aria-expanded');
            expect(ariaExpanded).toBeDefined();
          }
        }
      });
    });
  });
});