import { describe, expect, it } from 'vitest';
import { ActiveRecord } from '../active-record';
import { Job } from '../../../models/job';
import type { NewRecord, BaseRecord } from '../types';
import type { JobData } from '../../types/job-data';

// This test specifically verifies TypeScript type checking for the new() method

describe('ActiveRecord.new() TypeScript types', () => {
  it('properly types NewRecord with null required fields', () => {
    const newJob = Job.new();

    // TypeScript should enforce these are null
    // Using type assertions to verify compile-time types
    newJob.id satisfies null;
    newJob.created_at satisfies null;
    newJob.updated_at satisfies null;

    // These assertions confirm the runtime behavior matches types
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();
  });

  it('properly types NewRecord with optional fields', () => {
    interface TestRecord extends BaseRecord {
      title: string;
      optional_field?: string;
      status: 'active' | 'inactive';
    }

    const testModel = new ActiveRecord<TestRecord>({
      tableName: 'test',
      className: 'Test',
    });

    const newRecord: NewRecord<TestRecord> = testModel.new();

    // TypeScript should allow access to these fields
    const title: string | undefined = newRecord.title;
    const optionalField: string | undefined = newRecord.optional_field;
    const status: 'active' | 'inactive' | undefined = newRecord.status;

    // Runtime verification
    expect(title).toBeUndefined();
    expect(optionalField).toBeUndefined();
    expect(status).toBeUndefined();
  });

  it('allows type-safe data passing to new() method', () => {
    const newJob = Job.new({
      title: 'Type Test Job',
      client_id: 'client-123',
      priority: 'high',
    });

    // TypeScript enforces correct types
    expect(newJob.title).toBe('Type Test Job');
    expect(newJob.client_id).toBe('client-123');
    expect(newJob.priority).toBe('high');

    // Still null for managed fields
    expect(newJob.id).toBeNull();
    expect(newJob.created_at).toBeNull();
    expect(newJob.updated_at).toBeNull();
  });

  it('enforces NewRecord type constraints', () => {
    // This test ensures the NewRecord type properly constrains the return value
    const newJob = Job.new();

    // TypeScript should know this is NewRecord<JobData>
    const typedRecord: NewRecord<JobData> = newJob;

    // These should all be null according to the type
    expect(typedRecord.id).toBeNull();
    expect(typedRecord.created_at).toBeNull();
    expect(typedRecord.updated_at).toBeNull();
  });
});
