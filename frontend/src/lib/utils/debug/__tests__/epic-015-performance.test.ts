/**
 * Epic 015 Performance Tests
 * Tests performance characteristics of the debug system under various conditions
 *
 * Test Coverage:
 * - Redaction performance with large datasets
 * - Memory usage patterns
 * - Namespace resolution performance
 * - Circular reference handling
 * - Production vs development performance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock debug function
const mockDebugFunction = vi.hoisted(() => vi.fn());

vi.mock('debug', () => ({
  default: vi.fn(() => mockDebugFunction),
}));

import { debugAuth, debugDatabase, debugWorkflow, debugComponent } from '../namespaces';
import { securityRedactor } from '../redactor';
import { createEnhancedDebugger } from '../core';

// Mock console for tests that need it
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

describe('Epic 015 Performance - Redaction Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redact large objects within acceptable time limits', () => {
    const largeObject = {
      users: Array(1000)
        .fill(0)
        .map((_, i) => ({
          id: `user-${i}`,
          email: `user${i}@example.com`,
          name: `User ${i}`,
          password: `password-${i}`, // Should be redacted
          token: `token-${i}`, // Should be redacted
          profile: {
            firstName: `First${i}`,
            lastName: `Last${i}`,
            apiKey: `key-${i}`, // Should be redacted
            preferences: {
              theme: 'dark',
              notifications: true,
              secretKey: `secret-${i}`, // Should be redacted
            },
          },
        })),
    };

    const startTime = performance.now();
    const redactedData = securityRedactor(largeObject);
    const endTime = performance.now();

    const redactionTime = endTime - startTime;

    // Should complete within 100ms for 1000 user objects
    expect(redactionTime).toBeLessThan(100);

    // Verify redaction worked correctly
    expect(redactedData.users[0].password).toBe('[REDACTED]');
    expect(redactedData.users[0].token).toBe('[REDACTED]');
    expect(redactedData.users[0].profile.apiKey).toBe('[REDACTED]');
    expect(redactedData.users[0].profile.preferences.secretKey).toBe('[REDACTED]');

    // Verify safe data preserved
    expect(redactedData.users[0].email).toBe('user0@example.com');
    expect(redactedData.users[0].name).toBe('User 0');
    expect(redactedData.users[0].profile.firstName).toBe('First0');
  });

  it('should handle deeply nested objects efficiently', () => {
    // Create deeply nested object (10 levels)
    const createDeepObject = (depth: number): Record<string, unknown> => {
      if (depth === 0) {
        return {
          value: `level-${depth}`,
          password: `secret-${depth}`, // Should be redacted
          safeData: `safe-${depth}`,
        };
      }
      return {
        level: depth,
        password: `secret-${depth}`, // Should be redacted
        child: createDeepObject(depth - 1),
      };
    };

    const deepObject = createDeepObject(10);

    const startTime = performance.now();
    const redactedData = securityRedactor(deepObject);
    const endTime = performance.now();

    const redactionTime = endTime - startTime;

    // Should complete within 10ms for 10-level deep nesting
    expect(redactionTime).toBeLessThan(10);

    // Verify redaction worked at all levels
    expect(redactedData.password).toBe('[REDACTED]');
    expect(redactedData.child.password).toBe('[REDACTED]');
    expect(redactedData.child.child.password).toBe('[REDACTED]');

    // Verify safe data preserved
    expect(redactedData.level).toBe(10);
    expect(redactedData.child.level).toBe(9);
  });

  it('should handle arrays with many elements efficiently', () => {
    const largeArray = Array(5000)
      .fill(0)
      .map((_, i) => ({
        id: i,
        data: `item-${i}`,
        token: `token-${i}`, // Should be redacted
        metadata: {
          created: new Date().toISOString(),
          password: `password-${i}`, // Should be redacted
        },
      }));

    const testData = { items: largeArray };

    const startTime = performance.now();
    const redactedData = securityRedactor(testData);
    const endTime = performance.now();

    const redactionTime = endTime - startTime;

    // Should complete within 200ms for 5000 items
    expect(redactionTime).toBeLessThan(200);

    // Verify redaction worked
    expect(redactedData.items[0].token).toBe('[REDACTED]');
    expect(redactedData.items[0].metadata.password).toBe('[REDACTED]');

    // Verify safe data preserved
    expect(redactedData.items[0].id).toBe(0);
    expect(redactedData.items[0].data).toBe('item-0');
  });

  it('should handle repeated redaction calls efficiently', () => {
    const testData = {
      user: {
        id: 'user-123',
        email: 'user@example.com',
        password: 'secretPassword123',
        token: 'bearer-token-abc',
        profile: {
          name: 'John Doe',
          apiKey: 'sk-1234567890',
        },
      },
    };

    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      securityRedactor(testData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    // Average time per redaction should be less than 1ms
    expect(avgTime).toBeLessThan(1);

    // Total time for 1000 iterations should be less than 500ms
    expect(totalTime).toBeLessThan(500);
  });
});

describe('Epic 015 Performance - Debug System Overhead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have minimal overhead when debug is disabled', () => {
    // Mock debug as disabled
    vi.stubEnv('DEBUG', '');

    const testData = {
      user: { id: '123', password: 'secret' },
    };

    const iterations = 10000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      debugAuth.error('Test message', testData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    // When disabled, should be very fast (< 0.1ms per call)
    expect(avgTime).toBeLessThan(0.1);

    // Should not have called console methods
    expect(mockConsole.log).not.toHaveBeenCalled();
  });

  it('should measure overhead when debug is enabled', () => {
    // Mock debug as enabled
    vi.stubEnv('DEBUG', 'bos:*');

    const testData = {
      user: { id: '123', password: 'secret' },
    };

    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      debugAuth.error('Test message', testData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    // When enabled, should still be reasonable (< 5ms per call)
    expect(avgTime).toBeLessThan(5);

    // Should have called console methods
    expect(mockConsole.log).toHaveBeenCalledTimes(iterations);
  });

  it('should handle namespace resolution efficiently', () => {
    const namespaces = [
      'bos:auth',
      'bos:database',
      'bos:workflow',
      'bos:component',
      'bos:api',
      'bos:security',
    ];

    const testData = { test: 'data', password: 'secret' };
    const iterations = 1000;

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const namespace = namespaces[i % namespaces.length];
      const debugFn = createEnhancedDebugger(namespace);
      debugFn.error('Test message', testData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    // Namespace resolution should be fast (< 1ms per call)
    expect(avgTime).toBeLessThan(1);
  });
});

describe('Epic 015 Performance - Memory Usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not leak memory with repeated debug calls', () => {
    const testData = {
      items: Array(100)
        .fill(0)
        .map((_, i) => ({
          id: i,
          password: `secret-${i}`,
          data: `data-${i}`.repeat(100),
        })),
    };

    // Get initial memory usage
    const initialMemory = process.memoryUsage();

    // Perform many debug operations
    for (let i = 0; i < 1000; i++) {
      debugDatabase.error('Memory test', testData);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Get final memory usage
    const finalMemory = process.memoryUsage();

    // Memory increase should be reasonable (< 50MB)
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
  });

  it('should handle large string data without excessive memory usage', () => {
    const largeString = 'a'.repeat(1000000); // 1MB string
    const testData = {
      content: largeString,
      password: 'secret123',
    };

    const initialMemory = process.memoryUsage();

    // Process the large string multiple times
    for (let i = 0; i < 10; i++) {
      debugWorkflow.error('Large string test', testData);
    }

    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();

    // Memory increase should be reasonable relative to data size
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
  });

  it('should handle circular references without memory leaks', () => {
    const createCircularData = () => {
      const obj: Record<string, unknown> = {
        id: 'test',
        password: 'secret',
        data: 'test data',
      };
      obj.self = obj;
      obj.parent = { child: obj };
      return obj;
    };

    const initialMemory = process.memoryUsage();

    // Process circular references multiple times
    for (let i = 0; i < 1000; i++) {
      const circularData = createCircularData();
      debugComponent.error('Circular test', { data: circularData });
    }

    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();

    // Memory increase should be minimal
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // 20MB
  });
});

describe('Epic 015 Performance - Stress Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle concurrent debug calls', async () => {
    const testData = {
      user: { id: '123', password: 'secret' },
      session: { id: 'sess-456', token: 'token-789' },
    };

    const concurrentCalls = 100;
    const promises = [];

    const startTime = performance.now();

    for (let i = 0; i < concurrentCalls; i++) {
      promises.push(
        Promise.resolve().then(() => {
          debugAuth.error(`Concurrent test ${i}`, testData);
        })
      );
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(1000); // 1 second
  });

  it('should handle rapid sequential calls', () => {
    const testData = {
      operation: 'rapid-test',
      password: 'secret123',
      results: Array(50)
        .fill(0)
        .map((_, i) => ({
          id: i,
          status: 'completed',
          token: `token-${i}`,
        })),
    };

    const iterations = 10000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      debugWorkflow.error(`Rapid test ${i}`, testData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    // Should maintain reasonable performance under load
    expect(avgTime).toBeLessThan(2); // 2ms per call
    expect(totalTime).toBeLessThan(10000); // 10 seconds total
  });

  it('should handle mixed namespace calls efficiently', () => {
    const debugFunctions = [debugAuth, debugDatabase, debugWorkflow, debugComponent];

    const testData = {
      mixed: 'data',
      password: 'secret',
      token: 'token-123',
    };

    const iterations = 5000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const debugFn = debugFunctions[i % debugFunctions.length];
      debugFn.error(`Mixed test ${i}`, testData);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    // Should handle mixed calls efficiently
    expect(avgTime).toBeLessThan(1); // 1ms per call
    expect(totalTime).toBeLessThan(5000); // 5 seconds total
  });
});

describe('Epic 015 Performance - Production vs Development', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show performance difference between production and development', () => {
    const testData = {
      user: { id: '123', password: 'secret' },
      data: Array(100)
        .fill(0)
        .map((_, i) => ({
          id: i,
          token: `token-${i}`,
          content: `content-${i}`.repeat(10),
        })),
    };

    const iterations = 1000;

    // Test with DEBUG disabled (production-like)
    vi.stubEnv('DEBUG', '');
    const prodStartTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      debugAuth.error('Production test', testData);
    }

    const prodEndTime = performance.now();
    const prodTime = prodEndTime - prodStartTime;

    // Test with DEBUG enabled (development-like)
    vi.stubEnv('DEBUG', 'bos:*');
    const devStartTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      debugAuth.error('Development test', testData);
    }

    const devEndTime = performance.now();
    const devTime = devEndTime - devStartTime;

    // Production should be significantly faster
    expect(prodTime).toBeLessThan(devTime / 10); // At least 10x faster

    // Both should be reasonable
    expect(prodTime).toBeLessThan(100); // 100ms
    expect(devTime).toBeLessThan(5000); // 5 seconds
  });

  it('should measure redaction overhead specifically', () => {
    const sensitiveData = {
      user: {
        id: '123',
        email: 'user@example.com',
        password: 'secretPassword123',
        token: 'bearer-token-abc',
        profile: {
          name: 'John Doe',
          apiKey: 'sk-1234567890',
          preferences: {
            theme: 'dark',
            sessionId: 'sess-abc123',
          },
        },
      },
    };

    const iterations = 1000;

    // Test redaction time
    const redactionStartTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      securityRedactor(sensitiveData);
    }

    const redactionEndTime = performance.now();
    const redactionTime = redactionEndTime - redactionStartTime;
    const avgRedactionTime = redactionTime / iterations;

    // Redaction should be fast
    expect(avgRedactionTime).toBeLessThan(1); // 1ms per redaction
    expect(redactionTime).toBeLessThan(500); // 500ms total
  });
});
