/**
 * Simplified Authentication Helper for Modern Playwright Tests
 * 
 * This helper is designed to work with the setup project pattern
 * and focuses on utility functions rather than complex session management.
 */

import type { Page, BrowserContext } from '@playwright/test';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'technician' | 'customer_specialist';
  password: string;
}

/**
 * Simple authentication utilities for tests that don't use storageState
 */
export class AuthHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Perform login via UI - for tests that specifically need to test login flow
   */
  async loginViaUI(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
    
    // Fill login form using proper selectors
    await this.page.getByLabel(/email/i).fill(email);
    await this.page.getByLabel(/password/i).fill(password);
    
    // Submit form and wait for navigation
    await Promise.all([
      this.page.waitForURL(url => !url.pathname.includes('/login')),
      this.page.getByRole('button', { name: /sign in|login/i }).click()
    ]);
  }

  /**
   * Login as test user via UI using environment credentials
   */
  async loginAsTestUser(role: TestUser['role'] = 'admin'): Promise<void> {
    const credentials = this.getTestUserCredentials(role);
    await this.loginViaUI(credentials.email, credentials.password);
  }

  /**
   * Check if user is currently authenticated by looking for UI indicators
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Look for common authentication indicators
      const authIndicators = [
        this.page.getByRole('button', { name: /logout|sign out/i }),
        this.page.getByText(/dashboard|welcome/i),
        this.page.locator('[data-testid="user-menu"]'),
        this.page.locator('.user-avatar')
      ];
      
      for (const indicator of authIndicators) {
        try {
          await indicator.waitFor({ timeout: 1000 });
          return true;
        } catch {
          // Continue checking other indicators
        }
      }
      
      return false;
    } catch {
      return false;
    }
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
      owner: { 
        email: process.env.TEST_OWNER_EMAIL || 'owner@bos-test.local', 
        password: process.env.TEST_OWNER_PASSWORD || 'password123' 
      },
      admin: { 
        email: process.env.TEST_USER_EMAIL || 'admin@bos-test.local', 
        password: process.env.TEST_USER_PASSWORD || 'password123' 
      },
      customer_specialist: { 
        email: process.env.TEST_CUSTOMER_EMAIL || 'customer@bos-test.local', 
        password: process.env.TEST_CUSTOMER_PASSWORD || 'password123' 
      },
      technician: { 
        email: process.env.TEST_TECHNICIAN_EMAIL || 'tech@bos-test.local', 
        password: process.env.TEST_TECHNICIAN_PASSWORD || 'password123' 
      }
    };

    return credentials[role] || credentials.admin;
  }
}

/**
 * Test utilities for common authentication patterns
 */
export class AuthTestUtils {
  /**
   * Test login flow with proper assertions
   */
  static async testLoginFlow(page: Page, credentials: { email: string; password: string }): Promise<void> {
    const authHelper = new AuthHelper(page);
    
    // Clear any existing auth state
    await authHelper.clearAuth();
    
    // Perform login
    await authHelper.loginViaUI(credentials.email, credentials.password);
    
    // Verify authentication succeeded
    const isAuth = await authHelper.isAuthenticated();
    if (!isAuth) {
      throw new Error('Authentication failed after login');
    }
  }

  /**
   * Quick auth check for tests that expect to be authenticated
   */
  static async verifyAuthenticated(page: Page): Promise<void> {
    const authHelper = new AuthHelper(page);
    const isAuth = await authHelper.isAuthenticated();
    
    if (!isAuth) {
      throw new Error('Test expected to be authenticated but no auth indicators found');
    }
  }
}

/**
 * Predefined test users matching the setup project
 */
export const TEST_USERS: Record<TestUser['role'], TestUser> = {
  owner: {
    id: 'test-owner',
    email: process.env.TEST_OWNER_EMAIL || 'owner@bos-test.local',
    name: 'Test Owner',
    role: 'owner',
    password: process.env.TEST_OWNER_PASSWORD || 'password123'
  },
  admin: {
    id: 'test-admin',
    email: process.env.TEST_USER_EMAIL || 'admin@bos-test.local',
    name: 'Test Admin',
    role: 'admin',
    password: process.env.TEST_USER_PASSWORD || 'password123'
  },
  customer_specialist: {
    id: 'test-customer-specialist',
    email: process.env.TEST_CUSTOMER_EMAIL || 'customer@bos-test.local',
    name: 'Test Customer Specialist',
    role: 'customer_specialist',
    password: process.env.TEST_CUSTOMER_PASSWORD || 'password123'
  },
  technician: {
    id: 'test-technician',
    email: process.env.TEST_TECHNICIAN_EMAIL || 'tech@bos-test.local',
    name: 'Test Technician',
    role: 'technician',
    password: process.env.TEST_TECHNICIAN_PASSWORD || 'password123'
  }
};