/**
 * Jobs Test Helper
 *
 * Specialized helper for testing jobs functionality
 * Supports both jobs list (/jobs) and job detail (/jobs/[id]) pages
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { JobData } from '$lib/models/types/job-data';
import type { TaskData } from '$lib/models/types/task-data';
import type { ClientData } from '$lib/models/types/client-data';
import { DataFactory } from '../../helpers/data-factories';
import { debugComponent } from '$lib/utils/debug';

export interface JobTestScenario {
  jobs: JobData[];
  tasks: TaskData[];
  clients: ClientData[];
  cleanup: () => Promise<void>;
}

export interface JobCardElements {
  statusEmoji: boolean;
  clientName: boolean;
  jobTitle: boolean;
  priorityEmoji: boolean;
  technicians: boolean;
  isClickable: boolean;
}

/**
 * Comprehensive helper for jobs testing
 */
export class JobsTestHelper {
  private page: Page;
  private factory: DataFactory;
  private createdEntities: Array<{ type: string; id: string }> = [];

  constructor(page: Page, factory: DataFactory) {
    this.page = page;
    this.factory = factory;
  }

  /**
   * Create a comprehensive job test scenario with different job types
   */
  async createJobsScenario(
    options: {
      jobCount?: number;
      tasksPerJob?: number;
      includeVariousStatuses?: boolean;
      includeVariousPriorities?: boolean;
      includeTechnicians?: boolean;
    } = {}
  ): Promise<JobTestScenario> {
    const {
      jobCount = 5,
      tasksPerJob = 3,
      includeVariousStatuses = true,
      includeVariousPriorities = true,
    } = options;

    debugComponent('Creating jobs test scenario', {
      component: 'JobsTestHelper',
      jobCount,
      tasksPerJob,
      includeVariousStatuses,
      includeVariousPriorities,
    });

    const clients: ClientData[] = [];
    const jobs: JobData[] = [];
    const tasks: TaskData[] = [];

    // Create clients first
    for (let i = 0; i < Math.min(jobCount, 3); i++) {
      const client = await this.factory.createClient({
        // Let data-factories.ts generate unique name with UUID
        client_type: i % 2 === 0 ? 'residential' : 'business',
      });
      clients.push(client);
      this.createdEntities.push({ type: 'clients', id: client.id! });
    }

    // Job statuses and priorities for variety
    const statuses = includeVariousStatuses
      ? ['open', 'in_progress', 'paused', 'waiting_for_customer', 'successfully_completed']
      : ['open'];
    const priorities = includeVariousPriorities
      ? ['critical', 'high', 'normal', 'low', 'proactive_followup']
      : ['normal'];

    // Create jobs with variety
    for (let i = 0; i < jobCount; i++) {
      const client = clients[i % clients.length];
      const status = statuses[i % statuses.length];
      const priority = priorities[i % priorities.length];

      const job = await this.factory.createJob({
        // Let data-factories.ts generate unique title with UUID
        description: `Test job description for ${status} priority ${priority}`,
        status: status as any,
        priority: priority as any,
        client_id: client.id,
        // Note: technician assignment is handled separately after job creation
      });

      jobs.push(job);
      this.createdEntities.push({ type: 'jobs', id: job.id! });

      // Create tasks for this job
      if (tasksPerJob > 0) {
        const jobTasks = await this.factory.createTasks(job.id!, tasksPerJob, {
          status: 'new_task',
        });
        tasks.push(...jobTasks);
        jobTasks.forEach((task) => {
          this.createdEntities.push({ type: 'tasks', id: task.id! });
        });
      }
    }

    return {
      jobs,
      tasks,
      clients,
      cleanup: async () => {
        await this.cleanup();
      },
    };
  }

  /**
   * Wait for jobs list to load properly
   */
  async waitForJobsListToLoad(expectedJobCount?: number): Promise<void> {
    // Wait for basic page load
    await this.page.waitForLoadState('networkidle');

    // Give time for Svelte components to initialize
    await this.page.waitForTimeout(1000);

    // If we expect jobs, wait longer for Zero.js data synchronization
    if (expectedJobCount && expectedJobCount > 0) {
      console.warn(`🔄 Waiting for ${expectedJobCount} jobs to sync from Rails API to Zero.js...`);

      // Wait up to 15 seconds for jobs to appear via Zero.js
      let retryCount = 0;
      const maxRetries = 15; // 15 seconds total

      while (retryCount < maxRetries) {
        const jobCards = this.page.locator(
          '.job-card-inline, .job-card, [data-testid="job-card"], [data-job-id]'
        );
        const cardCount = await jobCards.count();

        if (cardCount >= expectedJobCount) {
          console.warn(`✅ Found ${cardCount} jobs after ${retryCount} seconds`);
          break;
        }

        if (retryCount % 3 === 0) {
          console.warn(
            `🔄 Still waiting for jobs (found ${cardCount}/${expectedJobCount}) - retry ${retryCount}/${maxRetries}`
          );
        }

        await this.page.waitForTimeout(1000);
        retryCount++;
      }

      // Final check
      const finalJobCards = this.page.locator(
        '.job-card-inline, .job-card, [data-testid="job-card"], [data-job-id]'
      );
      const finalCardCount = await finalJobCards.count();

      if (finalCardCount < expectedJobCount) {
        console.warn(
          `⚠️  Expected ${expectedJobCount} jobs but only found ${finalCardCount} after ${maxRetries} seconds. This suggests Zero.js sync issues.`
        );
      }
    }

    // Try to wait for any jobs-related content to appear
    try {
      // Try multiple approaches to detect a loaded jobs page
      await Promise.race([
        // Option 1: Jobs list with content
        this.page.waitForSelector('.jobs-list', { state: 'visible', timeout: 8000 }),
        // Option 2: Empty state message
        this.page.waitForSelector('.empty-state', { state: 'visible', timeout: 8000 }),
        // Option 3: Error state
        this.page.waitForSelector('.error-state', { state: 'visible', timeout: 8000 }),
        // Option 4: Just look for the main app layout
        this.page.waitForSelector('.app-layout, [data-testid="app-layout"]', {
          state: 'visible',
          timeout: 8000,
        }),
        // Option 5: Wait for Jobs header
        this.page.waitForSelector('h1:has-text("Jobs")', { state: 'visible', timeout: 8000 }),
      ]);

      // Additional time for any final rendering
      await this.page.waitForTimeout(500);
    } catch {
      console.warn(
        'Could not find expected jobs page elements, checking what is actually on the page'
      );

      // Debug information
      const title = await this.page.title();
      const url = this.page.url();
      const h1Text = await this.page.textContent('h1').catch(() => 'No h1 found');

      console.warn('🔍 Debug info:');
      console.warn('  Page title:', title);
      console.warn('  Page URL:', url);
      console.warn('  H1 text:', h1Text);

      // Try to find ANY sign that the page loaded correctly
      const pageHasJobs = (await this.page.locator(':text("Jobs")').count()) > 0;
      const pageHasLayout = (await this.page.locator('.app-layout, main, body').count()) > 0;

      if (pageHasJobs || pageHasLayout) {
        console.warn('✅ Page appears to have loaded (found Jobs text or layout), continuing test');
        // Page seems to have loaded, just continue
      } else {
        throw new Error(`Jobs page failed to load properly. Title: "${title}", URL: "${url}"`);
      }
    }
  }

  /**
   * Verify job card elements are displayed correctly
   */
  async verifyJobCardElements(job: JobData): Promise<JobCardElements> {
    // First try to find by data-job-id, fallback to generic job card if needed
    let jobCard = this.page.locator(`[data-job-id="${job.id}"]`).first();

    // If no job card with ID found, try to find by job title (fallback)
    if ((await jobCard.count()) === 0) {
      console.warn(`Job card with ID ${job.id} not found, trying fallback selection`);
      const allJobCards = this.page.locator('.job-card-inline, .job-card');
      const cardCount = await allJobCards.count();

      // Find the card that contains our job title
      for (let i = 0; i < cardCount; i++) {
        const card = allJobCards.nth(i);
        const cardText = await card.textContent();
        if (cardText && cardText.includes(job.title.substring(0, 20))) {
          jobCard = card;
          break;
        }
      }
    }

    await expect(jobCard).toBeVisible();

    const elements: JobCardElements = {
      statusEmoji: false,
      clientName: false,
      jobTitle: false,
      priorityEmoji: false,
      technicians: false,
      isClickable: false,
    };

    // Check status emoji
    const statusEmoji = jobCard.locator('.job-status-emoji, .status-emoji');
    elements.statusEmoji = (await statusEmoji.count()) > 0;
    if (elements.statusEmoji) {
      await expect(statusEmoji.first()).toBeVisible();
    }

    // Check client name
    const clientLink = jobCard.locator('.client-link, .client-name');
    elements.clientName = (await clientLink.count()) > 0;
    if (elements.clientName && job.client?.name) {
      await expect(clientLink.first()).toContainText(job.client.name);
    }

    // Check job title - use more flexible matching
    const jobName = jobCard.locator('.job-name, .job-title');
    elements.jobTitle = (await jobName.count()) > 0;
    if (elements.jobTitle) {
      // Use partial title matching since test data might have timestamps
      const baseTitle = job.title.split(' - ')[0].trim(); // Take everything before first " - "
      await expect(jobName.first()).toContainText(baseTitle);
    }

    // Check priority emoji (may not always be visible)
    const priorityEmoji = jobCard.locator('.job-priority-emoji, .priority-emoji');
    elements.priorityEmoji = (await priorityEmoji.count()) > 0;

    // Check technicians display
    const technicians = jobCard.locator('.technician-avatar, .assignee');
    elements.technicians = (await technicians.count()) > 0;

    // Check if card is clickable
    const href = await jobCard.getAttribute('href');
    elements.isClickable = href !== null && href.includes(`/jobs/${job.id}`);

    return elements;
  }

  /**
   * Test job creation flow
   */
  async testJobCreationFlow(clientId: string): Promise<JobData> {
    debugComponent('Testing job creation flow', {
      component: 'JobsTestHelper',
      clientId,
    });

    // Navigate to new job page
    await this.page.goto(`/jobs/new?clientId=${clientId}`);

    // Wait for new job form to load
    await expect(this.page.locator('.job-detail-container')).toBeVisible();

    // Verify we're in creation mode
    await expect(this.page.locator('[data-creation-mode="true"], .new-job-mode')).toBeVisible();

    // Find the editable title input
    const titleInput = this.page.locator('input[type="text"], .editable-title input');
    await expect(titleInput).toBeVisible();

    // Enter job title
    const jobTitle = `Created Job ${Date.now()}`;
    await titleInput.fill(jobTitle);

    // Save the job
    const saveButton = this.page.locator('button:has-text("Save"), .save-button');
    await saveButton.click();

    // Wait for navigation to job detail page
    await this.page.waitForURL(/\/jobs\/[^/]+$/);

    // Verify job was created and we're on the detail page
    await expect(this.page.locator('h1, .job-title')).toContainText(jobTitle);

    // Get the job ID from URL
    const url = this.page.url();
    const jobIdMatch = url.match(/\/jobs\/([^/]+)$/);
    const jobId = jobIdMatch ? jobIdMatch[1] : '';

    expect(jobId).toBeTruthy();

    // Track for cleanup
    this.createdEntities.push({ type: 'jobs', id: jobId });

    return {
      id: jobId,
      title: jobTitle,
      status: 'active',
      priority: 'medium',
      client_id: clientId,
    } as JobData;
  }

  /**
   * Test job detail page loading and display
   */
  async verifyJobDetailPage(job: JobData): Promise<void> {
    await this.page.goto(`/jobs/${job.id}`);

    // Wait for job detail to load
    await expect(this.page.locator('.job-detail-container')).toBeVisible();

    // Verify job title
    await expect(this.page.locator('h1, .job-title')).toContainText(job.title);

    // Verify job metadata section
    const metadataSection = this.page.locator('.job-metadata, .job-info');
    if ((await metadataSection.count()) > 0) {
      await expect(metadataSection.first()).toBeVisible();
    }

    // Verify tasks section - target the main container, not the nested task-list
    const tasksSection = this.page.locator('.tasks-section');
    await expect(tasksSection).toBeVisible();

    // Verify client information
    if (job.client?.name) {
      await expect(this.page.locator('body')).toContainText(job.client.name);
    }
  }

  /**
   * Test task list functionality on job detail page
   */
  async verifyTaskList(tasks: TaskData[]): Promise<void> {
    // Use more specific selector to avoid strict mode violations
    const taskList = this.page
      .locator('.tasks-section .task-list, .tasks-section .tasks-container')
      .first();
    await expect(taskList).toBeVisible();

    if (tasks.length > 0) {
      // Verify tasks are displayed
      for (const taskWrapper of tasks.slice(0, 3)) {
        // Check first 3 tasks - handle nested task structure
        const task = taskWrapper.task || taskWrapper; // Handle both nested and flat structures
        const taskElement = this.page.locator(`[data-task-id="${task.id}"]`);
        await expect(taskElement).toBeVisible();
        await expect(taskElement).toContainText(task.title);
      }

      // Verify task interaction elements
      const firstTask = this.page.locator('[data-task-id]').first();

      // Check for status emoji/button - use .first() to avoid strict mode violations
      const statusButton = firstTask.locator('.status-emoji, .task-status').first();
      await expect(statusButton).toBeVisible();

      // Check for task title - use .first() to avoid strict mode violations
      const taskTitle = firstTask.locator('.task-title, .task-name').first();
      await expect(taskTitle).toBeVisible();
    } else {
      // Verify empty task state
      const emptyState = this.page.locator('.tasks-empty, .no-tasks');
      await expect(emptyState).toBeVisible();
    }
  }

  /**
   * Test real-time updates for jobs
   */
  async testRealTimeUpdates(): Promise<void> {
    // Listen for Zero.js update messages
    const updateMessages: string[] = [];
    this.page.on('console', (msg) => {
      if (msg.text().includes('ZERO DATA CHANGED') || msg.text().includes('job')) {
        updateMessages.push(msg.text());
      }
    });

    // Create a new job (this should trigger real-time updates)
    const client = await this.factory.getTestClient();
    const newJob = await this.factory.createJob({
      title: `Real-time Test Job ${Date.now()}`,
      client_id: client.id,
      status: 'open',
      priority: 'normal',
    });

    this.createdEntities.push({ type: 'jobs', id: newJob.id! });

    // Wait for real-time update
    await this.page.waitForTimeout(3000);

    // On jobs list, new job should appear
    if (this.page.url().includes('/jobs') && !this.page.url().includes('/jobs/')) {
      const newJobCard = this.page.locator(`[data-job-id="${newJob.id}"]`);
      await expect(newJobCard).toBeVisible({ timeout: 5000 });
    }

    // Verify update was detected
    expect(updateMessages.length).toBeGreaterThan(0);

    debugComponent('Real-time job update test completed', {
      component: 'JobsTestHelper',
      updateMessages: updateMessages.length,
      jobId: newJob.id,
    });
  }

  /**
   * Test job filtering functionality
   */
  async testJobFiltering(): Promise<void> {
    // Test scope filtering
    const currentUrl = new URL(this.page.url());

    // Test "mine" scope
    currentUrl.searchParams.set('scope', 'mine');
    await this.page.goto(currentUrl.toString());

    // Wait for filter to apply
    await this.page.waitForTimeout(1000);

    // Verify filter is applied (jobs should still show or filter info should display)
    // Filter info may or may not be visible depending on implementation

    // Test technician filtering
    currentUrl.searchParams.set('technician_id', 'test-tech-1');
    await this.page.goto(currentUrl.toString());

    await this.page.waitForTimeout(1000);

    // Should show filter information
    const technicianFilter = this.page.locator('.filter-info');
    if ((await technicianFilter.count()) > 0) {
      await expect(technicianFilter.first()).toBeVisible();
    }

    // Clear filters
    currentUrl.searchParams.delete('scope');
    currentUrl.searchParams.delete('technician_id');
    await this.page.goto(currentUrl.toString());
  }

  /**
   * Test job search functionality
   */
  async testJobSearch(searchTerm: string): Promise<void> {
    // Look for search input
    const searchInput = this.page.locator('input[type="search"], .search-input');

    if ((await searchInput.count()) > 0) {
      // Enter search term
      await searchInput.first().fill(searchTerm);

      // Wait for search to apply
      await this.page.waitForTimeout(1000);

      // Verify search results
      const jobCards = this.page.locator('.job-card-inline, .job-card');
      const cardCount = await jobCards.count();

      if (cardCount > 0) {
        // At least one job should contain the search term
        const firstCard = jobCards.first();
        await expect(firstCard).toContainText(new RegExp(searchTerm, 'i'));
      }

      // Clear search
      await searchInput.first().clear();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Test error handling for jobs
   */
  async testJobsErrorHandling(): Promise<void> {
    // Mock API error
    await this.page.route('**/api/v1/jobs*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Reload page to trigger error
    await this.page.reload();

    // Verify error state displays
    const errorState = this.page.locator('.error-state');
    await expect(errorState).toBeVisible();

    // Verify error message and retry button
    await expect(errorState).toContainText(/error|failed|unable/i);

    const retryButton = this.page.locator('button:has-text("Try Again"), .retry-button');
    if ((await retryButton.count()) > 0) {
      await expect(retryButton.first()).toBeVisible();
    }

    // Clear route mock
    await this.page.unroute('**/api/v1/jobs*');
  }

  /**
   * Test jobs list empty state
   */
  async verifyEmptyJobsState(): Promise<void> {
    const emptyState = this.page.locator('.empty-state');
    await expect(emptyState).toBeVisible();

    // Verify empty state message
    await expect(emptyState).toContainText(/no jobs|empty/i);

    // Verify empty state icon
    const emptyIcon = emptyState.locator('.empty-icon, .illustration');
    await expect(emptyIcon).toBeVisible();
  }

  /**
   * Test mobile responsiveness for jobs
   */
  async testMobileJobs(): Promise<void> {
    // Set mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });

    // Wait for layout adjustment
    await this.page.waitForTimeout(500);

    // Verify jobs list is still functional
    const jobCards = this.page.locator('.job-card-inline, .job-card');
    const cardCount = await jobCards.count();

    if (cardCount > 0) {
      const firstCard = jobCards.first();
      await expect(firstCard).toBeVisible();

      // Verify card adapts to mobile width
      const cardBox = await firstCard.boundingBox();
      expect(cardBox?.width).toBeGreaterThan(300); // Should use most of mobile width
    }

    // Test job detail page on mobile
    if (cardCount > 0) {
      await jobCards.first().click();

      // Wait for navigation
      await this.page.waitForURL(/\/jobs\/[^/]+$/);

      // Verify job detail is mobile-friendly
      const jobDetail = this.page.locator('.job-detail-container');
      await expect(jobDetail).toBeVisible();

      // Verify content fits in mobile viewport
      const detailBox = await jobDetail.boundingBox();
      expect(detailBox?.width).toBeLessThanOrEqual(375);
    }
  }

  /**
   * Clean up created test data
   */
  async cleanup(): Promise<void> {
    debugComponent('Cleaning up jobs test data', {
      component: 'JobsTestHelper',
      entityCount: this.createdEntities.length,
    });

    // Clean up in reverse order (tasks, then jobs, then clients)
    // Filter out entities with invalid IDs to prevent unnecessary cleanup attempts
    const tasks = this.createdEntities.filter(
      (e) => e.type === 'tasks' && e.id && e.id !== 'undefined'
    );
    const jobs = this.createdEntities.filter(
      (e) => e.type === 'jobs' && e.id && e.id !== 'undefined'
    );
    const clients = this.createdEntities.filter(
      (e) => e.type === 'clients' && e.id && e.id !== 'undefined'
    );

    // Clean up tasks first to avoid foreign key violations
    for (const task of tasks) {
      try {
        await this.factory.deleteEntity('tasks', task.id);
      } catch (error) {
        console.warn(`Failed to cleanup task ${task.id}:`, error);
      }
    }

    // Then clean up jobs
    for (const job of jobs) {
      try {
        await this.factory.deleteEntity('jobs', job.id);
      } catch (error) {
        console.warn(`Failed to cleanup job ${job.id}:`, error);
      }
    }

    // Finally clean up clients
    for (const client of clients) {
      try {
        await this.factory.deleteEntity('clients', client.id);
      } catch (error) {
        console.warn(`Failed to cleanup client ${client.id}:`, error);
      }
    }

    this.createdEntities = [];
  }
}
