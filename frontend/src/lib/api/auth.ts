import { api } from './client';
import type { AuthResponse, LoginRequest, RefreshTokenRequest } from '$lib/types/api';
import { csrfTokenManager } from './csrf';
import { debugAuth } from '$lib/utils/debug';

export class AuthService {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        auth: credentials
      });
      
      // Login successful, store CSRF token for future requests
      return response;
    } catch (error) {
      debugAuth.error('Login failed', { error, credentials: credentials.email });
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  async refresh(refreshData?: RefreshTokenRequest): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/refresh', refreshData, {
        skipAuth: true,
        retryOnUnauthorized: false
      });
      
      return response;
    } catch (error) {
      debugAuth.error('Token refresh failed', { error, refreshData });
      throw error;
    }
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
      
      // Clear stored tokens
      csrfTokenManager.clearToken();
    } catch (error) {
      debugAuth.error('Logout failed', { error });
      // Still clear tokens even if API call fails
      csrfTokenManager.clearToken();
      throw error;
    }
  }

  /**
   * Check if user is currently authenticated by testing a protected endpoint
   */
  async checkAuth(): Promise<boolean> {
    try {
      // Try to access a protected endpoint to verify authentication
      await api.get('/jobs', { 
        retryOnUnauthorized: false 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current user data
   */
  async getCurrentUser(): Promise<any> {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      debugAuth.error('Failed to fetch current user', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();