/**
 * Legacy Authentication Setup for Playwright Tests
 *
 * ⚠️ DEPRECATED: This file is being phased out in favor of global.setup.ts
 * which handles both database seeding and authentication in proper order.
 *
 * This setup is kept temporarily for compatibility during the transition.
 * Database seeding is now handled in global.setup.ts before this runs.
 */

import { test as setup } from '@playwright/test';
import { LoginPage, verifyAuthentication } from './helpers';
import { debugAuth, debugError } from '$lib/utils/debug';

// Constants
const DEBUG_MODE = process.env.DEBUG_AUTH_SETUP === 'true';

/**
 * Legacy authentication setup - simplified since DB seeding is handled globally
 */
setup('authenticate legacy', async ({ page }) => {
  if (DEBUG_MODE) {
    debugAuth('🔐 Running legacy auth setup (database should already be seeded)');
  }

  try {
    // Initialize login page
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');

    // Perform authentication - database should already be seeded by global setup
    await loginPage.login(LoginPage.DEFAULT_CREDENTIALS);

    // Verify authentication
    const authResult = await verifyAuthentication(page, {
      timeout: 10000,
      requireInitials: false,
      verbose: DEBUG_MODE,
      useFallback: true,
    });

    if (!authResult.authVerified) {
      console.warn('⚠️ Legacy auth verification had issues but proceeding');
    }

    // Save authentication state for legacy tests that might still depend on this
    await page.context().storageState({ path: 'playwright/.auth/user-legacy.json' });

    if (DEBUG_MODE) {
      debugAuth('✅ Legacy authentication setup complete');
    }
  } catch (error) {
    debugError('❌ Legacy authentication failed:', error);
    console.warn('⚠️ Legacy auth failed - tests should use global.setup.ts auth instead');
    // Don't throw - let tests that depend on global setup continue
  }
});
