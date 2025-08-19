import { api } from './client';
import type { User } from '$lib/types/job';

export interface UsersApiResponse {
  data: User[];
  meta?: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export class UsersService {
  /**
   * Get all users (for technician selection)
   */
  async getUsers(): Promise<User[]> {
    const response = await api.get<UsersApiResponse>('/users');
    return response.data;
  }

  /**
   * Get users with technician role specifically
   */
  async getTechnicians(): Promise<User[]> {
    const response = await api.get<UsersApiResponse>('/users?role=technician');
    return response.data;
  }

}

// Export singleton instance
export const usersService = new UsersService();