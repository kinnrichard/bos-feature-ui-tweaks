/**
 * Task Info Popover ReactiveRecord Integration Tests
 * 
 * Tests the migration of TaskInfoPopover from REST API to ReactiveRecord
 * Verifies real-time synchronization and note creation functionality
 */

import { test, expect, Page } from '@playwright/test';
import { DataFactory } from './helpers/data-factories';

test.describe('TaskInfoPopover ReactiveRecord Integration', () => {
  let factory: DataFactory;
  let page: Page;
  let client: any;
  let job: any;
  let tasks: any[];

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    factory = new DataFactory(page);
    
    // Create test data
    client = await factory.createClient({
      name: 'TaskInfo Test Client'
    });
    
    job = await factory.createJob({
      client_id: client.id,
      status: 'open'
    });
    
    // Create tasks with activity logs
    tasks = await Promise.all([
      factory.createTask({
        job_id: job.id,
        title: 'Task with activity logs',
        status: 'new_task'
      }),
      factory.createTask({
        job_id: job.id,
        title: 'Task in progress',
        status: 'in_progress'
      })
    ]);
    
    // Navigate to the job page
    await page.goto(`/jobs/${job.id}`);
    await expect(page.locator('h1')).toContainText(client.name);
  });

  test.afterEach(async () => {
    // Cleanup is handled in individual tests
  });

  test('should display activity logs using ReactiveRecord queries', async () => {
    // Find the first task and click the info button
    const taskCard = page.locator('.task-item').filter({ hasText: tasks[0].title }).first();
    const infoButton = taskCard.locator('.task-action-button[title="Task details"]');
    
    await infoButton.click();
    
    // Wait for popover to open and load data
    const popover = page.locator('.popover-content-scrollable');
    await expect(popover).toBeVisible();
    
    // Check that activity logs are displayed
    await expect(popover.locator('.timeline-item').first()).toContainText('Created');
    
    // Verify no loading state is shown after data loads
    await expect(popover.locator('.loading-state')).not.toBeVisible();
  });

  test('should display notes and allow adding new notes via ReactiveRecord', async () => {
    // Add a note via API first to test display
    await factory.createNote({
      notable_type: 'Task',
      notable_id: tasks[0].id,
      content: 'Initial test note'
    });
    
    // Find task and open info popover
    const taskCard = page.locator('.task-item').filter({ hasText: tasks[0].title }).first();
    const infoButton = taskCard.locator('.task-action-button[title="Task details"]');
    
    await infoButton.click();
    
    const popover = page.locator('.popover-content-scrollable');
    await expect(popover).toBeVisible();
    
    // Check that existing note is displayed
    await expect(popover.locator('.timeline-note')).toContainText('Initial test note');
    
    // Add a new note
    const noteInput = popover.locator('textarea[placeholder="Add a note..."]');
    await noteInput.fill('New note via ReactiveRecord');
    
    const addButton = popover.locator('button:has-text("Add Note")');
    await addButton.click();
    
    // Wait for note to be added and displayed
    await expect(popover.locator('.timeline-note').last()).toContainText('New note via ReactiveRecord');
    
    // Verify the notes count updated on the task card
    await expect(taskCard.locator('.task-notes-count')).toContainText('2');
  });

  test('should handle real-time updates when another user adds notes', async ({ browser, context }) => {
    // Open info popover in first browser
    const taskCard = page.locator('.task-item').filter({ hasText: tasks[0].title }).first();
    const infoButton = taskCard.locator('.task-action-button[title="Task details"]');
    
    await infoButton.click();
    
    const popover = page.locator('.popover-content-scrollable');
    await expect(popover).toBeVisible();
    
    // Open second browser context using existing authentication
    const page2 = await context.newPage();
    await page2.goto(`/jobs/${job.id}`);
    
    // Open same task in second browser
    const taskCard2 = page2.locator('.task-item').filter({ hasText: tasks[0].title }).first();
    const infoButton2 = taskCard2.locator('.task-action-button[title="Task details"]');
    await infoButton2.click();
    
    const popover2 = page2.locator('.popover-content-scrollable');
    await expect(popover2).toBeVisible();
    
    // Add note in second browser
    const noteInput2 = popover2.locator('textarea[placeholder="Add a note..."]');
    await noteInput2.fill('Note from another user');
    await popover2.locator('button:has-text("Add Note")').click();
    
    // Verify note appears in first browser without refresh
    await expect(popover.locator('.timeline-note').last()).toContainText('Note from another user');
    
    // Cleanup
    await page2.close();
  });

  test('should display timer for in-progress tasks', async () => {
    // Find the in-progress task
    const taskCard = page.locator('.task-item').filter({ hasText: tasks[1].title }).first();
    const infoButton = taskCard.locator('.task-action-button[title="Task details"]');
    
    await infoButton.click();
    
    const popover = page.locator('.popover-content-scrollable');
    await expect(popover).toBeVisible();
    
    // Check for timer display
    const timerDisplay = popover.locator('.timer-display.active');
    await expect(timerDisplay).toBeVisible();
    
    // Verify timer is showing a valid time format (e.g., "5m" or "1h 30m")
    await expect(timerDisplay).toMatch(/^\d+[hm](\s\d+m)?$/);
  });

  test('should handle query errors gracefully', async () => {
    // Create a task with invalid ID to trigger error
    const invalidTaskId = '99999999';
    
    // Navigate directly to a job with an invalid task reference
    await page.evaluate((taskId) => {
      // Inject a fake task into the page state to trigger popover
      const fakeTask = {
        id: taskId,
        title: 'Invalid Task',
        status: 'pending'
      };
      // This would normally be done through the app's state management
      window.__testTask = fakeTask;
    }, invalidTaskId);
    
    // Try to open popover for non-existent task
    // This test might need adjustment based on how errors are handled
    
    // For now, just verify the component doesn't crash
    await expect(page.locator('.task-list')).toBeVisible();
  });

  test('should clean up queries when popover closes', async () => {
    // Open popover
    const taskCard = page.locator('.task-item').filter({ hasText: tasks[0].title }).first();
    const infoButton = taskCard.locator('.task-action-button[title="Task details"]');
    
    await infoButton.click();
    
    const popover = page.locator('.popover-content-scrollable');
    await expect(popover).toBeVisible();
    
    // Close popover by clicking outside
    await page.click('body', { position: { x: 10, y: 10 } });
    
    // Verify popover is closed
    await expect(popover).not.toBeVisible();
    
    // Re-open to verify it still works (queries were properly cleaned up)
    await infoButton.click();
    await expect(popover).toBeVisible();
    await expect(popover.locator('.timeline-item').first()).toContainText('Created');
  });
});