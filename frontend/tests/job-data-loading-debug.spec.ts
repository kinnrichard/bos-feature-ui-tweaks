/**
 * Job Data Loading Debug Test
 * 
 * Tests if job data is actually being loaded properly.
 */

import { test, expect } from '@playwright/test';
import { createPageTest } from './pages/helpers/page-test-wrapper';
import { JobsTestHelper } from './pages/helpers/jobs-test-helper';

test.describe('Job Data Loading Debug', () => {
  test.setTimeout(30000);

  createPageTest(
    'should load job data with tasks',
    async (page, { factory, cleanup }) => {
      console.log('=== Starting job data loading test ===');
      
      const jobsHelper = new JobsTestHelper(page, factory);
      
      // Create a simple scenario
      const scenario = await jobsHelper.createJobsScenario({
        jobCount: 1,
        tasksPerJob: 1,
      });
      cleanup.push(scenario.cleanup);
      
      const job = scenario.jobs[0];
      const task = scenario.tasks[0];
      
      console.log(`Created job ${job.id} with task ${task.id}: "${task.title}"`);
      
      // Navigate to the job detail page
      await page.goto(`/jobs/${job.id}`);
      console.log(`Navigated to /jobs/${job.id}`);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Check current URL to make sure we're on the right page
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      expect(currentUrl).toContain(`/jobs/${job.id}`);
      
      // Check if job detail container exists
      const jobDetailContainer = page.locator('.job-detail-container');
      await expect(jobDetailContainer).toBeVisible({ timeout: 10000 });
      console.log('✅ Job detail container is visible');
      
      // Check if JobDetailView exists
      const jobDetailView = page.locator('.job-detail-view');
      await expect(jobDetailView).toBeVisible({ timeout: 5000 });
      console.log('✅ JobDetailView component is visible');
      
      // Check if job title is visible
      const jobTitle = page.locator('.job-title, h1');
      await expect(jobTitle).toBeVisible({ timeout: 5000 });
      const titleText = await jobTitle.textContent();
      console.log(`✅ Job title visible: "${titleText}"`);
      
      // Check if tasks section exists
      const tasksSection = page.locator('.tasks-section');
      await expect(tasksSection).toBeVisible({ timeout: 5000 });
      console.log('✅ Tasks section is visible');
      
      // Check TaskList component
      const taskList = page.locator('.task-list');
      await expect(taskList).toBeVisible({ timeout: 5000 });
      console.log('✅ TaskList component is visible');
      
      // Now check for browser console logs to see debug output
      const consoleLogs = [];
      page.on('console', msg => {
        if (msg.text().includes('[JobDetailView]') || msg.text().includes('[TaskList]')) {
          consoleLogs.push(msg.text());
          console.log(`BROWSER: ${msg.text()}`);
        }
      });
      
      // Trigger a refresh to capture logs
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Wait a bit for logs to appear
      await page.waitForTimeout(2000);
      
      console.log(`Console logs captured: ${consoleLogs.length}`);
      
      // Check for task elements one more time
      const taskElements = page.locator('[data-task-id]');
      const taskCount = await taskElements.count();
      console.log(`Task elements found: ${taskCount}`);
      
      if (taskCount === 0) {
        // Log the HTML content around tasks section
        const tasksHtml = await tasksSection.innerHTML();
        console.log('Tasks section HTML:', tasksHtml);
        
        // Check if there are any error messages
        const errors = await page.locator('.error, .error-message').allTextContents();
        console.log('Errors found:', errors);
        
        // Check loading states
        const loadingElements = await page.locator('.loading, .spinner').count();
        console.log('Loading elements:', loadingElements);
      }
      
      console.log('=== Job data loading test completed ===');
    },
    {
      description: 'Validates that job data loads properly and tasks are passed to components',
    }
  );
});