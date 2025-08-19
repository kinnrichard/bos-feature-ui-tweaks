/**
 * Integration tests for ActiveRecord.new() method with actual form usage scenarios
 *
 * This test file verifies that the new() method works correctly in realistic
 * form and UI scenarios, ensuring the implementation is robust for real usage.
 */

import { describe, expect, it } from 'vitest';
import { Job } from '../../../models/job';
import type { NewRecord } from '../types';
import type { JobData, CreateJobData } from '../../types/job-data';

describe('ActiveRecord.new() - Form Integration Tests', () => {
  describe('Job Form Scenarios', () => {
    it('creates new job suitable for create form', () => {
      const newJob = Job.new();

      // Form-ready state
      expect(newJob.id).toBeNull();
      expect(newJob.created_at).toBeNull();
      expect(newJob.updated_at).toBeNull();

      // Should have sensible defaults for form
      expect(newJob.status).toBe('open');
      expect(newJob.priority).toBe('normal');
      expect(newJob.due_time_set).toBe(false);
      expect(newJob.start_time_set).toBe(false);
      expect(newJob.lock_version).toBe(0);

      // Optional fields should be undefined (not null)
      expect(newJob.title).toBeUndefined();
      expect(newJob.client_id).toBeUndefined();
      expect(newJob.description).toBeUndefined();
    });

    it('creates new job with initial client context', () => {
      const clientId = 'client-123';
      const newJob = Job.new({ client_id: clientId });

      // Should preserve provided client_id
      expect(newJob.client_id).toBe(clientId);

      // Should still have proper new record state
      expect(newJob.id).toBeNull();
      expect(newJob.created_at).toBeNull();
      expect(newJob.updated_at).toBeNull();

      // Should maintain defaults
      expect(newJob.status).toBe('open');
      expect(newJob.priority).toBe('normal');
    });

    it('creates new job with form field overrides', () => {
      const formData: Partial<CreateJobData> = {
        title: 'Emergency Repair',
        priority: 'urgent',
        status: 'in_progress',
        description: 'Critical system failure requiring immediate attention',
        estimated_minutes: 120,
      };

      const newJob = Job.new(formData);

      // Should preserve all form data
      expect(newJob.title).toBe(formData.title);
      expect(newJob.priority).toBe(formData.priority);
      expect(newJob.status).toBe(formData.status);
      expect(newJob.description).toBe(formData.description);
      expect(newJob.estimated_minutes).toBe(formData.estimated_minutes);

      // Should maintain new record state
      expect(newJob.id).toBeNull();
      expect(newJob.created_at).toBeNull();
      expect(newJob.updated_at).toBeNull();

      // Should keep defaults for non-overridden fields
      expect(newJob.due_time_set).toBe(false);
      expect(newJob.start_time_set).toBe(false);
      expect(newJob.lock_version).toBe(0);
    });
  });

  describe('Form Validation Scenarios', () => {
    it('creates job ready for validation', () => {
      const newJob = Job.new({
        title: '', // Invalid - empty title
        client_id: 'client-123',
        priority: 'high',
      });

      // Should be ready for validation
      expect(newJob.title).toBe('');
      expect(newJob.client_id).toBe('client-123');
      expect(newJob.priority).toBe('high');

      // Can check validation state
      const hasValidTitle = !!(newJob.title && newJob.title.trim().length > 0);
      const hasValidClient = !!(newJob.client_id && newJob.client_id.trim().length > 0);

      expect(hasValidTitle).toBe(false);
      expect(hasValidClient).toBe(true);
    });

    it('allows incremental form building', () => {
      // Start with minimal data
      const newJob = Job.new({ client_id: 'client-123' });

      // Simulate form field updates
      newJob.title = 'Progressive Form Job';
      newJob.priority = 'high';
      newJob.description = 'User is filling out the form step by step';

      // Should accumulate data correctly
      expect(newJob.client_id).toBe('client-123');
      expect(newJob.title).toBe('Progressive Form Job');
      expect(newJob.priority).toBe('high');
      expect(newJob.description).toBe('User is filling out the form step by step');

      // Should still be unsaved
      expect(newJob.id).toBeNull();
      expect(newJob.created_at).toBeNull();
      expect(newJob.updated_at).toBeNull();
    });
  });

  describe('Form State Management', () => {
    it('distinguishes between new and existing records', () => {
      const newJob = Job.new({ title: 'New Job' });

      // Helper functions that a form might use
      const isNewRecord = (job: JobData | NewRecord<JobData>) => job.id === null;
      const isPersisted = (job: JobData | NewRecord<JobData>) => job.id !== null;

      expect(isNewRecord(newJob)).toBe(true);
      expect(isPersisted(newJob)).toBe(false);

      // This would help forms decide between "Create" and "Update" buttons
      const submitButtonText = isNewRecord(newJob) ? 'Create Job' : 'Update Job';
      expect(submitButtonText).toBe('Create Job');
    });

    it('maintains type safety for form operations', () => {
      const newJob: NewRecord<JobData> = Job.new();

      // TypeScript should enforce proper types
      expect(typeof newJob.id).toBe('object'); // null is typeof 'object'
      expect(newJob.id).toBeNull();

      // Should allow access to all JobData fields
      newJob.title = 'Type Safe Job';
      newJob.priority = 'normal';
      newJob.status = 'open';

      expect(newJob.title).toBe('Type Safe Job');
      expect(newJob.priority).toBe('normal');
      expect(newJob.status).toBe('open');
    });
  });

  describe('Performance in Form Context', () => {
    it('creates multiple form records efficiently', () => {
      const startTime = performance.now();

      // Simulate creating multiple job forms (e.g., batch job creation)
      const formJobs: NewRecord<JobData>[] = [];

      for (let i = 0; i < 100; i++) {
        formJobs.push(
          Job.new({
            title: `Batch Job ${i}`,
            client_id: `client-${i % 10}`, // 10 different clients
            priority: i % 3 === 0 ? 'high' : 'normal',
          })
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(formJobs).toHaveLength(100);
      expect(formJobs[0].title).toBe('Batch Job 0');
      expect(formJobs[99].title).toBe('Batch Job 99');

      // Should complete quickly
      expect(duration).toBeLessThan(50);

      // Each should be independent
      formJobs[0].title = 'Modified';
      expect(formJobs[1].title).toBe('Batch Job 1');
    });

    it('handles form data mutations without side effects', () => {
      const initialData = {
        title: 'Original Title',
        client_id: 'client-123',
        metadata: { tags: ['original'] },
      };

      const formJob1 = Job.new(initialData);
      const formJob2 = Job.new(initialData);

      // Modify first form
      formJob1.title = 'Modified Title 1';
      formJob1.priority = 'high';

      // Modify second form
      formJob2.title = 'Modified Title 2';
      formJob2.priority = 'urgent';

      // Forms should be independent
      expect(formJob1.title).toBe('Modified Title 1');
      expect(formJob2.title).toBe('Modified Title 2');
      expect(formJob1.priority).toBe('high');
      expect(formJob2.priority).toBe('urgent');

      // Both should maintain new record state
      expect(formJob1.id).toBeNull();
      expect(formJob2.id).toBeNull();
    });
  });

  describe('Real World Form Patterns', () => {
    it('supports wizard/multi-step form pattern', () => {
      // Step 1: Basic info
      let jobForm = Job.new({
        title: 'Multi-step Job',
        client_id: 'client-123',
      });

      expect(jobForm.title).toBe('Multi-step Job');
      expect(jobForm.client_id).toBe('client-123');
      expect(jobForm.id).toBeNull(); // Still unsaved

      // Step 2: Add details
      jobForm.description = 'Detailed description from step 2';
      jobForm.priority = 'high';

      expect(jobForm.description).toBe('Detailed description from step 2');
      expect(jobForm.priority).toBe('high');
      expect(jobForm.id).toBeNull(); // Still unsaved

      // Step 3: Add scheduling
      jobForm.estimated_minutes = 240;
      jobForm.due_date = '2024-12-31';

      expect(jobForm.estimated_minutes).toBe(240);
      expect(jobForm.due_date).toBe('2024-12-31');
      expect(jobForm.id).toBeNull(); // Still unsaved until final submit
    });

    it('supports form template/preset pattern', () => {
      // Define form templates
      const emergencyTemplate = {
        priority: 'urgent' as const,
        status: 'in_progress' as const,
        title: 'Emergency Service Call',
      };

      const maintenanceTemplate = {
        priority: 'normal' as const,
        status: 'open' as const,
        title: 'Scheduled Maintenance',
      };

      // Create jobs from templates
      const emergencyJob = Job.new({
        ...emergencyTemplate,
        client_id: 'client-urgent-123',
      });

      const maintenanceJob = Job.new({
        ...maintenanceTemplate,
        client_id: 'client-maintenance-456',
      });

      // Verify template application
      expect(emergencyJob.priority).toBe('urgent');
      expect(emergencyJob.status).toBe('in_progress');
      expect(emergencyJob.title).toBe('Emergency Service Call');
      expect(emergencyJob.client_id).toBe('client-urgent-123');

      expect(maintenanceJob.priority).toBe('normal');
      expect(maintenanceJob.status).toBe('open');
      expect(maintenanceJob.title).toBe('Scheduled Maintenance');
      expect(maintenanceJob.client_id).toBe('client-maintenance-456');

      // Both should be new records
      expect(emergencyJob.id).toBeNull();
      expect(maintenanceJob.id).toBeNull();
    });
  });
});
