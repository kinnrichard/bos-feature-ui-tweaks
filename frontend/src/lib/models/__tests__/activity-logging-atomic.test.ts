/**
 * Test suite for atomic activity logging with Zero.js mutateBatch
 * Verifies that activity logs are created atomically with parent records
 * to prevent foreign key constraint violations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Job } from '../job';
import { Task } from '../task';
import { setCurrentUser } from '../../auth/current-user';

// Mock Zero.js client
const mockMutateBatch = vi.fn();
const mockInsert = vi.fn();
const mockFind = vi.fn();
const mockQuery = vi.fn();

vi.mock('../../zero/zero-client', () => ({
  getZero: vi.fn(() => ({
    mutateBatch: mockMutateBatch,
    mutate: {
      jobs: { insert: mockInsert, update: vi.fn(), delete: vi.fn() },
      tasks: { insert: mockInsert, update: vi.fn(), delete: vi.fn() },
      clients: { insert: mockInsert, update: vi.fn(), delete: vi.fn() },
      activity_logs: { insert: mockInsert }
    },
    query: mockQuery
  })),
  initZero: vi.fn()
}));

describe('Atomic Activity Logging', () => {
  const testUser = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
  const testClient = { id: 'client-123', name: 'Test Client' };
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Set current user for activity logging
    setCurrentUser(testUser);
    
    // Mock query responses
    mockQuery.mockImplementation((_tableName: string) => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      one: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue([])
    }));
    
    // Mock find to return created records
    mockFind.mockImplementation((id) => Promise.resolve({ id }));
  });

  afterEach(() => {
    setCurrentUser(null);
  });

  describe('mutateBatch Usage', () => {
    it('should use mutateBatch for creating Jobs with activity logs', async () => {
      // Setup mutateBatch mock to simulate successful transaction
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: { insert: mockInsert },
          activity_logs: { insert: mockInsert }
        };
        await callback(tx);
      });
      
      // Create a job
      const jobData = {
        title: 'Test Job',
        client_id: testClient.id,
        status: 'new'
      };
      
      await Job.create(jobData);
      
      // Verify mutateBatch was called
      expect(mockMutateBatch).toHaveBeenCalledTimes(1);
      
      // Verify the callback structure
      const batchCallback = mockMutateBatch.mock.calls[0][0];
      expect(typeof batchCallback).toBe('function');
      
      // Verify both inserts were called within the batch
      expect(mockInsert).toHaveBeenCalledTimes(2);
      
      // Verify job insert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Job',
          client_id: testClient.id,
          status: 'new',
          id: expect.any(String),
          created_at: expect.any(Number),
          updated_at: expect.any(Number)
        })
      );
      
      // Verify activity log insert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: testUser.id,
          action: 'created',
          loggable_type: 'Job',
          loggable_id: expect.any(String),
          client_id: testClient.id,
          job_id: expect.any(String),
          created_at: expect.any(Number),
          updated_at: expect.any(Number)
        })
      );
    });

    it('should use mutateBatch for creating Tasks with activity logs', async () => {
      // Setup mutateBatch mock
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          tasks: { insert: mockInsert },
          activity_logs: { insert: mockInsert }
        };
        await callback(tx);
      });
      
      // Mock Job.find to return job with client_id
      vi.spyOn(Job, 'find').mockResolvedValue({
        id: 'job-123',
        client_id: testClient.id,
        title: 'Test Job'
      } as any);
      
      // Create a task
      const taskData = {
        title: 'Test Task',
        job_id: 'job-123',
        status: 'new'
      };
      
      await Task.create(taskData);
      
      // Verify mutateBatch was called
      expect(mockMutateBatch).toHaveBeenCalledTimes(1);
      
      // Verify both inserts were called
      expect(mockInsert).toHaveBeenCalledTimes(2);
      
      // Verify task insert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Task',
          job_id: 'job-123',
          status: 'new'
        })
      );
      
      // Verify activity log has correct associations
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          loggable_type: 'Task',
          client_id: testClient.id, // Should be fetched from job
          job_id: 'job-123'
        })
      );
    });

    it('should handle activity log creation failure gracefully', async () => {
      // Setup mutateBatch to fail on activity log insert
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: { insert: mockInsert },
          activity_logs: {
            insert: vi.fn().mockRejectedValue(new Error('Activity log constraint violation'))
          }
        };
        await callback(tx);
      });
      
      const jobData = {
        title: 'Test Job',
        client_id: testClient.id
      };
      
      // The entire transaction should fail
      await expect(Job.create(jobData)).rejects.toThrow();
      
      // Verify mutateBatch was attempted
      expect(mockMutateBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Foreign Key Constraint Prevention', () => {
    it('should create parent and activity log in correct order', async () => {
      const insertOrder: string[] = [];
      
      // Track insertion order
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: {
            insert: vi.fn(async (data) => {
              insertOrder.push('job');
              return mockInsert(data);
            })
          },
          activity_logs: {
            insert: vi.fn(async (data) => {
              insertOrder.push('activity_log');
              return mockInsert(data);
            })
          }
        };
        await callback(tx);
      });
      
      await Job.create({ title: 'Test Job', client_id: testClient.id });
      
      // Verify correct order
      expect(insertOrder).toEqual(['job', 'activity_log']);
    });

    it('should use parent record ID in activity log', async () => {
      let capturedJobId: string | undefined;
      let capturedActivityLog: any;
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: {
            insert: vi.fn(async (data) => {
              capturedJobId = data.id;
              return mockInsert(data);
            })
          },
          activity_logs: {
            insert: vi.fn(async (data) => {
              capturedActivityLog = data;
              return mockInsert(data);
            })
          }
        };
        await callback(tx);
      });
      
      await Job.create({ title: 'Test Job', client_id: testClient.id });
      
      // Verify activity log uses same ID as parent
      expect(capturedActivityLog.loggable_id).toBe(capturedJobId);
      expect(capturedActivityLog.job_id).toBe(capturedJobId);
    });
  });

  describe('Non-Loggable Models', () => {
    it('should not use mutateBatch for models without Loggable concern', async () => {
      // Mock a non-loggable model (e.g., Note)
      const { Note } = await import('../note');
      
      // Reset mutateBatch mock
      mockMutateBatch.mockClear();
      mockInsert.mockClear();
      
      // Create should use regular insert, not mutateBatch
      await Note.create({
        content: 'Test note',
        notable_type: 'Job',
        notable_id: 'job-123'
      });
      
      // Should NOT use mutateBatch
      expect(mockMutateBatch).not.toHaveBeenCalled();
      
      // Should use regular insert
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline/Online Sync', () => {
    it('should maintain atomicity during offline operations', async () => {
      // Simulate offline mode
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: { insert: mockInsert },
          activity_logs: { insert: mockInsert }
        };
        await callback(tx);
      });
      
      await Job.create({
        title: 'Offline Job',
        client_id: testClient.id
      });
      
      // Verify batch operation was used even offline
      expect(mockMutateBatch).toHaveBeenCalledTimes(1);
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      
      // Verify both records would sync together
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('Activity Log Metadata', () => {
    it('should include proper metadata in activity logs', async () => {
      let capturedActivityLog: any;
      
      mockMutateBatch.mockImplementation(async (callback) => {
        const tx = {
          jobs: { insert: mockInsert },
          activity_logs: {
            insert: vi.fn(async (data) => {
              capturedActivityLog = data;
              return mockInsert(data);
            })
          }
        };
        await callback(tx);
      });
      
      await Job.create({
        title: 'Test Job with Metadata',
        client_id: testClient.id,
        description: 'Test description'
      });
      
      // Verify metadata structure
      expect(capturedActivityLog.metadata).toMatchObject({
        name: 'Test Job with Metadata'
      });
    });
  });
});

describe('Activity Logging Configuration', () => {
  it('should respect generated Loggable configuration', async () => {
    // Test that the system uses LOGGABLE_MODELS configuration
    const { LOGGABLE_MODELS } = await import('../generated-loggable-config');
    
    // Verify expected models are configured as loggable
    expect(LOGGABLE_MODELS['jobs']).toEqual({
      modelName: 'Job',
      includesLoggable: true
    });
    
    expect(LOGGABLE_MODELS['tasks']).toEqual({
      modelName: 'Task',
      includesLoggable: true
    });
    
    expect(LOGGABLE_MODELS['clients']).toEqual({
      modelName: 'Client',
      includesLoggable: true
    });
  });
});