import { describe, expect, it } from 'vitest';
import { ActiveRecord } from '../active-record';
import type { BaseRecord, NewRecord } from '../types';

// Test interface for Job model
interface TestJob extends BaseRecord {
  title: string;
  client_id: string;
  status: 'draft' | 'active' | 'completed';
  description?: string;
}

describe('ActiveRecord.new() method', () => {
  it('creates an unpersisted record with null timestamps', () => {
    const jobModel = new ActiveRecord<TestJob>({
      tableName: 'jobs',
      className: 'Job',
    });

    const newJob = jobModel.new();

    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();
  });

  it('applies defaults from config', () => {
    const jobModel = new ActiveRecord<TestJob>({
      tableName: 'jobs',
      className: 'Job',
      defaults: {
        status: 'draft',
        title: 'Untitled Job',
      },
    });

    const newJob = jobModel.new();

    expect(newJob.status).toBe('draft');
    expect(newJob.title).toBe('Untitled Job');
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();
  });

  it('overrides defaults with provided data', () => {
    const jobModel = new ActiveRecord<TestJob>({
      tableName: 'jobs',
      className: 'Job',
      defaults: {
        status: 'draft',
        title: 'Untitled Job',
      },
    });

    const newJob = jobModel.new({
      title: 'Custom Title',
      client_id: 'client-123',
    });

    expect(newJob.status).toBe('draft'); // from defaults
    expect(newJob.title).toBe('Custom Title'); // overridden
    expect(newJob.client_id).toBe('client-123'); // provided
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();
  });

  it('works with no defaults configured', () => {
    const jobModel = new ActiveRecord<TestJob>({
      tableName: 'jobs',
      className: 'Job',
    });

    const newJob = jobModel.new({
      title: 'Test Job',
      client_id: 'client-456',
      status: 'active',
    });

    expect(newJob.title).toBe('Test Job');
    expect(newJob.client_id).toBe('client-456');
    expect(newJob.status).toBe('active');
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();
  });

  it('returns correct TypeScript type', () => {
    const jobModel = new ActiveRecord<TestJob>({
      tableName: 'jobs',
      className: 'Job',
    });

    const newJob: NewRecord<TestJob> = jobModel.new();

    // TypeScript should enforce that these are null
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();

    // Should still have access to other fields
    expect(typeof newJob.title).toBe('undefined'); // not set
    expect(typeof newJob.client_id).toBe('undefined'); // not set
    expect(typeof newJob.status).toBe('undefined'); // not set
  });
});
