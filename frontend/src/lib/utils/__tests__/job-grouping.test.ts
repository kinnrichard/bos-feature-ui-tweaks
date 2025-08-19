/**
 * Tests for job grouping functionality
 * EP-0030: Job List Grouping Sections
 */

import { describe, it, expect } from 'vitest';
import type { JobData } from '$lib/models/types/job-data';
import {
  isOverdue,
  isDueToday,
  isDueTomorrow,
  isDueNextWeek,
  isScheduledForFuture,
  isCompletedOrCancelled,
  getJobSection,
  groupJobs,
  getPopulatedSections,
  sortJobsInSection,
} from '../job-grouping';

// Mock job data factory
function createMockJob(overrides: Partial<JobData> = {}): JobData {
  return {
    id: '1',
    title: 'Test Job',
    created_at: '2025-08-04T10:00:00Z',
    updated_at: '2025-08-04T10:00:00Z',
    lock_version: 1,
    status: 'open',
    priority: 'normal',
    due_time_set: false,
    start_time_set: false,
    ...overrides,
  };
}

describe('Job Date Utilities', () => {
  // Note: These tests will run with current system time
  // For simplicity, using relative dates that should work regardless of when tests run
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000);
  const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  describe('isOverdue', () => {
    it('should return true for overdue jobs', () => {
      const job = createMockJob({ due_at: yesterday.toISOString() });
      expect(isOverdue(job)).toBe(true);
    });

    it('should return false for jobs due today or later', () => {
      const jobToday = createMockJob({ due_at: today.toISOString() });
      const jobTomorrow = createMockJob({ due_at: tomorrow.toISOString() });
      expect(isOverdue(jobToday)).toBe(false);
      expect(isOverdue(jobTomorrow)).toBe(false);
    });

    it('should return false for jobs with no due date', () => {
      const job = createMockJob({ due_at: undefined });
      expect(isOverdue(job)).toBe(false);
    });
  });

  describe('isDueToday', () => {
    it('should return true for jobs due today', () => {
      const job = createMockJob({ due_at: today.toISOString() });
      expect(isDueToday(job)).toBe(true);
    });

    it('should return false for jobs due on other days', () => {
      const jobYesterday = createMockJob({ due_at: yesterday.toISOString() });
      const jobTomorrow = createMockJob({ due_at: tomorrow.toISOString() });
      expect(isDueToday(jobYesterday)).toBe(false);
      expect(isDueToday(jobTomorrow)).toBe(false);
    });
  });

  describe('isDueTomorrow', () => {
    it('should return true for jobs due tomorrow', () => {
      const job = createMockJob({ due_at: tomorrow.toISOString() });
      expect(isDueTomorrow(job)).toBe(true);
    });

    it('should return false for jobs due on other days', () => {
      const jobToday = createMockJob({ due_at: today.toISOString() });
      const jobNextWeek = createMockJob({ due_at: nextWeek.toISOString() });
      expect(isDueTomorrow(jobToday)).toBe(false);
      expect(isDueTomorrow(jobNextWeek)).toBe(false);
    });
  });

  describe('isDueNextWeek', () => {
    it('should return true for jobs due within 2-7 days', () => {
      const job = createMockJob({ due_at: nextWeek.toISOString() });
      expect(isDueNextWeek(job)).toBe(true);
    });

    it('should return false for jobs due today, tomorrow, or far future', () => {
      const jobToday = createMockJob({ due_at: today.toISOString() });
      const jobTomorrow = createMockJob({ due_at: tomorrow.toISOString() });
      const jobFuture = createMockJob({ due_at: futureDate.toISOString() });
      expect(isDueNextWeek(jobToday)).toBe(false);
      expect(isDueNextWeek(jobTomorrow)).toBe(false);
      expect(isDueNextWeek(jobFuture)).toBe(false);
    });
  });

  describe('isScheduledForFuture', () => {
    it('should return true for jobs starting in the future', () => {
      const job = createMockJob({ starts_at: futureDate.toISOString() });
      expect(isScheduledForFuture(job)).toBe(true);
    });

    it('should return false for jobs with no start date or past start date', () => {
      const jobNoStart = createMockJob({ starts_at: undefined });
      const jobPastStart = createMockJob({ starts_at: yesterday.toISOString() });
      expect(isScheduledForFuture(jobNoStart)).toBe(false);
      expect(isScheduledForFuture(jobPastStart)).toBe(false);
    });
  });

  describe('isCompletedOrCancelled', () => {
    it('should return true for completed jobs', () => {
      const job = createMockJob({ status: 'successfully_completed' });
      expect(isCompletedOrCancelled(job)).toBe(true);
    });

    it('should return true for cancelled jobs', () => {
      const job = createMockJob({ status: 'cancelled' });
      expect(isCompletedOrCancelled(job)).toBe(true);
    });

    it('should return false for other statuses', () => {
      const job = createMockJob({ status: 'open' });
      expect(isCompletedOrCancelled(job)).toBe(false);
    });
  });
});

describe('Job Section Classification', () => {
  it('should classify jobs into correct sections', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const noDue = createMockJob({ due_at: undefined });
    const scheduled = createMockJob({ starts_at: futureDate.toISOString() });
    const completed = createMockJob({ status: 'successfully_completed' });

    expect(getJobSection(noDue)).toBe('no_due_date');
    expect(getJobSection(scheduled)).toBe('scheduled');
    expect(getJobSection(completed)).toBe('completed_cancelled');
  });
});

describe('Job Grouping', () => {
  it('should group jobs correctly', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const jobs: JobData[] = [
      createMockJob({ id: '5', due_at: undefined }), // no due date
      createMockJob({ id: '6', starts_at: futureDate.toISOString() }), // scheduled
      createMockJob({ id: '7', status: 'successfully_completed' }), // completed
    ];

    const grouped = groupJobs(jobs);

    expect(grouped.no_due_date).toHaveLength(1);
    expect(grouped.scheduled).toHaveLength(1);
    expect(grouped.completed_cancelled).toHaveLength(1);
  });

  it('should sort jobs within sections by status priority', () => {
    const jobs: JobData[] = [
      createMockJob({ id: '1', status: 'open' }),
      createMockJob({ id: '2', status: 'in_progress' }),
      createMockJob({ id: '3', status: 'paused' }),
    ];

    const sorted = sortJobsInSection(jobs);

    expect(sorted[0].status).toBe('in_progress'); // priority 1
    expect(sorted[1].status).toBe('paused'); // priority 2
    expect(sorted[2].status).toBe('open'); // priority 3
  });

  it('should sort jobs by job priority when status is the same', () => {
    const jobs: JobData[] = [
      createMockJob({ id: '1', status: 'open', priority: 'normal' }),
      createMockJob({ id: '2', status: 'open', priority: 'critical' }),
      createMockJob({ id: '3', status: 'open', priority: 'high' }),
    ];

    const sorted = sortJobsInSection(jobs);

    expect(sorted[0].priority).toBe('critical'); // priority 1
    expect(sorted[1].priority).toBe('high'); // priority 3
    expect(sorted[2].priority).toBe('normal'); // priority 4
  });
});

describe('Populated Sections', () => {
  it('should return only sections with jobs', () => {
    const jobs: JobData[] = [
      createMockJob({ id: '5', due_at: undefined }), // no due date
      createMockJob({ id: '7', status: 'successfully_completed' }), // completed
    ];

    const grouped = groupJobs(jobs);
    const sections = getPopulatedSections(grouped);

    expect(sections.length).toBeGreaterThan(0);
    // Check that all returned sections have jobs
    for (const section of sections) {
      expect(section.jobs.length).toBeGreaterThan(0);
    }
  });

  it('should sort sections by priority', () => {
    const jobs: JobData[] = [
      createMockJob({ id: '5', due_at: undefined }), // no due date (priority 5)
      createMockJob({ id: '7', status: 'successfully_completed' }), // completed (priority 7)
    ];

    const grouped = groupJobs(jobs);
    const sections = getPopulatedSections(grouped);

    // Lower priority numbers come first
    if (sections.length >= 2) {
      expect(sections[0].info.priority).toBeLessThan(sections[1].info.priority);
    }
  });
});
