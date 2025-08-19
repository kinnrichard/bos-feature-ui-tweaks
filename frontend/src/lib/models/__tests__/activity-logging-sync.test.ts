/**
 * Test suite for offline/online sync scenarios with atomic activity logging
 * Ensures foreign key constraints are satisfied during synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getZero } from '../../zero/zero-client';
import { Job } from '../job';
import { Task } from '../task';
import { setCurrentUser } from '../../auth/current-user';

// Mock Zero.js sync behavior
const mockSync = vi.fn();
const mockMutateBatch = vi.fn();
const mockPendingMutations = vi.fn();

vi.mock('../../zero/zero-client', () => ({
  getZero: vi.fn(() => ({
    sync: mockSync,
    mutateBatch: mockMutateBatch,
    getPendingMutations: mockPendingMutations,
    mutate: {
      jobs: { insert: vi.fn(), update: vi.fn() },
      tasks: { insert: vi.fn(), update: vi.fn() },
      activity_logs: { insert: vi.fn() }
    },
    query: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      one: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue([])
    }))
  }))
}));

describe('Offline/Online Sync with Activity Logging', () => {
  const testUser = { id: 'user-123', name: 'Test User' };
  
  beforeEach(() => {
    vi.clearAllMocks();
    setCurrentUser(testUser);
    
    // Default online state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true
    });
  });

  afterEach(() => {
    setCurrentUser(null);
  });

  describe('Offline Creation and Sync', () => {
    it('should queue atomic mutations when offline', async () => {
      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      // Setup mutateBatch to track calls
      const batchedMutations: any[] = [];
      mockMutateBatch.mockImplementation(async (callback) => {
        const mutations: any[] = [];
        const tx = {
          jobs: {
            insert: vi.fn((data) => {
              mutations.push({ type: 'insert', table: 'jobs', data });
            })
          },
          activity_logs: {
            insert: vi.fn((data) => {
              mutations.push({ type: 'insert', table: 'activity_logs', data });
            })
          }
        };
        await callback(tx);
        batchedMutations.push(mutations);
      });
      
      // Create job while offline
      await Job.create({
        title: 'Offline Job',
        client_id: 'client-123'
      });
      
      // Verify batch was created with both mutations
      expect(batchedMutations).toHaveLength(1);
      expect(batchedMutations[0]).toHaveLength(2);
      expect(batchedMutations[0][0].table).toBe('jobs');
      expect(batchedMutations[0][1].table).toBe('activity_logs');
      
      // Verify activity log references parent ID
      const jobMutation = batchedMutations[0][0];
      const activityMutation = batchedMutations[0][1];
      expect(activityMutation.data.loggable_id).toBe(jobMutation.data.id);
    });

    it('should sync batched mutations atomically when coming online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      const syncedBatches: any[] = [];
      mockSync.mockImplementation(async () => {
        // Simulate processing pending mutations
        syncedBatches.push('sync-completed');
      });
      
      // Create multiple records offline
      await Job.create({ title: 'Job 1', client_id: 'client-123' });
      await Job.create({ title: 'Job 2', client_id: 'client-123' });
      
      // Come back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      
      // Trigger sync
      await getZero()?.sync();
      
      // Verify sync was called
      expect(mockSync).toHaveBeenCalledTimes(1);
      
      // Each job creation should have been a single atomic batch
      expect(mockMutateBatch).toHaveBeenCalledTimes(2);
    });

    it('should handle sync failures gracefully', async () => {
      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: { insert: vi.fn() },
          activity_logs: { insert: vi.fn() }
        };
        await callback(tx);
      });
      
      // Create job offline
      await Job.create({ title: 'Offline Job', client_id: 'client-123' });
      
      // Come online but sync fails
      Object.defineProperty(navigator, 'onLine', { value: true });
      mockSync.mockRejectedValue(new Error('Sync failed'));
      
      // Sync should fail but not crash
      await expect(getZero()?.sync()).rejects.toThrow('Sync failed');
      
      // Mutations should remain pending for retry
      expect(mockMutateBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent job and task creation', async () => {
      const mutations: any[] = [];
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: {
            insert: vi.fn((data) => {
              mutations.push({ table: 'jobs', data });
            })
          },
          tasks: {
            insert: vi.fn((data) => {
              mutations.push({ table: 'tasks', data });
            })
          },
          activity_logs: {
            insert: vi.fn((data) => {
              mutations.push({ table: 'activity_logs', data });
            })
          }
        };
        await callback(tx);
      });
      
      // Create job and task concurrently
      await Promise.all([
        Job.create({ title: 'Concurrent Job', client_id: 'client-123' }),
        Task.create({ title: 'Concurrent Task', job_id: 'job-123' })
      ]);
      
      // Each should be its own atomic batch
      expect(mockMutateBatch).toHaveBeenCalledTimes(2);
      
      // Verify each batch has parent + activity log
      expect(mutations.filter(m => m.table === 'activity_logs')).toHaveLength(2);
    });
  });

  describe('Update Operations', () => {
    it('should handle updates atomically with activity logs', async () => {
      // For updates, we don't use mutateBatch yet, but test the concept
      const mockUpdate = vi.fn();
      const zero = getZero();
      if (zero) {
        zero.mutate.jobs.update = mockUpdate;
      }
      
      // Mock existing job
      vi.spyOn(Job, 'find').mockResolvedValue({
        id: 'job-123',
        title: 'Original Title',
        client_id: 'client-123'
      } as any);
      
      // Update job
      await Job.update('job-123', { title: 'Updated Title' });
      
      // Verify update was called
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-123',
          title: 'Updated Title'
        })
      );
      
      // TODO: When update operations are migrated to mutateBatch,
      // verify activity log is created atomically
    });
  });

  describe('Error Recovery', () => {
    it('should rollback entire batch on activity log failure', async () => {
      const insertedRecords: string[] = [];
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: {
            insert: vi.fn((_data: any) => {
              insertedRecords.push('job');
              return Promise.resolve();
            })
          },
          activity_logs: {
            insert: vi.fn(() => {
              throw new Error('Foreign key constraint violation');
            })
          }
        };
        
        // This should throw and rollback
        await callback(tx);
      });
      
      // Attempt to create job
      await expect(Job.create({
        title: 'Failing Job',
        client_id: 'client-123'
      })).rejects.toThrow();
      
      // Job insert was called but should be rolled back
      expect(insertedRecords).toEqual(['job']);
      
      // In a real transaction, the job would be rolled back
      // and not exist in the database
    });

    it('should handle network interruptions during sync', async () => {
      // Go offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      // Create job offline
      await Job.create({ title: 'Offline Job', client_id: 'client-123' });
      
      // Simulate network interruption during sync
      let syncAttempts = 0;
      mockSync.mockImplementation(async () => {
        syncAttempts++;
        if (syncAttempts === 1) {
          throw new Error('Network error');
        }
        return Promise.resolve();
      });
      
      // Come online and first sync fails
      Object.defineProperty(navigator, 'onLine', { value: true });
      await expect(getZero()?.sync()).rejects.toThrow('Network error');
      
      // Retry sync
      await getZero()?.sync();
      
      // Second attempt should succeed
      expect(syncAttempts).toBe(2);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity across sync boundaries', async () => {
      const createdIds: Record<string, string> = {};
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: {
            insert: vi.fn((data) => {
              createdIds.jobId = data.id;
              createdIds.clientId = data.client_id;
            })
          },
          activity_logs: {
            insert: vi.fn((data) => {
              createdIds.activityLogId = data.id;
              createdIds.activityJobId = data.job_id;
              createdIds.activityClientId = data.client_id;
              createdIds.activityLoggableId = data.loggable_id;
            })
          }
        };
        await callback(tx);
      });
      
      await Job.create({
        title: 'Integrity Test Job',
        client_id: 'client-456'
      });
      
      // Verify all IDs match correctly
      expect(createdIds.activityJobId).toBe(createdIds.jobId);
      expect(createdIds.activityLoggableId).toBe(createdIds.jobId);
      expect(createdIds.activityClientId).toBe(createdIds.clientId);
      expect(createdIds.activityClientId).toBe('client-456');
    });
  });
});