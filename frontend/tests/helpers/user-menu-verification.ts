/**
 * User Menu Verification Helper
 *
 * Provides reusable functions for verifying user menu presence and authentication state
 * in Playwright tests. Uses multiple selector strategies for robustness.
 */

import { Page, expect } from '@playwright/test';

export interface UserMenuVerificationResult {
  userMenuFound: boolean;
  userInitialsFound: boolean;
  initialsText?: string;
  authVerified: boolean;
}

/**
 * Verifies that the user menu is visible, indicating successful authentication
 *
 * @param page - Playwright page object
 * @param options - Configuration options for verification
 * @returns Promise<UserMenuVerificationResult>
 */
export async function verifyUserMenu(
  page: Page,
  options: {
    timeout?: number;
    requireInitials?: boolean;
    verbose?: boolean;
  } = {}
): Promise<UserMenuVerificationResult> {
  const { timeout = 5000, requireInitials = false, verbose = false } = options;

  if (verbose) {
    console.log('[USER MENU] Starting user menu verification...');
  }

  // Primary verification: look for user menu button with multiple selector strategies
  const userMenuSelectors = [
    page.getByRole('button', { name: 'User menu' }),
    page.locator('[aria-label="User menu"]'),
    page.locator('[title="User menu"]'),
  ];

  let userMenuFound = false;
  for (const selector of userMenuSelectors) {
    try {
      await expect(selector).toBeVisible({ timeout: timeout / userMenuSelectors.length });
      if (verbose) {
        console.log('[USER MENU] User menu button found and visible');
      }
      userMenuFound = true;
      break;
    } catch {
      // Continue to next selector
    }
  }

  // Additional verification: check for user initials in the menu button
  let userInitialsFound = false;
  let initialsText: string | undefined;

  const userInitials = page.locator('.user-initials');
  try {
    if (await userInitials.isVisible({ timeout: 1000 })) {
      initialsText = (await userInitials.textContent()) || undefined;
      if (initialsText?.trim().length > 0) {
        if (verbose) {
          console.log(`[USER MENU] User initials found: ${initialsText.trim()}`);
        }
        userInitialsFound = true;
      }
    }
  } catch {
    // User initials not found, but not critical unless required
  }

  // Determine overall authentication verification
  const authVerified = userMenuFound && (!requireInitials || userInitialsFound);

  if (verbose) {
    console.log(
      `[USER MENU] Verification result: menu=${userMenuFound}, initials=${userInitialsFound}, verified=${authVerified}`
    );
  }

  return {
    userMenuFound,
    userInitialsFound,
    initialsText,
    authVerified,
  };
}

/**
 * Assert that user menu is visible (throws if not found)
 *
 * @param page - Playwright page object
 * @param options - Configuration options for verification
 */
export async function assertUserMenuVisible(
  page: Page,
  options: {
    timeout?: number;
    requireInitials?: boolean;
    verbose?: boolean;
  } = {}
): Promise<void> {
  const result = await verifyUserMenu(page, options);

  if (!result.authVerified) {
    const details = [
      `User menu found: ${result.userMenuFound}`,
      `User initials found: ${result.userInitialsFound}`,
      result.initialsText ? `Initials text: "${result.initialsText}"` : 'No initials text',
    ].join(', ');

    throw new Error(`User menu verification failed. ${details}`);
  }
}

/**
 * Fallback authentication verification using alternative indicators
 *
 * @param page - Playwright page object
 * @param timeout - Maximum time to wait for indicators
 * @returns Promise<boolean>
 */
export async function verifyAuthenticationFallback(
  page: Page,
  timeout: number = 3000
): Promise<boolean> {
  const fallbackIndicators = [
    page.getByRole('button', { name: /logout|sign out/i }),
    page.getByText(/dashboard|welcome/i),
    page.locator('.user-avatar'),
    page.locator('[data-testid="user-menu"]'),
  ];

  for (const indicator of fallbackIndicators) {
    try {
      await expect(indicator).toBeVisible({ timeout: timeout / fallbackIndicators.length });
      return true;
    } catch {
      // Continue checking other indicators
    }
  }

  return false;
}

/**
 * Comprehensive authentication verification combining primary and fallback methods
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 * @returns Promise<UserMenuVerificationResult & { fallbackVerified: boolean }>
 */
export async function verifyAuthentication(
  page: Page,
  options: {
    timeout?: number;
    requireInitials?: boolean;
    verbose?: boolean;
    useFallback?: boolean;
  } = {}
): Promise<UserMenuVerificationResult & { fallbackVerified: boolean }> {
  const { useFallback = true, ...verifyOptions } = options;

  const primaryResult = await verifyUserMenu(page, verifyOptions);

  let fallbackVerified = false;
  if (!primaryResult.authVerified && useFallback) {
    fallbackVerified = await verifyAuthenticationFallback(page, verifyOptions.timeout);
  }

  return {
    ...primaryResult,
    fallbackVerified,
    authVerified: primaryResult.authVerified || fallbackVerified,
  };
}
