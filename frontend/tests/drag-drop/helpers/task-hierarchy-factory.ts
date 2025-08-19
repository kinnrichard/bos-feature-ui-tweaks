/**
 * Task Hierarchy Factory
 * 
 * Specialized factory for creating complex task hierarchies for drag-drop testing
 */

import type { Page } from '@playwright/test';
import { DataFactory, type TaskData } from '../../helpers/data-factories';

export interface HierarchyNode {
  task: TaskData;
  children: HierarchyNode[];
  depth: number;
}

export interface HierarchySpec {
  title: string;
  children?: HierarchySpec[];
  status?: TaskData['status'];
  position?: number;
}

export class TaskHierarchyFactory {
  private dataFactory: DataFactory;
  private jobId: string;
  private positionCounter: number = 10;

  constructor(page: Page, jobId: string) {
    this.dataFactory = new DataFactory(page);
    this.jobId = jobId;
  }

  /**
   * Create a task hierarchy from a specification
   */
  async createHierarchy(spec: HierarchySpec, parentId?: string): Promise<HierarchyNode> {
    // Create the root task
    const task = await this.dataFactory.createTask({
      title: spec.title,
      job_id: this.jobId,
      status: spec.status || 'new_task',
      position: spec.position || this.getNextPosition(),
      parent_id: parentId
    });

    // Recursively create children
    const children: HierarchyNode[] = [];
    if (spec.children) {
      for (const childSpec of spec.children) {
        const childNode = await this.createHierarchy(childSpec, task.id);
        children.push(childNode);
      }
    }

    return {
      task,
      children,
      depth: parentId ? 1 : 0 // Simplified depth calculation
    };
  }

  /**
   * Create a simple linear hierarchy (A -> B -> C -> D)
   */
  async createLinearHierarchy(count: number, prefix: string = 'Task'): Promise<HierarchyNode> {
    if (count < 1) {
      throw new Error('Count must be at least 1');
    }

    const root = await this.dataFactory.createTask({
      title: `${prefix} 1`,
      job_id: this.jobId,
      status: 'new_task',
      position: this.getNextPosition()
    });

    let currentParent = root;
    const allTasks = [root];

    for (let i = 2; i <= count; i++) {
      const child = await this.dataFactory.createTask({
        title: `${prefix} ${i}`,
        job_id: this.jobId,
        status: 'new_task',
        position: this.getNextPosition(),
        parent_id: currentParent.id
      });
      
      allTasks.push(child);
      currentParent = child;
    }

    // Build hierarchy structure
    const buildHierarchy = (tasks: TaskData[], index: number = 0): HierarchyNode => {
      const task = tasks[index];
      const children = index < tasks.length - 1 ? [buildHierarchy(tasks, index + 1)] : [];
      
      return {
        task,
        children,
        depth: index
      };
    };

    return buildHierarchy(allTasks);
  }

  /**
   * Create a wide hierarchy (one parent with many children)
   */
  async createWideHierarchy(childCount: number, parentTitle: string = 'Parent'): Promise<HierarchyNode> {
    const parent = await this.dataFactory.createTask({
      title: parentTitle,
      job_id: this.jobId,
      status: 'new_task',
      position: this.getNextPosition()
    });

    const children: HierarchyNode[] = [];
    for (let i = 1; i <= childCount; i++) {
      const child = await this.dataFactory.createTask({
        title: `Child ${i}`,
        job_id: this.jobId,
        status: 'new_task',
        position: this.getNextPosition(),
        parent_id: parent.id
      });

      children.push({
        task: child,
        children: [],
        depth: 1
      });
    }

    return {
      task: parent,
      children,
      depth: 0
    };
  }

  /**
   * Create a balanced tree hierarchy
   */
  async createBalancedTree(depth: number, childrenPerLevel: number = 2): Promise<HierarchyNode> {
    const createNode = async (level: number, parentId?: string, index: number = 1): Promise<HierarchyNode> => {
      const task = await this.dataFactory.createTask({
        title: `L${level}-${index}`,
        job_id: this.jobId,
        status: 'new_task',
        position: this.getNextPosition(),
        parent_id: parentId
      });

      const children: HierarchyNode[] = [];
      if (level < depth) {
        for (let i = 1; i <= childrenPerLevel; i++) {
          const child = await createNode(level + 1, task.id, i);
          children.push(child);
        }
      }

      return {
        task,
        children,
        depth: level - 1
      };
    };

    return createNode(1);
  }

  /**
   * Create a complex mixed hierarchy for edge case testing
   */
  async createComplexHierarchy(): Promise<HierarchyNode> {
    const spec: HierarchySpec = {
      title: 'Root Project',
      children: [
        {
          title: 'Planning Phase',
          children: [
            { title: 'Requirements Analysis' },
            { title: 'Design Documents' },
            {
              title: 'Risk Assessment',
              children: [
                { title: 'Technical Risks' },
                { title: 'Business Risks' }
              ]
            }
          ]
        },
        {
          title: 'Development Phase',
          children: [
            {
              title: 'Frontend Development',
              children: [
                { title: 'Component Library' },
                { title: 'User Interface' },
                { title: 'Responsive Design' }
              ]
            },
            {
              title: 'Backend Development',
              children: [
                { title: 'API Design' },
                { title: 'Database Schema' },
                { title: 'Authentication' }
              ]
            }
          ]
        },
        {
          title: 'Testing Phase',
          children: [
            { title: 'Unit Tests' },
            { title: 'Integration Tests' },
            { title: 'End-to-End Tests' }
          ]
        },
        { title: 'Deployment' }
      ]
    };

    return this.createHierarchy(spec);
  }

  /**
   * Create hierarchy with problematic data for edge case testing
   */
  async createProblematicHierarchy(): Promise<{
    normal: HierarchyNode;
    withNullPositions: TaskData[];
    withSpecialChars: TaskData[];
    orphanedTasks: TaskData[];
  }> {
    // Normal hierarchy
    const normal = await this.createHierarchy({
      title: 'Normal Parent',
      children: [
        { title: 'Normal Child 1' },
        { title: 'Normal Child 2' }
      ]
    });

    // Tasks with null/undefined positions
    const withNullPositions = [];
    for (let i = 0; i < 3; i++) {
      const task = await this.dataFactory.createTask({
        title: `No Position Task ${i + 1}`,
        job_id: this.jobId,
        status: 'new_task'
        // Deliberately omit position
      });
      withNullPositions.push(task);
    }

    // Tasks with special characters
    const specialTitles = [
      'Task with émojis 🎯',
      'Task with "quotes" & \'apostrophes\'',
      'Task with <HTML> tags',
      'Task with\nnewlines',
      'タスク with unicode'
    ];
    
    const withSpecialChars = [];
    for (const title of specialTitles) {
      const task = await this.dataFactory.createTask({
        title,
        job_id: this.jobId,
        status: 'new_task',
        position: this.getNextPosition()
      });
      withSpecialChars.push(task);
    }

    // Orphaned tasks (reference non-existent parent)
    const orphanedTasks = [];
    for (let i = 0; i < 2; i++) {
      const task = await this.dataFactory.createTask({
        title: `Orphaned Task ${i + 1}`,
        job_id: this.jobId,
        status: 'new_task',
        position: this.getNextPosition(),
        parent_id: 'non-existent-parent-id'
      });
      orphanedTasks.push(task);
    }

    return {
      normal,
      withNullPositions,
      withSpecialChars,
      orphanedTasks
    };
  }

  /**
   * Create performance test hierarchy (large number of tasks)
   */
  async createPerformanceHierarchy(taskCount: number = 50): Promise<{
    rootTasks: TaskData[];
    parentChildPairs: { parent: TaskData; children: TaskData[] }[];
    totalTasks: number;
  }> {
    const rootTasks: TaskData[] = [];
    const parentChildPairs: { parent: TaskData; children: TaskData[] }[] = [];
    let totalCreated = 0;

    // Create root tasks (about 1/4 of total)
    const rootCount = Math.ceil(taskCount / 4);
    for (let i = 0; i < rootCount && totalCreated < taskCount; i++) {
      const root = await this.dataFactory.createTask({
        title: `Root Task ${i + 1}`,
        job_id: this.jobId,
        status: 'new_task',
        position: this.getNextPosition()
      });
      rootTasks.push(root);
      totalCreated++;
    }

    // Create parent-child relationships with remaining tasks
    for (let i = 0; i < rootTasks.length && totalCreated < taskCount; i++) {
      const parent = rootTasks[i];
      const children: TaskData[] = [];
      
      // Each root gets 2-5 children
      const childCount = Math.min(
        Math.floor(Math.random() * 4) + 2,
        taskCount - totalCreated
      );
      
      for (let j = 0; j < childCount; j++) {
        const child = await this.dataFactory.createTask({
          title: `Child ${i + 1}-${j + 1}`,
          job_id: this.jobId,
          status: 'new_task',
          position: this.getNextPosition(),
          parent_id: parent.id
        });
        children.push(child);
        totalCreated++;
      }
      
      if (children.length > 0) {
        parentChildPairs.push({ parent, children });
      }
    }

    return {
      rootTasks,
      parentChildPairs,
      totalTasks: totalCreated
    };
  }

  /**
   * Get all tasks from a hierarchy in flattened format
   */
  flattenHierarchy(node: HierarchyNode): TaskData[] {
    const result = [node.task];
    
    for (const child of node.children) {
      result.push(...this.flattenHierarchy(child));
    }
    
    return result;
  }

  /**
   * Get all task IDs from a hierarchy
   */
  getTaskIds(node: HierarchyNode): string[] {
    return this.flattenHierarchy(node).map(task => task.id!);
  }

  /**
   * Find a task in hierarchy by ID
   */
  findTask(node: HierarchyNode, taskId: string): HierarchyNode | null {
    if (node.task.id === taskId) {
      return node;
    }
    
    for (const child of node.children) {
      const found = this.findTask(child, taskId);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Get the parent task ID for a given task in hierarchy
   */
  getParentId(node: HierarchyNode, taskId: string): string | null {
    // Check direct children
    for (const child of node.children) {
      if (child.task.id === taskId) {
        return node.task.id!;
      }
    }
    
    // Check recursively
    for (const child of node.children) {
      const parentId = this.getParentId(child, taskId);
      if (parentId) {
        return parentId;
      }
    }
    
    return null;
  }

  /**
   * Reset position counter
   */
  resetPositionCounter(): void {
    this.positionCounter = 10;
  }

  /**
   * Get next position value
   */
  private getNextPosition(): number {
    const current = this.positionCounter;
    this.positionCounter += 10;
    return current;
  }
}