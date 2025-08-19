import { describe, expect, it } from 'vitest';
import { Job } from '../../../models/job';
import type { NewRecord } from '../types';
import type { JobData } from '../../types/job-data';

describe('ActiveRecord.new() usage examples', () => {
  it('demonstrates typical form usage pattern', () => {
    // Create a new unpersisted job for a form
    const formJob: NewRecord<JobData> = Job.new({
      title: 'New Client Project',
      client_id: 'client-456',
      priority: 'high',
    });

    // Form can bind to these fields
    expect(formJob.title).toBe('New Client Project');
    expect(formJob.client_id).toBe('client-456');
    expect(formJob.priority).toBe('high');

    // These are null until saved
    expect(formJob.id).toBeNull();
    expect(formJob.created_at).toBeNull();
    expect(formJob.updated_at).toBeNull();

    // Defaults are applied
    expect(formJob.status).toBe('open');
    expect(formJob.due_time_set).toBe(false);
    expect(formJob.lock_version).toBe(0);

    // In a real form, you would eventually save with:
    // const savedJob = await Job.create(formJob);
  });

  it('demonstrates edit form pattern vs new form pattern', () => {
    // For new records - use new()
    const newJob = Job.new({ title: 'New Job' });

    // For existing records - would use find()
    // const existingJob = await Job.find('existing-id');

    // Check the key difference
    expect(newJob.id).toBeNull(); // New record
    // existingJob.id would be a string for existing records

    // This helps forms know whether to show "Create" or "Update" buttons
    const isNewRecord = newJob.id === null;
    expect(isNewRecord).toBe(true);
  });

  it('demonstrates validation-ready records', () => {
    // Create a record that's ready for validation but not saved
    const job = Job.new({
      title: '', // Invalid - empty title
      client_id: 'client-123',
    });

    // Could run validation on this record
    const hasTitle = job.title && job.title.trim().length > 0;
    expect(hasTitle).toBeFalsy();

    // Fix the validation issue
    job.title = 'Fixed Title';
    const isValidNow = job.title && job.title.trim().length > 0;
    expect(isValidNow).toBe(true);

    // Still not saved - form can continue editing
    expect(job.id).toBeNull();
  });
});
