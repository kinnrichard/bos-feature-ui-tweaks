/**
 * Activity Logging Mutator Tests
 *
 * Tests the complete activity logging system including:
 * - Basic action logging (create, update, delete)
 * - Change tracking and metadata generation
 * - Integration with user attribution and positioning
 * - Special case handling (status changes, renames, assignments)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createActivityLoggingMutator,
  logCustomActivity,
  taskActivityLoggingMutator,
  jobActivityLoggingMutator,
  clientActivityLoggingMutator,
} from '../activity-logging';
import type { MutatorContext } from '../base-mutator';
import { getCurrentUser } from '../../auth/current-user';

// Mock dependencies
vi.mock('../../auth/current-user', () => ({
  getCurrentUser: vi.fn(() => ({ id: 'user-123', name: 'Test User' })),
}));

vi.mock('../../models/activity-log', () => ({
  ActivityLog: {
    create: vi.fn(),
  },
}));

describe('Activity Logging Mutator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createActivityLoggingMutator', () => {
    it('should create a mutator function', () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      expect(typeof mutator).toBe('function');
    });

    it('should skip logging when no user is available', async () => {
      // Use the already imported and mocked getCurrentUser
      vi.mocked(getCurrentUser).mockReturnValue(null);

      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = { id: 'task-1', title: 'Test Task' };
      const context: MutatorContext = { action: 'create' };

      const result = await mutator(data, context);

      expect(result).toEqual(data);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });

    it('should skip logging when skipActivityLogging is true', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = { id: 'task-1', title: 'Test Task' };
      const context: MutatorContext = {
        action: 'create',
        skipActivityLogging: true,
      };

      const result = await mutator(data, context);

      expect(result).toEqual(data);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });

    it('should log create actions', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
        getAssociatedJobId: (data) => data.job_id,
        getAssociatedClientId: (data) => data.client_id,
      });

      const data = {
        id: 'task-1',
        title: 'Test Task',
        job_id: 'job-1',
        client_id: 'client-1',
      };
      const context: MutatorContext = { action: 'create' };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'created',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Test Task',
        },
        client_id: 'client-1',
        job_id: 'job-1',
      });
    });

    it('should log update actions with change tracking', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = {
        id: 'task-1',
        title: 'Updated Task',
        status: 'completed',
      };
      const context: MutatorContext = {
        action: 'update',
        changes: {
          title: ['Test Task', 'Updated Task'],
          status: ['pending', 'completed'],
        },
      };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'status_changed',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Updated Task',
          changes: {
            title: ['Test Task', 'Updated Task'],
            status: ['pending', 'completed'],
          },
          old_status: 'pending',
          new_status: 'completed',
          new_status_label: 'Completed',
        },
        client_id: null,
        job_id: null,
      });
    });

    it('should handle rename actions', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = {
        id: 'task-1',
        title: 'Renamed Task',
      };
      const context: MutatorContext = {
        action: 'update',
        changes: {
          title: ['Original Task', 'Renamed Task'],
        },
      };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'renamed',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Renamed Task',
          old_name: 'Original Task',
        },
        client_id: null,
        job_id: null,
      });
    });

    it('should handle assignment changes', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = {
        id: 'task-1',
        title: 'Test Task',
        assigned_to_id: 'user-456',
      };
      const context: MutatorContext = {
        action: 'update',
        changes: {
          assigned_to_id: [null, 'user-456'],
        },
      };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'assigned',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Test Task',
          changes: {
            assigned_to_id: [null, 'user-456'],
          },
          assigned_to_id: 'user-456',
          old_assigned_to_id: null,
        },
        client_id: null,
        job_id: null,
      });
    });

    it('should filter out excluded fields from change tracking', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
        excludeFields: ['position', 'updated_at', 'unimportant_field'],
      });

      const data = {
        id: 'task-1',
        title: 'Test Task',
      };
      const context: MutatorContext = {
        action: 'update',
        changes: {
          position: [1, 2],
          updated_at: ['2024-01-01', '2024-01-02'],
          unimportant_field: ['old', 'new'],
          title: ['Old Title', 'Test Task'],
        },
      };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'renamed',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Test Task',
          old_name: 'Old Title',
        },
        client_id: null,
        job_id: null,
      });
    });

    it('should skip logging when only excluded fields changed', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
        excludeFields: ['position', 'updated_at'],
      });

      const data = {
        id: 'task-1',
        title: 'Test Task',
      };
      const context: MutatorContext = {
        action: 'update',
        changes: {
          position: [1, 2],
          updated_at: ['2024-01-01', '2024-01-02'],
        },
      };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });

    it('should handle custom actions', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
        actionMapping: {
          archive: 'archived',
        },
      });

      const data = { id: 'task-1', title: 'Test Task' };
      const context: MutatorContext = {
        customAction: 'archive',
        metadata: { reason: 'Project completed' },
      };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'archived',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Test Task',
          reason: 'Project completed',
        },
        client_id: null,
        job_id: null,
      });
    });

    it('should handle deletion/discard actions', async () => {
      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = {
        id: 'task-1',
        title: 'Test Task',
        discarded_at: Date.now(),
      };
      const context: MutatorContext = { action: 'delete' };

      await mutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'discarded',
        loggable_type: 'Task',
        loggable_id: 'task-1',
        metadata: {
          name: 'Test Task',
        },
        client_id: null,
        job_id: null,
      });
    });
  });

  describe('logCustomActivity', () => {
    it('should log custom activities', async () => {
      await logCustomActivity(
        'Job',
        'job-1',
        'viewed',
        { page: 'details' },
        { userId: 'user-123', clientId: 'client-1' }
      );

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'viewed',
        loggable_type: 'Job',
        loggable_id: 'job-1',
        metadata: { page: 'details' },
        client_id: 'client-1',
        job_id: null,
      });
    });

    it('should use current user when no userId provided', async () => {
      await logCustomActivity('Client', 'client-1', 'contacted', { method: 'email' });

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: 'contacted',
        loggable_type: 'Client',
        loggable_id: 'client-1',
        metadata: { method: 'email' },
        client_id: null,
        job_id: null,
      });
    });

    it('should skip when no user available', async () => {
      // Use the already imported and mocked getCurrentUser
      vi.mocked(getCurrentUser).mockReturnValue(null);

      await logCustomActivity('Task', 'task-1', 'viewed');

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).not.toHaveBeenCalled();
    });
  });

  describe('Model-specific mutators', () => {
    it('should have taskActivityLoggingMutator configured correctly', async () => {
      const data = {
        id: 'task-1',
        title: 'Test Task',
        job_id: 'job-1',
      };
      const context: MutatorContext = { action: 'create' };

      await taskActivityLoggingMutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loggable_type: 'Task',
          action: 'created',
        })
      );
    });

    it('should have jobActivityLoggingMutator configured correctly', async () => {
      const data = {
        id: 'job-1',
        title: 'Test Job',
        client_id: 'client-1',
      };
      const context: MutatorContext = { action: 'create' };

      await jobActivityLoggingMutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loggable_type: 'Job',
          action: 'created',
        })
      );
    });

    it('should have clientActivityLoggingMutator configured correctly', async () => {
      const data = {
        id: 'client-1',
        name: 'Test Client',
      };
      const context: MutatorContext = { action: 'create' };

      await clientActivityLoggingMutator(data, context);

      const { ActivityLog } = await import('../../models/activity-log');
      expect(ActivityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loggable_type: 'Client',
          action: 'created',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should not fail the main operation when logging fails', async () => {
      const { ActivityLog } = await import('../../models/activity-log');
      vi.mocked(ActivityLog.create).mockRejectedValue(new Error('Database error'));

      const mutator = createActivityLoggingMutator({
        loggableType: 'Task',
      });

      const data = { id: 'task-1', title: 'Test Task' };
      const context: MutatorContext = { action: 'create' };

      // Should not throw
      const result = await mutator(data, context);
      expect(result).toEqual(data);
    });
  });
});
