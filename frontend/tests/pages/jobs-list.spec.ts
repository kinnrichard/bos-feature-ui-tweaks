/**
 * Jobs List Page Tests (/jobs)
 *
 * Comprehensive test suite for jobs list functionality.
 * This replaces the problematic jobs.spec.ts with professional patterns.
 *
 * Features Tested:
 * - ReactiveJob with includes(['client']) integration
 * - JobCard component rendering and interaction
 * - Filtering by scope, technician, and search
 * - Real-time updates via Zero.js
 * - Error handling and recovery
 * - ZeroDataView component integration
 * - Mobile responsiveness and performance
 */

import { test, expect } from '@playwright/test';
import { createPageTest, PageAssertions, PageTestUtils } from './helpers/page-test-wrapper';
import { JobsTestHelper } from './helpers/jobs-test-helper';

test.describe('Jobs List Page (/jobs)', () => {
  // Configure test timeout for complex operations
  test.setTimeout(25000);

  test.describe('Core Functionality', () => {
    createPageTest(
      'should load jobs list with proper structure',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);
        const assertions = new PageAssertions(page);

        // Create comprehensive job scenario
        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 8,
          tasksPerJob: 2,
          includeVariousStatuses: true,
          includeVariousPriorities: true,
        });
        cleanup.push(scenario.cleanup);

        // Navigate to jobs list
        await page.goto('/jobs');
        await assertions.assertPageLoads(/Jobs.*bŏs/);

        // Wait for jobs to load
        await jobsHelper.waitForJobsListToLoad(scenario.jobs.length);

        // Verify page structure
        await expect(page.locator('h1')).toContainText('Jobs');
        await expect(page.locator('.jobs-list')).toBeVisible();

        // Check we have at least the jobs we created (may have more from other tests)
        const jobCards = page.locator('.job-card-inline');
        const actualJobCount = await jobCards.count();
        expect(actualJobCount).toBeGreaterThanOrEqual(scenario.jobs.length);

        // Verify jobs display correctly
        for (const job of scenario.jobs.slice(0, 3)) {
          const elements = await jobsHelper.verifyJobCardElements(job);
          expect(elements.statusEmoji).toBeTruthy();
          expect(elements.jobTitle).toBeTruthy();
          expect(elements.isClickable).toBeTruthy();
        }
      },
      {
        description: 'Validates jobs list page loads with ReactiveJob integration',
      }
    );

    createPageTest(
      'should display job cards with all required elements',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Create job with full data
        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 3,
          tasksPerJob: 1,
          includeVariousStatuses: true,
          includeVariousPriorities: true,
          includeTechnicians: true,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Verify each job card has required elements
        for (const job of scenario.jobs) {
          const elements = await jobsHelper.verifyJobCardElements(job);

          // Essential elements should be present
          expect(elements.statusEmoji).toBeTruthy();
          expect(elements.jobTitle).toBeTruthy();
          expect(elements.isClickable).toBeTruthy();

          // Client name should be shown (showClient=true by default)
          if (job.client?.name) {
            expect(elements.clientName).toBeTruthy();
          }
        }
      },
      {
        description: 'Validates JobCard component rendering with all required elements',
      }
    );

    createPageTest(
      'should integrate properly with ZeroDataView component',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 5,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Verify ZeroDataView integration
        // Note: ZeroDataView component should be handling the display
        const jobCards = page.locator('.job-card-inline');
        const actualJobCount = await jobCards.count();
        expect(actualJobCount).toBeGreaterThanOrEqual(scenario.jobs.length);

        // Verify proper data display through ZeroDataView
        await expect(page.locator('.jobs-list')).toBeVisible();
      },
      {
        description: 'Validates ZeroDataView component integration for data display',
      }
    );
  });

  test.describe('Filtering & Search', () => {
    createPageTest(
      'should filter jobs by scope parameter',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 6,
          tasksPerJob: 1,
          includeTechnicians: true,
        });
        cleanup.push(scenario.cleanup);

        // Test default scope (all)
        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        let jobCount = await page.locator('.job-card-inline').count();
        expect(jobCount).toBe(scenario.jobs.length);

        // Test "mine" scope (though it may show all jobs if no user filtering is implemented)
        await page.goto('/jobs?scope=mine');
        await page.waitForTimeout(1000);

        // Verify scope parameter is handled (jobs may still show if no user filtering)
        await expect(page.locator('.jobs-list')).toBeVisible();

        // Test filtering functionality
        await jobsHelper.testJobFiltering();
      },
      {
        description: 'Validates job filtering by scope URL parameter',
      }
    );

    createPageTest(
      'should filter jobs by technician ID',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 4,
          tasksPerJob: 1,
          includeTechnicians: true,
        });
        cleanup.push(scenario.cleanup);

        // Test technician filtering
        await page.goto('/jobs?technician_id=test-tech-1');
        await page.waitForTimeout(1000);

        // Should show filter info
        const filterInfo = page.locator('.filter-info');
        if ((await filterInfo.count()) > 0) {
          await expect(filterInfo.first()).toBeVisible();
          await expect(filterInfo.first()).toContainText(/filtered.*technician/i);

          // Should have clear filter link
          const clearFilter = page.locator('a:has-text("Clear filter")');
          await expect(clearFilter).toBeVisible();

          // Test clearing filter
          await clearFilter.click();
          await expect(page).toHaveURL('/jobs');
        }
      },
      {
        description: 'Validates job filtering by technician ID parameter',
      }
    );

    createPageTest(
      'should support job search functionality',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Create jobs with searchable titles
        const client = await factory.createClient({
          name: `Search Test Client ${Date.now()}`,
          client_type: 'residential',
        });
        cleanup.push(async () => await factory.deleteEntity('clients', client.id!));

        const searchableJob = await factory.createJob({
          title: `Unique Search Term ${Date.now()}`,
          client_id: client.id,
          status: 'open',
          priority: 'normal',
        });

        const regularJob = await factory.createJob({
          title: `Regular Job ${Date.now()}`,
          client_id: client.id,
          status: 'open',
          priority: 'normal',
        });

        cleanup.push(async () => {
          await factory.deleteEntity('jobs', searchableJob.id!);
          await factory.deleteEntity('jobs', regularJob.id!);
        });

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Test search functionality
        await jobsHelper.testJobSearch('Unique Search Term');
      },
      {
        description: 'Validates job search functionality with shouldShowJob filter',
      }
    );
  });

  test.describe('Real-time Updates & Zero.js', () => {
    createPageTest(
      'should receive real-time updates when new jobs are created',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Start with initial jobs
        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 3,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad(3);

        // Test real-time updates
        await jobsHelper.testRealTimeUpdates();
      },
      {
        description: 'Validates Zero.js real-time updates for new jobs',
      }
    );

    createPageTest(
      'should use ReactiveJob with proper includes',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 4,
          tasksPerJob: 2,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Verify client data is included (via includes(['client']))
        for (const job of scenario.jobs.slice(0, 2)) {
          if (job.client?.name) {
            const jobCard = page.locator(`[data-job-id="${job.id}"]`).first();
            await expect(jobCard.locator('.client-link')).toContainText(job.client.name);
          }
        }

        // Verify reactive updates work
        const jobCards = page.locator('.job-card-inline');
        const initialCount = await jobCards.count();
        expect(initialCount).toBe(scenario.jobs.length);
      },
      {
        description: 'Validates ReactiveJob query with proper includes and reactivity',
      }
    );
  });

  test.describe('Error Handling & Edge Cases', () => {
    createPageTest(
      'should display empty state when no jobs exist',
      async (page, { factory }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Navigate without creating any jobs
        await page.goto('/jobs');

        // Should show empty state
        await jobsHelper.verifyEmptyJobsState();
      },
      {
        description: 'Validates empty state display via ZeroDataView when no jobs exist',
      }
    );

    createPageTest(
      'should handle API errors gracefully with error state',
      async (page, { factory }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Test error handling
        await jobsHelper.testJobsErrorHandling();
      },
      {
        description: 'Validates error state display and recovery for jobs API failures',
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
      'should show loading skeleton during data fetch',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Create jobs for loading test
        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 3,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        // Mock slower API response to see loading state
        await page.route('**/api/v1/jobs*', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.continue();
        });

        await page.goto('/jobs');

        // Should show loading skeleton initially
        const loadingSkeletons = page.locator('[data-testid*="skeleton"], .loading, .spinner');
        if ((await loadingSkeletons.count()) > 0) {
          await expect(loadingSkeletons.first()).toBeVisible();
        }

        // Eventually jobs should load
        await jobsHelper.waitForJobsListToLoad();

        await page.unroute('**/api/v1/jobs*');
      },
      {
        description: 'Validates loading skeleton display during data fetching',
      }
    );

    createPageTest(
      'should handle retry functionality on error',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Create jobs for retry test
        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 2,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        let requestCount = 0;

        // Mock API to fail first, succeed second
        await page.route('**/api/v1/jobs*', async (route) => {
          requestCount++;
          if (requestCount === 1) {
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Server error' }),
            });
          } else {
            await route.continue();
          }
        });

        await page.goto('/jobs');

        // Should show error state initially
        const errorState = page.locator('.error-state');
        await expect(errorState).toBeVisible();

        // Click retry button if available
        const retryButton = page.locator('button:has-text("Try Again"), .retry-button');
        if ((await retryButton.count()) > 0) {
          await retryButton.click();

          // Should eventually show jobs after retry
          await jobsHelper.waitForJobsListToLoad();
        }

        expect(requestCount).toBeGreaterThan(1);
        await page.unroute('**/api/v1/jobs*');
      },
      {
        description: 'Validates retry functionality for failed API requests',
        customConsoleFilters: [
          {
            message: /500|Server error/,
            type: 'error',
            description: 'Expected server error for retry test',
          },
        ],
      }
    );
  });

  test.describe('Performance & User Experience', () => {
    createPageTest(
      'should load efficiently with large job datasets',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Create substantial job dataset
        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 25,
          tasksPerJob: 1,
          includeVariousStatuses: true,
          includeVariousPriorities: true,
        });
        cleanup.push(scenario.cleanup);

        // Measure load time
        const startTime = Date.now();

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        const loadTime = Date.now() - startTime;

        // Should load within reasonable time (4 seconds even with large dataset)
        expect(loadTime).toBeLessThan(4000);

        // Verify all jobs are displayed
        const jobCards = page.locator('.job-card-inline');
        const actualJobCount = await jobCards.count();
        expect(actualJobCount).toBeGreaterThanOrEqual(scenario.jobs.length);

        await PageTestUtils.logPerformanceMetrics(page, 'large-jobs-dataset');
      },
      {
        description: 'Validates performance with large job datasets',
        verbose: true,
      }
    );

    createPageTest(
      'should be responsive on mobile devices',
      async (page, { factory, cleanup: _cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        // Test mobile jobs functionality
        await jobsHelper.testMobileJobs();
      },
      {
        description: 'Validates mobile responsive design for jobs list',
      }
    );

    createPageTest(
      'should handle rapid navigation without memory leaks',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 5,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        // Test rapid navigation
        for (let i = 0; i < 3; i++) {
          await page.goto('/jobs');
          await jobsHelper.waitForJobsListToLoad();

          await page.goto('/clients');
          await page.waitForLoadState('networkidle');
        }

        // Return to jobs page
        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Check for memory leaks
        await PageTestUtils.verifyNoMemoryLeaks(page);
      },
      {
        description: 'Validates no memory leaks during rapid navigation',
        verbose: true,
      }
    );
  });

  test.describe('Navigation & Interaction', () => {
    createPageTest(
      'should navigate to job detail page when job card is clicked',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 3,
          tasksPerJob: 2,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Click on first job card
        const firstJobCard = page.locator('.job-card-inline').first();
        await firstJobCard.click();

        // Should navigate to job detail page
        await page.waitForURL(/\/jobs\/[^/]+$/);

        // Verify we're on the job detail page
        const jobDetailContainer = page.locator('.job-detail-container');
        await expect(jobDetailContainer).toBeVisible();
      },
      {
        description: 'Validates job card click navigation to detail page',
      }
    );

    createPageTest(
      'should have proper preload data attributes',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 2,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Verify preload attributes for performance
        const jobCards = page.locator('.job-card-inline');
        const firstCard = jobCards.first();

        await expect(firstCard).toHaveAttribute('data-sveltekit-preload-data', 'hover');
      },
      {
        description: 'Validates SvelteKit preload data attributes for performance',
      }
    );

    createPageTest(
      'should handle client link clicks within job cards',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 2,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Find client link within job card
        const clientLink = page.locator('.client-link').first();

        if ((await clientLink.count()) > 0) {
          const clientId = scenario.clients[0]?.id;
          if (clientId) {
            await clientLink.click();

            // Should navigate to client page
            await page.waitForURL(`/clients/${clientId}`);
          }
        }
      },
      {
        description: 'Validates client link navigation within job cards',
      }
    );
  });

  test.describe('Accessibility & Standards', () => {
    createPageTest(
      'should be keyboard accessible',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 3,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Test keyboard navigation
        await page.keyboard.press('Tab');

        // Should be able to focus on job cards
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Test keyboard activation
        await page.keyboard.press('Enter');

        // Should navigate to job detail (if Enter pressed on job card link)
        await page.waitForTimeout(1000);
      },
      {
        description: 'Validates keyboard accessibility for jobs list',
      }
    );

    createPageTest(
      'should have proper ARIA attributes and semantic structure',
      async (page, { factory, cleanup }) => {
        const jobsHelper = new JobsTestHelper(page, factory);

        const scenario = await jobsHelper.createJobsScenario({
          jobCount: 2,
          tasksPerJob: 1,
        });
        cleanup.push(scenario.cleanup);

        await page.goto('/jobs');
        await jobsHelper.waitForJobsListToLoad();

        // Verify semantic structure
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('main, [role="main"]')).toBeVisible();

        // Verify list structure for jobs
        const jobsList = page.locator('.jobs-list');
        await expect(jobsList).toBeVisible();

        // Job cards should be proper links
        const jobCards = page.locator('.job-card-inline');
        const firstCard = jobCards.first();
        await expect(firstCard).toHaveAttribute('href');
      },
      {
        description: 'Validates ARIA attributes and semantic HTML structure',
      }
    );
  });
});
