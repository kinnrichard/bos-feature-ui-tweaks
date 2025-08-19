import { test, expect } from '@playwright/test';

test.describe('Secure Debug System', () => {
  test('should redact sensitive data in debug logs', async ({ page }) => {
    // Navigate to a page where we can test debug functionality
    await page.goto('/');
    
    // Test data with sensitive information
    const testData = {
      user: {
        email: 'test@example.com',
        password: 'secret123',
        token: 'abc123def456'
      },
      headers: {
        'authorization': 'Bearer token123',
        'x-csrf-token': 'csrf-token-456',
        'cookie': 'session=abc123'
      },
      request: {
        body: {
          password: 'userpass',
          csrf_token: 'csrf-789'
        }
      }
    };
    
    // Enable debug logging
    await page.evaluate(() => {
      localStorage.setItem('debug', 'bos:*');
    });
    
    // Refresh to activate debug logging
    await page.reload();
    
    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Test secure debug function
    await page.evaluate((data) => {
      const { debugSecurity } = require('/src/lib/utils/debug.ts');
      debugSecurity('Testing secure debug with sensitive data', data);
    }, testData);
    
    // Wait for logs to be captured
    await page.waitForTimeout(100);
    
    // Check that sensitive data is redacted
    const debugLogs = logs.filter(log => log.includes('Testing secure debug'));
    expect(debugLogs.length).toBeGreaterThan(0);
    
    // Verify redaction
    for (const log of debugLogs) {
      expect(log).not.toContain('secret123');
      expect(log).not.toContain('abc123def456');
      expect(log).not.toContain('Bearer token123');
      expect(log).not.toContain('csrf-token-456');
      expect(log).not.toContain('session=abc123');
      expect(log).not.toContain('userpass');
      expect(log).not.toContain('csrf-789');
      
      // Should contain redacted placeholders
      expect(log).toContain('[REDACTED]');
    }
  });
  
  test('should allow debug namespace control', async ({ page }) => {
    await page.goto('/');
    
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });
    
    // Test specific namespace enabling
    await page.evaluate(() => {
      localStorage.setItem('debug', 'bos:security');
    });
    
    await page.reload();
    
    await page.evaluate(() => {
      const { debugSecurity, debugAPI } = require('/src/lib/utils/debug.ts');
      debugSecurity('Security debug message');
      debugAPI('API debug message');
    });
    
    await page.waitForTimeout(100);
    
    const securityLogs = logs.filter(log => log.includes('Security debug message'));
    const apiLogs = logs.filter(log => log.includes('API debug message'));
    
    expect(securityLogs.length).toBeGreaterThan(0);
    expect(apiLogs.length).toBe(0); // Should not appear as bos:api is not enabled
  });
  
  test('should provide debug helper functions', async ({ page }) => {
    await page.goto('/');
    
    // Check if debug helper is available in development
    const debugHelper = await page.evaluate(() => {
      return typeof (window as any).bosDebug;
    });
    
    expect(debugHelper).toBe('object');
    
    // Test debug helper functions
    await page.evaluate(() => {
      const helper = (window as any).bosDebug;
      helper.enable('bos:*');
      helper.status();
      helper.disable();
    });
    
    // Should not throw errors
    expect(true).toBe(true);
  });
});