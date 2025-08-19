import { describe, expect, it } from 'vitest';
import { Job } from '../../../models/job';
import type { NewRecord } from '../types';
import type { JobData } from '../../types/job-data';

describe('ActiveRecord.new() integration test with Job model', () => {
  it('creates new Job with defaults applied', () => {
    const newJob: NewRecord<JobData> = Job.new();

    // Should have null timestamps
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();

    // Should have defaults from JobDefaults
    expect(newJob.due_time_set).toBe(false);
    expect(newJob.lock_version).toBe(0);
    expect(newJob.priority).toBe('normal');
    expect(newJob.start_time_set).toBe(false);
    expect(newJob.status).toBe('open');
  });

  it('creates new Job with custom data overriding defaults', () => {
    const newJob = Job.new({
      title: 'Test Job',
      priority: 'high',
      status: 'in_progress',
    });

    // Should have null timestamps
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();

    // Should have provided data
    expect(newJob.title).toBe('Test Job');
    expect(newJob.priority).toBe('high'); // overridden
    expect(newJob.status).toBe('in_progress'); // overridden

    // Should keep other defaults
    expect(newJob.due_time_set).toBe(false);
    expect(newJob.lock_version).toBe(0);
    expect(newJob.start_time_set).toBe(false);
  });

  it('allows partial data for form initialization', () => {
    const newJob = Job.new({
      title: 'Partial Job',
      client_id: 'client-123',
    });

    // Required for forms but not saved yet
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();

    // Form data
    expect(newJob.title).toBe('Partial Job');
    expect(newJob.client_id).toBe('client-123');

    // Defaults still applied
    expect(newJob.status).toBe('open');
    expect(newJob.priority).toBe('normal');
  });
});
