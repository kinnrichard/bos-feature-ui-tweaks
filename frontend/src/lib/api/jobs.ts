import { api } from './client';
import qs from 'qs';
import type {
  JobResource,
  JobCreateRequest,
  JobUpdateRequest,
  PaginatedResponse,
  JsonApiResponse
} from '$lib/types/api';
import type {
  JobsApiResponse,
  JobApiResponse,
  JobsRequestParams,
  PopulatedJob
} from '$lib/types/job';

export class JobsService {
  /**
   * Get paginated list of jobs with new scope parameter support
   */
  async getJobsWithScope(params: JobsRequestParams = {}): Promise<JobsApiResponse> {
    const queryString = qs.stringify(params, {
      skipNulls: true,        // Skip null and undefined values
      strictNullHandling: true, // Don't serialize null as empty string
      arrayFormat: 'comma'    // For array parameters like include
    });

    const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;
    
    return api.get<JobsApiResponse>(endpoint);
  }

  /**
   * Helper method to populate jobs with included relationship data
   */
  populateJobs(response: JobsApiResponse): PopulatedJob[] {
    const includedMap = new Map();
    
    // Build lookup map for included resources
    response.included?.forEach(resource => {
      const key = `${resource.type}:${resource.id}`;
      includedMap.set(key, resource);
    });

    return response.data.map(job => {
      // Find related resources
      const client = includedMap.get(`clients:${job.relationships.client.data.id}`);
      const technicians = job.relationships.technicians.data.map(tech => 
        includedMap.get(`users:${tech.id}`)
      ).filter(Boolean);
      const tasks = job.relationships.tasks.data.map(task => 
        includedMap.get(`tasks:${task.id}`)
      ).filter(Boolean);

      return {
        ...job,
        client: { ...client?.attributes, id: client?.id },
        technicians: technicians.map(tech => ({ ...tech?.attributes, id: tech?.id })),
        tasks: tasks.map(task => ({ ...task?.attributes, id: task?.id }))
      } as PopulatedJob;
    });
  }

  /**
   * Get paginated list of jobs (legacy method for backward compatibility)
   */
  async getJobs(params: {
    page?: number;
    per_page?: number;
    status?: string;
    client_id?: string;
    technician_id?: string;
  } = {}): Promise<PaginatedResponse<JobResource>> {
    const queryString = qs.stringify(params, {
      skipNulls: true,
      strictNullHandling: true
    });

    const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;
    
    return api.get<PaginatedResponse<JobResource>>(endpoint);
  }

  /**
   * Get single job by ID with included relationships
   */
  async getJobWithDetails(id: string): Promise<PopulatedJob> {
    const include = 'client,technicians,tasks,tasks.subtasks';
    const endpoint = `/jobs/${id}?include=${include}`;
    
    const response = await api.get<JobApiResponse>(endpoint);
    
    // Use the existing populate logic for consistency
    const populated = this.populateJobs({
      data: [response.data],
      included: response.included || [],
      meta: { total: 1, page: 1, per_page: 1, total_pages: 1 },
      links: {}
    });
    
    return populated[0];
  }

  /**
   * Get single job by ID (legacy method)
   */
  async getJob(id: string): Promise<JsonApiResponse<JobResource>> {
    return api.get<JsonApiResponse<JobResource>>(`/jobs/${id}`);
  }

  /**
   * Create new job
   */
  async createJob(jobData: JobCreateRequest): Promise<JsonApiResponse<JobResource>> {
    return api.post<JsonApiResponse<JobResource>>('/jobs', {
      data: {
        type: 'jobs',
        attributes: jobData
      }
    });
  }

  /**
   * Update existing job
   */
  async updateJob(id: string, jobData: JobUpdateRequest): Promise<JsonApiResponse<JobResource>> {
    return api.patch<JsonApiResponse<JobResource>>(`/jobs/${id}`, {
      job: jobData
    });
  }

  /**
   * Delete job
   */
  async deleteJob(id: string): Promise<void> {
    await api.delete(`/jobs/${id}`);
  }

  /**
   * Bulk update job statuses
   */
  async bulkUpdateJobStatus(
    jobIds: string[], 
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<JsonApiResponse<JobResource[]>> {
    return api.patch<JsonApiResponse<JobResource[]>>('/jobs/bulk_update', {
      data: {
        type: 'bulk_job_update',
        attributes: {
          job_ids: jobIds,
          status
        }
      }
    });
  }

  /**
   * Update job technician assignments
   */
  async updateJobTechnicians(jobId: string, technicianIds: string[]): Promise<{
    status: string;
    technicians: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      initials: string;
      avatar_style: string;
    }>;
  }> {
    return api.patch<{
      status: string;
      technicians: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        initials: string;
        avatar_style: string;
      }>;
    }>(`/jobs/${jobId}/technicians`, {
      technician_ids: technicianIds
    });
  }

  /**
   * Update job status
   */
  async updateJobStatus(jobId: string, status: string): Promise<JsonApiResponse<JobResource>> {
    return api.patch<JsonApiResponse<JobResource>>(`/jobs/${jobId}`, {
      job: {
        status
      }
    });
  }
}

// Export singleton instance
export const jobsService = new JobsService();