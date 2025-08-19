/**
 * Job grouping utilities for automatic job list organization
 * EP-0030: Job List Grouping Sections
 *
 * This module provides functions to group and sort jobs into logical sections
 * based on their due dates, start dates, and status.
 */

import type { JobData } from '$lib/models/types/job-data';
import { getDaysUntilDue, getDaysUntilStart } from './due-date-icon';

/**
 * Job group section types
 */
export type JobGroupSection =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'next_week'
  | 'no_due_date'
  | 'scheduled'
  | 'completed_cancelled';

/**
 * Grouped jobs data structure
 */
export interface GroupedJobs {
  overdue: JobData[];
  today: JobData[];
  tomorrow: JobData[];
  next_week: JobData[];
  no_due_date: JobData[];
  scheduled: JobData[];
  completed_cancelled: JobData[];
}

/**
 * Section metadata for display
 */
export interface SectionInfo {
  title: string;
  priority: number;
}

/**
 * Section configuration
 */
export const SECTION_CONFIG: Record<JobGroupSection, SectionInfo> = {
  today: { title: 'Today', priority: 1 },
  overdue: { title: 'Overdue', priority: 2 },
  tomorrow: { title: 'Due Tomorrow', priority: 3 },
  next_week: { title: 'Due This Week', priority: 4 },
  no_due_date: { title: 'No Due Date', priority: 5 },
  scheduled: { title: 'Scheduled for Future', priority: 6 },
  completed_cancelled: { title: 'Completed or Cancelled', priority: 7 },
};

/**
 * Status priority order for sorting within sections
 * Lower numbers appear first
 */
const STATUS_PRIORITY: Record<JobData['status'], number> = {
  in_progress: 1, // Highest priority - active work
  paused: 2, // Was in progress but paused
  open: 3, // Ready to be worked on
  waiting_for_customer: 4, // Blocked by customer
  waiting_for_scheduled_appointment: 5, // Blocked by schedule
  cancelled: 6, // No longer active
  successfully_completed: 7, // Done
};

/**
 * Job priority order for secondary sorting
 * Lower numbers appear first (more urgent)
 */
const JOB_PRIORITY: Record<JobData['priority'], number> = {
  critical: 1,
  very_high: 2,
  high: 3,
  normal: 4,
  low: 5,
  proactive_followup: 6,
};

/**
 * Check if a job is overdue
 */
export function isOverdue(job: JobData): boolean {
  if (!job.due_at) return false;
  const daysUntil = getDaysUntilDue(new Date(job.due_at));
  return daysUntil !== null && daysUntil < 0;
}

/**
 * Check if a job belongs in the Today section
 * (due today OR in progress)
 */
export function isDueToday(job: JobData): boolean {
  // All in-progress jobs belong in Today
  if (job.status === 'in_progress') return true;

  // Jobs due today also belong in Today
  if (!job.due_at) return false;
  const daysUntil = getDaysUntilDue(new Date(job.due_at));
  return daysUntil === 0;
}

/**
 * Check if a job is due tomorrow
 */
export function isDueTomorrow(job: JobData): boolean {
  if (!job.due_at) return false;
  const daysUntil = getDaysUntilDue(new Date(job.due_at));
  return daysUntil === 1;
}

/**
 * Check if a job is due within the next week (2-7 days)
 */
export function isDueNextWeek(job: JobData): boolean {
  if (!job.due_at) return false;
  const daysUntil = getDaysUntilDue(new Date(job.due_at));
  return daysUntil !== null && daysUntil >= 2 && daysUntil <= 7;
}

/**
 * Check if a job is scheduled for the future (hasn't started yet)
 */
export function isScheduledForFuture(job: JobData): boolean {
  if (!job.starts_at) return false;
  const daysUntilStart = getDaysUntilStart(new Date(job.starts_at));
  return daysUntilStart !== null && daysUntilStart > 0;
}

/**
 * Check if a job is completed or cancelled
 */
export function isCompletedOrCancelled(job: JobData): boolean {
  return job.status === 'successfully_completed' || job.status === 'cancelled';
}

/**
 * Determine which section a job belongs to
 */
export function getJobSection(job: JobData): JobGroupSection {
  // Completed and cancelled jobs go to their own section
  if (isCompletedOrCancelled(job)) {
    return 'completed_cancelled';
  }

  // In-progress jobs always go to Today section
  if (job.status === 'in_progress') {
    return 'today';
  }

  // Jobs scheduled for future (haven't started yet)
  if (isScheduledForFuture(job)) {
    return 'scheduled';
  }

  // Jobs with due dates
  if (job.due_at) {
    if (isOverdue(job)) return 'overdue';
    if (isDueToday(job)) return 'today';
    if (isDueTomorrow(job)) return 'tomorrow';
    if (isDueNextWeek(job)) return 'next_week';
    // Jobs due more than a week out fall through to no_due_date handling
  }

  // Jobs with no due date or due far in the future
  return 'no_due_date';
}

/**
 * Sort jobs within a section
 */
export function sortJobsInSection(jobs: JobData[]): JobData[] {
  return [...jobs].sort((a, b) => {
    // Primary sort by status priority
    const statusPriorityA = STATUS_PRIORITY[a.status] || 999;
    const statusPriorityB = STATUS_PRIORITY[b.status] || 999;

    if (statusPriorityA !== statusPriorityB) {
      return statusPriorityA - statusPriorityB;
    }

    // Secondary sort by job priority (critical > high > normal > low)
    const jobPriorityA = JOB_PRIORITY[a.priority] || 999;
    const jobPriorityB = JOB_PRIORITY[b.priority] || 999;

    if (jobPriorityA !== jobPriorityB) {
      return jobPriorityA - jobPriorityB;
    }

    // Tertiary sort by date
    // Jobs with dates should come BEFORE jobs without dates
    const hasDateA = (a.starts_at && isScheduledForFuture(a)) || a.due_at;
    const hasDateB = (b.starts_at && isScheduledForFuture(b)) || b.due_at;

    // If one has a date and the other doesn't, prioritize the one with a date
    if (hasDateA && !hasDateB) return -1;
    if (!hasDateA && hasDateB) return 1;

    // Both have dates or both don't have dates - sort by the actual date
    let dateA: number;
    let dateB: number;

    if (a.starts_at && isScheduledForFuture(a)) {
      dateA = new Date(a.starts_at).getTime();
    } else if (a.due_at) {
      dateA = new Date(a.due_at).getTime();
    } else {
      dateA = new Date(a.created_at).getTime();
    }

    if (b.starts_at && isScheduledForFuture(b)) {
      dateB = new Date(b.starts_at).getTime();
    } else if (b.due_at) {
      dateB = new Date(b.due_at).getTime();
    } else {
      dateB = new Date(b.created_at).getTime();
    }

    if (dateA !== dateB) {
      return dateA - dateB;
    }

    // Quaternary sort: job title as final tiebreaker
    return (a.title || '').localeCompare(b.title || '');
  });
}

/**
 * Group jobs into sections
 */
export function groupJobs(jobs: JobData[]): GroupedJobs {
  const grouped: GroupedJobs = {
    overdue: [],
    today: [],
    tomorrow: [],
    next_week: [],
    no_due_date: [],
    scheduled: [],
    completed_cancelled: [],
  };

  // Group jobs by section
  for (const job of jobs) {
    const section = getJobSection(job);
    grouped[section].push(job);
  }

  // Sort jobs within each section
  for (const section of Object.keys(grouped) as JobGroupSection[]) {
    grouped[section] = sortJobsInSection(grouped[section]);
  }

  return grouped;
}

/**
 * Get sections that have jobs (for rendering only non-empty sections)
 */
export function getPopulatedSections(groupedJobs: GroupedJobs): Array<{
  section: JobGroupSection;
  jobs: JobData[];
  info: SectionInfo;
}> {
  const sections: Array<{
    section: JobGroupSection;
    jobs: JobData[];
    info: SectionInfo;
  }> = [];

  // Add sections that have jobs, in priority order
  for (const [section, info] of Object.entries(SECTION_CONFIG)) {
    const sectionKey = section as JobGroupSection;
    const jobs = groupedJobs[sectionKey];

    if (jobs.length > 0) {
      let sectionInfo = { ...info };

      // Special handling for completed_cancelled section
      if (sectionKey === 'completed_cancelled') {
        const hasCompleted = jobs.some((job) => job.status === 'successfully_completed');
        const hasCancelled = jobs.some((job) => job.status === 'cancelled');

        if (hasCompleted && !hasCancelled) {
          sectionInfo.title = 'Completed';
        } else if (!hasCompleted && hasCancelled) {
          sectionInfo.title = 'Cancelled';
        }
        // Otherwise keep the default 'Completed or Cancelled'
      }

      sections.push({
        section: sectionKey,
        jobs,
        info: sectionInfo,
      });
    }
  }

  // Sort by priority
  sections.sort((a, b) => a.info.priority - b.info.priority);

  return sections;
}

/**
 * Get total job count across all sections
 */
export function getTotalJobCount(groupedJobs: GroupedJobs): number {
  return Object.values(groupedJobs).reduce((total, jobs) => total + jobs.length, 0);
}

/**
 * Get job count for a specific section
 */
export function getSectionJobCount(groupedJobs: GroupedJobs, section: JobGroupSection): number {
  return groupedJobs[section].length;
}
