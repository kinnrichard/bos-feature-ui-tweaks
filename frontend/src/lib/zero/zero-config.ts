// Centralized Zero.js Configuration
// Single source of truth for all Zero.js settings across the application

import { debugDatabase } from '$lib/utils/debug';

/**
 * Zero.js Query Configuration
 * Controls reactive query behavior, TTL, retries, and performance settings
 */
export const ZERO_QUERY_CONFIG = {
  // TTL (Time To Live) settings
  DEFAULT_TTL: '1h',
  FIND_TTL: '2h', // Single record queries cache longer
  COLLECTION_TTL: '1h', // Collection queries
  RELATIONSHIP_TTL: '30m', // Queries with .related() calls

  // Retry and performance settings
  RETRY_DELAY: 100, // ms between retries
  MAX_RETRIES: 50, // max attempts waiting for Zero client
  INITIAL_RETRY_BACKOFF: 100, // ms
  MAX_RETRY_BACKOFF: 5000, // ms

  // Debug and logging
  DEBUG_LOGGING: true, // Enable detailed query logging
  PERFORMANCE_LOGGING: false, // Log query performance metrics

  // Query optimization
  BATCH_UPDATES: true, // Batch state updates for performance
  DEBOUNCE_LISTENERS: 50, // ms to debounce rapid listener updates

  // Memory management
  AUTO_CLEANUP_DELAY: 30000, // ms before auto-cleanup of unused queries
  MAX_CACHED_QUERIES: 1000, // Prevent memory leaks
};

/**
 * Zero.js Client Configuration
 * Controls Zero client initialization, authentication, and connection management
 */
export const ZERO_CLIENT_CONFIG = {
  // Connection settings
  KV_STORE: 'mem', // Use memory store for development
  LOG_LEVEL: 'info', // Zero internal logging level

  // Authentication and security
  TOKEN_CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 hours in ms
  TOKEN_REFRESH_THRESHOLD: 30 * 60 * 1000, // Refresh 30min before expiry

  // Connection management
  CONNECTION_TIMEOUT: 10000, // ms timeout for initial connection
  RECONNECT_ATTEMPTS: 5, // Number of reconnection attempts
  RECONNECT_DELAY: 2000, // ms between reconnection attempts

  // Performance and reliability
  ENABLE_VISIBILITY_HANDLING: true, // Pause/resume on tab visibility
  ENABLE_CONNECTION_RECOVERY: true, // Auto-recover lost connections
  HEARTBEAT_INTERVAL: 30000, // ms between connection health checks

  // Development settings
  EXPOSE_DEBUG_API: true, // Expose window.zero for debugging
  ENABLE_QUERY_INSPECTOR: true, // Add query debugging tools
  MOCK_MODE: false, // Use mock data instead of real Zero
};

/**
 * Zero.js Error Configuration
 * Controls error handling, retry logic, and error reporting
 */
export const ZERO_ERROR_CONFIG = {
  // Error categorization
  RETRYABLE_ERRORS: ['NetworkError', 'TimeoutError', 'ConnectionError', 'TemporaryError'],

  FATAL_ERRORS: ['AuthenticationError', 'PermissionError', 'SchemaError', 'ValidationError'],

  // Retry strategies
  EXPONENTIAL_BACKOFF: true, // Use exponential backoff for retries
  MAX_BACKOFF_MULTIPLIER: 8, // Maximum backoff multiplier
  JITTER_ENABLED: true, // Add randomness to prevent thundering herd

  // Error reporting
  ERROR_REPORTING: true, // Report errors to console
  LOG_STACK_TRACES: true, // Include stack traces in error logs
  INCLUDE_QUERY_CONTEXT: true, // Include query details in error context
  ENABLE_ERROR_BOUNDARIES: true, // React/Svelte error boundary integration
};

/**
 * Environment-specific configuration overrides
 * Automatically applies based on NODE_ENV and other environment variables
 */
export function getEnvironmentConfig() {
  // Environment detection with Node.js fallback
  const mode = (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || process.env.NODE_ENV || 'development';
  const isDevelopment = mode === 'development';
  const isTest = mode === 'test';
  const isProduction = mode === 'production';

  // Base configuration
  let config = {
    query: { ...ZERO_QUERY_CONFIG },
    client: { ...ZERO_CLIENT_CONFIG },
    error: { ...ZERO_ERROR_CONFIG },
  };

  // Development overrides
  if (isDevelopment) {
    config.query.DEBUG_LOGGING = true;
    config.query.PERFORMANCE_LOGGING = true;
    config.client.EXPOSE_DEBUG_API = true;
    config.client.ENABLE_QUERY_INSPECTOR = true;
    config.error.LOG_STACK_TRACES = true;
  }

  // Test overrides
  if (isTest) {
    config.query.DEBUG_LOGGING = false;
    config.query.DEFAULT_TTL = '1s'; // Faster tests
    config.client.MOCK_MODE = true;
    config.client.CONNECTION_TIMEOUT = 1000;
    config.error.LOG_STACK_TRACES = false;
  }

  // Production overrides
  if (isProduction) {
    config.query.DEBUG_LOGGING = false;
    config.query.PERFORMANCE_LOGGING = false;
    config.client.EXPOSE_DEBUG_API = false;
    config.client.KV_STORE = 'idb'; // Use IndexedDB in production
    config.error.LOG_STACK_TRACES = false;
  }

  // Apply environment variable overrides with Node.js fallback
  const env = (typeof import.meta !== 'undefined' && import.meta.env) || process.env;
  
  if (env.VITE_ZERO_DEBUG === 'true') {
    config.query.DEBUG_LOGGING = true;
    config.query.PERFORMANCE_LOGGING = true;
  }

  if (env.VITE_ZERO_TTL) {
    config.query.DEFAULT_TTL = env.VITE_ZERO_TTL;
  }

  return config;
}

/**
 * Current active configuration (environment-aware)
 * Use this throughout the application instead of importing individual configs
 */
export const ZERO_CONFIG = getEnvironmentConfig();

/**
 * Zero.js Server Configuration
 * Controls the Zero server connection settings
 */
export const ZERO_SERVER_CONFIG = {
  // Server endpoints
  getServerUrl(): string {
    // Browser-only environment detection based on frontend port
    const frontendPort = window.location.port;
    let zeroPort: string;

    if (frontendPort === '6173') {
      // Test environment (frontend test port)
      zeroPort = '4850';
    } else if (frontendPort === '5173') {
      // Development environment (frontend dev port)
      zeroPort = '4848';
    } else {
      // Fallback to development for unknown ports
      zeroPort = '4848';
    }

    return `${window.location.protocol}//${window.location.hostname}:${zeroPort}`;
  },

  getTokenEndpoint(): string {
    return '/api/v1/zero/token';
  },

  // Connection parameters
  CONNECT_TIMEOUT: 10000, // ms
  REQUEST_TIMEOUT: 30000, // ms
  KEEPALIVE_INTERVAL: 60000, // ms
};

/**
 * Configuration validation
 * Ensures all configuration values are valid and consistent
 */
export function validateZeroConfig(): void {
  const { query, client } = ZERO_CONFIG;

  // Validate TTL formats
  const ttlPattern = /^(\d+[smhdy]|forever|none)$/;
  if (typeof query.DEFAULT_TTL === 'string' && !ttlPattern.test(query.DEFAULT_TTL)) {
    throw new Error(`Invalid DEFAULT_TTL format: ${query.DEFAULT_TTL}`);
  }

  // Validate retry limits
  if (query.MAX_RETRIES < 1 || query.MAX_RETRIES > 1000) {
    throw new Error(`MAX_RETRIES must be between 1 and 1000, got: ${query.MAX_RETRIES}`);
  }

  // Validate timeout values
  if (client.CONNECTION_TIMEOUT < 1000) {
    debugDatabase.warn('Connection timeout very low, may cause issues', {
      timeout: client.CONNECTION_TIMEOUT,
    });
  }

  // Environment consistency checks with Node.js fallback
  const mode = (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || process.env.NODE_ENV || 'development';
  if (mode === 'production' && query.DEBUG_LOGGING) {
    debugDatabase.warn('Debug logging enabled in production environment', {
      mode: mode,
      debugLogging: query.DEBUG_LOGGING,
    });
  }
}

// Validate configuration on import
validateZeroConfig();

/**
 * Helper functions for common configuration patterns
 */
export const ZeroConfigHelpers = {
  /**
   * Get TTL for a specific query type
   */
  getTTL(queryType: 'find' | 'collection' | 'relationship' | 'default'): string {
    switch (queryType) {
      case 'find':
        return ZERO_CONFIG.query.FIND_TTL;
      case 'collection':
        return ZERO_CONFIG.query.COLLECTION_TTL;
      case 'relationship':
        return ZERO_CONFIG.query.RELATIONSHIP_TTL;
      default:
        return ZERO_CONFIG.query.DEFAULT_TTL;
    }
  },

  /**
   * Check if error is retryable based on configuration
   */
  isRetryableError(error: Error): boolean {
    return ZERO_CONFIG.error.RETRYABLE_ERRORS.some(
      (errorType) => error.name === errorType || error.message.includes(errorType)
    );
  },

  /**
   * Calculate next retry delay with exponential backoff
   */
  getRetryDelay(attempt: number): number {
    const { EXPONENTIAL_BACKOFF, MAX_BACKOFF_MULTIPLIER, JITTER_ENABLED } = ZERO_CONFIG.error;
    const baseDelay = ZERO_CONFIG.query.RETRY_DELAY;

    let delay = EXPONENTIAL_BACKOFF
      ? baseDelay * Math.min(Math.pow(2, attempt), MAX_BACKOFF_MULTIPLIER)
      : baseDelay;

    // Add jitter to prevent thundering herd
    if (JITTER_ENABLED) {
      delay += Math.random() * (delay * 0.1);
    }

    return Math.min(delay, ZERO_CONFIG.query.MAX_RETRY_BACKOFF);
  },
};

// Individual configs are already exported above - no need to re-export
