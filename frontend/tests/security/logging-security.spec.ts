import { test, expect } from '@playwright/test';

/**
 * Tests specifically for logging security to ensure no sensitive data leakage
 */
test.describe('Logging Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console monitoring
    await page.goto('/');
  });

  test('should not log sensitive data in console during API calls', async ({ page }) => {
    const consoleLogs: string[] = [];
    const sensitivePatterns = [
      /csrf.*token.*[a-zA-Z0-9]{8,}/i,      // CSRF tokens
      /bearer.*[a-zA-Z0-9]{8,}/i,           // Bearer tokens
      /authorization.*[a-zA-Z0-9]{8,}/i,    // Authorization headers
      /x-csrf-token.*[a-zA-Z0-9]{8,}/i,     // CSRF header values
      /cookie.*[a-zA-Z0-9]{8,}/i,           // Cookie values
      /password.*[a-zA-Z0-9]{3,}/i,         // Password fields
      /secret.*[a-zA-Z0-9]{8,}/i,           // Secret values
      /key.*[a-zA-Z0-9]{8,}/i               // API keys
    ];

    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to login page and perform authentication
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Wait for potential API calls and logging
    await page.waitForTimeout(3000);

    // Check each log entry against sensitive patterns
    const violations: string[] = [];
    
    consoleLogs.forEach((log, index) => {
      sensitivePatterns.forEach(pattern => {
        if (pattern.test(log)) {
          violations.push(`Log ${index}: ${log}`);
        }
      });
    });

    // Report violations if any
    if (violations.length > 0) {
      console.log('Sensitive data violations found:');
      violations.forEach(violation => console.log(violation));
    }

    expect(violations).toHaveLength(0);
  });

  test('should mask token values in development logs', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Enable development mode
    await page.addInitScript(() => {
      // @ts-expect-error - Testing environment override
      import.meta.env.DEV = true;
    });

    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // Check that tokens are mentioned but not exposed
    const tokenLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('token') || log.toLowerCase().includes('csrf')
    );

    tokenLogs.forEach(log => {
      // Should mention token status but not show actual token values
      if (log.includes('present') || log.includes('missing')) {
        expect(log).not.toMatch(/[a-zA-Z0-9]{20,}/); // No long token strings
      }
      
      // Should not contain token prefixes with actual values
      expect(log).not.toMatch(/present \([a-zA-Z0-9]{8,}\)/);
      expect(log).not.toMatch(/token.*[a-zA-Z0-9]{20,}/);
    });
  });

  test('should not log request/response headers with sensitive data', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // Check header logs
    const headerLogs = consoleLogs.filter(log => 
      log.includes('headers') || log.includes('Headers')
    );

    headerLogs.forEach(log => {
      // Should not contain sensitive header names or values
      expect(log).not.toMatch(/x-csrf-token.*[a-zA-Z0-9]{8,}/i);
      expect(log).not.toMatch(/authorization.*[a-zA-Z0-9]{8,}/i);
      expect(log).not.toMatch(/cookie.*[a-zA-Z0-9]{8,}/i);
      expect(log).not.toMatch(/set-cookie.*[a-zA-Z0-9]{8,}/i);
    });
  });

  test('should use secure logging in production mode', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Set production mode
    await page.addInitScript(() => {
      // @ts-expect-error - Testing environment override
      import.meta.env.DEV = false;
    });

    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // In production, should have minimal logging
    const apiLogs = consoleLogs.filter(log => 
      log.includes('[API]') || log.includes('[CSRF]')
    );

    // Should have some basic status logs but no detailed debugging
    expect(apiLogs.length).toBeGreaterThan(0);
    
    // Should not have development-only logs
    const debugLogs = apiLogs.filter(log => 
      log.includes('Request headers') || 
      log.includes('Response headers') ||
      log.includes('Token set:') ||
      log.includes('Found token in meta')
    );

    expect(debugLogs).toHaveLength(0);
  });

  test('should handle malformed log data safely', async ({ page }) => {
    const consoleLogs: string[] = [];
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/login');

    // Test with malformed data that could cause logging issues
    await page.evaluate(() => {
      // @ts-expect-error - Testing window object access
      const { SecureLogger } = window;
      
      // Test with circular references
      const circular: unknown = {};
      circular.self = circular;
      
      try {
        SecureLogger.logObject(circular, { prefix: '[CIRCULAR]' });
      } catch {
        console.log('Circular reference handled');
      }
      
      // Test with undefined/null values
      SecureLogger.logObject(null, { prefix: '[NULL]' });
      SecureLogger.logObject(undefined, { prefix: '[UNDEFINED]' });
      
      // Test with very large objects
      const largeObject = {
        data: 'x'.repeat(10000),
        token: 'secret-should-be-redacted'
      };
      
      SecureLogger.logObject(largeObject, { prefix: '[LARGE]' });
    });

    await page.waitForTimeout(1000);

    // Should handle errors gracefully without crashing
    const fatalErrors = errors.filter(error => 
      error.includes('Maximum call stack') || 
      error.includes('out of memory')
    );

    expect(fatalErrors).toHaveLength(0);

    // Should still redact sensitive data even in edge cases
    const sensitiveLogs = consoleLogs.filter(log => 
      log.includes('secret-should-be-redacted')
    );

    expect(sensitiveLogs).toHaveLength(0);
  });

  test('should not expose internal system paths or URLs', async ({ page }) => {
    const consoleLogs: string[] = [];
    
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // Check that no internal system paths are logged
    const systemPaths = [
      '/etc/',
      '/usr/',
      '/var/',
      '/root/',
      '/home/',
      'C:\\',
      'file://',
      'ftp://',
      'ssh://'
    ];

    consoleLogs.forEach(log => {
      systemPaths.forEach(path => {
        expect(log).not.toContain(path);
      });
    });

    // Check that no private IP addresses are logged
    const privateIpPatterns = [
      /192\.168\.\d+\.\d+/,
      /10\.\d+\.\d+\.\d+/,
      /172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/
    ];

    consoleLogs.forEach(log => {
      privateIpPatterns.forEach(pattern => {
        expect(log).not.toMatch(pattern);
      });
    });
  });
});