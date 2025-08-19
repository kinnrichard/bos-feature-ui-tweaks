/**
 * Real Database Integration Test Example
 * 
 * Demonstrates testing with actual Rails API and test database
 * This test shows the hybrid testing approach in action.
 */

import { expect } from '@playwright/test';
import { testWithRealDB, TestLifecycle } from './helpers/isolation';
import { AuthTestUtils } from './helpers/auth';
import { TestDataUtils } from './helpers/data-factories';

// Setup and teardown for the entire test suite
testWithRealDB.beforeAll(async () => {
  await TestLifecycle.setupSuite();
});

testWithRealDB.afterAll(async () => {
  await TestLifecycle.teardownSuite();
});

testWithRealDB.describe('Job Management with Real Database', () => {
  testWithRealDB.beforeEach(async ({ page, auth }) => {
    // Authenticate as admin user for each test
    await auth.setupAuthenticatedSession('admin');
  });

  testWithRealDB('should create and display a new job', async ({ 
    page, 
    factory, 
    cleanup 
  }) => {
    // Create test data via API
    const client = await factory.createClient({
      name: `Test Integration Client ${Date.now()}`,
      client_type: 'residential'
    });
    
    const job = await factory.createJob({
      title: 'Real DB Test Job',
      description: 'Testing with actual database',
      status: 'open',
      priority: 'high',
      client_id: client.id
    });

    // Track for cleanup
    cleanup.push(async () => {
      await factory.deleteEntity('jobs', job.id!);
      await factory.deleteEntity('clients', client.id!);
    });

    // Navigate to jobs page
    await page.goto('/jobs');

    // Verify the job appears in the UI
    await expect(page.locator('text=' + job.title)).toBeVisible();
    await expect(page.locator(`[data-job-id="${job.id}"]`)).toBeVisible();

    // Verify job details
    const jobCard = page.locator(`[data-job-id="${job.id}"]`);
    await expect(jobCard.locator('text=' + client.name)).toBeVisible();
    await expect(jobCard.locator('.priority-high, [data-priority="high"]')).toBeVisible();
  });

  testWithRealDB('should handle task creation workflow', async ({ 
    page, 
    factory, 
    cleanup 
  }) => {
    // Create job with real database
    const { job, tasks, cleanup: jobCleanup } = await factory.createJobWithTasks({
      title: 'Task Creation Test Job',
      status: 'open'
    }, 0); // Start with no tasks

    cleanup.push(jobCleanup);

    // Navigate to job detail page
    await page.goto(`/jobs/${job.id}`);

    // Wait for job to load
    await expect(page.locator('h1, .job-title')).toContainText(job.title);

    // Create a new task via UI
    const newTaskTitle = 'New Integration Test Task';
    
    // Find and use the new task input
    const taskInput = page.locator('input[placeholder*="task"], input[placeholder*="Task"], .new-task input');
    await taskInput.fill(newTaskTitle);
    await taskInput.press('Enter');

    // Wait for task to appear in UI
    await expect(page.locator('text=' + newTaskTitle)).toBeVisible();

    // Verify task was created in database
    const taskExists = await TestDataUtils.waitForEntity(page, 'tasks', '', 3000);
    expect(taskExists).toBeTruthy();

    // Verify task appears in API response
    const tasksResponse = await page.request.get(`/api/v1/jobs/${job.id}/tasks`);
    expect(tasksResponse.ok()).toBeTruthy();
    
    const tasksData = await tasksResponse.json();
    const createdTask = tasksData.data.find((task: any) => 
      task.attributes.title === newTaskTitle
    );
    expect(createdTask).toBeTruthy();
  });

  testWithRealDB('should handle task status updates', async ({ 
    page, 
    factory, 
    cleanup 
  }) => {
    // Create job with tasks
    const { job, tasks } = await factory.createJobWithTasks({
      title: 'Status Update Test Job'
    }, 3);

    cleanup.push(async () => {
      for (const task of tasks) {
        await factory.deleteEntity('tasks', task.id!);
      }
      await factory.deleteEntity('jobs', job.id!);
    });

    // Navigate to job page
    await page.goto(`/jobs/${job.id}`);

    // Find first task and change its status
    const firstTask = tasks[0];
    const taskElement = page.locator(`[data-task-id="${firstTask.id}"]`);
    await expect(taskElement).toBeVisible();

    // Click on status element (emoji or dropdown)
    const statusElement = taskElement.locator('.status-emoji, .task-status, [data-status]');
    await statusElement.click();

    // Select "in_progress" status
    const progressOption = page.locator('text=In Progress, text=in_progress').first();
    if (await progressOption.isVisible()) {
      await progressOption.click();
    } else {
      // Handle cycling interface by clicking multiple times
      await statusElement.click(); // May cycle to in_progress
    }

    // Wait for optimistic update in UI
    await expect(taskElement.locator('.status-in-progress, [data-status="in_progress"]')).toBeVisible();

    // Verify status was updated in database
    const taskData = await TestDataUtils.verifyEntityData(
      page,
      'tasks',
      firstTask.id!,
      { status: 'in_progress' }
    );
    expect(taskData).toBeTruthy();
  });

  testWithRealDB('should handle authentication flow', async ({ page }) => {
    // Clear any existing authentication
    await page.context().clearCookies();

    // Navigate to login page
    await page.goto('/login');

    // Test login with real API
    await AuthTestUtils.testLoginFlow(page, {
      email: 'admin@bos-test.local',
      password: 'password123'
    });

    // Verify successful authentication
    await expect(page).toHaveURL(/\/(?!login)/); // Not on login page
    
    // Verify we can access protected content
    await page.goto('/jobs');
    await expect(page.locator('body')).not.toContainText('Sign In');
  });

  testWithRealDB('should persist data across page reloads', async ({ 
    page, 
    factory, 
    cleanup 
  }) => {
    // Create test data
    const { job, tasks } = await factory.createJobWithTasks({
      title: 'Persistence Test Job'
    }, 2);

    cleanup.push(async () => {
      for (const task of tasks) {
        await factory.deleteEntity('tasks', task.id!);
      }
      await factory.deleteEntity('jobs', job.id!);
    });

    // Navigate to job and verify data loads
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('text=' + job.title)).toBeVisible();
    
    for (const task of tasks) {
      await expect(page.locator('text=' + task.title)).toBeVisible();
    }

    // Reload page
    await page.reload();

    // Verify data still loads from database
    await expect(page.locator('text=' + job.title)).toBeVisible();
    
    for (const task of tasks) {
      await expect(page.locator('text=' + task.title)).toBeVisible();
    }
  });

  testWithRealDB('should handle complex task hierarchies', async ({ 
    page, 
    factory, 
    cleanup 
  }) => {
    // Create job
    const job = await factory.createJob({
      title: 'Hierarchy Test Job'
    });

    // Create hierarchical task structure
    const hierarchy = await factory.createTaskHierarchy(job.id!);

    cleanup.push(async () => {
      for (const child of hierarchy.children) {
        await factory.deleteEntity('tasks', child.id!);
      }
      await factory.deleteEntity('tasks', hierarchy.parent.id!);
      await factory.deleteEntity('jobs', job.id!);
    });

    // Navigate to job page
    await page.goto(`/jobs/${job.id}`);

    // Verify parent task is visible
    await expect(page.locator('text=' + hierarchy.parent.title)).toBeVisible();

    // Verify child tasks are visible (may be collapsed initially)
    const parentElement = page.locator(`[data-task-id="${hierarchy.parent.id}"]`);
    
    // Check if hierarchy has disclosure controls
    const disclosureButton = parentElement.locator('.disclosure-button, .expand-button');
    if (await disclosureButton.isVisible()) {
      await disclosureButton.click();
    }

    // Verify child tasks appear
    for (const child of hierarchy.children) {
      await expect(page.locator('text=' + child.title)).toBeVisible();
    }
  });
});

testWithRealDB.describe('Error Handling with Real API', () => {
  testWithRealDB.beforeEach(async ({ page, auth }) => {
    await auth.setupAuthenticatedSession('admin');
  });

  testWithRealDB('should handle API errors gracefully', async ({ page }) => {
    // Navigate to non-existent job
    await page.goto('/jobs/non-existent-id');

    // Should show error message or redirect appropriately
    await expect(page.locator('body')).toContainText(/not found|error|404/i);
  });

  testWithRealDB('should handle network failures', async ({ page, factory }) => {
    // Create a job first
    const job = await factory.createJob({
      title: 'Network Test Job'
    });

    // Navigate to job
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('text=' + job.title)).toBeVisible();

    // Simulate network failure by blocking API requests
    await page.route('**/api/v1/**', route => route.abort());

    // Try to create a task (should handle failure gracefully)
    const taskInput = page.locator('input[placeholder*="task"], .new-task input');
    if (await taskInput.isVisible()) {
      await taskInput.fill('This should fail');
      await taskInput.press('Enter');

      // Should show error message
      await expect(page.locator('text=/error|failed|try again/i')).toBeVisible();
    }

    // Cleanup
    await page.unroute('**/api/v1/**');
    await factory.deleteEntity('jobs', job.id!);
  });
});

// Example of hybrid test - uses real DB for some operations, mocks for others
testWithRealDB.describe('Hybrid Testing Example', () => {
  testWithRealDB('should combine real data with selective mocking', async ({ 
    page, 
    factory 
  }) => {
    // Create real job data
    const job = await factory.createJob({
      title: 'Hybrid Test Job'
    });

    // Mock specific API endpoints that are expensive or unreliable
    await page.route('**/api/v1/notifications**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            type: 'notifications',
            attributes: { message: 'Mocked notification response' }
          }
        })
      });
    });

    // Use real API for core functionality
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('text=' + job.title)).toBeVisible();

    // Cleanup
    await factory.deleteEntity('jobs', job.id!);
  });
});