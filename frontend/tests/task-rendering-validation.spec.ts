/**
 * Task Rendering Validation Test
 * 
 * Tests basic task rendering functionality to identify core issues.
 */

import { test, expect } from '@playwright/test';
import { createPageTest } from './pages/helpers/page-test-wrapper';
import { JobsTestHelper } from './pages/helpers/jobs-test-helper';

test.describe('Task Rendering Validation', () => {
  test.setTimeout(30000);

  createPageTest(
    'should render basic task elements',
    async (page, { factory, cleanup }) => {
      console.log('=== Starting basic task rendering test ===');
      
      const jobsHelper = new JobsTestHelper(page, factory);
      
      // Create a simple scenario with one job and one task
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
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-task-rendering.png', fullPage: true });
      
      // Check if job detail container exists
      const jobDetailContainer = page.locator('.job-detail-container');
      await expect(jobDetailContainer).toBeVisible({ timeout: 10000 });
      console.log('✅ Job detail container is visible');
      
      // Check if task-related elements exist at all
      const taskElements = page.locator('[data-task-id]');
      const taskCount = await taskElements.count();
      console.log(`Task elements found: ${taskCount}`);
      
      if (taskCount === 0) {
        // Log page content for debugging
        const pageContent = await page.content();
        console.log('Page HTML (first 2000 chars):', pageContent.substring(0, 2000));
        
        // Run our debug script
        await page.addScriptTag({ path: './test-task-rendering-debug.js' });
        
        // Check for any JavaScript errors
        const errorMessages = await page.evaluate(() => {
          const errors = [];
          // @ts-ignore
          if (window.__errors) errors.push(...window.__errors);
          return errors;
        });
        console.log('JavaScript errors:', errorMessages);
      }
      
      // This assertion will fail if no tasks are rendered
      await expect(taskElements.first()).toBeVisible({ timeout: 10000 });
      console.log('✅ At least one task element is visible');
      
      // Verify the task has correct data
      const firstTask = taskElements.first();
      const taskId = await firstTask.getAttribute('data-task-id');
      expect(taskId).toBe(task.id);
      console.log(`✅ Task ID matches: ${taskId}`);
      
      // Check if task title is visible
      const taskTitle = firstTask.locator('.task-title, .task-name');
      await expect(taskTitle).toBeVisible();
      const titleText = await taskTitle.textContent();
      console.log(`✅ Task title visible: "${titleText}"`);
      
      console.log('=== Basic task rendering test completed successfully ===');
    },
    {
      description: 'Validates that tasks are rendered with correct attributes and content',
    }
  );
});