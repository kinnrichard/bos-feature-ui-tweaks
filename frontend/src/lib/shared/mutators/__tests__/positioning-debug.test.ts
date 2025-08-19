import { describe, expect, it, beforeEach } from 'vitest';
import { createPositioningMutator } from '../positioning';
import type { MutatorContext } from '../base-mutator';

describe('Positioning Mutator Debug', () => {
  const context: MutatorContext = {
    action: 'create',
    offline: false,
    user: { id: 'user-123' }
  };

  const taskMutator = createPositioningMutator('tasks', {
    scopeFields: ['job_id']
  });

  it('demonstrates the bug when inserting between tasks', () => {
    // Existing tasks with positions 1, 2, 3
    const existingTasks = [
      { id: 't1', position: 1, job_id: 'job-1' },
      { id: 't2', position: 2, job_id: 'job-1' },
      { id: 't3', position: 3, job_id: 'job-1' }
    ];

    // Try to insert a new task between t1 and t2
    // Current buggy approach: position = 2 (collides with t2)
    const newTask = {
      title: 'New Task',
      job_id: 'job-1',
      position: 2 // This will collide!
    };

    const result = taskMutator(newTask, context);
    
    console.log('Current buggy result:', result);
    // With current implementation, position is either:
    // - 2 (if manual positioning allowed) - COLLISION!
    // - Date.now() (if online) - WAY TOO BIG!
    
    // The position should be 1.5 for proper insertion
  });

  it('shows how fractional positioning should work', () => {
    // What we SHOULD do: use fractional positions
    const existingTasks = [
      { id: 't1', position: 1.0, job_id: 'job-1' },
      { id: 't2', position: 2.0, job_id: 'job-1' },
      { id: 't3', position: 3.0, job_id: 'job-1' }
    ];

    // To insert between t1 and t2:
    const idealPosition = (1.0 + 2.0) / 2; // = 1.5
    
    expect(idealPosition).toBe(1.5);
    expect(idealPosition).toBeGreaterThan(1.0);
    expect(idealPosition).toBeLessThan(2.0);
  });

  it('shows the drag-and-drop positioning issue', () => {
    // When dragging t3 between t1 and t2
    const tasks = [
      { id: 't1', position: 1, job_id: 'job-1' },
      { id: 't2', position: 2, job_id: 'job-1' },
      { id: 't3', position: 3, job_id: 'job-1' }
    ];

    // Current approach might try to set position = 2
    // But that collides with t2!
    
    // Correct approach: calculate fractional position
    const correctPosition = (tasks[0].position + tasks[1].position) / 2;
    expect(correctPosition).toBe(1.5);
  });
});