/**
 * Simple Activity Logging Test
 * Tests basic functionality without complex mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActivityLoggingMutator } from '../activity-logging';
import type { MutatorContext } from '../base-mutator';

describe('Activity Logging Mutator - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a mutator function', () => {
    const mutator = createActivityLoggingMutator({
      loggableType: 'Task'
    });
    
    expect(typeof mutator).toBe('function');
  });

  it('should return data unchanged when no user is provided', async () => {
    const mutator = createActivityLoggingMutator({
      loggableType: 'Task'
    });
    
    const data = { id: 'task-1', title: 'Test Task' };
    const context: MutatorContext = { action: 'create' };
    
    const result = await mutator(data, context);
    
    expect(result).toEqual(data);
  });

  it('should skip logging when skipActivityLogging is true', async () => {
    const mutator = createActivityLoggingMutator({
      loggableType: 'Task'
    });
    
    const data = { id: 'task-1', title: 'Test Task' };
    const context: MutatorContext = { 
      action: 'create',
      skipActivityLogging: true,
      user: { id: 'user-1', name: 'Test User' }
    };
    
    const result = await mutator(data, context);
    
    expect(result).toEqual(data);
  });

  it('should handle configuration correctly', () => {
    const config = {
      loggableType: 'Job',
      excludeFields: ['position', 'updated_at'],
      trackChanges: false,
      actionMapping: { 'archive': 'archived' }
    };
    
    const mutator = createActivityLoggingMutator(config);
    
    expect(typeof mutator).toBe('function');
  });
});