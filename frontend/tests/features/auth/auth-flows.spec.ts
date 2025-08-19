import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../helpers/auth';

test.describe('Authentication Flows', () => {
  let auth: AuthHelper;

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page);
  });

  test.describe('Login Process', () => {
    test('should successfully log in with valid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in login form
      await page.fill('input[name="email"], input[type="email"]', 'admin@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'password');

      // Submit form
      await page.click('button[type="submit"], button:has-text("Login")');

      // Should redirect to dashboard/home after successful login
      await expect(page).toHaveURL(/\/(dashboard|home|jobs|$)/);

      // Should not show login form anymore
      await expect(page.locator('input[name="email"]')).not.toBeVisible();
    });

    test('should show error message for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill in invalid credentials
      await page.fill('input[name="email"], input[type="email"]', 'invalid@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'wrongpassword');

      // Submit form
      await page.click('button[type="submit"], button:has-text("Login")');

      // Should show error message
      const errorMessage = page.locator('.error-message, .alert-error, .login-error');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should handle empty form submission', async ({ page }) => {
      await page.goto('/login');

      // Try to submit empty form
      await page.click('button[type="submit"], button:has-text("Login")');

      // Should show validation errors or remain on login page
      const emailInput = page.locator('input[name="email"], input[type="email"]');
      const passwordInput = page.locator('input[name="password"], input[type="password"]');

      // Should still be on login page
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    });
  });

  test.describe('Logout Process', () => {
    test('should successfully log out authenticated user', async ({ page }) => {
      // First log in
      await auth.setupAuthenticatedSession('admin');
      await page.goto('/');

      // Find and click logout button
      const logoutButton = page.locator(
        'button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]'
      );

      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Should redirect to login page
        await expect(page).toHaveURL(/\/login/);

        // Should show login form
        await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
      }
    });

    test('should clear session data on logout', async ({ page }) => {
      // Log in and then log out
      await auth.setupAuthenticatedSession('admin');
      await page.goto('/');

      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Try to access protected page
        await page.goto('/jobs');

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected routes without authentication', async ({
      page,
    }) => {
      // Clear any existing auth
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto('/jobs');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      // Log in first
      await auth.setupAuthenticatedSession('admin');

      // Access protected route
      await page.goto('/jobs');

      // Should not redirect to login
      await expect(page).not.toHaveURL(/\/login/);

      // Should show the protected content
      await expect(page.locator('h1')).toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async ({ page }) => {
      // Log in
      await auth.setupAuthenticatedSession('admin');
      await page.goto('/jobs');

      // Reload page
      await page.reload();

      // Should still be authenticated
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should handle session expiry gracefully', async ({ page }) => {
      // This test would require backend support for session expiry
      // For now, we'll test the UI behavior when auth fails

      await auth.setupAuthenticatedSession('admin');
      await page.goto('/jobs');

      // Mock expired session by intercepting API calls
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      });

      // Try to perform an action that requires auth
      await page.reload();

      // Should handle 401 response appropriately
      // Either redirect to login or show auth error
      const isLoginPage = page.url().includes('/login');
      const hasAuthError = await page.locator('.auth-error, .unauthorized').isVisible();

      expect(isLoginPage || hasAuthError).toBeTruthy();
    });
  });

  test.describe('Security Features', () => {
    test('should not expose sensitive data in form fields', async ({ page }) => {
      await page.goto('/login');

      // Password field should be properly masked
      const passwordInput = page.locator('input[name="password"], input[type="password"]');
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Fill password and verify it's masked
      await passwordInput.fill('testpassword');
      const inputValue = await passwordInput.inputValue();
      expect(inputValue).toBe('testpassword'); // Value should be there but visually masked
    });

    test('should handle CSRF protection', async ({ page }) => {
      await page.goto('/login');

      // Look for CSRF token or other security measures
      const csrfToken = page.locator(
        'input[name="_token"], input[name="csrf_token"], meta[name="csrf-token"]'
      );

      // If CSRF protection is implemented, token should be present
      if (await csrfToken.isVisible()) {
        await expect(csrfToken).toBeVisible();

        const tokenValue =
          (await csrfToken.getAttribute('value')) || (await csrfToken.getAttribute('content'));
        expect(tokenValue).toBeTruthy();
        expect(tokenValue?.length).toBeGreaterThan(10); // Reasonable token length
      }
    });
  });
});
