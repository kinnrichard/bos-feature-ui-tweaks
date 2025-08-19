/* eslint-disable no-console */
import { test, expect } from '@playwright/test';
import { DataFactory } from '../../helpers/data-factories';

test.describe('Jobs List Page', () => {
  let dataFactory: DataFactory;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers for real database testing
    dataFactory = new DataFactory(page);
  });

  test.describe('Display & Structure', () => {
    test('should display jobs list with proper structure', async ({ page }) => {
      // Create real test data with unique names
      const timestamp = Date.now();
      const client = await dataFactory.createClient({ name: `Test Client ${timestamp}` });
      const job = await dataFactory.createJob({
        title: `Test Job ${timestamp}`,
        description: 'Test job description',
        status: 'in_progress',
        priority: 'high',
        client_id: client.id,
      });

      console.log(`Created job with ID: ${job.id}`);

      await page.goto('/jobs?scope=all');

      // Wait for SvelteKit to fully load
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');

      // Debug: Check what page we're actually on
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);

      // Debug: Check if we see any content
      const h1Content = await page
        .locator('h1')
        .first()
        .textContent()
        .catch(() => null);
      console.log('H1 content:', h1Content);

      // Debug: Check what TanStack Query sees by reading console messages
      const messages = await page.evaluate(() => {
        // Capture console logs from the browser
        const logs: string[] = [];
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
          logs.push(
            `LOG: ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
          );
          originalLog.apply(console, args);
        };
        console.error = (...args) => {
          logs.push(
            `ERROR: ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
          );
          originalError.apply(console, args);
        };
        console.warn = (...args) => {
          logs.push(
            `WARN: ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
          );
          originalWarn.apply(console, args);
        };

        return logs;
      });
      console.log('Browser console messages captured:', messages.slice(-10)); // Last 10 messages

      // Debug: Check page content
      const pageContent = await page.textContent('body');
      console.log('Page content preview:', pageContent?.substring(0, 1000));

      // Should be authenticated via storageState, no login redirect expected

      // Check page title
      await expect(page.locator('h1')).toContainText('Jobs');

      // Debug: Check what the API returns (using authenticated session)
      const cookies = await page.context().cookies();
      console.log(
        'Page cookies:',
        cookies.map((c) => `${c.name}=${c.value}`)
      );

      const apiResponse = await page.request.get('http://localhost:4000/api/v1/jobs?scope=all', {
        headers: {
          Accept: 'application/json',
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
        },
      });
      const apiData = await apiResponse.json();
      console.log('API Response status:', apiResponse.status());
      console.log('API Response data:', JSON.stringify(apiData, null, 2));

      // Check if our specific job exists
      const specificJobResponse = await page.request.get(
        `http://localhost:4000/api/v1/jobs/${job.id}`,
        {
          headers: {
            Accept: 'application/json',
            Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
          },
        }
      );
      console.log('Specific job response status:', specificJobResponse.status());
      if (specificJobResponse.ok()) {
        const specificJobData = await specificJobResponse.json();
        console.log('Specific job data:', JSON.stringify(specificJobData, null, 2));
      }

      // Check if there are jobs or empty state
      const hasJobs = page.locator('.job-card-inline');
      const hasEmptyState = page.locator('.empty-state');

      const jobCount = await hasJobs.count();
      const emptyStateVisible = await hasEmptyState.isVisible();

      console.log(`Job cards found: ${jobCount}`);
      console.log(`Empty state visible: ${emptyStateVisible}`);

      if (jobCount > 0) {
        // Wait for the job card to appear
        await expect(page.locator('.job-card-inline')).toBeVisible({ timeout: 5000 });
      } else {
        console.log('No job cards found, checking if empty state is shown...');
        await expect(page.locator('.empty-state')).toBeVisible({ timeout: 5000 });
        // This is expected if the created job isn't returned by the API - let's investigate why
        throw new Error(
          `Created job with ID ${job.id} but API returned ${apiData.data?.length || 0} jobs`
        );
      }

      // Check job card contains all required elements
      const jobCard = page.locator('.job-card-inline').first();

      // Check status emoji is present
      await expect(jobCard.locator('.job-status-emoji')).toBeVisible();
      // Note: exact emoji content depends on configuration, just check it exists

      // Check client name is displayed (in Svelte it's within the client-link)
      await expect(jobCard.locator('.client-link')).toContainText(`Test Client ${timestamp}`);

      // Check job title is displayed
      await expect(jobCard.locator('.job-name')).toContainText(`Test Job ${timestamp}`);

      // Check priority emoji for high priority (should be visible for high priority)
      await expect(jobCard.locator('.job-priority-emoji')).toBeVisible();
    });

    test('job cards should be clickable and navigate correctly', async ({ page }) => {
      // Create test data first
      const timestamp = Date.now();
      const client = await dataFactory.createClient({
        name: `Navigation Test Client ${timestamp}`,
      });
      const job = await dataFactory.createJob({
        title: `Navigation Test Job ${timestamp}`,
        client_id: client.id,
      });

      await page.goto('/jobs');

      // Wait for job card to load
      const jobCard = page.locator('.job-card-inline').first();
      await expect(jobCard).toBeVisible();

      // Check that job card has the correct href (using real job ID)
      await expect(jobCard).toHaveAttribute('href', `/jobs/${job.id}`);

      // Check that job card has preload data attribute
      await expect(jobCard).toHaveAttribute('data-sveltekit-preload-data', 'hover');
    });
  });

  test.describe('Loading States', () => {
    test('should display loading skeleton while fetching', async ({ page }) => {
      // Add a delay to the real API to see loading state
      await page.route('**/api/v1/jobs*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.continue();
      });

      await page.goto('/jobs');

      // Should show loading skeleton initially
      await expect(page.locator('[data-testid="job-card-skeleton"]')).toBeVisible();
    });
  });

  test.describe('Empty & Error States', () => {
    test('should display empty state when no jobs', async ({ page }) => {
      // Capture network requests to verify correct port usage
      const requests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/')) {
          requests.push(`${request.method()} ${request.url()}`);
        }
      });

      // Don't create any jobs, so the database will be empty
      await page.goto('/jobs');

      // Wait for page to load and requests to complete
      await page.waitForLoadState('networkidle');

      // Debug: Print all API requests made and verify correct port
      console.log('API requests made:');
      requests.forEach((req) => {
        console.log(`  ${req}`);
        if (req.includes('localhost:4000')) {
          console.log('✅ Request made to correct port 4000');
        } else if (req.includes('localhost:3000')) {
          console.error('ERROR: Request made to wrong port 3000!');
        }
      });

      // Check if we can manually verify the API works
      const apiResponse = await page.request.get('http://localhost:4000/api/v1/jobs');
      console.log('Direct API test status:', apiResponse.status());
      console.log('Direct API test response:', await apiResponse.json());

      // Should show empty state (real API with no data)
      await expect(page.locator('.empty-state')).toBeVisible();
      await expect(page.locator('text=No jobs found')).toBeVisible();
      await expect(page.locator('text=📋')).toBeVisible(); // Empty state icon
    });

    test('should display error state when API fails', async ({ page }) => {
      // Mock API error on real endpoint
      await page.route('**/api/v1/jobs*', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.goto('/jobs');

      // Should show error state
      await expect(page.locator('.error-state')).toBeVisible();
      await expect(page.locator('text=Unable to load jobs')).toBeVisible();
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
    });

    test('should handle retry functionality', async ({ page }) => {
      let requestCount = 0;

      await page.route('**/api/v1/jobs*', async (route) => {
        requestCount++;
        if (requestCount === 1) {
          // First request fails
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Network error' }),
          });
        } else {
          // Subsequent requests succeed with real API response format
          await route.continue();
        }
      });

      await page.goto('/jobs');

      // Should show error state initially
      await expect(page.locator('.error-state')).toBeVisible();

      // Click retry button
      await page.click('button:has-text("Try Again")');

      // Should show success state after retry (empty since no jobs created)
      await expect(page.locator('.empty-state')).toBeVisible();
      expect(requestCount).toBe(2);
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      // Create test data first
      const timestamp = Date.now();
      const client = await dataFactory.createClient({ name: `Mobile Test Client ${timestamp}` });
      const job = await dataFactory.createJob({
        title: `Mobile Test Job ${timestamp}`,
        client_id: client.id,
      });
      void job; // Created for test data

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/jobs');

      // Wait for job card to load
      await expect(page.locator('.job-card-inline')).toBeVisible();

      // Check mobile responsive styling is applied
      const jobCard = page.locator('.job-card-inline').first();
      const box = await jobCard.boundingBox();

      // Job card should take most of screen width on mobile
      expect(box?.width).toBeGreaterThan(300);

      // Check that header actions are responsive
      await expect(page.locator('.page-header__actions')).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('should use fZero rune for real-time updates', async ({ page }) => {
      // Create initial test data
      const timestamp = Date.now();
      const client = await dataFactory.createClient({ name: `Real-time Test Client ${timestamp}` });
      const job = await dataFactory.createJob({
        title: `Real-time Test Job ${timestamp}`,
        description: 'Initial job description',
        status: 'in_progress',
        priority: 'high',
        client_id: client.id,
      });
      void job; // Created for test data

      // Navigate to jobs page
      await page.goto('/jobs');

      // Wait for initial job to load
      await expect(page.locator('.job-card-inline')).toBeVisible();

      // Verify initial job is displayed
      await expect(page.locator('.job-card-inline').first()).toContainText(
        `Real-time Test Job ${timestamp}`
      );

      // Listen for console messages to verify fZero rune is working
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('🔥 ZERO DATA CHANGED!')) {
          consoleMessages.push(msg.text());
        }
      });

      // Create a new job while the page is loaded to test real-time updates
      const newJob = await dataFactory.createJob({
        title: `New Job ${timestamp}`,
        description: 'New job for real-time testing',
        status: 'open',
        priority: 'normal',
        client_id: client.id,
      });
      void newJob; // Created for test data

      // Wait for real-time update to occur
      await expect(page.locator('.job-card-inline')).toHaveCount(2, { timeout: 10000 });

      // Verify the new job appears
      const jobCards = page.locator('.job-card-inline');
      await expect(jobCards).toHaveCount(2);

      // Check that we received Zero data change events
      expect(consoleMessages.length).toBeGreaterThan(0);
      console.log('Captured Zero data change events:', consoleMessages);
    });

    test('should use Svelte 5 patterns correctly', async ({ page }) => {
      // Create test data
      const timestamp = Date.now();
      const client = await dataFactory.createClient({ name: `Svelte5 Test Client ${timestamp}` });
      const job = await dataFactory.createJob({
        title: `Svelte5 Test Job ${timestamp}`,
        client_id: client.id,
      });
      void job; // Created for test data

      // Navigate to jobs page
      await page.goto('/jobs');

      // Wait for job to load
      await expect(page.locator('.job-card-inline')).toBeVisible();

      // Verify error handling works with new fZero rune
      await page.route('**/api/v1/jobs*', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Test error for Svelte 5 patterns' }),
        });
      });

      // Refresh to trigger error
      await page.reload();

      // Should show error state with new onclick handler
      await expect(page.locator('.error-state')).toBeVisible();
      await expect(page.locator('text=Unable to load jobs')).toBeVisible();

      // Test the new onclick handler (not on:click)
      const retryButton = page.locator('button:has-text("Try Again")');
      await expect(retryButton).toBeVisible();

      // Click should work with new syntax
      await retryButton.click();

      // Should capture console log for retry (testing console logging reduction)
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        if (msg.text().includes('🔄 Jobs page retry requested')) {
          consoleMessages.push(msg.text());
        }
      });

      await retryButton.click();

      // Wait for console message to appear
      await expect(async () => {
        expect(consoleMessages.length).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });
      console.log('Retry console messages:', consoleMessages);
    });
  });
});
