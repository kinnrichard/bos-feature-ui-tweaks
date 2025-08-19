import { api } from './client';
import type { HealthResponse } from '$lib/types/api';

export class HealthService {
  /**
   * Check API health status
   */
  async checkHealth(): Promise<HealthResponse> {
    return api.get<HealthResponse>('/health', {
      skipAuth: true,
      retryOnUnauthorized: false
    });
  }
}

// Export singleton instance
export const healthService = new HealthService();