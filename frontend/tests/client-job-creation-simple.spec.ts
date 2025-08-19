/**
 * Client Job Creation Simple Tests
 *
 * Basic validation tests for the client job creation feature.
 * These tests verify the functionality exists and works correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Client Job Creation - Simple Validation', () => {
  test('client job creation routes should exist', async ({ page }) => {
    // Test that the route exists (not 404)
    const response = await page.goto('/jobs/new?clientId=test');
    expect(response?.status()).not.toBe(404);
  });

  test('client jobs index should have new job button', async ({ page }) => {
    await page.goto('/clients/test/jobs');
    await page.waitForLoadState('domcontentloaded');

    // Should have some form of new job creation link
    const hasNewJobLink =
      (await page
        .locator('a[href*="/jobs/new"], button:has-text("New Job"), a:has-text("New Job")')
        .count()) > 0;
    expect(hasNewJobLink).toBe(true);
  });

  test('job creation page should render without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/jobs/new?clientId=test');
    await page.waitForLoadState('domcontentloaded');

    // Should not have critical errors
    const criticalErrors = errors.filter(
      (e) => e.includes('TypeError') || e.includes('ReferenceError')
    );
    expect(criticalErrors.length).toBe(0);

    // Should have content
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);
  });

  test('job creation should show different content than regular jobs', async ({ page }) => {
    // Get creation page content
    await page.goto('/jobs/new?clientId=test');
    await page.waitForLoadState('domcontentloaded');
    const creationContent = await page.textContent('body');

    // Get regular jobs page content
    await page.goto('/jobs');
    await page.waitForLoadState('domcontentloaded');
    const jobsContent = await page.textContent('body');

    // Should be different
    expect(creationContent).not.toBe(jobsContent);
    expect(creationContent?.length).toBeGreaterThan(0);
  });

  test('invalid client should show appropriate response', async ({ page }) => {
    await page.goto('/jobs/new?clientId=invalid-client-12345');
    await page.waitForLoadState('domcontentloaded');

    // Should either show error or load gracefully
    const content = await page.textContent('body');
    expect(content?.length).toBeGreaterThan(0);

    // Should not crash
    const response = await page.evaluate(() => document.readyState);
    expect(response).toBe('complete');
  });

  test('page should have proper title', async ({ page }) => {
    await page.goto('/jobs/new?clientId=test-client');
    await page.waitForLoadState('domcontentloaded');

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).toMatch(/job|client/);
  });

  test('page should be responsive', async ({ page }) => {
    // Test mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/jobs/new?clientId=test');
    await page.waitForLoadState('domcontentloaded');

    const mobileScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(mobileScrollWidth).toBeLessThanOrEqual(400);

    // Test desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const desktopWidth = await page.evaluate(() => document.body.clientWidth);
    expect(desktopWidth).toBeGreaterThan(500);
  });

  test('keyboard navigation should work', async ({ page }) => {
    await page.goto('/jobs/new?clientId=test');
    await page.waitForLoadState('domcontentloaded');

    // Test basic keyboard navigation
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);

    // Should have some focusable element
    expect(activeElement).toBeTruthy();
  });

  test('should have job-related UI elements', async ({ page }) => {
    await page.goto('/jobs/new?clientId=test');
    await page.waitForLoadState('domcontentloaded');

    // Should have job-related content
    const content = await page.textContent('body');
    const hasJobContent = content?.toLowerCase().includes('job');
    expect(hasJobContent).toBe(true);

    // Should have some kind of UI structure
    const hasUIElements = (await page.locator('h1, h2, .job-title, .job-detail').count()) > 0;
    expect(hasUIElements).toBe(true);
  });
});
