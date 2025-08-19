import type { AxiosResponse } from 'axios';
import { debugAPI } from '$lib/utils/debug';

export interface CsrfTokenManager {
  getToken(): Promise<string | null>;
  setTokenFromResponse(response: AxiosResponse): void;
  forceRefresh(): Promise<string | null>;
  clearToken(): void;
}

class CsrfTokenManagerImpl implements CsrfTokenManager {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string | null> | null = null;
  private readonly cacheMinutes = 4;
  private readonly refreshThresholdMinutes = 2;

  constructor() {
    this.initializeFromMeta();
  }

  private initializeFromMeta(): void {
    if (typeof document !== 'undefined') {
      const metaToken = document.querySelector("meta[name='csrf-token']")?.getAttribute('content');
      if (metaToken) {
        this.token = metaToken;
        this.tokenExpiry = Date.now() + this.cacheMinutes * 60 * 1000;
        debugAPI('CSRF token initialized from meta tag', {
          tokenPrefix: metaToken.substring(0, 10) + '...',
          expiryTime: new Date(this.tokenExpiry).toISOString(),
        });
      }
    }
  }

  async getToken(): Promise<string | null> {
    // Check if we have a valid cached token
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    // Check if we should refresh proactively
    if (this.token && Date.now() > this.tokenExpiry - this.refreshThresholdMinutes * 60 * 1000) {
      debugAPI('Proactive CSRF token refresh triggered');
      return await this.forceRefresh();
    }

    // No token available, try to fetch one
    if (!this.token) {
      debugAPI('No CSRF token available, fetching new one');
      return await this.forceRefresh();
    }

    return this.token;
  }

  setTokenFromResponse(response: AxiosResponse): void {
    const newToken = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'];
    if (newToken && newToken !== this.token) {
      this.token = newToken;
      this.tokenExpiry = Date.now() + this.cacheMinutes * 60 * 1000;
      debugAPI('CSRF token updated from response', {
        tokenPrefix: newToken.substring(0, 10) + '...',
        expiryTime: new Date(this.tokenExpiry).toISOString(),
      });
    }
  }

  async forceRefresh(): Promise<string | null> {
    // If we're already refreshing, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  clearToken(): void {
    this.token = null;
    this.tokenExpiry = 0;
    debugAPI('CSRF token cleared');
  }

  private async performRefresh(): Promise<string | null> {
    try {
      debugAPI('Performing CSRF token refresh');

      // Use the health endpoint which provides CSRF tokens
      const response = await fetch('/api/v1/health', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract CSRF token from response headers
      const csrfToken = response.headers.get('X-CSRF-Token');

      if (csrfToken) {
        this.token = csrfToken;
        this.tokenExpiry = Date.now() + this.cacheMinutes * 60 * 1000;
        debugAPI('CSRF token refreshed successfully from health endpoint', {
          tokenPrefix: csrfToken.substring(0, 10) + '...',
          expiryTime: new Date(this.tokenExpiry).toISOString(),
        });
        return csrfToken;
      } else {
        debugAPI('No CSRF token in health response headers');
        return null;
      }
    } catch (error) {
      debugAPI('CSRF token refresh failed', { error });
      return null;
    }
  }
}

export const csrfTokenManager = new CsrfTokenManagerImpl();
