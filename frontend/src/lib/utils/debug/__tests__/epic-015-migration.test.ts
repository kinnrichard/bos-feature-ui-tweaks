/**
 * Epic 015 Console Migration Test Suite
 * Comprehensive testing for the console.warn/error migration to enhanced debug system
 * 
 * Test Coverage:
 * - Security redaction across all namespaces
 * - Production behavior and namespace controls
 * - Migration validation and backward compatibility
 * - Error context and structured logging
 * - Performance and memory safety
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock debug function
const mockDebugFunction = vi.hoisted(() => vi.fn());

// Mock debug library
vi.mock('debug', () => ({
  default: vi.fn(() => mockDebugFunction)
}));

import { 
  debugAuth, 
  debugDatabase, 
  debugWorkflow, 
  debugComponent,
  debugAPI,
  debugSecurity,
  debugReactive,
  debugState,
  debugCache,
  debugWebSocket,
  debugValidation,
  debugPerformance,
  debugError,
  debugNavigation,
  debugNotification,
  debugSearch,
  debugUpload,
  debugExport,
  debugIntegration
} from '../namespaces';
import { securityRedactor } from '../redactor';
import { createEnhancedDebugger } from '../core';

describe('Epic 015 Console Migration - Security Redaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sensitiveTestData = {
    // Authentication sensitive data
    password: 'mySecretPassword123',
    token: 'bearer-token-xyz789',
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    apiKey: 'sk-1234567890abcdef',
    sessionId: 'sess_abc123',
    csrfToken: 'csrf-token-456',
    refreshToken: 'refresh-token-789',
    
    // Database sensitive data
    connectionString: 'postgresql://user:pass@localhost/db',
    databasePassword: 'db-secret-password',
    
    // Mixed data with safe fields
    email: 'user@example.com',
    username: 'testuser',
    id: '12345',
    timestamp: '2024-01-15T10:30:00Z'
  };

  describe('Authentication Debug Namespace (debugAuth)', () => {
    it('should redact sensitive authentication data in error logs', () => {
      const testError = new Error('Authentication failed');
      
      debugAuth.error('Login failed', {
        error: testError,
        credentials: sensitiveTestData.email,
        password: sensitiveTestData.password,
        token: sensitiveTestData.token
      });

      expect(mockConsole.log).toHaveBeenCalled();
      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      // Should contain safe data
      expect(loggedData).toContain(sensitiveTestData.email);
      expect(loggedData).toContain('Authentication failed');
      
      // Should NOT contain sensitive data
      expect(loggedData).not.toContain(sensitiveTestData.password);
      expect(loggedData).not.toContain(sensitiveTestData.token);
      expect(loggedData).toContain('[REDACTED]');
    });

    it('should redact JWT tokens in refresh scenarios', () => {
      debugAuth.error('Token refresh failed', {
        error: 'Invalid token',
        refreshToken: sensitiveTestData.refreshToken,
        jwt: sensitiveTestData.jwt,
        sessionId: sensitiveTestData.sessionId
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).not.toContain(sensitiveTestData.refreshToken);
      expect(loggedData).not.toContain(sensitiveTestData.jwt);
      expect(loggedData).not.toContain(sensitiveTestData.sessionId);
      expect(loggedData).toContain('[REDACTED]');
    });

    it('should handle null and undefined values safely', () => {
      debugAuth.error('Login failed', {
        error: null,
        credentials: undefined,
        password: sensitiveTestData.password,
        validField: 'safe-value'
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('safe-value');
      expect(loggedData).not.toContain(sensitiveTestData.password);
      expect(loggedData).toContain('[REDACTED]');
    });
  });

  describe('Database Debug Namespace (debugDatabase)', () => {
    it('should redact database connection strings', () => {
      debugDatabase.error('Database query failed', {
        error: 'Connection timeout',
        connectionString: sensitiveTestData.connectionString,
        query: 'SELECT * FROM users',
        apiKey: sensitiveTestData.apiKey
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('SELECT * FROM users');
      expect(loggedData).toContain('Connection timeout');
      expect(loggedData).not.toContain(sensitiveTestData.connectionString);
      expect(loggedData).not.toContain(sensitiveTestData.apiKey);
      expect(loggedData).toContain('[REDACTED]');
    });

    it('should handle Zero.js configuration warnings', () => {
      debugDatabase.warn('Connection timeout very low, may cause issues', {
        timeout: 500,
        password: sensitiveTestData.databasePassword,
        config: {
          host: 'localhost',
          user: 'admin',
          password: sensitiveTestData.databasePassword
        }
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('500');
      expect(loggedData).toContain('localhost');
      expect(loggedData).toContain('admin');
      expect(loggedData).not.toContain(sensitiveTestData.databasePassword);
      expect(loggedData).toContain('[REDACTED]');
    });
  });

  describe('Workflow Debug Namespace (debugWorkflow)', () => {
    it('should redact sensitive data in task operations', () => {
      debugWorkflow.error('Task creation failed', {
        error: 'Validation failed',
        taskData: {
          title: 'Test task',
          description: 'Task description',
          assignee: sensitiveTestData.email,
          token: sensitiveTestData.token,
          metadata: {
            createdBy: sensitiveTestData.username,
            apiKey: sensitiveTestData.apiKey
          }
        }
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('Test task');
      expect(loggedData).toContain('Task description');
      expect(loggedData).toContain(sensitiveTestData.email);
      expect(loggedData).toContain(sensitiveTestData.username);
      expect(loggedData).not.toContain(sensitiveTestData.token);
      expect(loggedData).not.toContain(sensitiveTestData.apiKey);
      expect(loggedData).toContain('[REDACTED]');
    });

    it('should handle task status update errors', () => {
      debugWorkflow.error('Task status update failed', {
        error: 'Invalid status',
        taskId: '12345',
        newStatus: 'completed',
        token: sensitiveTestData.token,
        csrfToken: sensitiveTestData.csrfToken
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('12345');
      expect(loggedData).toContain('completed');
      expect(loggedData).toContain('Invalid status');
      expect(loggedData).not.toContain(sensitiveTestData.token);
      expect(loggedData).not.toContain(sensitiveTestData.csrfToken);
      expect(loggedData).toContain('[REDACTED]');
    });
  });

  describe('Component Debug Namespace (debugComponent)', () => {
    it('should redact sensitive data in component errors', () => {
      debugComponent.error('Component state invalid', {
        state: {
          isVisible: true,
          userEmail: sensitiveTestData.email,
          authToken: sensitiveTestData.token,
          formData: {
            name: 'John Doe',
            email: sensitiveTestData.email,
            password: sensitiveTestData.password
          }
        },
        componentName: 'TestComponent'
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('TestComponent');
      expect(loggedData).toContain('John Doe');
      expect(loggedData).toContain(sensitiveTestData.email);
      expect(loggedData).toContain('true');
      expect(loggedData).not.toContain(sensitiveTestData.token);
      expect(loggedData).not.toContain(sensitiveTestData.password);
      expect(loggedData).toContain('[REDACTED]');
    });

    it('should handle portal target warnings', () => {
      debugComponent.warn('Portal target not found, falling back to body', {
        target: '#modal-container',
        password: sensitiveTestData.password, // Should be redacted even in warnings
        fallback: 'body'
      });

      const logCall = mockConsole.log.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      
      expect(loggedData).toContain('#modal-container');
      expect(loggedData).toContain('body');
      expect(loggedData).not.toContain(sensitiveTestData.password);
      expect(loggedData).toContain('[REDACTED]');
    });
  });
});

describe('Epic 015 Console Migration - Production Behavior Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respect DEBUG environment variable controls', () => {
    // Mock environment with no debug enabled
    vi.stubEnv('DEBUG', '');
    
    const testDebugger = createEnhancedDebugger('test:namespace');
    testDebugger.error('Test error', { data: 'test' });
    
    // In production with DEBUG='', should not log
    expect(mockConsole.log).not.toHaveBeenCalled();
  });

  it('should log when specific namespace is enabled', () => {
    // Mock environment with specific namespace enabled
    vi.stubEnv('DEBUG', 'bos:auth');
    
    debugAuth.error('Authentication failed', { error: 'Invalid credentials' });
    
    // Should log when namespace is enabled
    expect(mockConsole.log).toHaveBeenCalled();
  });

  it('should respect wildcard namespace patterns', () => {
    // Mock environment with wildcard pattern
    vi.stubEnv('DEBUG', 'bos:*');
    
    debugAuth.error('Auth error', { error: 'test' });
    debugDatabase.warn('DB warning', { warning: 'test' });
    debugWorkflow.error('Workflow error', { error: 'test' });
    
    // All should log with wildcard pattern
    expect(mockConsole.log).toHaveBeenCalledTimes(3);
  });

  it('should handle negative patterns correctly', () => {
    // Mock environment with negative pattern
    vi.stubEnv('DEBUG', 'bos:*,-bos:cache');
    
    debugAuth.error('Auth error', { error: 'test' });
    debugCache.error('Cache error', { error: 'test' });
    
    // Auth should log, cache should not
    expect(mockConsole.log).toHaveBeenCalledTimes(1);
  });
});

describe('Epic 015 Console Migration - Migration Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ensure all debug namespaces have enhanced methods', () => {
    const namespaces = [
      debugAuth, debugDatabase, debugWorkflow, debugComponent,
      debugAPI, debugSecurity, debugReactive, debugState,
      debugCache, debugWebSocket, debugValidation, debugPerformance,
      debugError, debugNavigation, debugNotification, debugSearch,
      debugUpload, debugExport, debugIntegration
    ];

    namespaces.forEach(debugFn => {
      expect(debugFn).toHaveProperty('warn');
      expect(debugFn).toHaveProperty('error');
      expect(typeof debugFn.warn).toBe('function');
      expect(typeof debugFn.error).toBe('function');
    });
  });

  it('should maintain backward compatibility with existing debug calls', () => {
    // Test that existing debug calls still work
    debugAuth('Legacy debug call', { data: 'test' });
    debugDatabase('Legacy database debug', { query: 'SELECT 1' });
    
    expect(mockConsole.log).toHaveBeenCalledTimes(2);
  });

  it('should provide consistent error context across namespaces', () => {
    const testError = new Error('Test error');
    const testData = { 
      id: '12345', 
      status: 'failed',
      password: 'should-be-redacted' 
    };

    debugAuth.error('Auth error', { error: testError, ...testData });
    debugDatabase.error('DB error', { error: testError, ...testData });
    debugWorkflow.error('Workflow error', { error: testError, ...testData });
    debugComponent.error('Component error', { error: testError, ...testData });

    // All should have been called
    expect(mockConsole.log).toHaveBeenCalledTimes(4);

    // All should have redacted sensitive data
    mockConsole.log.mock.calls.forEach(call => {
      const loggedData = JSON.stringify(call);
      expect(loggedData).toContain('12345');
      expect(loggedData).toContain('failed');
      expect(loggedData).not.toContain('should-be-redacted');
      expect(loggedData).toContain('[REDACTED]');
    });
  });
});

describe('Epic 015 Console Migration - Error Context Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide structured error context for authentication failures', () => {
    const mockError = new Error('Invalid credentials');
    const mockCredentials = { email: 'user@example.com' };

    debugAuth.error('Login failed', { 
      error: mockError, 
      credentials: mockCredentials.email,
      password: 'secret123' // Should be redacted
    });

    const logCall = mockConsole.log.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    expect(loggedData).toContain('Login failed');
    expect(loggedData).toContain('Invalid credentials');
    expect(loggedData).toContain(mockCredentials.email);
    expect(loggedData).not.toContain('secret123');
  });

  it('should provide structured error context for database operations', () => {
    const mockError = new Error('Connection timeout');
    
    debugDatabase.error('Database query failed', {
      error: mockError,
      query: 'SELECT * FROM users',
      timeout: 5000,
      connectionString: 'postgresql://user:pass@localhost/db' // Should be redacted
    });

    const logCall = mockConsole.log.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    expect(loggedData).toContain('Database query failed');
    expect(loggedData).toContain('Connection timeout');
    expect(loggedData).toContain('SELECT * FROM users');
    expect(loggedData).toContain('5000');
    expect(loggedData).not.toContain('postgresql://user:pass@localhost/db');
  });

  it('should handle complex nested objects with mixed sensitive data', () => {
    const complexData = {
      user: {
        id: '12345',
        email: 'user@example.com',
        profile: {
          name: 'John Doe',
          settings: {
            theme: 'dark',
            apiKey: 'sk-secret-key-123', // Should be redacted
            preferences: {
              notifications: true,
              token: 'user-token-456' // Should be redacted
            }
          }
        }
      },
      metadata: {
        timestamp: '2024-01-15T10:30:00Z',
        session: {
          id: 'sess_abc123', // Should be redacted
          valid: true
        }
      }
    };

    debugWorkflow.error('Complex data logging test', { data: complexData });

    const logCall = mockConsole.log.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    // Should contain safe data
    expect(loggedData).toContain('12345');
    expect(loggedData).toContain('user@example.com');
    expect(loggedData).toContain('John Doe');
    expect(loggedData).toContain('dark');
    expect(loggedData).toContain('true');
    expect(loggedData).toContain('2024-01-15T10:30:00Z');
    
    // Should NOT contain sensitive data
    expect(loggedData).not.toContain('sk-secret-key-123');
    expect(loggedData).not.toContain('user-token-456');
    expect(loggedData).not.toContain('sess_abc123');
    expect(loggedData).toContain('[REDACTED]');
  });
});

describe('Epic 015 Console Migration - Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle large data objects without performance degradation', () => {
    const largeData = {
      items: Array(1000).fill(0).map((_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        password: `secret-${i}`, // Should be redacted
        data: `data-${i}`.repeat(100)
      }))
    };

    const startTime = performance.now();
    debugDatabase.error('Large data test', { data: largeData });
    const endTime = performance.now();

    // Should complete within reasonable time (less than 100ms)
    expect(endTime - startTime).toBeLessThan(100);
    expect(mockConsole.log).toHaveBeenCalledTimes(1);

    const logCall = mockConsole.log.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    // Should contain safe data
    expect(loggedData).toContain('item-0');
    expect(loggedData).toContain('Item 0');
    
    // Should NOT contain sensitive data
    expect(loggedData).not.toContain('secret-0');
    expect(loggedData).toContain('[REDACTED]');
  });

  it('should handle circular references safely', () => {
    const circularData: any = {
      name: 'circular-test',
      password: 'secret123' // Should be redacted
    };
    circularData.self = circularData;

    expect(() => {
      debugComponent.error('Circular reference test', { data: circularData });
    }).not.toThrow();

    expect(mockConsole.log).toHaveBeenCalledTimes(1);
    const logCall = mockConsole.log.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    expect(loggedData).toContain('circular-test');
    expect(loggedData).not.toContain('secret123');
  });
});

describe('Epic 015 Console Migration - Security Redactor Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redact all known sensitive field patterns', () => {
    const testData = {
      // Password variants
      password: 'secret1',
      userPassword: 'secret2',
      adminPassword: 'secret3',
      
      // Token variants
      token: 'token1',
      accessToken: 'token2',
      refreshToken: 'token3',
      bearerToken: 'token4',
      
      // API key variants
      apiKey: 'key1',
      api_key: 'key2',
      secretKey: 'key3',
      
      // Session variants
      sessionId: 'session1',
      session_id: 'session2',
      
      // CSRF variants
      csrfToken: 'csrf1',
      csrf_token: 'csrf2',
      
      // Safe fields
      email: 'user@example.com',
      username: 'testuser',
      id: '12345'
    };

    const redactedData = securityRedactor.redact(testData);
    
    // Should redact all sensitive fields
    expect(redactedData.password).toBe('[REDACTED]');
    expect(redactedData.userPassword).toBe('[REDACTED]');
    expect(redactedData.adminPassword).toBe('[REDACTED]');
    expect(redactedData.token).toBe('[REDACTED]');
    expect(redactedData.accessToken).toBe('[REDACTED]');
    expect(redactedData.refreshToken).toBe('[REDACTED]');
    expect(redactedData.bearerToken).toBe('[REDACTED]');
    expect(redactedData.apiKey).toBe('[REDACTED]');
    expect(redactedData.api_key).toBe('[REDACTED]');
    expect(redactedData.secretKey).toBe('[REDACTED]');
    expect(redactedData.sessionId).toBe('[REDACTED]');
    expect(redactedData.session_id).toBe('[REDACTED]');
    expect(redactedData.csrfToken).toBe('[REDACTED]');
    expect(redactedData.csrf_token).toBe('[REDACTED]');
    
    // Should preserve safe fields
    expect(redactedData.email).toBe('user@example.com');
    expect(redactedData.username).toBe('testuser');
    expect(redactedData.id).toBe('12345');
  });

  it('should handle nested objects with sensitive data', () => {
    const nestedData = {
      level1: {
        level2: {
          level3: {
            password: 'deeply-nested-secret',
            safeField: 'safe-value'
          }
        }
      }
    };

    const redactedData = securityRedactor.redact(nestedData);
    
    expect(redactedData.level1.level2.level3.password).toBe('[REDACTED]');
    expect(redactedData.level1.level2.level3.safeField).toBe('safe-value');
  });

  it('should handle arrays with sensitive data', () => {
    const arrayData = {
      users: [
        { id: '1', email: 'user1@example.com', password: 'secret1' },
        { id: '2', email: 'user2@example.com', password: 'secret2' }
      ]
    };

    const redactedData = securityRedactor.redact(arrayData);
    
    expect(redactedData.users[0].password).toBe('[REDACTED]');
    expect(redactedData.users[1].password).toBe('[REDACTED]');
    expect(redactedData.users[0].email).toBe('user1@example.com');
    expect(redactedData.users[1].email).toBe('user2@example.com');
  });
});