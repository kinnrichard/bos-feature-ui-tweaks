import { test, expect } from '@playwright/test';

test.describe('Homepage Sidebar Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage
    await page.goto('/');
  });

  test('should display homepage with sidebar', async ({ page }) => {
    // Check that we're on the homepage
    await expect(page).toHaveURL('/');

    // Check that sidebar is visible
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Check for the logo in sidebar
    const logo = sidebar.locator('.logo-link');
    await expect(logo).toBeVisible();

    // Check that search input is centered on the page
    const searchInput = page.locator('input[type="search"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search Clients');
  });

  test('sidebar should show Clients and Jobs on homepage', async ({ page }) => {
    const sidebar = page.locator('.sidebar');

    // Check that "Clients" is shown (not "People")
    await expect(sidebar.locator('a:has-text("Clients")')).toBeVisible();

    // Check that "Jobs" is shown
    await expect(sidebar.locator('a:has-text("Jobs")')).toBeVisible();

    // Check that "Devices" is hidden on homepage
    await expect(sidebar.locator('a:has-text("Devices")')).not.toBeVisible();
  });

  test('clicking Clients in sidebar should navigate correctly', async ({ page }) => {
    const sidebar = page.locator('.sidebar');

    // Click on Clients
    await sidebar.locator('a:has-text("Clients")').click();

    // Should navigate to /clients
    await expect(page).toHaveURL('/clients');
  });

  test('clicking Jobs in sidebar should navigate correctly', async ({ page }) => {
    const sidebar = page.locator('.sidebar');

    // Click on Jobs
    await sidebar.locator('a:has-text("Jobs")').click();

    // Should navigate to /jobs
    await expect(page).toHaveURL('/jobs');
  });

  test('logo in sidebar should navigate to homepage', async ({ page }) => {
    // Start on a different page
    await page.goto('/jobs');

    // Click the logo
    const logo = page.locator('.logo-link');
    await logo.click();

    // Should be back on homepage
    await expect(page).toHaveURL('/');

    // Search input should be visible
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test('clients page with search should have sidebar and toolbar search', async ({ page }) => {
    // Navigate to clients with search query
    await page.goto('/clients?q=test');

    // Check that sidebar is visible
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Toolbar search should be populated
    const toolbarSearch = page.locator('.toolbar .search-input');
    await expect(toolbarSearch).toBeVisible();
    await expect(toolbarSearch).toHaveValue('test');
  });
});
