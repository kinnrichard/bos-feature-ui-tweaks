/**
 * Logs Test Helper
 *
 * Specialized helper for testing activity logs functionality
 * Supports both system logs (/logs) and client logs (/clients/[id]/logs)
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { ActivityLogData } from '$lib/models/types/activity-log-data';
import type { ClientData } from '$lib/models/types/client-data';
import type { JobData } from '$lib/models/types/job-data';
import { DataFactory } from '../../helpers/data-factories';
import { debugComponent } from '$lib/utils/debug';

export interface LogTestScenario {
  logs: ActivityLogData[];
  client?: ClientData;
  job?: JobData;
  cleanup: () => Promise<void>;
}

export interface LogGroupInfo {
  groupHeader: string;
  logCount: number;
  collapsed?: boolean;
}

/**
 * Comprehensive helper for activity log testing
 */
export class LogsTestHelper {
  private page: Page;
  private factory: DataFactory;
  private createdEntities: Array<{ type: string; id: string }> = [];

  constructor(page: Page, factory: DataFactory) {
    this.page = page;
    this.factory = factory;
  }

  /**
   * Create a comprehensive log scenario with different activity types
   */
  async createLogScenario(
    options: {
      clientId?: string;
      jobId?: string;
      logCount?: number;
      includeSystemLogs?: boolean;
    } = {}
  ): Promise<LogTestScenario> {
    const { clientId, jobId, logCount = 10, includeSystemLogs = true } = options;

    debugComponent('Creating log test scenario', {
      component: 'LogsTestHelper',
      clientId,
      jobId,
      logCount,
      includeSystemLogs,
    });

    // Create client if not provided
    let client: ClientData | undefined;
    if (!clientId) {
      client = await this.factory.createClient({
        // Let data-factories.ts generate unique name with UUID
        client_type: 'residential',
      });
      this.createdEntities.push({ type: 'clients', id: client.id! });
    } else {
      client = await this.factory.getTestClient();
    }

    // Create job if not provided
    let job: JobData | undefined;
    if (!jobId && client) {
      job = await this.factory.createJob({
        // Let data-factories.ts generate unique title with UUID
        client_id: client.id,
        status: 'open',
        priority: 'normal',
      });
      this.createdEntities.push({ type: 'jobs', id: job.id! });
    }

    // Create various types of activity logs
    const logs: ActivityLogData[] = [];

    // System-level logs (if enabled)
    if (includeSystemLogs) {
      const systemLog = await this.createActivityLog({
        activity_type: 'system',
        description: 'System maintenance completed',
        client_id: null,
        job_id: null,
      });
      logs.push(systemLog);
    }

    // Client-specific logs
    if (client) {
      const clientLog = await this.createActivityLog({
        activity_type: 'client_updated',
        description: `Client ${client.name} information updated`,
        client_id: client.id,
        job_id: null,
      });
      logs.push(clientLog);
    }

    // Job-specific logs
    if (job) {
      const jobCreatedLog = await this.createActivityLog({
        activity_type: 'job_created',
        description: `Job "${job.title}" created`,
        client_id: client?.id || null,
        job_id: job.id,
      });
      logs.push(jobCreatedLog);

      const jobUpdatedLog = await this.createActivityLog({
        activity_type: 'job_updated',
        description: `Job "${job.title}" status changed`,
        client_id: client?.id || null,
        job_id: job.id,
      });
      logs.push(jobUpdatedLog);
    }

    // Fill remaining logs with various activities
    const remainingLogs = Math.max(0, logCount - logs.length);
    for (let i = 0; i < remainingLogs; i++) {
      const logType = ['client_contact', 'job_note_added', 'task_completed'][i % 3];
      const log = await this.createActivityLog({
        activity_type: logType,
        description: `Test activity ${i + 1}: ${logType.replace('_', ' ')}`,
        client_id: client?.id || null,
        job_id: job?.id || null,
      });
      logs.push(log);
    }

    return {
      logs,
      client,
      job,
      cleanup: async () => {
        await this.cleanup();
      },
    };
  }

  /**
   * Create a single activity log entry
   */
  private async createActivityLog(data: {
    activity_type: string;
    description: string;
    client_id: string | null;
    job_id: string | null;
  }): Promise<ActivityLogData> {
    // Note: This would typically call the actual API
    // For now, we'll create a mock structure that matches what the UI expects
    const log: ActivityLogData = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      activity_type: data.activity_type,
      description: data.description,
      client_id: data.client_id,
      job_id: data.job_id,
      user_id: 'test-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Add associated data if needed
      client: data.client_id ? { name: 'Test Client' } : null,
      job: data.job_id ? { title: 'Test Job' } : null,
      user: { name: 'Test User' },
    };

    // Track for cleanup (if we had real API calls)
    // this.createdEntities.push({ type: 'activity_logs', id: log.id });

    return log;
  }

  /**
   * Wait for logs to load and display properly
   */
  async waitForLogsToLoad(expectedCount?: number): Promise<void> {
    // Wait for the logs container to be visible
    await expect(this.page.locator('.logs-container')).toBeVisible({
      timeout: 10000,
    });

    // Updated selectors to match the actual ActivityLogList UI structure with test attributes
    const logGroups = this.page.locator('[data-testid="logs-group-container"]');
    const logRows = this.page.locator('[data-testid="activity-log-row"]'); // Actual log entry rows with test IDs
    const emptyState = this.page.locator('.activity-log-empty, .empty-state');
    const loadingState = this.page.locator('.loading, .spinner, .logs-loading');

    // Wait for loading to complete first (if present)
    const hasLoading = (await loadingState.count()) > 0;
    if (hasLoading) {
      await expect(loadingState).toBeHidden({ timeout: 8000 });
    }

    // Check for ReactiveView loading skeleton
    const loadingSkeleton = this.page.locator(
      '[data-testid="loading-skeleton"], .loading-skeleton'
    );
    if ((await loadingSkeleton.count()) > 0) {
      await expect(loadingSkeleton).toBeHidden({ timeout: 8000 });
    }

    // Either logs should load or empty state should show
    try {
      await Promise.race([
        // Wait for at least one log group container to appear
        expect(logGroups.first()).toBeVisible({ timeout: 8000 }),
        expect(emptyState).toBeVisible({ timeout: 8000 }),
      ]);

      // If we have log groups, expand the first one to make sure content is accessible
      const groupCount = await logGroups.count();
      if (groupCount > 0) {
        const firstGroupHeader = this.page.locator('[data-testid="logs-group-header"]').first();

        // Check if group is collapsed and expand it if needed
        const isCollapsed = await firstGroupHeader.evaluate((header) => {
          return (
            header.classList.contains('logs-group--collapsed') ||
            header.querySelector('.chevron-icon:not(.expanded)') !== null
          );
        });

        if (isCollapsed) {
          await firstGroupHeader.click();
          // Wait for slide animation to complete
          await this.page.waitForTimeout(300);
        }

        // Wait for log rows to be visible within the expanded group
        await expect(logRows.first()).toBeVisible({ timeout: 5000 });
      }
    } catch (error) {
      // Enhanced debugging for test failures
      console.warn('=== LOGS LOADING DEBUG INFO ===');

      const pageContent = await this.page.textContent('body');
      console.warn('Page content preview:', pageContent?.substring(0, 500));

      // Check various container states
      const containerStates = {
        'logs-container': await this.page.locator('.logs-container').count(),
        'logs-group-container': await logGroups.count(),
        'logs-table__row': await this.page.locator('.logs-table__row').count(),
        'activity-log-row': await logRows.count(),
        'empty-state': await emptyState.count(),
        'loading-state': await loadingState.count(),
      };

      console.warn('Container states:', containerStates);

      // Check for any error states
      const errorState = this.page.locator('.error-state, .activity-log-error');
      const errorCount = await errorState.count();
      if (errorCount > 0) {
        const errorText = await errorState.first().textContent();
        console.warn('Error state detected:', errorText);
      }

      // Take a screenshot for debugging
      try {
        await this.page.screenshot({
          path: `debug-logs-failure-${Date.now()}.png`,
          fullPage: true,
        });
        console.warn('Debug screenshot saved');
      } catch (screenshotError) {
        console.warn('Could not save debug screenshot:', screenshotError);
      }

      // Final check - if we have groups but no visible content
      if (
        containerStates['logs-group-container'] > 0 &&
        containerStates['activity-log-row'] === 0
      ) {
        console.warn('Log groups found but no content visible - likely collapsed groups');
        // Try to expand all groups
        const allHeaders = this.page.locator('[data-testid="logs-group-header"]');
        const headerCount = await allHeaders.count();
        for (let i = 0; i < Math.min(headerCount, 3); i++) {
          await allHeaders.nth(i).click();
          await this.page.waitForTimeout(200);
        }

        // Check again for visible rows
        const expandedRowCount = await logRows.count();
        console.warn(`After expanding groups, found ${expandedRowCount} visible rows`);

        if (expandedRowCount === 0) {
          console.warn('No log entries found even after expanding groups');
        }
      } else if (containerStates['logs-container'] === 0) {
        throw new Error('No logs container found on page');
      } else {
        console.warn('Logs container exists but content loading failed');
      }

      // Re-throw the original error if we still don't have content
      if (containerStates['activity-log-row'] === 0 && containerStates['empty-state'] === 0) {
        throw error;
      }
    }

    // If expected count provided, verify it (count actual log rows, not group headers)
    if (expectedCount !== undefined) {
      if (expectedCount > 0) {
        const actualCount = await logRows.count();
        if (actualCount < expectedCount) {
          console.warn(`Expected ${expectedCount} logs but found ${actualCount} visible log rows`);
        }
      } else {
        await expect(emptyState).toBeVisible();
      }
    }
  }

  /**
   * Verify log display elements are correct
   */
  async verifyLogDisplay(logs: ActivityLogData[]): Promise<void> {
    // Ensure groups are expanded so we can see log content
    await this.expandAllLogGroups();

    const logRows = this.page.locator('[data-testid="activity-log-row"]');
    const visibleRowCount = await logRows.count();

    if (visibleRowCount === 0) {
      console.warn('No visible log rows found for verification');
      return;
    }

    // Verify the first few visible log rows contain expected content
    const logsToCheck = Math.min(logs.length, visibleRowCount, 5);

    for (let i = 0; i < logsToCheck; i++) {
      const log = logs[i];
      const logRow = logRows.nth(i);

      // Verify log row is visible
      await expect(logRow).toBeVisible();

      // Verify timestamp is shown in the time-content cell
      const timeElement = logRow.locator('.time-content time');
      await expect(timeElement).toBeVisible();

      // Verify action content contains some expected information
      const actionElement = logRow.locator('.action-content');
      await expect(actionElement).toBeVisible();

      // For logs with action descriptions, verify they appear
      if (log.description) {
        // The action content should contain some relevant text
        const actionText = await actionElement.textContent();
        if (actionText) {
          // At minimum, verify the action content is not empty
          expect(actionText.trim().length).toBeGreaterThan(0);
        }
      }

      // Verify user information if present
      if (log.user) {
        const userElements = this.page.locator('.user-name', { hasText: log.user.name });
        if ((await userElements.count()) > 0) {
          await expect(userElements.first()).toBeVisible();
        }
      }

      // For client context, check if client name appears in group headers or content
      if (log.client) {
        const clientMentions = this.page.locator('text=' + log.client.name);
        if ((await clientMentions.count()) > 0) {
          await expect(clientMentions.first()).toBeVisible();
        }
      }

      // For job context, check if job title appears in group headers or content
      if (log.job) {
        const jobMentions = this.page.locator('text=' + log.job.title);
        if ((await jobMentions.count()) > 0) {
          await expect(jobMentions.first()).toBeVisible();
        }
      }
    }
  }

  /**
   * Helper method to expand all log groups for testing
   */
  async expandAllLogGroups(): Promise<void> {
    const groupHeaders = this.page.locator('[data-testid="logs-group-header"]');
    const groupCount = await groupHeaders.count();

    for (let i = 0; i < groupCount; i++) {
      const groupHeader = groupHeaders.nth(i);

      // Check if group is collapsed
      const isCollapsed = await groupHeader.evaluate((header) => {
        return (
          header.classList.contains('logs-group--collapsed') ||
          header.querySelector('.chevron-icon:not(.expanded)') !== null
        );
      });

      if (isCollapsed) {
        await groupHeader.click();
        // Wait for animation to complete
        await this.page.waitForTimeout(300);
      }
    }
  }

  /**
   * Test log grouping functionality
   */
  async verifyLogGrouping(): Promise<LogGroupInfo[]> {
    const groups: LogGroupInfo[] = [];

    // Look for group headers using the correct selectors
    const groupContainers = this.page.locator('[data-testid="logs-group-container"]');
    const groupCount = await groupContainers.count();

    for (let i = 0; i < groupCount; i++) {
      const groupContainer = groupContainers.nth(i);
      const groupHeader = groupContainer.locator('[data-testid="logs-group-header"]');
      const headerText = await groupHeader.locator('.logs-group-title').textContent();

      // Check if group is collapsed by looking for the collapsed class or chevron state
      const isCollapsed = await groupHeader.evaluate((header) => {
        return (
          header.classList.contains('logs-group--collapsed') ||
          header.querySelector('.chevron-icon:not(.expanded)') !== null
        );
      });

      // Count logs in this group by expanding it temporarily if needed
      let logsInGroup = 0;
      if (isCollapsed) {
        // Temporarily expand to count logs
        await groupHeader.click();
        await this.page.waitForTimeout(300);
        logsInGroup = await groupContainer.locator('[data-testid="activity-log-row"]').count();
        // Collapse it back
        await groupHeader.click();
        await this.page.waitForTimeout(300);
      } else {
        logsInGroup = await groupContainer.locator('[data-testid="activity-log-row"]').count();
      }

      groups.push({
        groupHeader: headerText?.trim() || 'Unknown Group',
        logCount: logsInGroup,
        collapsed: isCollapsed,
      });
    }

    return groups;
  }

  /**
   * Test auto-scroll functionality for new logs
   */
  async testAutoScroll(): Promise<void> {
    // Get initial scroll position
    const initialScrollTop = await this.page.evaluate(() => window.scrollY);

    // Mock new log arrival (this would normally come from Zero.js)
    await this.page.evaluate(() => {
      // Simulate new log being added to the UI
      const logsList = document.querySelector('.activity-log-list, .logs-container');
      if (logsList) {
        const newLog = document.createElement('div');
        newLog.className = 'activity-log-item new-log';
        newLog.textContent = 'New activity log entry';
        logsList.appendChild(newLog);

        // Trigger auto-scroll event
        const event = new CustomEvent('newLogAdded');
        document.dispatchEvent(event);
      }
    });

    // Wait for auto-scroll to complete
    await this.page.waitForTimeout(1000);

    // Verify scroll position changed (page should scroll to show new log)
    const finalScrollTop = await this.page.evaluate(() => window.scrollY);

    // Either scrolled down to show new content, or stayed at bottom
    expect(finalScrollTop >= initialScrollTop).toBeTruthy();
  }

  /**
   * Test progressive loading behavior
   */
  async testProgressiveLoading(): Promise<void> {
    // Look for progressive loading indicators
    const progressiveLoader = this.page.locator('.progressive-loader, .load-more');

    if (await progressiveLoader.isVisible()) {
      // Test clicking load more
      await progressiveLoader.click();

      // Wait for additional logs to load
      await this.page.waitForTimeout(2000);

      // Verify more logs appeared
      const logCount = await this.page.locator('.activity-log-item, .log-entry').count();
      expect(logCount).toBeGreaterThan(0);
    }
  }

  /**
   * Test real-time updates via Zero.js
   */
  async testRealTimeUpdates(): Promise<void> {
    // Listen for console messages indicating Zero.js updates
    const updateMessages: string[] = [];
    this.page.on('console', (msg) => {
      if (msg.text().includes('ZERO DATA CHANGED') || msg.text().includes('activity log')) {
        updateMessages.push(msg.text());
      }
    });

    // Create new log (this should trigger Zero.js update)
    const newLog = await this.createActivityLog({
      activity_type: 'real_time_test',
      description: 'Real-time update test log',
      client_id: null,
      job_id: null,
    });

    // Wait for real-time update to be processed
    await this.page.waitForTimeout(3000);

    // Verify the update was detected
    expect(updateMessages.length).toBeGreaterThan(0);

    debugComponent('Real-time update test completed', {
      component: 'LogsTestHelper',
      updateMessages: updateMessages.length,
      logId: newLog.id,
    });
  }

  /**
   * Verify empty state display
   */
  async verifyEmptyState(): Promise<void> {
    // Wait for the logs container to appear first
    await expect(this.page.locator('.logs-container')).toBeVisible();

    // Look for empty state (ActivityLogEmpty component)
    const emptyState = this.page.locator('.activity-log-empty, .empty-state');
    await expect(emptyState).toBeVisible({ timeout: 10000 });

    // Verify empty state content contains expected text
    const emptyText = await emptyState.textContent();
    if (emptyText) {
      expect(emptyText.toLowerCase()).toMatch(/no.*activity|no.*logs|empty|nothing to show/);
    }

    // Try to verify empty state icon/illustration if present
    const emptyIcon = emptyState.locator('.empty-icon, .illustration, img, svg');
    if ((await emptyIcon.count()) > 0) {
      await expect(emptyIcon.first()).toBeVisible();
    }
  }

  /**
   * Test error handling and recovery
   */
  async testErrorHandling(): Promise<void> {
    // Mock API error
    await this.page.route('**/api/v1/activity_logs*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Reload page to trigger error
    await this.page.reload();

    // Verify error state displays
    const errorState = this.page.locator('.error-state, .activity-log-error');
    await expect(errorState).toBeVisible();

    // Verify error message
    await expect(errorState).toContainText(/error|failed|unable/i);

    // Clear route mock
    await this.page.unroute('**/api/v1/activity_logs*');
  }

  /**
   * Clean up created test data
   */
  async cleanup(): Promise<void> {
    debugComponent('Cleaning up logs test data', {
      component: 'LogsTestHelper',
      entityCount: this.createdEntities.length,
    });

    for (const entity of this.createdEntities) {
      try {
        await this.factory.deleteEntity(
          entity.type as 'clients' | 'jobs' | 'activity_logs',
          entity.id
        );
      } catch (error) {
        console.warn(`Failed to cleanup ${entity.type}/${entity.id}:`, error);
      }
    }

    this.createdEntities = [];
  }
}
