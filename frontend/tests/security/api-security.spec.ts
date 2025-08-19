import { test, expect } from '@playwright/test';

/**
 * Security tests for API client to ensure no sensitive data exposure
 */
test.describe('API Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console logging monitoring
    await page.goto('/login');
  });

  test('should not log CSRF tokens in production mode', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    // Capture console logs
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Override environment to simulate production
    await page.addInitScript(() => {
      // @ts-ignore
      import.meta.env.DEV = false;
    });

    await page.goto('/login');
    
    // Trigger API requests that would use CSRF tokens
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for potential API calls
    await page.waitForTimeout(2000);

    // Check that no CSRF tokens are logged
    const tokenLogs = consoleLogs.filter(log => 
      log.includes('csrf') || log.includes('token') || log.includes('X-CSRF-Token')
    );

    // Should not have any token content in logs
    const sensitiveLogs = tokenLogs.filter(log => 
      /[a-zA-Z0-9]{8,}/.test(log) || log.includes('present (') || log.includes('...')
    );

    expect(sensitiveLogs).toHaveLength(0);
  });

  test('should not log request headers with sensitive data', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/login');
    
    // Trigger API request
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);

    // Check that no sensitive headers are logged
    const headerLogs = consoleLogs.filter(log => 
      log.includes('headers') || log.includes('Headers')
    );

    headerLogs.forEach(log => {
      expect(log).not.toContain('X-CSRF-Token');
      expect(log).not.toContain('Authorization');
      expect(log).not.toContain('Cookie');
      expect(log).not.toContain('Set-Cookie');
    });
  });

  test('should validate API endpoints and reject invalid ones', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/login');

    // Test with invalid endpoint patterns
    await page.evaluate(() => {
      // @ts-ignore - Access the API client for testing
      const { api } = window;
      
      // These should throw validation errors
      const invalidEndpoints = [
        '/../../../etc/passwd',
        '/api/v1/users/<script>alert("xss")</script>',
        '/api/v1/users?id=1; DROP TABLE users;',
        '/api/v1/users?redirect=http://evil.com',
        '/api/v1/' + 'x'.repeat(300) // Too long
      ];

      invalidEndpoints.forEach(async (endpoint) => {
        try {
          await api.get(endpoint);
        } catch (error) {
          console.log('Validation error for:', endpoint, (error as Error).message);
        }
      });
    });

    await page.waitForTimeout(1000);

    // Should have validation errors for invalid endpoints
    const validationErrors = errors.filter(error => 
      error.includes('Invalid API endpoint')
    );

    expect(validationErrors.length).toBeGreaterThan(0);
  });

  test('should handle timeout errors gracefully', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/login');

    // Mock slow API response
    await page.route('**/api/v1/**', (route) => {
      // Delay response to trigger timeout
      setTimeout(() => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true })
        });
      }, 35000); // Longer than 30s timeout
    });

    await page.evaluate(() => {
      // @ts-ignore
      const { api } = window;
      
      api.get('/test-timeout').catch((error: any) => {
        console.log('Timeout error:', error.code, error.message);
      });
    });

    await page.waitForTimeout(5000);

    // Should handle timeout gracefully
    const timeoutErrors = errors.filter(error => 
      error.includes('TIMEOUT_ERROR') || error.includes('Request timed out')
    );

    expect(timeoutErrors.length).toBeGreaterThan(0);
  });

  test('should sanitize request data to prevent XSS', async ({ page }) => {
    const requestBodies: string[] = [];
    
    // Capture request bodies
    page.on('request', (request) => {
      if (request.method() === 'POST') {
        requestBodies.push(request.postData() || '');
      }
    });

    await page.goto('/login');

    // Test with malicious input
    await page.evaluate(() => {
      // @ts-ignore
      const { api } = window;
      
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'Normal text',
        nested: {
          value: '<script>document.cookie</script>'
        }
      };

      api.post('/test', maliciousData).catch(() => {
        // Ignore errors, we're testing sanitization
      });
    });

    await page.waitForTimeout(1000);

    // Check that script tags are removed from request bodies
    requestBodies.forEach(body => {
      expect(body).not.toContain('<script>');
      expect(body).not.toContain('</script>');
    });
  });
});

test.describe('Debug Security Tests', () => {
  test('should filter sensitive headers in debug logs', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/login');

    // Enable debug logging
    await page.evaluate(() => {
      localStorage.setItem('debug', 'bos:security');
    });

    await page.reload();

    await page.evaluate(() => {
      const { debugSecurity } = require('/src/lib/utils/debug.ts');
      
      // Test with sensitive headers
      const testHeaders = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'secret-token-123',
        'Authorization': 'Bearer secret-jwt-token',
        'Cookie': 'session=abc123',
        'Accept': 'application/json'
      };

      debugSecurity('Test headers', { headers: testHeaders });
    });

    await page.waitForTimeout(500);

    // Check that sensitive headers are filtered out
    const loggedHeaders = consoleLogs.filter(log => log.includes('Test headers'));
    
    loggedHeaders.forEach(log => {
      expect(log).toContain('Content-Type');
      expect(log).toContain('Accept');
      expect(log).toContain('[REDACTED]');
      expect(log).not.toContain('secret-token-123');
      expect(log).not.toContain('secret-jwt-token');
      expect(log).not.toContain('session=abc123');
    });
  });

  test('should sanitize objects with sensitive keys', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/login');

    await page.evaluate(() => {
      localStorage.setItem('debug', 'bos:security');
    });

    await page.reload();

    await page.evaluate(() => {
      const { debugSecurity } = require('/src/lib/utils/debug.ts');
      
      const testObject = {
        name: 'John Doe',
        password: 'secret123',
        apiKey: 'key-abc123',
        token: 'jwt-token-456',
        normalField: 'safe-value',
        nested: {
          secret: 'hidden-value',
          public: 'visible-value'
        }
      };

      debugSecurity('Test object', testObject);
    });

    await page.waitForTimeout(500);

    const loggedObjects = consoleLogs.filter(log => log.includes('Test object'));
    
    loggedObjects.forEach(log => {
      expect(log).toContain('John Doe');
      expect(log).toContain('safe-value');
      expect(log).toContain('visible-value');
      expect(log).toContain('[REDACTED]');
      expect(log).not.toContain('secret123');
      expect(log).not.toContain('key-abc123');
      expect(log).not.toContain('jwt-token-456');
      expect(log).not.toContain('hidden-value');
    });
  });
});