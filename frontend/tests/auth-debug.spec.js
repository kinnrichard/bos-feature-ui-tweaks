const { test, expect } = require('@playwright/test');

// Simple test to debug 403 authentication errors
test('debug authentication flow', async ({ page }) => {
  console.log('Starting authentication debug test...');
  
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Step 1: Get CSRF token from health endpoint
    console.log('Step 1: Getting CSRF token...');
    const healthResponse = await page.request.get(`${baseUrl}/api/v1/health`);
    console.log('Health response status:', healthResponse.status());
    
    if (!healthResponse.ok()) {
      console.log('Health check failed - server may not be running');
      return;
    }
    
    const healthHeaders = healthResponse.headers();
    const csrfToken = healthHeaders['x-csrf-token'] || healthHeaders['X-CSRF-Token'];
    console.log('CSRF token from health:', csrfToken ? csrfToken.substring(0, 10) + '...' : 'NONE');
    
    if (!csrfToken) {
      console.log('No CSRF token found in health response');
      return;
    }
    
    // Step 2: Attempt login
    console.log('Step 2: Attempting login...');
    const loginResponse = await page.request.post(`${baseUrl}/api/v1/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      data: {
        auth: {
          email: 'admin@bos-test.local',
          password: 'password123'
        }
      }
    });
    
    console.log('Login response status:', loginResponse.status());
    
    if (!loginResponse.ok()) {
      const loginError = await loginResponse.json();
      console.log('Login error:', loginError);
      return;
    }
    
    console.log('Login successful!');
    
    // Step 3: Get request cookies and add to browser context
    console.log('Step 3: Transferring cookies to browser context...');
    const requestCookies = await page.request.storageState();
    console.log('Request cookies count:', requestCookies.cookies?.length || 0);
    
    if (requestCookies.cookies && requestCookies.cookies.length > 0) {
      await page.context().addCookies(requestCookies.cookies);
      console.log('Cookies transferred to browser context');
    }
    
    // Step 4: Test creating a client (should work if authenticated)
    console.log('Step 4: Testing client creation...');
    const clientResponse = await page.request.post(`${baseUrl}/api/v1/test/create_client`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      data: {
        client: {
          name: 'Test Client Debug',
          client_type: 'residential'
        }
      }
    });
    
    console.log('Client creation response status:', clientResponse.status());
    
    if (!clientResponse.ok()) {
      const clientError = await clientResponse.json();
      console.log('Client creation error:', clientError);
      
      // Check if it's a 403 error
      if (clientResponse.status() === 403) {
        console.log('*** 403 FORBIDDEN ERROR - This is what we need to debug ***');
        console.log('Error details:', clientError);
      }
    } else {
      console.log('Client creation successful!');
    }
    
    // Step 5: Test creating a job (should work if authenticated)
    console.log('Step 5: Testing job creation...');
    const jobResponse = await page.request.post(`${baseUrl}/api/v1/jobs`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      data: {
        job: {
          title: 'Test Job Debug',
          description: 'Debug test job',
          status: 'open',
          priority: 'normal',
          client_id: 'client-id-here'
        }
      }
    });
    
    console.log('Job creation response status:', jobResponse.status());
    
    if (!jobResponse.ok()) {
      const jobError = await jobResponse.json();
      console.log('Job creation error:', jobError);
      
      // Check if it's a 403 error
      if (jobResponse.status() === 403) {
        console.log('*** 403 FORBIDDEN ERROR - This is what we need to debug ***');
        console.log('Error details:', jobError);
      }
    } else {
      console.log('Job creation successful!');
    }
    
  } catch (error) {
    console.log('Test error:', error);
  }
});