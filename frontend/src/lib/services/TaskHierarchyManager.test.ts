import { describe, expect, test, beforeEach, vi } from 'vitest';
import { TaskHierarchyManager, TaskExpansionManager } from './TaskHierarchyManager';
import type { BaseTask, HierarchicalTask } from './TaskHierarchyManager';

describe('TaskExpansionManager', () => {
  let expansionManager: TaskExpansionManager;

  beforeEach(() => {
    expansionManager = new TaskExpansionManager();
  });

  test('should initialize with no expanded tasks', () => {
    expect(expansionManager.isExpanded('task1')).toBe(false);
  });

  test('should expand and collapse tasks', () => {
    expansionManager.expand('task1');
    expect(expansionManager.isExpanded('task1')).toBe(true);

    expansionManager.collapse('task1');
    expect(expansionManager.isExpanded('task1')).toBe(false);
  });

  test('should toggle expansion state', () => {
    expect(expansionManager.isExpanded('task1')).toBe(false);
    
    expansionManager.toggle('task1');
    expect(expansionManager.isExpanded('task1')).toBe(true);
    
    expansionManager.toggle('task1');
    expect(expansionManager.isExpanded('task1')).toBe(false);
  });

  test('should auto-expand all tasks with subtasks', () => {
    const hierarchicalTasks: HierarchicalTask[] = [
      {
        id: 'task1',
        title: 'Task 1',
        position: 1,
        status: 'new_task',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        subtasks: [
          {
            id: 'task2',
            title: 'Task 2',
            position: 1,
            status: 'new_task',
            created_at: '2023-01-01',
            updated_at: '2023-01-01',
            parent_id: 'task1',
            subtasks: []
          }
        ]
      },
      {
        id: 'task3',
        title: 'Task 3',
        position: 2,
        status: 'new_task',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        subtasks: [
          {
            id: 'task4',
            title: 'Task 4',
            position: 1,
            status: 'new_task',
            created_at: '2023-01-01',
            updated_at: '2023-01-01',
            parent_id: 'task3',
            subtasks: [
              {
                id: 'task5',
                title: 'Task 5',
                position: 1,
                status: 'new_task',
                created_at: '2023-01-01',
                updated_at: '2023-01-01',
                parent_id: 'task4',
                subtasks: []
              }
            ]
          }
        ]
      }
    ];

    expansionManager.autoExpandAll(hierarchicalTasks);
    
    expect(expansionManager.isExpanded('task1')).toBe(true);
    expect(expansionManager.isExpanded('task2')).toBe(false); // no subtasks
    expect(expansionManager.isExpanded('task3')).toBe(true);
    expect(expansionManager.isExpanded('task4')).toBe(true);
    expect(expansionManager.isExpanded('task5')).toBe(false); // no subtasks
  });

  test('should only auto-expand once', () => {
    const hierarchicalTasks: HierarchicalTask[] = [
      {
        id: 'task1',
        title: 'Task 1',
        position: 1,
        status: 'new_task',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
        subtasks: [
          {
            id: 'task2',
            title: 'Task 2',
            position: 1,
            status: 'new_task',
            created_at: '2023-01-01',
            updated_at: '2023-01-01',
            parent_id: 'task1',
            subtasks: []
          }
        ]
      }
    ];

    expansionManager.autoExpandAll(hierarchicalTasks);
    expect(expansionManager.isExpanded('task1')).toBe(true);
    
    // Collapse it
    expansionManager.collapse('task1');
    expect(expansionManager.isExpanded('task1')).toBe(false);
    
    // Auto-expand again should not re-expand
    expansionManager.autoExpandAll(hierarchicalTasks);
    expect(expansionManager.isExpanded('task1')).toBe(false);
  });

  test('should reset expansion state', () => {
    expansionManager.expand('task1');
    expansionManager.expand('task2');
    
    expect(expansionManager.isExpanded('task1')).toBe(true);
    expect(expansionManager.isExpanded('task2')).toBe(true);
    
    expansionManager.reset();
    
    expect(expansionManager.isExpanded('task1')).toBe(false);
    expect(expansionManager.isExpanded('task2')).toBe(false);
  });
});

describe('TaskHierarchyManager', () => {
  let hierarchyManager: TaskHierarchyManager;

  beforeEach(() => {
    vi.useFakeTimers();
    hierarchyManager = new TaskHierarchyManager();
  });

  const createMockTasks = (): BaseTask[] => [
    {
      id: 'task1',
      title: 'Root Task 1',
      position: 1,
      status: 'new_task',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: 'task2',
      title: 'Child Task 1',
      position: 1,
      status: 'in_progress',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      parent_id: 'task1'
    },
    {
      id: 'task3',
      title: 'Root Task 2',
      position: 2,
      status: 'successfully_completed',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: 'task4',
      title: 'Child Task 2',
      position: 2,
      status: 'new_task',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      parent_id: 'task1'
    },
    {
      id: 'task5',
      title: 'Grandchild Task',
      position: 1,
      status: 'paused',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      parent_id: 'task2'
    },
    {
      id: 'task6',
      title: 'Deleted Task',
      position: 3,
      status: 'cancelled',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      discarded_at: '2023-01-02'
    }
  ];

  test('should organize tasks into hierarchy', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress', 'successfully_completed', 'paused', 'cancelled'],
      false
    );

    expect(hierarchicalTasks).toHaveLength(2); // 2 root tasks (excluding deleted)
    
    // Check root task 1
    expect(hierarchicalTasks[0].id).toBe('task1');
    expect(hierarchicalTasks[0].subtasks).toHaveLength(2);
    expect(hierarchicalTasks[0].subtasks[0].id).toBe('task2');
    expect(hierarchicalTasks[0].subtasks[1].id).toBe('task4');
    
    // Check grandchild
    expect(hierarchicalTasks[0].subtasks[0].subtasks).toHaveLength(1);
    expect(hierarchicalTasks[0].subtasks[0].subtasks[0].id).toBe('task5');
    
    // Check root task 2
    expect(hierarchicalTasks[1].id).toBe('task3');
    expect(hierarchicalTasks[1].subtasks).toHaveLength(0);
  });

  test('should filter tasks by status with hierarchical context', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['in_progress'],
      false
    );

    // New hierarchical filtering behavior: if a child matches, include parent
    // task2 (in_progress) should cause task1 (its parent) to be included
    expect(hierarchicalTasks).toHaveLength(1); // task1 is included as parent of matching task2
    expect(hierarchicalTasks[0].id).toBe('task1');
    expect(hierarchicalTasks[0].subtasks).toHaveLength(1); // Only task2 (in_progress) is included
    expect(hierarchicalTasks[0].subtasks[0].id).toBe('task2');
    expect(hierarchicalTasks[0].subtasks[0].subtasks).toHaveLength(0); // task5 (paused) is not included
    
    // Test with a status that includes root tasks
    const rootTasksIncluded = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress'],
      false
    );
    
    expect(rootTasksIncluded).toHaveLength(1); // task1 is included
    expect(rootTasksIncluded[0].id).toBe('task1');
    expect(rootTasksIncluded[0].subtasks).toHaveLength(2); // task2 and task4
  });

  test('should show deleted tasks when requested', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['cancelled'],
      true
    );

    expect(hierarchicalTasks).toHaveLength(1); // Only deleted task
    expect(hierarchicalTasks[0].id).toBe('task6');
  });

  test('should exclude deleted tasks by default', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress', 'successfully_completed', 'paused', 'cancelled'],
      false
    );

    const allTaskIds = hierarchicalTasks.map(t => t.id);
    expect(allTaskIds).not.toContain('task6');
  });

  test('should show nested hierarchical filtering', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['paused'], // Only grandchild task5 has this status
      false
    );

    // Should include task1 (root) -> task2 (child) -> task5 (grandchild with paused status)
    expect(hierarchicalTasks).toHaveLength(1);
    expect(hierarchicalTasks[0].id).toBe('task1'); // Root ancestor
    expect(hierarchicalTasks[0].subtasks).toHaveLength(1);
    expect(hierarchicalTasks[0].subtasks[0].id).toBe('task2'); // Parent of matching task
    expect(hierarchicalTasks[0].subtasks[0].subtasks).toHaveLength(1);
    expect(hierarchicalTasks[0].subtasks[0].subtasks[0].id).toBe('task5'); // Matching grandchild
  });

  test('should show multiple branches when filtering', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['successfully_completed'], // Only task3 has this status
      false
    );

    // Should include only task3 (root task with matching status)
    expect(hierarchicalTasks).toHaveLength(1);
    expect(hierarchicalTasks[0].id).toBe('task3');
    expect(hierarchicalTasks[0].subtasks).toHaveLength(0);
  });

  test('should sort tasks by position', () => {
    const tasks: BaseTask[] = [
      {
        id: 'task1',
        title: 'Task 1',
        position: 3,
        status: 'new_task',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      },
      {
        id: 'task2',
        title: 'Task 2',
        position: 1,
        status: 'new_task',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      },
      {
        id: 'task3',
        title: 'Task 3',
        position: 2,
        status: 'new_task',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      }
    ];

    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task'],
      false
    );

    expect(hierarchicalTasks.map(t => t.id)).toEqual(['task2', 'task3', 'task1']);
  });

  test('should flatten hierarchical tasks for rendering', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress', 'successfully_completed', 'paused'],
      false
    );

    // Auto-expand all tasks
    hierarchyManager.autoExpandAll(hierarchicalTasks);

    const flattenedTasks = hierarchyManager.flattenTasks(hierarchicalTasks);

    expect(flattenedTasks).toHaveLength(5); // All tasks except deleted
    
    // Check order and depth
    expect(flattenedTasks[0].task.id).toBe('task1');
    expect(flattenedTasks[0].depth).toBe(0);
    expect(flattenedTasks[0].hasSubtasks).toBe(true);
    expect(flattenedTasks[0].isExpanded).toBe(true);
    
    expect(flattenedTasks[1].task.id).toBe('task2');
    expect(flattenedTasks[1].depth).toBe(1);
    expect(flattenedTasks[1].hasSubtasks).toBe(true);
    expect(flattenedTasks[1].isExpanded).toBe(true);
    
    expect(flattenedTasks[2].task.id).toBe('task5');
    expect(flattenedTasks[2].depth).toBe(2);
    expect(flattenedTasks[2].hasSubtasks).toBe(false);
    expect(flattenedTasks[2].isExpanded).toBe(false);
    
    expect(flattenedTasks[3].task.id).toBe('task4');
    expect(flattenedTasks[3].depth).toBe(1);
    expect(flattenedTasks[3].hasSubtasks).toBe(false);
    expect(flattenedTasks[3].isExpanded).toBe(false);
    
    expect(flattenedTasks[4].task.id).toBe('task3');
    expect(flattenedTasks[4].depth).toBe(0);
    expect(flattenedTasks[4].hasSubtasks).toBe(false);
    expect(flattenedTasks[4].isExpanded).toBe(false);
  });

  test('should hide collapsed subtasks', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress', 'successfully_completed', 'paused'],
      false
    );

    // Don't auto-expand
    const flattenedTasks = hierarchyManager.flattenTasks(hierarchicalTasks);

    expect(flattenedTasks).toHaveLength(2); // Only root tasks visible
    expect(flattenedTasks[0].task.id).toBe('task1');
    expect(flattenedTasks[1].task.id).toBe('task3');
  });

  test('should get flat task IDs in correct order', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress', 'successfully_completed', 'paused'],
      false
    );

    hierarchyManager.autoExpandAll(hierarchicalTasks);
    const flattenedTasks = hierarchyManager.flattenTasks(hierarchicalTasks);
    const flatTaskIds = hierarchyManager.getFlatTaskIds(flattenedTasks);

    expect(flatTaskIds).toEqual(['task1', 'task2', 'task5', 'task4', 'task3']);
  });

  test('should toggle expansion correctly', () => {
    const tasks = createMockTasks();
    const hierarchicalTasks = hierarchyManager.organizeTasksHierarchically(
      tasks,
      ['new_task', 'in_progress', 'successfully_completed', 'paused'],
      false
    );

    expect(hierarchyManager.isTaskExpanded('task1')).toBe(false);
    
    hierarchyManager.toggleExpansion('task1');
    expect(hierarchyManager.isTaskExpanded('task1')).toBe(true);
    
    hierarchyManager.toggleExpansion('task1');
    expect(hierarchyManager.isTaskExpanded('task1')).toBe(false);
  });

  test('should force expand tasks', () => {
    expect(hierarchyManager.isTaskExpanded('task1')).toBe(false);
    
    hierarchyManager.expandTask('task1');
    expect(hierarchyManager.isTaskExpanded('task1')).toBe(true);
  });

  test('should reset expansion state', () => {
    hierarchyManager.expandTask('task1');
    hierarchyManager.expandTask('task2');
    
    expect(hierarchyManager.isTaskExpanded('task1')).toBe(true);
    expect(hierarchyManager.isTaskExpanded('task2')).toBe(true);
    
    hierarchyManager.resetExpansion();
    
    expect(hierarchyManager.isTaskExpanded('task1')).toBe(false);
    expect(hierarchyManager.isTaskExpanded('task2')).toBe(false);
  });

});