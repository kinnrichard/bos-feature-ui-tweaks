/**
 * Authentication Test Utilities
 *
 * Provides utilities for testing authentication flows with real Rails API
 */

import type { Page, BrowserContext } from '@playwright/test';
import { testDb } from './database';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'technician' | 'customer_specialist';
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: TestUser;
}

/**
 * Authentication helper for real API testing
 */
export class AuthHelper {
  private page: Page;
  private baseUrl: string;

  constructor(page: Page) {
    this.page = page;
    this.baseUrl = testDb.getRailsUrl();
  }

  /**
   * Login with real API call
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    // First get CSRF token from production health endpoint
    const csrfResponse = await this.page.request.get(`${this.baseUrl}/api/v1/health`, {
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

    // Perform login
    const loginResponse = await this.page.request.post(`${this.baseUrl}/api/v1/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      data: {
        auth: {
          email,
          password,
        },
      },
    });

    if (!loginResponse.ok()) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${error.errors?.[0]?.detail || 'Unknown error'}`);
    }

    const loginData = await loginResponse.json();
    const userData = loginData.included?.find((item: any) => item.type === 'users');

    // IMPORTANT: Copy authentication cookies from request context to browser context
    // This ensures that page.goto() requests will have the same session cookies
    const requestCookies = await this.page.request.storageState();
    if (requestCookies.cookies && requestCookies.cookies.length > 0) {
      // Add cookies to the browser context so page.goto() can use them
      await this.page.context().addCookies(requestCookies.cookies);
    }

    return {
      accessToken: 'cookie-based', // Rails uses cookie-based auth
      refreshToken: 'cookie-based',
      expiresAt: loginData.data.attributes.expires_at,
      user: {
        id: userData.id,
        email: userData.attributes.email,
        name: userData.attributes.name,
        role: userData.attributes.role,
        password: password,
      },
    };
  }

  /**
   * Login as a test user by role
   */
  async loginAsTestUser(role: TestUser['role'] = 'admin'): Promise<AuthTokens> {
    const credentials = this.getTestUserCredentials(role);
    return this.login(credentials.email, credentials.password);
  }

  /**
   * Logout via API
   */
  async logout(): Promise<void> {
    const response = await this.page.request.post(`${this.baseUrl}/api/v1/auth/logout`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok()) {
      console.warn(`Logout failed: ${response.status()}`);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const response = await this.page.request.get(`${this.baseUrl}/api/v1/users/me`, {
        headers: { Accept: 'application/json' },
      });
      return response.ok();
    } catch {
      return false;
    }
  }

  /**
   * Get current user via API
   */
  async getCurrentUser(): Promise<TestUser | null> {
    try {
      const response = await this.page.request.get(`${this.baseUrl}/api/v1/users/me`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok()) {
        return null;
      }

      const data = await response.json();
      return {
        id: data.data.id,
        email: data.data.attributes.email,
        name: data.data.attributes.name,
        role: data.data.attributes.role,
        password: '', // Not available from API
      };
    } catch {
      return null;
    }
  }

  /**
   * Navigate to login page and perform UI login
   */
  async loginViaUI(email: string, password: string): Promise<void> {
    await this.page.goto('/login');

    // Fill login form
    await this.page.fill('input[name="email"], input[type="email"]', email);
    await this.page.fill('input[name="password"], input[type="password"]', password);

    // Submit form
    await this.page.click('button[type="submit"], input[type="submit"]');

    // Wait for navigation away from login page
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10000,
    });
  }

  /**
   * Login as test user via UI
   */
  async loginAsTestUserViaUI(role: TestUser['role'] = 'admin'): Promise<void> {
    const credentials = this.getTestUserCredentials(role);
    await this.loginViaUI(credentials.email, credentials.password);
  }

  /**
   * Clear authentication state
   */
  async clearAuth(): Promise<void> {
    // Clear cookies
    await this.page.context().clearCookies();

    // Clear localStorage/sessionStorage
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Get test user credentials based on role
   */
  private getTestUserCredentials(role: TestUser['role']): { email: string; password: string } {
    const credentials = {
      owner: { email: 'owner@bos-test.local', password: 'password123' },
      admin: { email: 'admin@bos-test.local', password: 'password123' },
      customer_specialist: { email: 'customer@bos-test.local', password: 'password123' },
      technician: { email: 'tech@bos-test.local', password: 'password123' },
    };

    return credentials[role] || credentials.admin;
  }

  /**
   * Set up authenticated session for page
   */
  async setupAuthenticatedSession(role: TestUser['role'] = 'admin'): Promise<TestUser> {
    const tokens = await this.loginAsTestUser(role);
    return tokens.user;
  }
}

/**
 * Browser context authentication utilities
 */
export class ContextAuthHelper {
  private context: BrowserContext;
  private baseUrl: string;

  constructor(context: BrowserContext) {
    this.context = context;
    this.baseUrl = testDb.getRailsUrl();
  }

  /**
   * Setup authenticated context with cookies
   */
  async setupAuthenticatedContext(role: TestUser['role'] = 'admin'): Promise<TestUser> {
    // Create a temporary page for authentication
    const page = await this.context.newPage();
    const authHelper = new AuthHelper(page);

    try {
      const tokens = await authHelper.loginAsTestUser(role);
      await page.close();
      return tokens.user;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Clear authentication from context
   */
  async clearAuth(): Promise<void> {
    await this.context.clearCookies();
  }
}

/**
 * Test data factories for users
 */
export class UserFactory {
  /**
   * Create test user data
   */
  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    const defaults: TestUser = {
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'technician',
      password: 'password123',
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Get predefined test users
   */
  static getTestUsers(): Record<TestUser['role'], TestUser> {
    return {
      owner: {
        id: 'test-owner',
        email: 'owner@bos-test.local',
        name: 'Test Owner',
        role: 'owner',
        password: 'password123',
      },
      admin: {
        id: 'test-admin',
        email: 'admin@bos-test.local',
        name: 'Test Admin',
        role: 'admin',
        password: 'password123',
      },
      customer_specialist: {
        id: 'test-customer-specialist',
        email: 'customer@bos-test.local',
        name: 'Test Customer Specialist',
        role: 'customer_specialist',
        password: 'password123',
      },
      technician: {
        id: 'test-technician',
        email: 'tech@bos-test.local',
        name: 'Test Technician',
        role: 'technician',
        password: 'password123',
      },
    };
  }
}

/**
 * Authentication test utilities for common patterns
 */
export class AuthTestUtils {
  /**
   * Test authentication flow with assertions
   */
  static async testLoginFlow(
    page: Page,
    credentials: { email: string; password: string }
  ): Promise<void> {
    const authHelper = new AuthHelper(page);

    // Verify not authenticated initially
    const initialAuth = await authHelper.isAuthenticated();
    if (initialAuth) {
      await authHelper.logout();
    }

    // Perform login
    await authHelper.loginViaUI(credentials.email, credentials.password);

    // Verify authentication
    const finalAuth = await authHelper.isAuthenticated();
    if (!finalAuth) {
      throw new Error('Authentication failed after login');
    }
  }

  /**
   * Test logout flow with assertions
   */
  static async testLogoutFlow(page: Page): Promise<void> {
    const authHelper = new AuthHelper(page);

    // Verify authenticated initially
    const initialAuth = await authHelper.isAuthenticated();
    if (!initialAuth) {
      throw new Error('User must be authenticated before testing logout');
    }

    // Perform logout
    await authHelper.logout();

    // Verify not authenticated
    const finalAuth = await authHelper.isAuthenticated();
    if (finalAuth) {
      throw new Error('User still authenticated after logout');
    }
  }

  /**
   * Setup page with authenticated user
   */
  static async setupAuthenticatedPage(
    page: Page,
    role: TestUser['role'] = 'admin'
  ): Promise<TestUser> {
    const authHelper = new AuthHelper(page);
    return authHelper.setupAuthenticatedSession(role);
  }
}
