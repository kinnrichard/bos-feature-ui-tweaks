/**
 * Shared utility functions for TaskRow components
 * Extracted from TaskList.svelte to eliminate duplication
 */

import type { Task } from '$lib/api/tasks';

/**
 * Convert task status to human-readable label
 */
export function getStatusLabel(status: string): string {
  const labelMap: Record<string, string> = {
    new_task: 'New',
    in_progress: 'In Progress',
    paused: 'Paused',
    successfully_completed: 'Completed',
    cancelled: 'Cancelled',
    failed: 'Failed',
  };
  return labelMap[status] || status.replace('_', ' ');
}

/**
 * Format date string to localized short format
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format duration in seconds to human-readable time string
 */
export function formatTimeDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  } else {
    return `${Math.floor(minutes)}m`;
  }
}

/**
 * Calculate task depth for indentation
 */
export function getTaskDepth(tasks: Task[], taskId: string): number {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !task.parent_id) return 0;

  return 1 + getTaskDepth(tasks, task.parent_id);
}

/**
 * Calculate current duration for time tracking
 * Includes accumulated time plus current session if in progress
 */
export function calculateCurrentDuration(task: Task, currentTime?: number): number {
  if (task.status !== 'in_progress' || !task.in_progress_since) {
    return task.accumulated_seconds || 0;
  }

  const startTime = new Date(task.in_progress_since).getTime();
  const now = currentTime ?? Date.now();
  const currentSessionSeconds = Math.floor((now - startTime) / 1000);

  return (task.accumulated_seconds || 0) + currentSessionSeconds;
}
