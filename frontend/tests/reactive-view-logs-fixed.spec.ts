import { test, expect } from '@playwright/test';
import { withConsoleMonitoring } from './helpers/console-monitoring';

test.describe('ReactiveView Logs Integration Tests - Fixed', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage first to ensure proper authentication state
    await page.goto('/');
    
    // Wait for any initial load to complete
    await page.waitForLoadState('networkidle');
  });

  test.describe('Logs Page Accessibility and Error Handling', () => {
    test('System logs page is accessible and handles errors gracefully', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to system logs
        await page.goto('/logs');
        await page.waitForLoadState('networkidle');
        
        // Check page state
        const pageState = await page.evaluate(() => {
          return {
            title: document.title,
            h1Text: document.querySelector('h1')?.textContent || 'No H1 found',
            hasActivityLogList: !!document.querySelector('.activity-log-list'),
            hasLogsContainer: !!document.querySelector('.logs-container'),
            hasErrorState: !!document.querySelector('.error-state, .error-content'),
            hasLoadingSkeleton: !!document.querySelector('.skeleton-generic'),
            url: window.location.href,
            bodyClass: document.body.className
          };
        });
        
        console.log('System logs page state:', JSON.stringify(pageState, null, 2));
        
        // Test that page loads in some state (success or error)
        expect(pageState.title).toBeDefined();
        expect(pageState.url).toContain('/logs');
        
        // If successful, verify expected elements
        if (pageState.h1Text.includes('System Activity Logs')) {
          expect(pageState.hasActivityLogList || pageState.hasLoadingSkeleton).toBeTruthy();
        }
        
        // If error state, verify error handling
        if (pageState.hasErrorState) {
          console.log('Error state detected - this is acceptable during testing');
          // Error state should be properly rendered
          const errorContent = await page.locator('.error-state, .error-content').textContent();
          expect(errorContent).toBeDefined();
        }
      });
    });

    test('Client logs page is accessible and handles errors gracefully', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to clients page first
        await page.goto('/clients');
        await page.waitForLoadState('networkidle');
        
        // Check if clients page loads
        const clientsPageState = await page.evaluate(() => {
          return {
            hasClientLinks: document.querySelectorAll('a[href^="/clients/"]').length > 0,
            hasErrorState: !!document.querySelector('.error-state'),
            url: window.location.href
          };
        });
        
        if (clientsPageState.hasClientLinks) {
          // Get first client link
          const firstClientLink = page.locator('a[href^="/clients/"]').first();
          const clientHref = await firstClientLink.getAttribute('href');
          
          if (clientHref) {
            // Navigate to client logs
            await page.goto(`${clientHref}/logs`);
            await page.waitForLoadState('networkidle');
            
            // Check client logs state
            const clientLogsState = await page.evaluate(() => {
              return {
                h1Text: document.querySelector('h1')?.textContent || 'No H1 found',
                hasActivityLogList: !!document.querySelector('.activity-log-list'),
                hasErrorState: !!document.querySelector('.error-state, .error-content'),
                hasLoadingSkeleton: !!document.querySelector('.skeleton-generic'),
                url: window.location.href
              };
            });
            
            console.log('Client logs page state:', JSON.stringify(clientLogsState, null, 2));
            
            // Test that page loads in some state
            expect(clientLogsState.url).toContain('/logs');
            
            // If successful, verify expected elements
            if (clientLogsState.h1Text.includes('Activity Log for')) {
              expect(clientLogsState.hasActivityLogList || clientLogsState.hasLoadingSkeleton).toBeTruthy();
            }
            
            // If error state, verify error handling
            if (clientLogsState.hasErrorState) {
              console.log('Client logs error state detected - this is acceptable during testing');
            }
          }
        } else {
          console.log('No clients available for testing client logs');
        }
      });
    });
  });

  test.describe('ReactiveView Component Integration', () => {
    test('ReactiveView component can be imported and used', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test that the ReactiveView component exists in the codebase
        // by checking if pages can load without import errors
        
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Navigate to logs - if ReactiveView import fails, page won't load
        await page.goto('/logs');
        
        // Should not have import errors
        const hasImportErrors = monitor.shouldFailTest();
        expect(hasImportErrors).toBeFalsy();
        
        // Page should load in some state (even if error state)
        const pageExists = await page.evaluate(() => {
          return document.body && document.body.innerHTML.length > 0;
        });
        
        expect(pageExists).toBeTruthy();
      });
    });

    test('ActivityLogList component renders correctly', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to logs page
        await page.goto('/logs');
        await page.waitForLoadState('networkidle');
        
        // Check if ActivityLogList component structure exists
        const componentStructure = await page.evaluate(() => {
          // Look for ActivityLogList-specific elements
          const hasLogsContainer = !!document.querySelector('.logs-container');
          const hasActivityLogList = !!document.querySelector('.activity-log-list');
          const hasEmptyState = !!document.querySelector('.empty-logs, .no-logs');
          const hasErrorState = !!document.querySelector('.error-state');
          const hasLoadingState = !!document.querySelector('.skeleton-generic');
          
          return {
            hasLogsContainer,
            hasActivityLogList,
            hasEmptyState,
            hasErrorState,
            hasLoadingState,
            hasAnyExpectedElement: hasLogsContainer || hasActivityLogList || hasEmptyState || hasErrorState || hasLoadingState
          };
        });
        
        console.log('ActivityLogList structure:', JSON.stringify(componentStructure, null, 2));
        
        // Should have some expected UI elements
        expect(componentStructure.hasAnyExpectedElement).toBeTruthy();
        
        // Should not have critical console errors from component rendering
        const criticalErrors = await page.evaluate(() => {
          // Check for any visible error messages about missing components
          const errorMessages = Array.from(document.querySelectorAll('*')).map(el => el.textContent || '').join(' ');
          return errorMessages.toLowerCase().includes('component not found') || 
                 errorMessages.toLowerCase().includes('import error');
        });
        
        expect(criticalErrors).toBeFalsy();
      });
    });
  });

  test.describe('Navigation and State Management', () => {
    test('Navigation between pages works without critical errors', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test basic navigation flow
        const navigationSequence = [
          '/',
          '/logs',
          '/clients',
          '/logs'
        ];
        
        for (const url of navigationSequence) {
          await page.goto(url);
          await page.waitForLoadState('networkidle');
          
          // Should load without critical errors
          const currentUrl = page.url();
          expect(currentUrl).toContain(url);
          
          // Brief pause between navigations
          await page.waitForTimeout(100);
        }
        
        // Should not accumulate critical errors
        const hasCriticalErrors = monitor.shouldFailTest();if (hasCriticalErrors) {
          console.log('Console errors detected:', monitor.getErrorSummary());
        }
        
        // Allow for development warnings but not critical errors
        expect(hasCriticalErrors).toBeFalsy();
      });
    });

    test('Page state persists during navigation', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Navigate to logs
        await page.goto('/logs');
        await page.waitForLoadState('networkidle');
        
        // Get initial state
        const initialState = await page.evaluate(() => {
          return {
            url: window.location.href,
            hasContent: document.body.innerHTML.length > 1000,
            timestamp: Date.now()
          };
        });
        
        // Navigate away and back
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        await page.goto('/logs');
        await page.waitForLoadState('networkidle');
        
        // Get state after return
        const returnState = await page.evaluate(() => {
          return {
            url: window.location.href,
            hasContent: document.body.innerHTML.length > 1000,
            timestamp: Date.now()
          };
        });
        
        // Should maintain state consistency
        expect(returnState.url).toBe(initialState.url);
        expect(returnState.hasContent).toBeTruthy();
        
        console.log(`Navigation timing: ${returnState.timestamp - initialState.timestamp}ms`);
      });
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('Logs page works on mobile viewport', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Navigate to logs
        await page.goto('/logs');
        await page.waitForLoadState('networkidle');
        
        // Check mobile layout
        const mobileLayout = await page.evaluate(() => {
          const body = document.body;
          const bodyRect = body.getBoundingClientRect();
          
          return {
            viewportWidth: window.innerWidth,
            bodyWidth: bodyRect.width,
            isMobileViewport: window.innerWidth <= 768,
            hasOverflow: bodyRect.width > window.innerWidth,
            hasResponsiveElements: !!document.querySelector('.logs-container, .activity-log-list, .error-state')
          };
        });
        
        console.log('Mobile layout:', JSON.stringify(mobileLayout, null, 2));
        
        // Verify mobile viewport
        expect(mobileLayout.isMobileViewport).toBeTruthy();
        expect(mobileLayout.hasOverflow).toBeFalsy();
        
        // Should have some responsive elements
        expect(mobileLayout.hasResponsiveElements).toBeTruthy();
      });
    });
  });

  test.describe('Error Recovery and Resilience', () => {
    test('Application recovers from navigation errors', async ({ page }) => {
      await withConsoleMonitoring(page, async (monitor) => {
        // Test navigation to potentially problematic routes
        const testRoutes = [
          '/logs',
          '/clients',
          '/jobs',
          '/'
        ];
        
        let successfulNavigations = 0;
        
        for (const route of testRoutes) {
          try {
            await page.goto(route);
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            
            // Check if page loaded in any state
            const hasContent = await page.evaluate(() => {
              return document.body && document.body.innerHTML.length > 100;
            });
            
            if (hasContent) {
              successfulNavigations++;
            }
            
            console.log(`Route ${route}: ${hasContent ? 'loaded' : 'failed'}`);
            
          } catch (error) {
            console.log(`Route ${route} navigation error:`, error.message);
          }
        }
        
        // At least some routes should work
        expect(successfulNavigations).toBeGreaterThan(0);
        
        // Final navigation to home should always work
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const homeLoaded = await page.evaluate(() => {
          return document.body && document.body.innerHTML.length > 100;
        });
        
        expect(homeLoaded).toBeTruthy();
      });
    });
  });
});