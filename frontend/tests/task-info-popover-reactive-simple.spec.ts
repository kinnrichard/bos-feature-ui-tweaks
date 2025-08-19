/**
 * Task Info Popover ReactiveRecord Integration Tests
 * 
 * Tests the migration of TaskInfoPopover from REST API to ReactiveRecord
 * Verifies real-time synchronization and note creation functionality
 */

import { test, expect } from '@playwright/test';
import { DataFactory } from './helpers/data-factories';

test.describe('TaskInfoPopover ReactiveRecord Integration', () => {
  let factory: DataFactory;

  test.beforeEach(async ({ page }) => {
    factory = new DataFactory(page);
  });

  test('should display activity logs and notes using ReactiveRecord queries', async ({ page }) => {
    // Create test data
    const client = await factory.createClient({
      name: `TaskInfo Test Client ${Date.now()}`
    });
    
    const job = await factory.createJob({
      client_id: client.id,
      status: 'open'
    });
    
    // Create a task
    const task = await factory.createTask({
      job_id: job.id,
      title: 'Task with reactive data',
      status: 'new_task'
    });
    
    // Wait a bit to ensure data is synced to Zero.js
    await page.waitForTimeout(2000);
    
    // Navigate to the job page
    await page.goto(`/jobs/${job.id}`);
    await page.waitForLoadState('networkidle');
    
    // Find the task and click the info button
    const taskCard = page.locator('.task-item').filter({ hasText: task.title }).first();
    await taskCard.waitFor();
    
    const infoButton = taskCard.locator('.task-action-button[title="Task details"]');
    await infoButton.click();
    
    // Wait for popover to open
    const popover = page.locator('.popover-content-scrollable');
    await expect(popover).toBeVisible();
    
    // Wait for popover to finish initializing
    await page.waitForTimeout(1000);
    
    // Check browser console for errors and debug logs
    await page.evaluate(() => {
      console.log('=== TaskInfoPopover Debug Info ===');
      // Check if Zero is available
      if (typeof window !== 'undefined' && (window as any).zero) {
        console.log('Zero client is available:', !!(window as any).zero);
        console.log('Zero state:', (window as any).zeroDebug?.getZeroState?.());
      } else {
        console.log('Zero client is NOT available');
      }
    });
    
    // Verify timeline loads (should show content or empty state, not loading)
    await expect(popover.locator('.loading-state').filter({ hasText: 'Loading task details...' })).not.toBeVisible({ timeout: 5000 });
    
    // Check that timeline content is displayed (either items or empty state)
    const timelineItems = popover.locator('.timeline-item');
    const emptyState = popover.locator('.empty-state');
    
    // Either we have timeline items or an empty state
    const hasItems = await timelineItems.count() > 0;
    const hasEmptyState = await emptyState.isVisible();
    
    expect(hasItems || hasEmptyState).toBeTruthy();
    
    // If we have items, verify the first one is Created
    if (hasItems) {
      await expect(popover.locator('.timeline-label').first()).toContainText('Created');
    }
    
    // Add a note
    const noteInput = popover.locator('textarea[placeholder="Add a note..."]');
    await noteInput.fill('Test note via ReactiveRecord');
    
    const addButton = popover.locator('button:has-text("Add Note")');
    await addButton.click();
    
    // Wait for note to be added
    await expect(popover.locator('.timeline-note')).toContainText('Test note via ReactiveRecord');
    
    // Clean up
    // TODO: Add cleanup methods to DataFactory
    // await factory.deleteTask(task.id);
    // await factory.deleteJob(job.id);
    // await factory.deleteClient(client.id);
  });
});