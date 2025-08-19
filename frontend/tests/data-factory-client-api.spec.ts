import { test, expect } from '@playwright/test';
import { DataFactory } from './helpers/data-factories';
import { AuthHelper } from './helpers/auth';

test.describe('DataFactory Client API Integration', () => {
  let dataFactory: DataFactory;
  let auth: AuthHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize helpers
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);

    // Setup authentication for API calls
    await auth.setupAuthenticatedSession('admin');
  });

  test('should create client via real API endpoint', async ({ page }) => {
    // Create a client using DataFactory
    const clientData = {
      name: `Test Client ${Date.now()}`,
      client_type: 'residential' as const,
    };

    const createdClient = await dataFactory.createClient(clientData);

    // Verify the client was created successfully
    expect(createdClient).toBeDefined();
    expect(createdClient.id).toBeDefined();
    expect(createdClient.name).toBe(clientData.name);
    expect(createdClient.client_type).toBe(clientData.client_type);
    expect(createdClient.created_at).toBeDefined();
    expect(createdClient.updated_at).toBeDefined();

    // Verify the client exists in the API by fetching it directly
    const response = await page.request.get(
      `http://localhost:4000/api/v1/clients/${createdClient.id}`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    expect(response.ok()).toBe(true);
    const clientFromApi = await response.json();

    expect(clientFromApi.data.id).toBe(createdClient.id);
    expect(clientFromApi.data.attributes.name).toBe(clientData.name);
    expect(clientFromApi.data.attributes.client_type).toBe(clientData.client_type);

    // Cleanup: Delete the created client
    await dataFactory.deleteEntity('clients', createdClient.id!);
  });

  test('should retrieve existing test client', async ({ page: _page }) => {
    // First create a client to ensure we have one
    const testClient = await dataFactory.createClient({
      name: `Test Client for Retrieval ${Date.now()}`,
      client_type: 'business',
    });

    // Get the test client using DataFactory
    const retrievedClient = await dataFactory.getTestClient(0);

    // Verify we got a client
    expect(retrievedClient).toBeDefined();
    expect(retrievedClient.id).toBeDefined();
    expect(retrievedClient.name).toBeDefined();
    expect(retrievedClient.client_type).toMatch(/^(residential|business)$/);
    expect(retrievedClient.created_at).toBeDefined();
    expect(retrievedClient.updated_at).toBeDefined();

    // Cleanup
    await dataFactory.deleteEntity('clients', testClient.id!);
  });

  test('should handle client creation with default values', async ({ page: _page }) => {
    // Create a client with minimal data (should use defaults)
    const createdClient = await dataFactory.createClient();

    // Verify defaults were applied
    expect(createdClient).toBeDefined();
    expect(createdClient.id).toBeDefined();
    expect(createdClient.name).toMatch(/^Test Client \d+$/);
    expect(createdClient.client_type).toBe('residential');

    // Cleanup
    await dataFactory.deleteEntity('clients', createdClient.id!);
  });

  test('should handle business client creation', async ({ page: _page }) => {
    // Create a business client
    const clientName = `Test Business Client ${Date.now()}`;
    const businessClient = await dataFactory.createClient({
      name: clientName,
      client_type: 'business',
    });

    // Verify business client was created correctly
    expect(businessClient).toBeDefined();
    expect(businessClient.id).toBeDefined();
    expect(businessClient.name).toBe(clientName);
    expect(businessClient.client_type).toBe('business');

    // Cleanup
    await dataFactory.deleteEntity('clients', businessClient.id!);
  });

  test('should create client and use it for job creation', async ({ page: _page }) => {
    // Create a client first
    const timestamp = Date.now();
    const client = await dataFactory.createClient({
      name: `Client for Job Test ${timestamp}`,
      client_type: 'residential',
    });

    // Create a job using the client
    const job = await dataFactory.createJob({
      title: `Test Job with Custom Client ${timestamp}`,
      client_id: client.id,
      status: 'open',
      priority: 'normal',
    });

    // Verify job was created with the correct client
    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.title).toBe(`Test Job with Custom Client ${timestamp}`);
    expect(job.client_id).toBe(client.id);
    expect(job.status).toBe('open');
    expect(job.priority).toBe('normal');

    // Cleanup
    await dataFactory.deleteEntity('jobs', job.id!);
    await dataFactory.deleteEntity('clients', client.id!);
  });

  test('should demonstrate transition from test controller to real API', async ({ page }) => {
    // This test demonstrates that we're using the real API endpoints
    // instead of the removed test controller endpoints

    let apiCallMade = false;
    let apiEndpoint = '';

    // Monitor API calls to verify we're using the real endpoints
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/v1/clients') && request.method() === 'POST') {
        apiCallMade = true;
        apiEndpoint = url;
      }
    });

    // Create a client using DataFactory
    const clientName = `API Transition Test Client ${Date.now()}`;
    const client = await dataFactory.createClient({
      name: clientName,
      client_type: 'residential',
    });

    // Verify that the real API was called
    expect(apiCallMade).toBe(true);
    expect(apiEndpoint).toContain('/api/v1/clients');
    expect(apiEndpoint).not.toContain('/test/'); // Should not contain test controller paths

    // Verify the client was created successfully
    expect(client).toBeDefined();
    expect(client.id).toBeDefined();
    expect(client.name).toBe(clientName);

    // Cleanup
    await dataFactory.deleteEntity('clients', client.id!);
  });
});
