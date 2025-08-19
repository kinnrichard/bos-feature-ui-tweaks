/**
 * Unit tests for technician filtering logic in jobs filter utilities
 * EP-0029: Technician Filter Implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchesTechnicianFilter,
  isAssignedToTechnician,
  createJobsFilter,
  createFilterFromSearchParams,
} from './jobs.svelte';
import type { JobData } from '$lib/models/types/job-data';
import type { UserData } from '$lib/models/types/user-data';

// Mock job data factory
function createMockJob(overrides: Partial<JobData> = {}): JobData {
  return {
    id: 'job-123',
    title: 'Test Job',
    status: 'open',
    priority: 'normal',
    client_id: 'client-123',
    created_at: '2025-08-03T00:00:00Z',
    updated_at: '2025-08-03T00:00:00Z',
    jobAssignments: [],
    ...overrides,
  } as JobData;
}

// Mock user/technician data factory
function createMockTechnician(id: string, name?: string): UserData {
  return {
    id,
    name: name || `Technician ${id}`,
    email: `tech${id}@example.com`,
    role: 'technician',
  } as UserData;
}

// Mock job assignment factory
function createMockAssignment(technician: UserData) {
  return {
    id: `assignment-${technician.id}`,
    user_id: technician.id,
    user: technician,
    job_id: 'job-123',
  };
}

describe('Jobs Filter - Technician Filtering', () => {
  describe('isAssignedToTechnician', () => {
    it('should return true when job is assigned to specific technician', () => {
      const technician = createMockTechnician('tech-123');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(isAssignedToTechnician(job, 'tech-123')).toBe(true);
    });

    it('should return false when job is not assigned to specific technician', () => {
      const technician = createMockTechnician('tech-456');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(isAssignedToTechnician(job, 'tech-123')).toBe(false);
    });

    it('should return false when job has no assignments', () => {
      const job = createMockJob({
        jobAssignments: [],
      });

      expect(isAssignedToTechnician(job, 'tech-123')).toBe(false);
    });

    it('should return false when job assignments is undefined', () => {
      const job = createMockJob({
        jobAssignments: undefined,
      });

      expect(isAssignedToTechnician(job, 'tech-123')).toBe(false);
    });

    it('should return true when technicianId is empty (no filter)', () => {
      const job = createMockJob();
      expect(isAssignedToTechnician(job, '')).toBe(true);
    });

    it('should handle multiple assignments correctly', () => {
      const tech1 = createMockTechnician('tech-123');
      const tech2 = createMockTechnician('tech-456');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(tech1), createMockAssignment(tech2)],
      });

      expect(isAssignedToTechnician(job, 'tech-123')).toBe(true);
      expect(isAssignedToTechnician(job, 'tech-456')).toBe(true);
      expect(isAssignedToTechnician(job, 'tech-789')).toBe(false);
    });
  });

  describe('matchesTechnicianFilter', () => {
    it('should return true when no filter is applied', () => {
      const job = createMockJob();

      expect(matchesTechnicianFilter(job, [])).toBe(true);
      expect(matchesTechnicianFilter(job, undefined as any)).toBe(true);
    });

    it('should match job assigned to specific technician', () => {
      const technician = createMockTechnician('tech-123');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(matchesTechnicianFilter(job, ['tech-123'])).toBe(true);
    });

    it('should not match job not assigned to specific technician', () => {
      const technician = createMockTechnician('tech-456');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(matchesTechnicianFilter(job, ['tech-123'])).toBe(false);
    });

    it('should match "not_assigned" filter for unassigned jobs', () => {
      const job = createMockJob({
        jobAssignments: [],
      });

      expect(matchesTechnicianFilter(job, ['not_assigned'])).toBe(true);
    });

    it('should match "not_assigned" filter for jobs with undefined assignments', () => {
      const job = createMockJob({
        jobAssignments: undefined,
      });

      expect(matchesTechnicianFilter(job, ['not_assigned'])).toBe(true);
    });

    it('should not match "not_assigned" filter for assigned jobs', () => {
      const technician = createMockTechnician('tech-123');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(matchesTechnicianFilter(job, ['not_assigned'])).toBe(false);
    });

    it('should handle multiple technician IDs (OR logic)', () => {
      const tech1 = createMockTechnician('tech-123');
      const tech2 = createMockTechnician('tech-456');
      const job1 = createMockJob({
        id: 'job-1',
        jobAssignments: [createMockAssignment(tech1)],
      });
      const job2 = createMockJob({
        id: 'job-2',
        jobAssignments: [createMockAssignment(tech2)],
      });
      const job3 = createMockJob({
        id: 'job-3',
        jobAssignments: [],
      });

      const filter = ['tech-123', 'tech-456'];

      expect(matchesTechnicianFilter(job1, filter)).toBe(true);
      expect(matchesTechnicianFilter(job2, filter)).toBe(true);
      expect(matchesTechnicianFilter(job3, filter)).toBe(false);
    });

    it('should handle mixed specific technicians and "not_assigned"', () => {
      const technician = createMockTechnician('tech-123');
      const assignedJob = createMockJob({
        id: 'job-assigned',
        jobAssignments: [createMockAssignment(technician)],
      });
      const unassignedJob = createMockJob({
        id: 'job-unassigned',
        jobAssignments: [],
      });
      const otherAssignedJob = createMockJob({
        id: 'job-other',
        jobAssignments: [createMockAssignment(createMockTechnician('tech-456'))],
      });

      const filter = ['tech-123', 'not_assigned'];

      expect(matchesTechnicianFilter(assignedJob, filter)).toBe(true);
      expect(matchesTechnicianFilter(unassignedJob, filter)).toBe(true);
      expect(matchesTechnicianFilter(otherAssignedJob, filter)).toBe(false);
    });

    it('should handle jobs with multiple assignments', () => {
      const tech1 = createMockTechnician('tech-123');
      const tech2 = createMockTechnician('tech-456');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(tech1), createMockAssignment(tech2)],
      });

      expect(matchesTechnicianFilter(job, ['tech-123'])).toBe(true);
      expect(matchesTechnicianFilter(job, ['tech-456'])).toBe(true);
      expect(matchesTechnicianFilter(job, ['tech-789'])).toBe(false);
      expect(matchesTechnicianFilter(job, ['tech-123', 'tech-789'])).toBe(true);
    });

    it('should return false when only "not_assigned" is specified but no specific technicians', () => {
      const technician = createMockTechnician('tech-123');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      // This tests the edge case where only not_assigned is selected
      // but the job has assignments - should return false
      expect(matchesTechnicianFilter(job, ['not_assigned'])).toBe(false);
    });
  });

  describe('createJobsFilter with technician filters', () => {
    let jobs: JobData[];

    beforeEach(() => {
      const tech1 = createMockTechnician('tech-123', 'Alice');
      const tech2 = createMockTechnician('tech-456', 'Bob');

      jobs = [
        createMockJob({
          id: 'job-1',
          title: 'Assigned to Alice',
          jobAssignments: [createMockAssignment(tech1)],
        }),
        createMockJob({
          id: 'job-2',
          title: 'Assigned to Bob',
          jobAssignments: [createMockAssignment(tech2)],
        }),
        createMockJob({
          id: 'job-3',
          title: 'Assigned to Both',
          jobAssignments: [createMockAssignment(tech1), createMockAssignment(tech2)],
        }),
        createMockJob({
          id: 'job-4',
          title: 'Not Assigned',
          jobAssignments: [],
        }),
      ];
    });

    it('should filter by single technician ID', () => {
      const filter = createJobsFilter({
        technicianIds: ['tech-123'],
      });

      const result = filter(jobs);
      expect(result).toHaveLength(2);
      expect(result.map((j) => j.id)).toEqual(['job-1', 'job-3']);
    });

    it('should filter by multiple technician IDs', () => {
      const filter = createJobsFilter({
        technicianIds: ['tech-123', 'tech-456'],
      });

      const result = filter(jobs);
      expect(result).toHaveLength(3);
      expect(result.map((j) => j.id)).toEqual(['job-1', 'job-2', 'job-3']);
    });

    it('should filter by "not_assigned"', () => {
      const filter = createJobsFilter({
        technicianIds: ['not_assigned'],
      });

      const result = filter(jobs);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('job-4');
    });

    it('should filter by mixed technicians and "not_assigned"', () => {
      const filter = createJobsFilter({
        technicianIds: ['tech-123', 'not_assigned'],
      });

      const result = filter(jobs);
      expect(result).toHaveLength(3);
      expect(result.map((j) => j.id)).toEqual(['job-1', 'job-3', 'job-4']);
    });

    it('should return all jobs when no technician filter is applied', () => {
      const filter = createJobsFilter({});

      const result = filter(jobs);
      expect(result).toHaveLength(4);
    });

    it('should combine with other filters (status)', () => {
      // Add status variation to test jobs
      const jobsWithStatus = jobs.map((job, index) => ({
        ...job,
        status: index % 2 === 0 ? 'open' : 'in_progress',
      })) as JobData[];

      const filter = createJobsFilter({
        technicianIds: ['tech-123'],
        statuses: ['open' as any],
      });

      const result = filter(jobsWithStatus);
      // Should get jobs that are both assigned to tech-123 AND have open status
      // job-1 (index 0) and job-3 (index 2) are assigned to tech-123
      // job-1 (index 0) and job-3 (index 2) both have 'open' status (even indices)
      expect(result).toHaveLength(2);
      expect(result.map((j) => j.id)).toEqual(['job-1', 'job-3']);
    });
  });

  describe('createFilterFromSearchParams with technician parameters', () => {
    it('should parse single technician ID from search params', () => {
      const searchParams = new URLSearchParams('technician_ids=tech-123');
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.technicianIds).toEqual(['tech-123']);
    });

    it('should parse multiple technician IDs from search params', () => {
      const searchParams = new URLSearchParams('technician_ids=tech-123,tech-456,not_assigned');
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.technicianIds).toEqual(['tech-123', 'tech-456', 'not_assigned']);
    });

    it('should handle empty technician_ids parameter', () => {
      const searchParams = new URLSearchParams('technician_ids=');
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.technicianIds).toBeUndefined();
    });

    it('should handle missing technician_ids parameter', () => {
      const searchParams = new URLSearchParams('status=open');
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.technicianIds).toBeUndefined();
    });

    it('should combine with other search parameters', () => {
      const searchParams = new URLSearchParams(
        'status=open,in_progress&technician_ids=tech-123,not_assigned&priority=high'
      );
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.statuses).toEqual(['open', 'in_progress']);
      expect(filter.technicianIds).toEqual(['tech-123', 'not_assigned']);
      expect(filter.priority).toBe('high');
    });

    it('should handle legacy single technician_id parameter', () => {
      const searchParams = new URLSearchParams('technician_id=tech-123');
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.technicianId).toBe('tech-123');
      expect(filter.technicianIds).toBeUndefined();
    });

    it('should prioritize technician_ids over technician_id when both present', () => {
      const searchParams = new URLSearchParams(
        'technician_id=tech-legacy&technician_ids=tech-123,tech-456'
      );
      const filter = createFilterFromSearchParams(searchParams);

      expect(filter.technicianId).toBe('tech-legacy');
      expect(filter.technicianIds).toEqual(['tech-123', 'tech-456']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null job assignments gracefully', () => {
      const job = createMockJob({
        jobAssignments: null as any,
      });

      expect(matchesTechnicianFilter(job, ['tech-123'])).toBe(false);
      expect(matchesTechnicianFilter(job, ['not_assigned'])).toBe(true);
    });

    it('should handle assignments with missing user data', () => {
      const job = createMockJob({
        jobAssignments: [
          {
            id: 'assignment-1',
            user_id: 'tech-123',
            user: null, // Missing user data
            job_id: 'job-123',
          },
        ] as any,
      });

      expect(matchesTechnicianFilter(job, ['tech-123'])).toBe(false);
    });

    it('should handle assignments with missing user ID', () => {
      const technician = { ...createMockTechnician('tech-123'), id: undefined } as any;
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(matchesTechnicianFilter(job, ['tech-123'])).toBe(false);
    });

    it('should handle empty technician IDs in filter array', () => {
      const technician = createMockTechnician('tech-123');
      const job = createMockJob({
        jobAssignments: [createMockAssignment(technician)],
      });

      expect(matchesTechnicianFilter(job, ['', 'tech-123', ''])).toBe(true);
      // Empty strings return true from isAssignedToTechnician (line 58 in jobs.svelte.ts)
      // So empty strings in the filter will match any job
      expect(matchesTechnicianFilter(job, ['', ''])).toBe(true);
    });
  });
});
