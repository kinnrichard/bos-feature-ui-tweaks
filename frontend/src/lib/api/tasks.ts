import { api } from './client';

// Simplified task interface for component use
export interface Task {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  position?: number;
  subtasks_count?: number;
  depth?: number;
  // Time tracking fields
  in_progress_since?: string;
  accumulated_seconds?: number;
  assigned_to?: {
    id: string;
    name: string;
    initials: string;
  };
}

export interface TaskReorderRequest {
  id: string;
  position: number;
  parent_id?: string;
  lock_version?: number;
}

export interface RelativeTaskReorderRequest {
  id: string;
  parent_id?: string | null;
  before_task_id?: string;
  after_task_id?: string;
  position?: 'first' | 'last';
  lock_version?: number;
}

export interface BatchTaskReorderRequest {
  positions: TaskReorderRequest[];
  job_lock_version?: number;
}

export interface BatchRelativeTaskReorderRequest {
  relative_positions: RelativeTaskReorderRequest[];
  job_lock_version?: number;
}

export interface TaskReorderResponse {
  status: string;
  timestamp: string;
  lock_version?: number;
  job_lock_version?: number;
  tasks?: Array<{
    id: string;
    title: string;
    position: number;
    parent_id?: string;
    status: string;
    lock_version: number;
  }>;
}

export interface TaskReorderError {
  error: string;
  conflict?: boolean;
  current_state?: {
    job_lock_version: number;
    tasks: Array<{
      id: string;
      title: string;
      position: number;
      parent_id?: string;
      status: string;
      lock_version: number;
    }>;
  };
}

export class TasksService {
  /**
   * Reorder a single task to a new position
   */
  async reorderTask(
    jobId: string,
    taskId: string,
    position: number,
    lockVersion?: number
  ): Promise<TaskReorderResponse> {
    const payload: { position: number; lock_version?: number } = { position };
    if (lockVersion !== undefined) {
      payload.lock_version = lockVersion;
    }

    return api.patch<TaskReorderResponse>(`/jobs/${jobId}/tasks/${taskId}/reorder`, payload);
  }

  /**
   * Batch reorder multiple tasks
   */
  async batchReorderTasks(
    jobId: string,
    request: BatchTaskReorderRequest
  ): Promise<TaskReorderResponse> {
    return api.patch<TaskReorderResponse>(`/jobs/${jobId}/tasks/batch_reorder`, request);
  }

  /**
   * Batch reorder multiple tasks using relative positioning
   */
  async batchReorderTasksRelative(
    jobId: string,
    request: BatchRelativeTaskReorderRequest
  ): Promise<TaskReorderResponse> {
    return api.patch<TaskReorderResponse>(`/jobs/${jobId}/tasks/batch_reorder_relative`, request);
  }

  /**
   * Nest a task under another task (make it a subtask)
   */
  async nestTask(
    jobId: string,
    taskId: string,
    parentId: string,
    position?: number
  ): Promise<{ status: string; task: Task; timestamp: string }> {
    const taskData: { parent_id: string; position?: number } = { parent_id: parentId };
    if (position !== undefined) {
      taskData.position = position;
    }

    return this.updateTask(jobId, taskId, taskData);
  }

  /**
   * Nest a task using relative positioning
   */
  async nestTaskRelative(
    jobId: string,
    taskId: string,
    parentId: string,
    options: {
      before_task_id?: string;
      after_task_id?: string;
      position?: 'first' | 'last';
    } = {}
  ): Promise<{ status: string; task: Task; timestamp: string }> {
    const taskData: {
      parent_id: string;
      before_task_id?: string;
      after_task_id?: string;
      position?: 'first' | 'last';
    } = { parent_id: parentId };

    if (options.before_task_id) {
      taskData.before_task_id = options.before_task_id;
    } else if (options.after_task_id) {
      taskData.after_task_id = options.after_task_id;
    } else if (options.position === 'first') {
      taskData.position = 'first';
    } else {
      // Default to 'last' for nesting
      taskData.position = 'last';
    }

    return this.updateTask(jobId, taskId, taskData);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    jobId: string,
    taskId: string,
    status: string
  ): Promise<{ status: string; task: Task }> {
    return api.patch<{ status: string; task: Task }>(
      `/jobs/${jobId}/tasks/${taskId}/update_status`,
      {
        status,
      }
    );
  }

  /**
   * Create new task
   */
  async createTask(
    jobId: string,
    taskData: {
      title: string;
      status?: string;
      parent_id?: string;
      position?: number;
      after_task_id?: string;
    }
  ): Promise<{ status: string; task: Task }> {
    return api.post<{ status: string; task: Task }>(`/jobs/${jobId}/tasks`, {
      task: taskData,
    });
  }

  /**
   * Update task
   */
  async updateTask(
    jobId: string,
    taskId: string,
    taskData: Partial<{
      title: string;
      status: string;
      assigned_to_id: string;
      parent_id: string;
      position: number;
      before_task_id: string;
      after_task_id: string;
    }>
  ): Promise<{ status: string; task: Task; timestamp: string }> {
    return api.patch<{ status: string; task: Task; timestamp: string }>(
      `/jobs/${jobId}/tasks/${taskId}`,
      {
        task: taskData,
      }
    );
  }

  /**
   * Delete task
   */
  async deleteTask(jobId: string, taskId: string): Promise<{ status: string; message: string }> {
    return api.delete<{ status: string; message: string }>(`/jobs/${jobId}/tasks/${taskId}`);
  }

  /**
   * Get task details
   */
  async getTaskDetails(jobId: string, taskId: string): Promise<Record<string, unknown>> {
    // For demo purposes, return mock data
    if (jobId === 'test') {
      return {
        id: taskId,
        title: `Task ${taskId} details`,
        status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: [
          {
            id: 'note1',
            content: 'This is a sample note showing the task progress.',
            user_name: 'John Smith',
            created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
          },
          {
            id: 'note2',
            content: 'Another note with more details about the task.',
            user_name: 'Alice Johnson',
            created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
          },
        ],
        available_technicians: [
          {
            id: 'user1',
            name: 'John Smith',
            initials: 'JS',
          },
          {
            id: 'user2',
            name: 'Alice Johnson',
            initials: 'AJ',
          },
          {
            id: 'user3',
            name: 'Bob Wilson',
            initials: 'BW',
          },
        ],
      };
    }

    return api.get<Record<string, unknown>>(`/jobs/${jobId}/tasks/${taskId}/details`);
  }

  /**
   * Get batch task details for all tasks in a job
   */
  async getBatchTaskDetails(jobId: string): Promise<{
    data: Array<{
      type: string;
      id: string;
      attributes: {
        title: string;
        status: string;
        position: number;
        parent_id?: string;
        created_at: string;
        updated_at: string;
        completed_at?: string;
        notes: Array<{
          id: string;
          content: string;
          user_name: string;
          created_at: string;
        }>;
        activity_logs: Array<{
          id: string;
          action: string;
          user_name?: string;
          created_at: string;
          metadata: Record<string, unknown>;
        }>;
      };
      relationships: {
        assigned_to: {
          data: { type: string; id: string } | null;
        };
      };
    }>;
    included: Array<{
      type: string;
      id: string;
      attributes: {
        name: string;
        email: string;
      };
    }>;
  }> {
    // For demo purposes, return mock data
    if (jobId === 'test') {
      return {
        data: [
          {
            type: 'tasks',
            id: 'task1',
            attributes: {
              title: 'Test Task 1',
              status: 'in_progress',
              position: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              notes: [
                {
                  id: 'note1',
                  content: 'This is a batch-loaded note',
                  user_name: 'John Smith',
                  created_at: new Date().toISOString(),
                },
              ],
              activity_logs: [
                {
                  id: 'log1',
                  action: 'status_changed',
                  user_name: 'Alice Johnson',
                  created_at: new Date().toISOString(),
                  metadata: { from: 'new_task', to: 'in_progress' },
                },
              ],
            },
            relationships: {
              assigned_to: {
                data: { type: 'users', id: 'user1' },
              },
            },
          },
        ],
        included: [
          {
            type: 'users',
            id: 'user1',
            attributes: {
              name: 'John Smith',
              email: 'john@example.com',
            },
          },
        ],
      };
    }

    return api.get(`/jobs/${jobId}/tasks/batch_details`);
  }

  /**
   * Assign task to technician
   */
  async assignTask(
    jobId: string,
    taskId: string,
    technicianId: string | null
  ): Promise<{ status: string; technician?: { id: string; name: string } }> {
    // For demo purposes, return mock response
    if (jobId === 'test') {
      const technicians = [
        { id: 'user1', name: 'John Smith' },
        { id: 'user2', name: 'Alice Johnson' },
        { id: 'user3', name: 'Bob Wilson' },
      ];

      const technician = technicianId ? technicians.find((t) => t.id === technicianId) : null;

      return {
        status: 'success',
        technician: technician || undefined,
      };
    }

    return api.patch<{ status: string; technician?: { id: string; name: string } }>(
      `/jobs/${jobId}/tasks/${taskId}/assign`,
      { technician_id: technicianId }
    );
  }

  /**
   * Add note to task
   */
  async addNote(
    jobId: string,
    taskId: string,
    content: string
  ): Promise<{
    status: string;
    note: {
      id: string;
      content: string;
      user_name: string;
      created_at: string;
    };
  }> {
    // For demo purposes, return mock response
    if (jobId === 'test') {
      return {
        status: 'success',
        note: {
          id: `note-${Date.now()}`,
          content,
          user_name: 'Current User',
          created_at: new Date().toISOString(),
        },
      };
    }

    return api.post<{
      status: string;
      note: {
        id: string;
        content: string;
        user_name: string;
        created_at: string;
      };
    }>(`/jobs/${jobId}/tasks/${taskId}/notes`, {
      note: { content },
    });
  }

  /**
   * Search tasks within a job
   */
  async searchTasks(
    jobId: string,
    query: string
  ): Promise<{
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      parent_titles: string[];
    }>;
  }> {
    return api.get<{
      tasks: Array<{
        id: string;
        title: string;
        status: string;
        parent_titles: string[];
      }>;
    }>(`/jobs/${jobId}/tasks/search?q=${encodeURIComponent(query)}`);
  }
}

// Export singleton instance
export const tasksService = new TasksService();
