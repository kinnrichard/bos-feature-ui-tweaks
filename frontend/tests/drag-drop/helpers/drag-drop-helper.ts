/**
 * Drag-Drop Test Helper
 *
 * Provides utilities for simulating drag-drop operations and validating results
 */

import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export interface TaskHierarchyExpectation {
  taskId: string;
  parentId: string | null;
  depth: number;
}

export interface DragDropSimulationOptions {
  /** Duration of drag operation in ms */
  duration?: number;
  /** Steps to divide the drag into for smoother animation */
  steps?: number;
  /** Wait time after drag completes */
  waitAfter?: number;
  /** Force position for drop target */
  targetPosition?: { x: number; y: number };
}

export class DragDropHelper {
  private page: Page;
  private consoleErrors: string[] = [];

  constructor(page: Page) {
    this.page = page;

    // Set up console monitoring
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  /**
   * Get collected console errors since helper initialization
   */
  async getConsoleErrors(): Promise<string[]> {
    return [...this.consoleErrors];
  }

  /**
   * Clear collected console errors
   */
  clearConsoleErrors(): void {
    this.consoleErrors = [];
  }

  /**
   * Expand a task to show its children
   */
  async expandTask(taskId: string): Promise<void> {
    // Validate task ID
    if (!taskId || taskId === 'undefined') {
      throw new Error(`Cannot expand task with invalid ID: ${taskId}`);
    }

    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);

    // Wait for task to be visible first with timeout
    await taskElement.waitFor({ state: 'visible', timeout: 5000 });

    const expandButton = taskElement.locator('.disclosure-button');

    // Check if expand button exists
    if ((await expandButton.count()) === 0) {
      console.warn(`No expand button found for task ${taskId} - task may not have children`);
      return;
    }

    // Only click if task is not already expanded
    const isExpanded = await expandButton.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await expandButton.click();
      // Wait for expansion animation to complete
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Collapse a task to hide its children
   */
  async collapseTask(taskId: string): Promise<void> {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);
    const expandButton = taskElement.locator('.disclosure-button');

    // Only click if task is expanded
    const isExpanded = await expandButton.getAttribute('aria-expanded');
    if (isExpanded === 'true') {
      await expandButton.click();
      // Wait for collapse animation to complete
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Get the visual order of tasks as they appear in the DOM
   */
  async getVisualTaskOrder(): Promise<string[]> {
    const taskElements = await this.page.locator('[data-task-id]').all();
    const taskIds: string[] = [];

    for (const element of taskElements) {
      const taskId = await element.getAttribute('data-task-id');
      if (taskId) {
        taskIds.push(taskId);
      }
    }

    return taskIds;
  }

  /**
   * Verify the parent-child hierarchy matches expectations
   */
  async verifyTaskHierarchy(expectations: TaskHierarchyExpectation[]): Promise<void> {
    for (const expectation of expectations) {
      await this.verifyTaskParent(expectation.taskId, expectation.parentId);
      await this.verifyTaskDepth(expectation.taskId, expectation.depth);
    }
  }

  /**
   * Verify a task has the expected parent
   */
  async verifyTaskParent(taskId: string, expectedParentId: string | null): Promise<void> {
    if (expectedParentId === null) {
      // Task should be at root level (depth 0)
      const taskDepth = await this.getTaskDepth(taskId);
      expect(taskDepth).toBe(0);
    } else {
      // Task should be a child of the expected parent
      // We verify this by checking if the task appears nested under the parent
      const parentElement = this.page.locator(`[data-task-id="${expectedParentId}"]`);
      await expect(parentElement).toBeVisible();

      // The child should appear after the parent in DOM order
      const allTasks = await this.getVisualTaskOrder();
      const parentIndex = allTasks.indexOf(expectedParentId);
      const childIndex = allTasks.indexOf(taskId);

      expect(parentIndex).toBeGreaterThan(-1);
      expect(childIndex).toBeGreaterThan(-1);
      expect(childIndex).toBeGreaterThan(parentIndex);
    }
  }

  /**
   * Verify a task appears at the expected depth in the hierarchy
   */
  async verifyTaskDepth(taskId: string, expectedDepth: number): Promise<void> {
    const actualDepth = await this.getTaskDepth(taskId);
    expect(actualDepth).toBe(expectedDepth);
  }

  /**
   * Get the visual depth of a task based on its indentation
   */
  async getTaskDepth(taskId: string): Promise<number> {
    // Validate task ID
    if (!taskId || taskId === 'undefined') {
      throw new Error(`Cannot get depth for task with invalid ID: ${taskId}`);
    }

    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);

    // Wait for task to be visible first
    await taskElement.waitFor({ state: 'visible', timeout: 5000 });

    const taskRow = taskElement.locator('.task-row, .task-item').first();

    // Check if task row exists
    if ((await taskRow.count()) === 0) {
      console.warn(`No task row found for task ${taskId}`);
      return 0;
    }

    // Check for depth indicators like margin-left or padding-left
    const style = await taskRow.evaluate((el) => window.getComputedStyle(el));
    const marginLeft = parseInt(style.marginLeft || '0', 10);
    const paddingLeft = parseInt(style.paddingLeft || '0', 10);

    // Calculate depth based on indentation (assuming 20px per level)
    const totalIndent = marginLeft + paddingLeft;
    const baseIndent = 12; // Base padding for root level tasks
    const indentPerLevel = 20; // Additional pixels per depth level

    const depth = Math.max(0, Math.floor((totalIndent - baseIndent) / indentPerLevel));
    return depth;
  }

  /**
   * Drag a task between two other tasks (reproduces the specific bug)
   */
  async dragTaskBetween(
    draggedTaskId: string,
    beforeTaskId: string,
    afterTaskId: string,
    options: DragDropSimulationOptions = {}
  ): Promise<void> {
    const draggedElement = this.page.locator(`[data-task-id="${draggedTaskId}"]`);
    const beforeElement = this.page.locator(`[data-task-id="${beforeTaskId}"]`);
    const afterElement = this.page.locator(`[data-task-id="${afterTaskId}"]`);

    // Calculate drop position between the two tasks
    const beforeBox = await beforeElement.boundingBox();
    const afterBox = await afterElement.boundingBox();

    if (!beforeBox || !afterBox) {
      throw new Error('Could not get bounding boxes for target tasks');
    }

    // Position between the two tasks
    const dropX = beforeBox.x + beforeBox.width / 2;
    const dropY =
      beforeBox.y + beforeBox.height + (afterBox.y - beforeBox.y - beforeBox.height) / 2;

    await this.simulateDrag(draggedElement, { x: dropX, y: dropY }, options);
  }

  /**
   * Drag a task to become a child of another task (nesting operation)
   */
  async dragTaskIntoParent(
    draggedTaskId: string,
    parentTaskId: string,
    options: DragDropSimulationOptions = {}
  ): Promise<void> {
    // Validate task IDs
    if (!draggedTaskId || draggedTaskId === 'undefined') {
      throw new Error(`Invalid dragged task ID: ${draggedTaskId}`);
    }
    if (!parentTaskId || parentTaskId === 'undefined') {
      throw new Error(`Invalid parent task ID: ${parentTaskId}`);
    }

    const draggedElement = this.page.locator(`[data-task-id="${draggedTaskId}"]`);
    const parentElement = this.page.locator(`[data-task-id="${parentTaskId}"]`);

    // Get the center of the parent task for nesting
    const parentBox = await parentElement.boundingBox();
    if (!parentBox) {
      throw new Error('Could not get bounding box for parent task');
    }

    const dropPosition = options.targetPosition || {
      x: parentBox.x + parentBox.width / 2,
      y: parentBox.y + parentBox.height / 2,
    };

    await this.simulateDrag(draggedElement, dropPosition, options);
  }

  /**
   * Drag a task to a specific position in the list
   */
  async dragTaskToPosition(
    draggedTaskId: string,
    targetPosition: { x: number; y: number },
    options: DragDropSimulationOptions = {}
  ): Promise<void> {
    const draggedElement = this.page.locator(`[data-task-id="${draggedTaskId}"]`);
    await this.simulateDrag(draggedElement, targetPosition, options);
  }

  /**
   * Reorder a task relative to another task
   */
  async reorderTask(
    draggedTaskId: string,
    targetTaskId: string,
    position: 'before' | 'after' = 'after',
    options: DragDropSimulationOptions = {}
  ): Promise<void> {
    // Validate task IDs
    if (!draggedTaskId || draggedTaskId === 'undefined') {
      throw new Error(`Cannot reorder task with invalid dragged ID: ${draggedTaskId}`);
    }
    if (!targetTaskId || targetTaskId === 'undefined') {
      throw new Error(`Cannot reorder task with invalid target ID: ${targetTaskId}`);
    }

    const draggedElement = this.page.locator(`[data-task-id="${draggedTaskId}"]`);
    const targetElement = this.page.locator(`[data-task-id="${targetTaskId}"]`);

    // Wait for both elements to be visible with timeout
    await Promise.all([
      draggedElement.waitFor({ state: 'visible', timeout: 5000 }),
      targetElement.waitFor({ state: 'visible', timeout: 5000 }),
    ]);

    const targetBox = await targetElement.boundingBox();
    if (!targetBox) {
      throw new Error('Could not get bounding box for target task');
    }

    // Position slightly before or after the target
    const offset = position === 'before' ? -5 : 5;
    const dropPosition = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + (position === 'before' ? 0 : targetBox.height) + offset,
    };

    await this.simulateDrag(draggedElement, dropPosition, options);
  }

  /**
   * Simulate a drag operation with proper events and timing
   */
  private async simulateDrag(
    sourceElement: Locator,
    targetPosition: { x: number; y: number },
    options: DragDropSimulationOptions = {}
  ): Promise<void> {
    const { duration = 500, steps = 10, waitAfter = 500 } = options;

    // Get source position
    const sourceBox = await sourceElement.boundingBox();
    if (!sourceBox) {
      throw new Error('Could not get bounding box for source element');
    }

    const sourcePosition = {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2,
    };

    // Use Playwright's built-in drag simulation for better HTML5 drag support
    try {
      await sourceElement.dragTo(this.page.locator('body'), {
        targetPosition: targetPosition,
        force: true,
        timeout: duration * 2,
      });
    } catch (error) {
      // Fallback to manual mouse events if drag-to fails
      console.warn('Drag-to failed, falling back to manual simulation:', error);

      await this.page.mouse.move(sourcePosition.x, sourcePosition.y);
      await this.page.mouse.down();

      // Move in steps for smoother animation
      const stepX = (targetPosition.x - sourcePosition.x) / steps;
      const stepY = (targetPosition.y - sourcePosition.y) / steps;
      const stepDelay = duration / steps;

      for (let i = 1; i <= steps; i++) {
        const currentX = sourcePosition.x + stepX * i;
        const currentY = sourcePosition.y + stepY * i;
        await this.page.mouse.move(currentX, currentY);
        await this.page.waitForTimeout(stepDelay);
      }

      await this.page.mouse.up();
    }

    // Wait for drag operation to complete
    if (waitAfter > 0) {
      await this.page.waitForTimeout(waitAfter);
    }
  }

  /**
   * Verify drag indicators appear during drag operations
   */
  async verifyDragIndicators(shouldBeVisible: boolean = true): Promise<void> {
    const indicator = this.page.locator('.drag-drop-indicator');

    if (shouldBeVisible) {
      await expect(indicator).toBeVisible();
    } else {
      await expect(indicator).toHaveCount(0);
    }
  }

  /**
   * Verify multi-drag badges appear for multi-select operations
   */
  async verifyMultiDragBadge(expectedCount?: number): Promise<void> {
    const badge = this.page.locator('.multi-drag-badge');

    if (expectedCount !== undefined) {
      await expect(badge).toBeVisible();

      const badgeText = await badge.textContent();
      expect(badgeText).toContain(`+${expectedCount - 1} more`);
    } else {
      await expect(badge).toHaveCount(0);
    }
  }

  /**
   * Verify no drag artifacts remain after operation
   */
  async verifyCleanState(): Promise<void> {
    // No drag indicators should remain
    await this.verifyDragIndicators(false);

    // No multi-drag badges should remain
    await this.verifyMultiDragBadge();

    // No tasks should have dragging classes
    const draggingTasks = this.page.locator('[data-task-id].task-dragging');
    await expect(draggingTasks).toHaveCount(0);

    // No tasks should have drag-related styling
    const dragTargets = this.page.locator('[data-task-id].drag-nest-target');
    await expect(dragTargets).toHaveCount(0);
  }

  /**
   * Create a multi-select by clicking tasks with modifier keys
   */
  async createMultiSelection(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;

    // Validate task IDs
    for (const taskId of taskIds) {
      if (!taskId || taskId === 'undefined') {
        throw new Error(`Invalid task ID in selection: ${taskId}`);
      }
    }

    // Click first task normally
    await this.page.locator(`[data-task-id="${taskIds[0]}"]`).click();

    // Click remaining tasks with Meta/Ctrl modifier
    for (let i = 1; i < taskIds.length; i++) {
      await this.page.locator(`[data-task-id="${taskIds[i]}"]`).click({ modifiers: ['Meta'] });
    }

    // Verify selection count
    await expect(this.page.locator('[data-task-id].selected')).toHaveCount(taskIds.length);
  }

  /**
   * Clear all task selections
   */
  async clearSelection(): Promise<void> {
    await this.page.click('body');
    await expect(this.page.locator('[data-task-id].selected')).toHaveCount(0);
  }

  /**
   * Wait for all animations to complete
   */
  async waitForAnimations(): Promise<void> {
    // Wait for common animation durations
    await this.page.waitForTimeout(500);

    // Wait for any CSS transitions to complete
    await this.page.waitForFunction(
      () => {
        const elements = document.querySelectorAll('[data-task-id]');
        return Array.from(elements).every((el) => {
          const styles = window.getComputedStyle(el);
          return !styles.transform || styles.transform === 'none';
        });
      },
      { timeout: 2000 }
    );
  }

  /**
   * Get task data from the DOM for validation
   */
  async getTaskData(taskId: string): Promise<{
    title: string;
    depth: number;
    isVisible: boolean;
    isSelected: boolean;
    position: { x: number; y: number };
  }> {
    const taskElement = this.page.locator(`[data-task-id="${taskId}"]`);

    const title = (await taskElement.locator('.task-title').textContent()) || '';
    const depth = await this.getTaskDepth(taskId);
    const isVisible = await taskElement.isVisible();
    const isSelected = await taskElement.evaluate((el) => el.classList.contains('selected'));

    const box = await taskElement.boundingBox();
    const position = box ? { x: box.x, y: box.y } : { x: 0, y: 0 };

    return {
      title,
      depth,
      isVisible,
      isSelected,
      position,
    };
  }

  /**
   * Verify tasks maintain their relative positions after operations
   */
  async verifyTaskOrder(expectedOrder: string[]): Promise<void> {
    const actualOrder = await this.getVisualTaskOrder();
    expect(actualOrder).toEqual(expectedOrder);
  }

  /**
   * Check for console errors related to drag-drop operations
   */
  async monitorConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('drag') || text.includes('drop') || text.includes('targetIndex')) {
          errors.push(text);
        }
      }
    });

    return errors;
  }
}
