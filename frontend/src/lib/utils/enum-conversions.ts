// Integer-to-string enum conversion utilities
// Maps Rails enum integer values to their string representations

/**
 * Job status enum mappings
 * Rails: {"open" => 0, "in_progress" => 1, "paused" => 2, "waiting_for_customer" => 3, "waiting_for_scheduled_appointment" => 4, "successfully_completed" => 5, "cancelled" => 6}
 */
export const JOB_STATUS_MAP = {
  0: 'open',
  1: 'in_progress',
  2: 'paused',
  3: 'waiting_for_customer',
  4: 'waiting_for_scheduled_appointment',
  5: 'successfully_completed',
  6: 'cancelled',
} as const;

export const JOB_STATUS_REVERSE_MAP = {
  open: 0,
  in_progress: 1,
  paused: 2,
  waiting_for_customer: 3,
  waiting_for_scheduled_appointment: 4,
  successfully_completed: 5,
  cancelled: 6,
} as const;

/**
 * Job priority enum mappings
 * Rails: {"critical" => 0, "very_high" => 1, "high" => 2, "normal" => 3, "low" => 4, "proactive_followup" => 5}
 */
export const JOB_PRIORITY_MAP = {
  0: 'critical',
  1: 'very_high',
  2: 'high',
  3: 'normal',
  4: 'low',
  5: 'proactive_followup',
} as const;

export const JOB_PRIORITY_REVERSE_MAP = {
  critical: 0,
  very_high: 1,
  high: 2,
  normal: 3,
  low: 4,
  proactive_followup: 5,
} as const;

/**
 * Contact type enum mappings
 * Rails: {"phone" => 0, "email" => 1, "address" => 2}
 */
export const CONTACT_TYPE_MAP = {
  0: 'phone',
  1: 'email',
  2: 'address',
} as const;

export const CONTACT_TYPE_REVERSE_MAP = {
  phone: 0,
  email: 1,
  address: 2,
} as const;

/**
 * Task status enum mappings
 * Rails: {"new_task" => 0, "in_progress" => 1, "paused" => 2, "successfully_completed" => 3, "cancelled" => 4}
 */
export const TASK_STATUS_MAP = {
  0: 'new_task',
  1: 'in_progress',
  2: 'paused',
  3: 'successfully_completed',
  4: 'cancelled',
} as const;

export const TASK_STATUS_REVERSE_MAP = {
  new_task: 0,
  in_progress: 1,
  paused: 2,
  successfully_completed: 3,
  cancelled: 4,
} as const;

/**
 * User role enum mappings
 * Rails: {"admin" => 0, "technician" => 1, "customer_specialist" => 2, "owner" => 3}
 */
export const USER_ROLE_MAP = {
  0: 'admin',
  1: 'technician',
  2: 'customer_specialist',
  3: 'owner',
} as const;

export const USER_ROLE_REVERSE_MAP = {
  admin: 0,
  technician: 1,
  customer_specialist: 2,
  owner: 3,
} as const;

// Type definitions for enum values
export type JobStatusInteger = keyof typeof JOB_STATUS_MAP;
export type JobStatusString = (typeof JOB_STATUS_MAP)[JobStatusInteger];
export type JobPriorityInteger = keyof typeof JOB_PRIORITY_MAP;
export type JobPriorityString = (typeof JOB_PRIORITY_MAP)[JobPriorityInteger];
export type ContactTypeInteger = keyof typeof CONTACT_TYPE_MAP;
export type ContactTypeString = (typeof CONTACT_TYPE_MAP)[ContactTypeInteger];
export type TaskStatusInteger = keyof typeof TASK_STATUS_MAP;
export type TaskStatusString = (typeof TASK_STATUS_MAP)[TaskStatusInteger];
export type UserRoleInteger = keyof typeof USER_ROLE_MAP;
export type UserRoleString = (typeof USER_ROLE_MAP)[UserRoleInteger];

/**
 * Convert job status integer to string
 */
export function getJobStatusString(status: number | null | undefined): string {
  if (status === null || status === undefined) return 'unknown';
  return JOB_STATUS_MAP[status as JobStatusInteger] || 'unknown';
}

/**
 * Convert job status string to integer
 */
export function getJobStatusInteger(status: string): number {
  return JOB_STATUS_REVERSE_MAP[status as JobStatusString] ?? 0;
}

/**
 * Convert job priority integer to string
 */
export function getJobPriorityString(priority: number | null | undefined): string {
  if (priority === null || priority === undefined) return 'normal';
  return JOB_PRIORITY_MAP[priority as JobPriorityInteger] || 'normal';
}

/**
 * Convert job priority string to integer
 */
export function getJobPriorityInteger(priority: string): number {
  return JOB_PRIORITY_REVERSE_MAP[priority as JobPriorityString] ?? 3;
}

/**
 * Convert contact type integer to string
 */
export function getContactTypeString(contactType: number | null | undefined): string {
  if (contactType === null || contactType === undefined) return 'phone';
  return CONTACT_TYPE_MAP[contactType as ContactTypeInteger] || 'phone';
}

/**
 * Convert contact type string to integer
 */
export function getContactTypeInteger(contactType: string): number {
  return CONTACT_TYPE_REVERSE_MAP[contactType as ContactTypeString] ?? 0;
}

/**
 * Convert task status integer to string
 */
export function getTaskStatusString(status: number | null | undefined): string {
  if (status === null || status === undefined) return 'new_task';
  return TASK_STATUS_MAP[status as TaskStatusInteger] || 'new_task';
}

/**
 * Convert task status string to integer
 */
export function getTaskStatusInteger(status: string): number {
  return TASK_STATUS_REVERSE_MAP[status as TaskStatusString] ?? 0;
}

/**
 * Convert user role integer to string
 */
export function getUserRoleString(role: number | null | undefined): string {
  if (role === null || role === undefined) return 'technician';
  return USER_ROLE_MAP[role as UserRoleInteger] || 'technician';
}

/**
 * Convert user role string to integer
 */
export function getUserRoleInteger(role: string): number {
  return USER_ROLE_REVERSE_MAP[role as UserRoleString] ?? 1;
}
