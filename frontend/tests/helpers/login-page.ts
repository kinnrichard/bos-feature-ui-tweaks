/**
 * Login Page Object Model
 *
 * Encapsulates login page interactions and selectors for better test maintainability
 */

import { Page, Locator, expect } from '@playwright/test';
import { assertUserMenuVisible } from './user-menu-verification';

export interface LoginCredentials {
  email: string;
  password: string;
}

export class LoginPage {
  private readonly page: Page;

  // Selectors
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorSelectors = '.alert-error, .error-message, [role="alert"]';

  // Test data constants
  static readonly DEFAULT_CREDENTIALS: LoginCredentials = {
    email: process.env.TEST_USER_EMAIL || 'admin@bos-test.local',
    password: process.env.TEST_USER_PASSWORD || 'password123',
  };

  static readonly INVALID_CREDENTIALS: LoginCredentials = {
    email: 'invalid@example.com',
    password: 'wrongpassword',
  };

  static readonly TEST_CREDENTIALS: LoginCredentials = {
    email: 'test@example.com',
    password: 'testpassword',
  };

  // API endpoints
  static readonly AUTH_API_PATTERN = '**/api/v1/auth/**';

  // Timeouts
  static readonly DEFAULT_TIMEOUT = 5000;
  static readonly NAVIGATION_TIMEOUT = 10000;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.submitButton = page.getByRole('button', { name: /sign in|login/i });
  }

  /**
   * Get the underlying page object for advanced operations
   */
  getPage(): Page {
    return this.page;
  }

  /**
   * Navigate to login page and clear authentication state
   */
  async goto(): Promise<void> {
    // Clear any existing authentication state
    await this.page.context().clearCookies();

    // Navigate to login page
    await this.page.goto('/login');

    // Clear storage after navigation to avoid security errors
    await this.clearStorage();
  }

  /**
   * Fill login form with provided credentials
   */
  async fillCredentials(credentials: LoginCredentials): Promise<void> {
    await this.emailInput.fill(credentials.email);
    await this.passwordInput.fill(credentials.password);
  }

  /**
   * Submit the login form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Submit form and wait for navigation away from login page
   */
  async submitAndWaitForNavigation(): Promise<void> {
    await Promise.all([
      this.page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: LoginPage.NAVIGATION_TIMEOUT,
      }),
      this.submit(),
    ]);
  }

  /**
   * Perform complete login flow with credentials
   */
  async login(credentials: LoginCredentials = LoginPage.DEFAULT_CREDENTIALS): Promise<void> {
    await this.fillCredentials(credentials);
    await this.submitAndWaitForNavigation();
  }

  /**
   * Check if login form elements are visible
   */
  async assertFormElementsVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Check if submit button is enabled
   */
  async assertSubmitButtonEnabled(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
  }

  /**
   * Check if currently on login page
   */
  async assertOnLoginPage(): Promise<void> {
    expect(this.page.url()).toContain('/login');
  }

  /**
   * Check if redirected away from login page
   */
  async assertNotOnLoginPage(): Promise<void> {
    await expect(this.page).not.toHaveURL(/.*\/login.*/);
  }

  /**
   * Check if error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    try {
      return await this.page.locator(this.errorSelectors).isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Assert that either error message is shown or still on login page
   */
  async assertLoginFailure(): Promise<void> {
    const hasError = await this.hasErrorMessage();
    const onLoginPage = this.page.url().includes('/login');

    expect(hasError || onLoginPage).toBe(true);
  }

  /**
   * Assert successful login by checking for user menu
   */
  async assertLoginSuccess(): Promise<void> {
    await this.assertNotOnLoginPage();
    await assertUserMenuVisible(this.page, {
      timeout: LoginPage.DEFAULT_TIMEOUT,
      requireInitials: false,
      verbose: false,
    });
  }

  /**
   * Test keyboard navigation (Tab and Enter)
   */
  async testKeyboardNavigation(): Promise<void> {
    // Fill email and press Tab to move to password
    await this.emailInput.fill(LoginPage.TEST_CREDENTIALS.email);
    await this.emailInput.press('Tab');
    await expect(this.passwordInput).toBeFocused();

    // Fill password and press Enter to submit
    await this.passwordInput.fill(LoginPage.TEST_CREDENTIALS.password);
    await this.passwordInput.press('Enter');
  }

  /**
   * Mock network error for login endpoint
   */
  async mockNetworkError(): Promise<void> {
    await this.page.route(LoginPage.AUTH_API_PATTERN, (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Network error' }),
      });
    });
  }

  /**
   * Clear storage with error handling
   */
  private async clearStorage(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (error) {
      // Ignore localStorage errors on some origins
      console.warn(
        'Could not clear storage:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
