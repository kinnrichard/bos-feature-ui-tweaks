/**
 * Test Setup for Epic 015 Console Migration Tests
 * Configures the test environment for debug system testing
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock process.env for consistent testing
const mockEnv = {
  NODE_ENV: 'test',
  DEBUG: '',
  VITE_API_URL: 'http://localhost:3000'
};

// Store original values
const originalEnv = { ...process.env };

// Global test setup
beforeEach(() => {
  // Reset environment variables
  Object.assign(process.env, mockEnv);
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset console mocks
  vi.clearAllTimers();
  
  // Mock performance.now for consistent timing tests
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
});

afterEach(() => {
  // Restore original environment
  Object.assign(process.env, originalEnv);
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Restore all mocks
  vi.restoreAllMocks();
});

// Mock debug library globally
vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn())
}));

// Mock console methods globally
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Mock localStorage for browser compatibility
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  writable: true
});

// Mock fetch for API testing
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock import.meta.env
vi.stubGlobal('import.meta.env', {
  DEV: true,
  PROD: false,
  MODE: 'test',
  VITE_API_URL: 'http://localhost:3000'
});

// Mock Svelte 5 runes
vi.stubGlobal('$state', vi.fn(() => ({
  selectedStatuses: ['new_task', 'in_progress', 'paused', 'successful', 'failed'],
  showDeleted: false,
  showArchived: false,
  get currentStatuses() {
    return this.selectedStatuses;
  }
})));

vi.stubGlobal('$derived', vi.fn((fn) => fn()));
vi.stubGlobal('$effect', vi.fn());
vi.stubGlobal('$inspect', vi.fn());

// Add global garbage collection mock for memory tests
if (!global.gc) {
  global.gc = vi.fn();
}

// Enhanced console mock with history tracking
const consoleHistory = {
  log: [] as any[],
  warn: [] as any[],
  error: [] as any[],
  info: [] as any[]
};

const originalConsole = { ...console };

global.console = {
  ...originalConsole,
  log: vi.fn((...args) => {
    consoleHistory.log.push(args);
    return originalConsole.log(...args);
  }),
  warn: vi.fn((...args) => {
    consoleHistory.warn.push(args);
    return originalConsole.warn(...args);
  }),
  error: vi.fn((...args) => {
    consoleHistory.error.push(args);
    return originalConsole.error(...args);
  }),
  info: vi.fn((...args) => {
    consoleHistory.info.push(args);
    return originalConsole.info(...args);
  })
};

// Export console history for test access
(global as any).consoleHistory = consoleHistory;

// Helper function to check for sensitive data in console output
(global as any).checkForSensitiveData = (history: any[], sensitivePatterns: string[]) => {
  const allOutput = JSON.stringify(history);
  return sensitivePatterns.some(pattern => allOutput.includes(pattern));
};

// Performance testing helpers
(global as any).measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Memory usage helpers
(global as any).measureMemory = () => {
  if (process.memoryUsage) {
    return process.memoryUsage();
  }
  return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
};