/**
 * Test Data Factories
 *
 * Utilities for creating and managing test data via Rails API
 */

import type { Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import { testDb } from './database';

export interface JobData {
  id?: string;
  title: string;
  description?: string;
  status:
    | 'open'
    | 'in_progress'
    | 'paused'
    | 'waiting_for_customer'
    | 'waiting_for_scheduled_appointment'
    | 'successfully_completed'
    | 'cancelled';
  priority: 'critical' | 'high' | 'normal' | 'low' | 'proactive_followup';
  due_on?: string;
  due_time?: string;
  client_id?: string;
  technician_ids?: string[];
}

export interface TaskData {
  id?: string;
  title: string;
  description?: string;
  status: 'new_task' | 'in_progress' | 'paused' | 'successfully_completed' | 'cancelled' | 'failed';
  position?: number;
  job_id: string;
  parent_id?: string;
  estimated_minutes?: number;
}

export interface ClientData {
  id?: string;
  name: string;
  client_type: 'residential' | 'business';
  created_at?: string;
  updated_at?: string;
}

export interface UserData {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: 'owner' | 'admin' | 'technician' | 'technician_lead';
}

/**
 * Data factory for creating test entities via Rails API
 */
export class DataFactory {
  private page: Page;
  private baseUrl: string;
  private isAuthenticated: boolean = false;
  private csrfToken: string | null = null;

  constructor(page: Page) {
    this.page = page;
    this.baseUrl = testDb.getApiUrl();
  }

  /**
   * Get CSRF token for API calls using production endpoint
   */
  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    const csrfResponse = await this.page.request.get(`${this.baseUrl}/health`, {
      headers: { Accept: 'application/json' },
    });

    if (!csrfResponse.ok()) {
      throw new Error(`Failed to get CSRF token: ${csrfResponse.status()}`);
    }

    // Extract CSRF token from response headers (same as production)
    const headers = csrfResponse.headers();
    const csrfToken = headers['x-csrf-token'] || headers['X-CSRF-Token'];
    if (!csrfToken) {
      console.error('Available headers:', Object.keys(headers));
      throw new Error('CSRF token not found in health response headers');
    }

    this.csrfToken = csrfToken;
    return this.csrfToken;
  }

  /**
   * Ensure user is authenticated before making API calls
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated) {
      return;
    }

    // Import auth helper to set up authenticated session
    const { AuthHelper } = await import('./auth');
    const auth = new AuthHelper(this.page);

    try {
      await auth.setupAuthenticatedSession('admin');
      this.isAuthenticated = true;
    } catch (error) {
      throw new Error(`Failed to authenticate for API calls: ${error}`);
    }
  }

  /**
   * Get an existing test client from the real clients API
   */
  async getTestClient(index: number = 0): Promise<ClientData> {
    await this.ensureAuthenticated();

    // Use the real clients API to get existing clients
    const response = await this.page.request.get(`${this.baseUrl}/clients`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok()) {
      throw new Error(`Failed to get clients: ${response.status()}`);
    }

    const result = await response.json();
    const clients = result.data || [];

    if (clients.length === 0) {
      throw new Error('No test clients available. Run database seed first.');
    }

    const client = clients[index] || clients[0]; // Use specified index or first client

    return {
      id: client.id,
      name: client.attributes.name,
      client_type: client.attributes.client_type,
      created_at: client.attributes.created_at,
      updated_at: client.attributes.updated_at,
    };
  }

  /**
   * Create a client via API using the real clients endpoint
   */
  async createClient(data: Partial<ClientData> = {}): Promise<ClientData> {
    await this.ensureAuthenticated();

    const clientData = {
      name: `Test Client ${randomUUID()}`,
      client_type: 'residential' as const,
      ...data,
    };

    const csrfToken = await this.getCsrfToken();
    const response = await this.page.request.post(`${this.baseUrl}/clients`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: { client: clientData },
    });

    if (!response.ok()) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.errors?.[0]?.detail || errorData.message || 'Unknown error';
      throw new Error(`Failed to create client: ${response.status()} - ${errorDetail}`);
    }

    const result = await response.json();
    return {
      id: result.data.id,
      ...result.data.attributes,
    };
  }

  /**
   * Get an existing test user from the database setup
   * Since there's no user creation API, we use the pre-seeded test users
   */
  async getTestUser(
    role: 'owner' | 'admin' | 'technician' | 'technician_lead' = 'technician'
  ): Promise<UserData> {
    await this.ensureAuthenticated();

    // Return user data based on the test environment setup
    const testUsers = {
      owner: {
        id: 'test-owner',
        name: 'Test Owner',
        email: 'owner@bos-test.local',
        role: 'owner' as const,
      },
      admin: {
        id: 'test-admin',
        name: 'Test Admin',
        email: 'admin@bos-test.local',
        role: 'admin' as const,
      },
      technician: {
        id: 'test-tech',
        name: 'Test Tech',
        email: 'tech@bos-test.local',
        role: 'technician' as const,
      },
      technician_lead: {
        id: 'test-tech-lead',
        name: 'Test Tech Lead',
        email: 'techlead@bos-test.local',
        role: 'technician_lead' as const,
      },
    };

    return testUsers[role] || testUsers.technician;
  }

  /**
   * Create a user via API (if API endpoint becomes available)
   * Currently not implemented - use getTestUser() instead
   */
  async createUser(data: Partial<UserData> = {}): Promise<UserData> {
    // For now, return a test user since there's no user creation API
    console.warn('User creation API not available, using test user instead');
    const role = (data.role as keyof typeof this.getTestUser) || 'technician';
    return this.getTestUser(role);
  }

  /**
   * Get a real client ID from the clients API
   */
  private async getTestClientId(index: number = 0): Promise<string> {
    const client = await this.getTestClient(index);
    return client.id!;
  }

  /**
   * Get existing jobs from the seeded database
   */
  async getJobs(limit: number = 10): Promise<JobData[]> {
    await this.ensureAuthenticated();

    const response = await this.page.request.get(`${this.baseUrl}/jobs?limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': await this.getCsrfToken(),
      },
    });

    if (!response.ok()) {
      throw new Error(`Failed to get jobs: ${response.status()} ${response.statusText()}`);
    }

    const result = await response.json();

    // Handle JSON:API format
    if (result.data && Array.isArray(result.data)) {
      return result.data.map((item: { id: string; attributes: unknown }) => ({
        id: item.id,
        ...item.attributes,
      }));
    }

    // Handle direct array format
    return result.jobs || result.data || result;
  }

  /**
   * Get a specific job with its tasks
   */
  async getJobWithTasks(jobId: string): Promise<{ job: JobData; tasks: TaskData[] }> {
    await this.ensureAuthenticated();

    const jobResponse = await this.page.request.get(`${this.baseUrl}/jobs/${jobId}`, {
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': await this.getCsrfToken(),
      },
    });

    if (!jobResponse.ok()) {
      throw new Error(`Failed to get job: ${jobResponse.status()} ${jobResponse.statusText()}`);
    }

    const jobResult = await jobResponse.json();
    let job: JobData;

    // Handle JSON:API format
    if (jobResult.data && jobResult.data.attributes) {
      job = {
        id: jobResult.data.id,
        ...jobResult.data.attributes,
      };
    } else {
      job = jobResult.job || jobResult.data || jobResult;
    }

    // Get tasks for this job
    const tasksResponse = await this.page.request.get(`${this.baseUrl}/jobs/${jobId}/tasks`, {
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': await this.getCsrfToken(),
      },
    });

    let tasks: TaskData[] = [];
    if (tasksResponse.ok()) {
      const tasksResult = await tasksResponse.json();

      // Handle JSON:API format
      if (tasksResult.data && Array.isArray(tasksResult.data)) {
        tasks = tasksResult.data.map((item: { id: string; attributes: unknown }) => ({
          id: item.id,
          ...item.attributes,
        }));
      } else {
        tasks = tasksResult.tasks || tasksResult.data || tasksResult || [];
      }
    }

    return { job, tasks };
  }

  /**
   * Create a job via API using real production endpoint
   */
  async createJob(data: Partial<JobData> = {}): Promise<JobData> {
    await this.ensureAuthenticated();

    // Ensure we have a client ID
    let clientId = data.client_id;
    if (!clientId) {
      clientId = await this.getTestClientId(0);
    }

    const jobData = {
      title: `Test Job ${randomUUID()}`,
      description: 'Test job description',
      status: 'open' as const,
      priority: 'normal' as const,
      client_id: clientId,
      ...data,
    };

    const csrfToken = await this.getCsrfToken();
    const response = await this.page.request.post(`${this.baseUrl}/jobs`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: { job: jobData },
    });

    if (!response.ok()) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.errors?.[0]?.detail || errorData.message || 'Unknown error';
      throw new Error(`Failed to create job: ${response.status()} - ${errorDetail}`);
    }

    const result = await response.json();
    const jobResult = {
      id: result.data.id,
      ...result.data.attributes,
    };
    return jobResult;
  }

  /**
   * Create a task via API
   */
  async createTask(data: Partial<TaskData>): Promise<TaskData> {
    await this.ensureAuthenticated();

    if (!data.job_id) {
      throw new Error('job_id is required to create a task');
    }

    // Remove job_id and description from the data sent to API since they're not permitted
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { job_id: _job_id, description: _description, ...cleanData } = data;

    const taskData = {
      title: `Test Task ${randomUUID()}`,
      status: 'new_task',
      ...cleanData,
    };

    const csrfToken = await this.getCsrfToken();
    const response = await this.page.request.post(`${this.baseUrl}/jobs/${data.job_id}/tasks`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: { task: taskData },
    });

    if (!response.ok()) {
      const errorData = await response.json().catch(() => ({}));
      const errorDetail = errorData.errors?.[0]?.detail || errorData.message || 'Unknown error';
      throw new Error(`Failed to create task: ${response.status()} - ${errorDetail}`);
    }

    const result = await response.json();

    // Handle different possible response structures
    let taskResult;
    if (result.data) {
      // JSON:API format with data wrapper
      taskResult = {
        id: result.data.id,
        ...result.data.attributes,
        job_id: data.job_id, // Add back the job_id for consistency
      };
    } else if (result.task) {
      // Response with task wrapper (current API format)
      taskResult = {
        ...result.task,
        job_id: data.job_id, // Add back the job_id for consistency
      };
    } else {
      // Fallback for simpler response structure
      taskResult = {
        ...result,
        job_id: data.job_id,
      };
    }

    // Validate that the task has a proper ID
    if (!taskResult.id || taskResult.id === 'undefined') {
      throw new Error(
        `Task creation returned invalid ID: ${taskResult.id}. Response: ${JSON.stringify(result)}`
      );
    }

    return taskResult;
  }

  /**
   * Create multiple tasks for a job
   */
  async createTasks(
    jobId: string,
    count: number,
    taskData: Partial<TaskData> = {}
  ): Promise<TaskData[]> {
    const tasks: TaskData[] = [];

    for (let i = 0; i < count; i++) {
      const task = await this.createTask({
        ...taskData,
        job_id: jobId,
        title: taskData.title || `Test Task ${i + 1}`,
        position: (i + 1) * 10,
      });
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Create a hierarchical task structure
   */
  async createTaskHierarchy(jobId: string): Promise<{ parent: TaskData; children: TaskData[] }> {
    // Create parent task
    const parent = await this.createTask({
      job_id: jobId,
      title: 'Parent Task',
      description: 'Main task with subtasks',
    });

    // Create child tasks
    const children: TaskData[] = [];
    for (let i = 0; i < 3; i++) {
      const child = await this.createTask({
        job_id: jobId,
        title: `Subtask ${i + 1}`,
        parent_id: parent.id,
        position: (i + 1) * 10,
      });
      children.push(child);
    }

    return { parent, children };
  }

  /**
   * Create a complete job with tasks
   */
  async createJobWithTasks(
    jobData: Partial<JobData> = {},
    taskCount: number = 5
  ): Promise<{
    job: JobData;
    tasks: TaskData[];
  }> {
    const job = await this.createJob(jobData);
    const tasks = await this.createTasks(job.id!, taskCount);

    return { job, tasks };
  }

  /**
   * Create mixed status tasks for testing
   */
  async createMixedStatusTasks(jobId: string): Promise<TaskData[]> {
    const statuses: TaskData['status'][] = [
      'new_task',
      'in_progress',
      'paused',
      'successfully_completed',
      'failed',
    ];

    const tasks: TaskData[] = [];

    for (const status of statuses) {
      const task = await this.createTask({
        job_id: jobId,
        title: `Task - ${status.replace('_', ' ')}`,
        status: status,
      });
      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Delete test entity by ID using Rails test cleanup endpoint
   */
  async deleteEntity(
    entityType: 'jobs' | 'tasks' | 'clients' | 'users',
    id: string
  ): Promise<void> {
    // Use the database helper for consistent cleanup
    await testDb.cleanupEntity(entityType, id);
  }

  /**
   * Cleanup created test data
   */
  async cleanup(
    entities: Array<{ type: 'jobs' | 'tasks' | 'clients' | 'users'; id: string }>
  ): Promise<void> {
    for (const entity of entities) {
      await this.deleteEntity(entity.type, entity.id);
    }
  }
}

/**
 * Predefined test scenarios
 */
export class TestScenarios {
  private factory: DataFactory;

  constructor(page: Page) {
    this.factory = new DataFactory(page);
  }

  /**
   * Simple job scenario - basic job with a few tasks
   */
  async createSimpleJobScenario(): Promise<{
    job: JobData;
    tasks: TaskData[];
    cleanup: () => Promise<void>;
  }> {
    const { job, tasks } = await this.factory.createJobWithTasks(
      {
        title: 'Simple Installation Job',
        priority: 'normal',
        status: 'open',
      },
      3
    );

    const cleanup = async () => {
      for (const task of tasks) {
        await this.factory.deleteEntity('tasks', task.id!);
      }
      await this.factory.deleteEntity('jobs', job.id!);
    };

    return { job, tasks, cleanup };
  }

  /**
   * Complex job scenario - job with hierarchical tasks and mixed statuses
   */
  async createComplexJobScenario(): Promise<{
    job: JobData;
    tasks: TaskData[];
    hierarchy: { parent: TaskData; children: TaskData[] };
    cleanup: () => Promise<void>;
  }> {
    const job = await this.factory.createJob({
      title: 'Complex Network Installation',
      priority: 'high',
      status: 'in_progress',
    });

    const tasks = await this.factory.createMixedStatusTasks(job.id!);
    const hierarchy = await this.factory.createTaskHierarchy(job.id!);

    const cleanup = async () => {
      // Delete all tasks
      for (const task of [...tasks, hierarchy.parent, ...hierarchy.children]) {
        await this.factory.deleteEntity('tasks', task.id!);
      }
      await this.factory.deleteEntity('jobs', job.id!);
    };

    return { job, tasks, hierarchy, cleanup };
  }

  /**
   * Multi-user scenario - multiple technicians assigned to jobs
   */
  async createMultiUserScenario(): Promise<{
    users: UserData[];
    job: JobData;
    tasks: TaskData[];
    cleanup: () => Promise<void>;
  }> {
    // Create technicians
    const users = await Promise.all([
      this.factory.createUser({ role: 'technician', name: 'Tech User 1' }),
      this.factory.createUser({ role: 'technician', name: 'Tech User 2' }),
      this.factory.createUser({ role: 'technician_lead', name: 'Lead Tech' }),
    ]);

    const { job, tasks } = await this.factory.createJobWithTasks(
      {
        title: 'Multi-Technician Project',
        priority: 'high',
        technician_ids: users.map((u) => u.id!).slice(0, 2), // Assign first 2 techs
      },
      6
    );

    const cleanup = async () => {
      for (const task of tasks) {
        await this.factory.deleteEntity('tasks', task.id!);
      }
      await this.factory.deleteEntity('jobs', job.id!);
      for (const user of users) {
        await this.factory.deleteEntity('users', user.id!);
      }
    };

    return { users, job, tasks, cleanup };
  }

  /**
   * Empty job scenario - job with no tasks for testing task creation
   */
  async createEmptyJobScenario(): Promise<{
    job: JobData;
    cleanup: () => Promise<void>;
  }> {
    const job = await this.factory.createJob({
      title: 'Empty Project Template',
      status: 'open',
    });

    const cleanup = async () => {
      await this.factory.deleteEntity('jobs', job.id!);
    };

    return { job, cleanup };
  }
}

/**
 * Test data utilities for common patterns
 */
export class TestDataUtils {
  /**
   * Wait for entity to exist via API
   */
  static async waitForEntity(
    page: Page,
    entityType: string,
    entityId: string,
    timeoutMs: number = 5000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await page.request.get(`${testDb.getApiUrl()}/${entityType}/${entityId}`, {
          headers: { Accept: 'application/json' },
        });

        if (response.ok()) {
          return true;
        }
      } catch {
        // Continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * Verify entity data via API
   */
  static async verifyEntityData(
    page: Page,
    entityType: string,
    entityId: string,
    expectedData: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await page.request.get(`${testDb.getApiUrl()}/${entityType}/${entityId}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok()) {
        return false;
      }

      const data = await response.json();
      const attributes = data.data?.attributes || {};

      // Check all expected keys exist and match
      for (const [key, expectedValue] of Object.entries(expectedData)) {
        if (attributes[key] !== expectedValue) {
          console.warn(`Mismatch for ${key}: expected ${expectedValue}, got ${attributes[key]}`);
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get entity count via API
   */
  static async getEntityCount(page: Page, entityType: string): Promise<number> {
    try {
      const response = await page.request.get(`${testDb.getApiUrl()}/${entityType}`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok()) {
        return 0;
      }

      const data = await response.json();
      return data.data?.length || 0;
    } catch {
      return 0;
    }
  }
}
