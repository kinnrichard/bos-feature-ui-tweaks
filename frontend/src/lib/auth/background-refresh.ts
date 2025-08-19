import { csrfTokenManager } from '$lib/api/csrf';
import { AUTH_CONFIG } from './config';

class BackgroundRefreshService {
  private refreshTimer: number | null = null;
  private sessionStartTime: number;

  // Configurable timeouts from environment or defaults
  private readonly REFRESH_INTERVAL_MINUTES = AUTH_CONFIG.REFRESH_INTERVAL_MINUTES;
  private readonly MAX_IDLE_HOURS = AUTH_CONFIG.MAX_IDLE_HOURS;
  private readonly MAX_SESSION_HOURS = AUTH_CONFIG.MAX_SESSION_HOURS;

  constructor() {
    this.sessionStartTime = Date.now();
  }

  async start(): Promise<void> {
    // Initialize session start time from storage or current time
    const storedSessionStart = localStorage.getItem('sessionStartTime');
    if (storedSessionStart) {
      this.sessionStartTime = parseInt(storedSessionStart);
    } else {
      this.sessionStartTime = Date.now();
      localStorage.setItem('sessionStartTime', this.sessionStartTime.toString());
    }

    this.startRefreshTimer();

    // Don't perform initial refresh - let the timer handle it
    // The user just logged in, so tokens are fresh
  }

  private startRefreshTimer(): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Set up interval to refresh every X minutes
    this.refreshTimer = window.setInterval(
      () => this.performBackgroundRefresh(),
      this.REFRESH_INTERVAL_MINUTES * 60 * 1000
    );
  }

  private async performBackgroundRefresh(): Promise<void> {
    try {
      // Check session age limits before refreshing
      if (!this.isSessionValid()) {
        this.forceLogout('Session expired');
        return;
      }

      // Get CSRF token
      const csrfToken = await csrfTokenManager.getToken();

      // Call refresh endpoint
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });

      if (!response.ok) {
        // Don't log as error if it's a missing token (first login)
        if (response.status === 400) {
          const data = await response.json();
          if (data.errors?.[0]?.code === 'MISSING_TOKEN') {
            console.debug('No refresh token available yet - likely first login');
            return;
          }
        }
        // If refresh fails, let the existing 401 retry logic handle it
        const errorText = await response.text();
        console.debug(`Background refresh failed: ${response.status} - ${errorText}`);
        throw new Error(`Refresh failed with status: ${response.status}`);
      }

      // Update last refresh time
      localStorage.setItem('lastRefreshTime', Date.now().toString());

      // Parse response to potentially update session metadata
      const data = await response.json();
      if (data.auth?.session_created_at) {
        const sessionCreatedAt = new Date(data.auth.session_created_at).getTime();
        this.sessionStartTime = sessionCreatedAt;
        localStorage.setItem('sessionStartTime', sessionCreatedAt.toString());
      }

      console.debug('Background token refresh successful');
    } catch (error) {
      console.error('Background refresh failed:', error);
    }
  }

  private isSessionValid(): boolean {
    const now = Date.now();

    // Check absolute session timeout (31 days)
    const sessionAgeHours = (now - this.sessionStartTime) / (1000 * 60 * 60);
    if (sessionAgeHours > this.MAX_SESSION_HOURS) {
      console.warn(
        `Session age (${sessionAgeHours.toFixed(1)} hours) exceeds maximum (${this.MAX_SESSION_HOURS} hours)`
      );
      return false;
    }

    // Check idle timeout (24 hours since last refresh)
    const lastRefreshStr = localStorage.getItem('lastRefreshTime');
    if (lastRefreshStr) {
      const lastRefresh = parseInt(lastRefreshStr);
      const idleHours = (now - lastRefresh) / (1000 * 60 * 60);

      if (idleHours > this.MAX_IDLE_HOURS) {
        console.warn(
          `Idle time (${idleHours.toFixed(1)} hours) exceeds maximum (${this.MAX_IDLE_HOURS} hours)`
        );
        return false;
      }
    }

    return true;
  }

  private forceLogout(reason: string): void {
    console.info(`Forcing logout: ${reason}`);

    // Stop the refresh timer
    this.stop();

    // Clear auth-related storage
    localStorage.removeItem('sessionStartTime');
    localStorage.removeItem('lastRefreshTime');

    // Redirect to login with reason
    window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Utility method to check if refresh is active
  isActive(): boolean {
    return this.refreshTimer !== null;
  }

  // Get session info for debugging
  getSessionInfo(): {
    sessionAgeHours: number;
    idleHours: number;
    isValid: boolean;
  } {
    const now = Date.now();
    const sessionAgeHours = (now - this.sessionStartTime) / (1000 * 60 * 60);

    let idleHours = 0;
    const lastRefreshStr = localStorage.getItem('lastRefreshTime');
    if (lastRefreshStr) {
      const lastRefresh = parseInt(lastRefreshStr);
      idleHours = (now - lastRefresh) / (1000 * 60 * 60);
    }

    return {
      sessionAgeHours,
      idleHours,
      isValid: this.isSessionValid(),
    };
  }
}

// Export singleton instance
export const backgroundRefresh = new BackgroundRefreshService();
