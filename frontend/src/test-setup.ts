/**
 * Test setup for Vitest
 * 
 * Note: This file is only used by Vitest tests, not Playwright tests.
 * Playwright tests should import expect from '@playwright/test' directly.
 * 
 * IMPORTANT: This setup does NOT export globals to avoid conflicts
 * with Playwright's expect implementation.
 */

// Vitest-specific setup only
// No global expect imports to prevent Symbol($$jest-matchers-object) conflicts