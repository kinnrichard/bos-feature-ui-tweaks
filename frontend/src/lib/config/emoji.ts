/**
 * Centralized emoji configuration for the bŏs Svelte PWA
 *
 * This is the single source of truth for all emoji mappings throughout the application.
 * Based on the original Rails emoji configuration but adapted for the API + PWA architecture.
 */

import {
  getJobStatusString,
  getJobPriorityString,
  getTaskStatusString,
  TASK_STATUS_MAP,
} from '$lib/utils/enum-conversions';

// Job Status Emoji Mappings
const JOB_STATUS_EMOJIS: Record<string, string> = {
  open: '⚫',
  in_progress: '🟢',
  waiting_for_customer: '⏳',
  waiting_for_scheduled_appointment: '🗓️',
  paused: '⏸️',
  successfully_completed: '☑️',
  cancelled: '❌',
};

// Job Priority Emoji Mappings
const JOB_PRIORITY_EMOJIS: Record<string, string> = {
  critical: '🔥',
  very_high: '‼️',
  high: '❗',
  normal: '➖',
  low: '🐢',
  proactive_followup: '💬',
};

// Task Status Emoji Mappings
const TASK_STATUS_EMOJIS: Record<string, string> = {
  new_task: '⚫️',
  in_progress: '🟢',
  paused: '⏸️',
  successfully_completed: '☑️',
  cancelled: '❌',
};

// Task Priority Emoji Mappings
const TASK_PRIORITY_EMOJIS: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

// Activity Type Emoji Mappings
const ACTIVITY_TYPE_EMOJIS: Record<string, string> = {
  client: '👤',
  job: '💼',
  'cross-reference': '🔗',
  general: '⚙️',
};

// Entity Type Emoji Mappings
const ENTITY_TYPE_EMOJIS: Record<string, string> = {
  Client: '👤', // Default for client when type is unknown
  Job: '💼',
  Task: '☑️',
  Person: '👤',
  Device: '💻',
  Note: '📝',
};

// Utility Emojis
const UTILITY_EMOJIS = {
  timer: '⏱️',
  trash: '🗑️',
  warning: '❗',
  check: '✓',
  unassigned: '❓',
  client_types: {
    business: '🏢',
    residential: '🏠',
  },
  contact_methods: {
    phone: '📱',
    primary_phone: '📱',
    email: '📧',
    address: '📍',
  },
  schedule_types: {
    scheduled_appointment: '🗓️',
    follow_up: '🔄',
    due_date: '⏰',
    start_date: '▶️',
  },
} as const;

/**
 * Get emoji for a job status
 */
export function getJobStatusEmoji(status: string | number | null | undefined): string {
  const statusString = typeof status === 'number' ? getJobStatusString(status) : status;
  return JOB_STATUS_EMOJIS[statusString || ''] || '📝';
}

/**
 * Get emoji for a job priority
 */
export function getJobPriorityEmoji(priority: string | number | null | undefined): string {
  const priorityString = typeof priority === 'number' ? getJobPriorityString(priority) : priority;
  return JOB_PRIORITY_EMOJIS[priorityString || ''] || '';
}

/**
 * Get emoji for a task status
 */
export function getTaskStatusEmoji(status: string | number | null | undefined): string {
  const statusString = typeof status === 'number' ? getTaskStatusString(status) : status;
  return TASK_STATUS_EMOJIS[statusString || ''] || '❓';
}

/**
 * Get emoji for a task, considering both status and deleted state
 * @param task - The task object
 */
export function getTaskEmoji(task: {
  status: string | number;
  discarded_at?: string | number | null;
}): string {
  // If task is deleted, always return trash emoji
  if (task.discarded_at) {
    return '🗑️';
  }

  return getTaskStatusEmoji(task.status);
}

/**
 * Get label for a task status
 */
export function getTaskStatusLabel(status: string | number | null | undefined): string {
  const statusString = typeof status === 'number' ? getTaskStatusString(status) : status;
  switch (statusString) {
    case 'new_task':
      return 'New Task';
    case 'in_progress':
      return 'In Progress';
    case 'paused':
      return 'Paused';
    case 'successfully_completed':
      return 'Completed Successfully';
    case 'cancelled':
      return 'Cancelled';
    default:
      return statusString?.replace('_', ' ') || 'Unknown';
  }
}

/**
 * Get emoji for a task priority
 */
export function getTaskPriorityEmoji(priority: string): string {
  return TASK_PRIORITY_EMOJIS[priority] || '';
}

/**
 * Get utility emoji by type
 */
export function getUtilityEmoji(type: keyof typeof UTILITY_EMOJIS): string {
  return (UTILITY_EMOJIS[type] as string) || '';
}

/**
 * Get client type emoji
 */
export function getClientTypeEmoji(type: keyof typeof UTILITY_EMOJIS.client_types): string {
  return UTILITY_EMOJIS.client_types[type] || '❓';
}

/**
 * Get contact method emoji
 */
export function getContactMethodEmoji(method: keyof typeof UTILITY_EMOJIS.contact_methods): string {
  return UTILITY_EMOJIS.contact_methods[method] || '📞';
}

/**
 * Get schedule type emoji
 */
export function getScheduleTypeEmoji(type: keyof typeof UTILITY_EMOJIS.schedule_types): string {
  return UTILITY_EMOJIS.schedule_types[type] || '🗓️';
}

/**
 * Get activity type emoji for activity log groups
 */
export function getActivityTypeEmoji(type: string): string {
  return ACTIVITY_TYPE_EMOJIS[type] || '📋';
}

/**
 * Get entity type emoji for different entity types
 * @param entityType - The entity type (Client, Job, Task, etc.)
 * @param entityData - Optional entity data for client type detection
 */
export function getEntityTypeEmoji(
  entityType: string,
  entityData?: { client_type?: string; business?: boolean }
): string {
  // Special handling for Client type
  if (entityType === 'Client' && entityData) {
    if ('client_type' in entityData && entityData.client_type === 'business') {
      return '🏢';
    } else if ('client_type' in entityData && entityData.client_type === 'residential') {
      return '🏠';
    } else if ('business' in entityData && entityData.business) {
      return '🏢';
    } else if ('business' in entityData && entityData.business === false) {
      return '🏠';
    }
  }

  return ENTITY_TYPE_EMOJIS[entityType] || '📄';
}

/**
 * Helper function to get status with emoji and label
 */
export function getJobStatusWithEmoji(status: string | number | null | undefined): string {
  if (status === null || status === undefined) return '📝 Unknown';
  const statusString = typeof status === 'number' ? getJobStatusString(status) : status;
  const emoji = getJobStatusEmoji(status);
  const label = statusString.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return `${emoji} ${label}`;
}

/**
 * Helper function to get priority with emoji and label
 */
export function getJobPriorityWithEmoji(priority: string | number | null | undefined): string {
  if (priority === null || priority === undefined) return 'Unknown';
  const priorityString = typeof priority === 'number' ? getJobPriorityString(priority) : priority;
  const emoji = getJobPriorityEmoji(priority);
  const label = priorityString.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  return emoji ? `${emoji} ${label}` : label;
}

/**
 * Generate PopoverMenu options for all task statuses
 * Uses centralized enum from enum-conversions.ts to avoid duplication
 */
export function getTaskStatusOptions() {
  const statusEntries = Object.values(TASK_STATUS_MAP) as string[];

  return [
    { id: 'title', value: 'title', label: 'Task Status', header: true },
    ...statusEntries.map((status) => ({
      id: status,
      value: status,
      label: getTaskStatusLabel(status),
      icon: TASK_STATUS_EMOJIS[status] || '❓',
    })),
  ];
}

// Export emoji mappings for advanced use cases
export const EMOJI_MAPPINGS = {
  jobStatuses: JOB_STATUS_EMOJIS,
  jobPriorities: JOB_PRIORITY_EMOJIS,
  taskStatuses: TASK_STATUS_EMOJIS,
  taskPriorities: TASK_PRIORITY_EMOJIS,
  activityTypes: ACTIVITY_TYPE_EMOJIS,
  entityTypes: ENTITY_TYPE_EMOJIS,
  utility: UTILITY_EMOJIS,
} as const;
