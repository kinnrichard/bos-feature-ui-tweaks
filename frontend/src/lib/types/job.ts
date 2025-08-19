export interface Client {
  id: string;
  type: 'clients';
  attributes: {
    name: string;
    created_at: string;
    updated_at: string;
  };
}

export interface User {
  id: string;
  type: 'users';
  attributes: {
    name: string;
    email: string;
    role: string;
    initials: string;
    avatar_style: string;
    created_at: string;
    updated_at: string;
  };
}

export interface Task {
  id: string;
  type: 'tasks';
  attributes: {
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
    parent_id?: string;
    subtasks_count?: number;
    depth?: number;
  };
}

export interface TaskCounts {
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
}

export interface Job {
  id: string;
  type: 'jobs';
  attributes: {
    title: string;
    description?: string;
    status: string;
    priority: string;
    due_on?: string;
    due_time?: string;
    start_on?: string;
    start_time?: string;
    created_at: string;
    updated_at: string;
    status_label: string;
    priority_label: string;
    is_overdue: boolean;
    task_counts: TaskCounts;
  };
  relationships: {
    client: {
      data: {
        id: string;
        type: 'clients';
      };
    };
    technicians: {
      data: Array<{
        id: string;
        type: 'users';
      }>;
    };
    tasks: {
      data: Array<{
        id: string;
        type: 'tasks';
      }>;
    };
  };
}

export interface JobsApiResponse {
  data: Job[];
  included: Array<Client | User | Task | ScheduledDateTime>;
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
  links: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

// Scheduled Date Time interface to match backend model
export interface ScheduledDateTime {
  id: string;
  type: 'scheduled_date_times';
  attributes: {
    schedulable_type: string;
    scheduled_type: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    schedulable_id?: string;
    scheduled_at?: string;
    scheduled_time_set: boolean;
  };
}

// Helper types for working with included data
export interface PopulatedJob extends Omit<Job, 'relationships'> {
  client: Client['attributes'] & { id: string };
  technicians: Array<User['attributes'] & { id: string }>;
  tasks: Array<Task['attributes'] & { id: string }>;
  scheduledDateTimes?: Array<ScheduledDateTime['attributes'] & { id: string }>;
}

// Status and priority enums for type safety
export type JobStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_for_customer'
  | 'waiting_for_scheduled_appointment'
  | 'paused'
  | 'successfully_completed'
  | 'cancelled';

export type JobPriority =
  | 'critical'
  | 'very_high'
  | 'high'
  | 'normal'
  | 'low'
  | 'proactive_followup';

// Individual job API response (for job detail view)
export interface JobApiResponse {
  data: Job;
  included: Array<Client | User | Task | ScheduledDateTime>;
}

// API request types
export interface JobsRequestParams {
  scope?: 'all' | 'mine';
  status?: JobStatus;
  priority?: JobPriority;
  client_id?: string;
  q?: string;
  page?: number;
  per_page?: number;
  include?: string;
  from_date?: string;
  to_date?: string;
}
