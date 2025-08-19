/**
 * Utility functions for consistent task sorting
 *
 * Tasks are sorted primarily by position (integer), and secondarily by created_at
 * to handle cases where multiple tasks may have the same position due to
 * concurrent offline operations.
 */

export interface SortableTask {
  position?: number | null;
  created_at?: number | Date | string | null;
}

/**
 * Compare function for sorting tasks by position, then created_at
 *
 * @param a - First task to compare
 * @param b - Second task to compare
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function compareTasksForSort(a: SortableTask, b: SortableTask): number {
  // First, compare by position
  const posA = a.position ?? 0;
  const posB = b.position ?? 0;

  if (posA !== posB) {
    return posA - posB;
  }

  // If positions are equal, compare by created_at
  const timeA = normalizeTimestamp(a.created_at);
  const timeB = normalizeTimestamp(b.created_at);

  return timeA - timeB;
}

/**
 * Sort an array of tasks by position, then created_at
 *
 * @param tasks - Array of tasks to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortTasks<T extends SortableTask>(tasks: T[]): T[] {
  return [...tasks].sort(compareTasksForSort);
}

/**
 * Sort tasks in place by position, then created_at
 *
 * @param tasks - Array of tasks to sort in place
 * @returns The same array, sorted
 */
export function sortTasksInPlace<T extends SortableTask>(tasks: T[]): T[] {
  return tasks.sort(compareTasksForSort);
}

/**
 * Normalize various timestamp formats to a comparable number
 *
 * @param timestamp - Timestamp in various formats
 * @returns Milliseconds since epoch
 */
function normalizeTimestamp(timestamp: number | Date | string | null | undefined): number {
  if (!timestamp) {
    return 0;
  }

  if (typeof timestamp === 'number') {
    // Assume it's already milliseconds since epoch
    return timestamp;
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Create a sort comparator for Zero.js queries
 * This returns the field names in the order they should be sorted
 *
 * @returns Array of field names for Zero.js orderBy
 */
export function getTaskSortFields(): ['position', 'created_at'] {
  return ['position', 'created_at'];
}
