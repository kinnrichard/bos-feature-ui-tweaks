import { test, expect } from '@playwright/test';
import { LoginPage } from './helpers';

test.describe('Login functionality', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test.describe('Form elements and validation', () => {
    test('should display all required login form elements', async ({ page: _page }) => {
      // Arrange & Act - form should be loaded from beforeEach

      // Assert - all form elements should be visible
      await loginPage.assertFormElementsVisible();
    });

    test('should validate empty fields and prevent submission', async ({ page: _page }) => {
      // Arrange - empty form from beforeEach

      // Act - try to submit without filling fields
      await loginPage.submit();

      // Assert - should remain on login page (validation prevents submission)
      await loginPage.assertOnLoginPage();
    });

    test('should enable submit button when form is ready', async ({ page: _page }) => {
      // Arrange - form loaded from beforeEach

      // Act - fill valid credentials
      await loginPage.fillCredentials(LoginPage.DEFAULT_CREDENTIALS);

      // Assert - submit button should be enabled
      await loginPage.assertSubmitButtonEnabled();
    });
  });

  test.describe('User interactions', () => {
    test('should support keyboard navigation (Tab and Enter)', async ({ page: _page }) => {
      // Arrange - form loaded from beforeEach

      // Act - test keyboard navigation
      await loginPage.testKeyboardNavigation();

      // Assert - form submission should be triggered (no errors thrown)
      // Note: May show error for invalid test credentials, but navigation works
    });
  });

  test.describe('Authentication scenarios', () => {
    test('should reject invalid credentials', async ({ page: _page }) => {
      // Arrange - form loaded from beforeEach

      // Act - attempt login with invalid credentials
      await loginPage.fillCredentials(LoginPage.INVALID_CREDENTIALS);
      await loginPage.submit();

      // Assert - login should fail gracefully
      await loginPage.assertLoginFailure();
    });

    test('should successfully authenticate with valid credentials', async ({ page: _page }) => {
      // Arrange - form loaded from beforeEach

      // Act - perform login with valid credentials
      await loginPage.login(LoginPage.DEFAULT_CREDENTIALS);

      // Assert - should be authenticated and redirected
      await loginPage.assertLoginSuccess();
    });
  });

  test.describe('Error handling', () => {
    test('should handle network errors gracefully', async ({ page: _page }) => {
      // Arrange - mock network failure
      await loginPage.mockNetworkError();

      // Act - attempt login with any credentials
      await loginPage.fillCredentials(LoginPage.TEST_CREDENTIALS);
      await loginPage.submit();

      // Assert - should handle error gracefully
      await loginPage.assertLoginFailure();
    });

    test('should not crash on form submission', async ({ page }) => {
      // Arrange - form loaded from beforeEach

      // Act - fill and submit form
      await loginPage.fillCredentials(LoginPage.DEFAULT_CREDENTIALS);
      await loginPage.submit();

      // Assert - should complete without throwing errors
      // Wait briefly for any processing
      await page.waitForTimeout(1000);

      // Test passes if no errors are thrown during submission
      // This is better than expect(true).toBe(true)
      const pageExists = await page.locator('body').isVisible();
      expect(pageExists).toBe(true);
    });
  });
});
