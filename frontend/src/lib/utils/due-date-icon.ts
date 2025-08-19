/**
 * Utility functions for calculating and selecting due date icons
 * Extracted from JobSchedulePopover to be reused across components
 */

/**
 * Calculate the number of days until a due date
 * @param due The due date to calculate from
 * @returns Number of days until due (negative if overdue), or null if no date
 */
export function getDaysUntilDue(due: Date | null): number | null {
  if (!due) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  const diffTime = dueDay.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get the appropriate calendar icon based on due date
 * @param dueDate The due date to calculate icon for
 * @returns Path to the appropriate calendar SVG icon, or null if no date
 */
export function getDueDateIcon(dueDate: Date | null): string | null {
  const daysUntil = getDaysUntilDue(dueDate);

  if (daysUntil === null) {
    // No due date set - return null (calendar-add.svg is for toolbar only)
    return null;
  } else if (daysUntil < 0) {
    // Overdue
    return '/icons/calendar.badge.exclamation.svg';
  } else if (daysUntil >= 0 && daysUntil <= 31) {
    // Due within 31 days - use numbered calendar
    return `/icons/${daysUntil}.calendar.svg`;
  } else {
    // Due more than 31 days away
    return '/icons/ellipsis.calendar.svg';
  }
}

/**
 * Calculate the number of days until a start date
 * @param start The start date to calculate from
 * @returns Number of days until start (negative if already started), or null if no date
 */
export function getDaysUntilStart(start: Date | null): number | null {
  if (!start) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);

  const diffTime = startDay.getTime() - today.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get the appropriate calendar icon based on start date
 * @param startDate The start date to calculate icon for
 * @returns Path to the appropriate GREEN calendar SVG icon, or null if already started
 */
export function getStartDateIcon(startDate: Date | null): string | null {
  const daysUntil = getDaysUntilStart(startDate);

  if (daysUntil === null) {
    // No start date set
    return null;
  } else if (daysUntil < 0) {
    // Already started - no icon
    return null;
  } else if (daysUntil >= 0 && daysUntil <= 31) {
    // Starting within 31 days - use numbered GREEN calendar
    return `/icons/${daysUntil}.calendar.green.svg`;
  } else {
    // Starting more than 31 days away
    return '/icons/ellipsis.calendar.green.svg';
  }
}

/**
 * Determine if we should show the start date icon
 * @param startsAt The start date/time (ISO string or timestamp)
 * @param startTimeSet Whether a specific time was set (not just date)
 * @returns true if job hasn't started yet, false if it has started
 */
export function shouldShowStartIcon(
  startsAt: string | number | null | undefined,
  startTimeSet: boolean
): boolean {
  if (!startsAt) return false;

  const now = new Date();
  const startDate = new Date(startsAt);

  // Reset to start of day for date comparison
  const nowDay = new Date(now);
  nowDay.setHours(0, 0, 0, 0);
  const startDay = new Date(startDate);
  startDay.setHours(0, 0, 0, 0);

  // If start date is in the future (different day), show start icon
  if (startDay > nowDay) {
    return true;
  }

  // If start date is in the past (different day), don't show start icon
  if (startDay < nowDay) {
    return false;
  }

  // Start date is today - check if time was set
  if (startTimeSet) {
    // Compare actual times
    return startDate > now;
  }

  // Today with no specific time set - treat as already started
  return false;
}

/**
 * Get the appropriate date icon for a job (start or due date)
 * @param startsAt The job's start date/time
 * @param startTimeSet Whether a specific start time was set
 * @param dueAt The job's due date/time
 * @returns Path to the appropriate calendar SVG icon, or null if no relevant dates
 */
export function getJobDateIcon(
  startsAt: string | number | null | undefined,
  startTimeSet: boolean,
  dueAt: string | number | null | undefined
): string | null {
  // Check if we should show start date icon (job hasn't started yet)
  if (shouldShowStartIcon(startsAt, startTimeSet)) {
    return getStartDateIcon(startsAt ? new Date(startsAt) : null);
  }

  // Job has started (or no start date), show due date icon if available
  if (dueAt) {
    return getDueDateIcon(new Date(dueAt));
  }

  // No relevant dates to show
  return null;
}

/**
 * Get the date icon for toolbar display (includes calendar-add fallback)
 * @param startsAt The job's start date/time
 * @param startTimeSet Whether a specific start time was set
 * @param dueAt The job's due date/time
 * @returns Path to the appropriate calendar SVG icon (never null)
 */
export function getToolbarDateIcon(
  startsAt: string | number | null | undefined,
  startTimeSet: boolean,
  dueAt: string | number | null | undefined
): string {
  const jobIcon = getJobDateIcon(startsAt, startTimeSet, dueAt);
  // If no date icon available, show the "add date" icon
  return jobIcon || '/icons/calendar-add.svg';
}
