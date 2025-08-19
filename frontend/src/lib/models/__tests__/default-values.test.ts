import { describe, it, expect } from 'vitest';
import { Task } from '../task';
import { Job } from '../job';

describe('Default Values', () => {
  describe('Task defaults', () => {
    it('should have correct default configuration', () => {
      // @ts-expect-error - accessing private config for testing
      const config = Task['config'];

      expect(config.defaults).toBeDefined();
      expect(config.defaults).toEqual({
        applies_to_all_targets: true,
        lock_version: 0,
        position_finalized: false,
        repositioned_to_top: false,
        subtasks_count: 0,
      });
    });
  });

  describe('Job defaults', () => {
    it('should have correct default configuration', () => {
      // @ts-expect-error - accessing private config for testing
      const config = Job['config'];

      expect(config.defaults).toBeDefined();
      expect(config.defaults).toEqual({
        due_time_set: false,
        lock_version: 0,
        priority: 'normal',
        start_time_set: false,
        status: 'open',
      });
    });
  });
});
