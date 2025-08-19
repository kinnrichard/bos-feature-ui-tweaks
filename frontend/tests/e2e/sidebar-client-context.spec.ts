import { test, expect } from '@playwright/test';
import { DataFactory } from '../helpers/data-factories';
import { AuthHelper } from '../helpers/auth';

test.describe('Sidebar Client Context', () => {
  let dataFactory: DataFactory;
  let auth: AuthHelper;

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);
    await auth.setupAuthenticatedSession('admin');
  });
  test('should not show client section on homepage', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    const sidebar = page.locator('.sidebar');

    // Check that no client section is visible
    const clientSection = sidebar.locator('.nav-item:has(.nav-link[href*="/clients/"])');
    await expect(clientSection).not.toBeVisible();

    // Check that footer logs section is not visible
    const footerNav = sidebar.locator('.footer-nav');
    await expect(footerNav).not.toBeVisible();
  });

  test('should show client section on job detail page', async ({ page }) => {
    // Create test data with known values
    const timestamp = Date.now();
    const clientName = `Test Client ${timestamp}`;
    const jobTitle = `Test Job ${timestamp}`;

    const client = await dataFactory.createClient({
      name: clientName,
      client_type: 'business',
    });

    const job = await dataFactory.createJob({
      title: jobTitle,
      client_id: client.id,
      status: 'in_progress',
    });

    // Navigate to the created job
    await page.goto(`/jobs/${job.id}`);

    // Wait for the page to load completely and job data to be fetched
    await page.waitForTimeout(3000);

    const sidebar = page.locator('.sidebar');

    // Wait for the client section to appear (it loads after job data is fetched)
    const clientSection = sidebar.locator('.nav-item').filter({ hasText: clientName });
    await expect(clientSection).toBeVisible({ timeout: 10000 });

    // Check that client name is displayed
    await expect(clientSection).toContainText(clientName);

    // Check that footer shows client's logs
    const footerNav = sidebar.locator('.footer-nav');
    await expect(footerNav).toBeVisible();
    await expect(footerNav).toContainText('Logs'); // Footer just shows "Logs" when client is selected

    // Cleanup
    await dataFactory.deleteEntity('jobs', job.id!);
    await dataFactory.deleteEntity('clients', client.id!);
  });

  test('should show client section on client detail page', async ({ page }) => {
    // Create test data with known values
    const timestamp = Date.now();
    const clientName = `Test Client ${timestamp}`;

    const client = await dataFactory.createClient({
      name: clientName,
      client_type: 'residential',
    });

    // Navigate to the created client
    await page.goto(`/clients/${client.id}`);

    // Wait for the page to load completely
    await page.waitForTimeout(2000);

    const sidebar = page.locator('.sidebar');

    // Check that client section is visible - target the client link
    const clientSection = sidebar.locator('.nav-item').filter({ hasText: clientName });
    await expect(clientSection).toBeVisible();

    // Check that client name is displayed
    await expect(clientSection).toContainText(clientName);

    // Check that footer shows client's logs
    const footerNav = sidebar.locator('.footer-nav');
    await expect(footerNav).toBeVisible();
    await expect(footerNav).toContainText('Logs'); // Footer just shows "Logs" when client is selected

    // Cleanup
    await dataFactory.deleteEntity('clients', client.id!);
  });

  test('should not show client section on jobs listing page', async ({ page }) => {
    // Navigate to jobs listing
    await page.goto('/jobs');

    const sidebar = page.locator('.sidebar');

    // Check that no client section is visible
    const clientSection = sidebar.locator('.nav-item:has(.nav-link[href*="/clients/"])');
    await expect(clientSection).not.toBeVisible();

    // Check that footer logs section is not visible
    const footerNav = sidebar.locator('.footer-nav');
    await expect(footerNav).not.toBeVisible();
  });

  test('sidebar navigation should work correctly', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    const sidebar = page.locator('.sidebar');

    // Click on "Clients" (which links to /clients)
    await sidebar.locator('a:has-text("Clients")').click();
    await expect(page).toHaveURL('/clients');

    // Navigate back to homepage
    await sidebar.locator('.logo-link').click();
    await expect(page).toHaveURL('/');

    // Click on "Jobs"
    await sidebar.locator('a:has-text("Jobs")').click();
    await expect(page).toHaveURL('/jobs');
  });
});
