// Standardized Zero.js Error Handling System
// Provides consistent error patterns across all reactive queries

import { ZERO_CONFIG, ZeroConfigHelpers } from './zero-config';
import { debugDatabase } from '$lib/utils/debug';

/**
 * Base Zero error class
 * All Zero-related errors inherit from this for consistent handling
 */
export abstract class ZeroError extends Error {
  public readonly timestamp: number;
  public readonly context: Record<string, any>;
  public readonly retryable: boolean;
  
  constructor(
    message: string, 
    context: Record<string, any> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.context = context;
    this.retryable = retryable;
    
    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Get formatted error for logging
   */
  toLogFormat(): string {
    const contextStr = Object.keys(this.context).length > 0 
      ? ` | Context: ${JSON.stringify(this.context)}`
      : '';
    
    return `[${this.name}] ${this.message}${contextStr}`;
  }
  
  /**
   * Get user-friendly error message
   */
  toUserMessage(): string {
    return this.getUserMessage();
  }
  
  protected abstract getUserMessage(): string;
}

/**
 * ActiveRecord-style errors (matches Rails ActiveRecord patterns)
 */
export class ActiveRecordError extends ZeroError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, context, false); // Most ActiveRecord errors are not retryable
  }
  
  protected getUserMessage(): string {
    return `Database operation failed: ${this.message}`;
  }
}

/**
 * Query-related errors
 */
export class QueryError extends ZeroError {
  public readonly queryType: string;
  public readonly queryParams: any;
  
  constructor(
    message: string, 
    queryType: string,
    queryParams: any = {},
    retryable: boolean = true
  ) {
    super(message, { queryType, queryParams }, retryable);
    this.queryType = queryType;
    this.queryParams = queryParams;
  }
  
  protected getUserMessage(): string {
    return 'Unable to load data. Please try again.';
  }
}

/**
 * Connection and network errors
 */
export class ConnectionError extends ZeroError {
  public readonly endpoint?: string;
  public readonly statusCode?: number;
  
  constructor(
    message: string,
    endpoint?: string,
    statusCode?: number,
    context: Record<string, any> = {}
  ) {
    super(message, { endpoint, statusCode, ...context }, true);
    this.endpoint = endpoint;
    this.statusCode = statusCode;
  }
  
  protected getUserMessage(): string {
    if (this.statusCode && this.statusCode >= 500) {
      return 'Server is temporarily unavailable. Please try again in a few moments.';
    }
    return 'Connection failed. Please check your internet connection.';
  }
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends ZeroError {
  public readonly authType: 'token' | 'permission' | 'session';
  
  constructor(
    message: string,
    authType: 'token' | 'permission' | 'session',
    context: Record<string, any> = {}
  ) {
    super(message, { authType, ...context }, false);
    this.authType = authType;
  }
  
  protected getUserMessage(): string {
    switch (this.authType) {
      case 'token':
        return 'Your session has expired. Please refresh the page.';
      case 'permission':
        return 'You do not have permission to access this data.';
      case 'session':
        return 'Please log in to continue.';
      default:
        return 'Authentication failed.';
    }
  }
}

/**
 * Validation errors (matches Rails validation patterns)
 */
export class ValidationError extends ZeroError {
  public readonly field?: string;
  public readonly validationType: string;
  public readonly value?: any;
  
  constructor(
    message: string,
    validationType: string,
    field?: string,
    value?: any,
    context: Record<string, any> = {}
  ) {
    super(message, { field, validationType, value, ...context }, false);
    this.field = field;
    this.validationType = validationType;
    this.value = value;
  }
  
  protected getUserMessage(): string {
    if (this.field) {
      return `${this.field}: ${this.message}`;
    }
    return this.message;
  }
}

/**
 * TTL and configuration errors
 */
export class ConfigError extends ZeroError {
  public readonly configKey: string;
  public readonly configValue: any;
  
  constructor(
    message: string,
    configKey: string,
    configValue: any,
    context: Record<string, any> = {}
  ) {
    super(message, { configKey, configValue, ...context }, false);
    this.configKey = configKey;
    this.configValue = configValue;
  }
  
  protected getUserMessage(): string {
    return 'Configuration error. Please contact support.';
  }
}

/**
 * Error handler class with retry logic and standardized patterns
 */
export class ZeroErrorHandler {
  private retryAttempts = new Map<string, number>();
  private errorCallbacks = new Map<string, Array<(error: ZeroError) => void>>();
  
  /**
   * Handle an error with automatic retry logic and proper logging
   */
  async handleError(
    error: any,
    context: ErrorContext
  ): Promise<ErrorResult> {
    const zeroError = this.normalizeError(error, context);
    
    // Log error based on configuration
    this.logError(zeroError, context);
    
    // Check if we should retry
    const shouldRetry = this.shouldRetry(zeroError, context);
    
    if (shouldRetry) {
      const retryDelay = this.calculateRetryDelay(context.operationId);
      return {
        error: zeroError,
        shouldRetry: true,
        retryDelay,
        retryAttempt: this.getRetryCount(context.operationId) + 1
      };
    }
    
    // Call error callbacks
    this.notifyErrorCallbacks(zeroError, context);
    
    return {
      error: zeroError,
      shouldRetry: false,
      retryDelay: 0,
      retryAttempt: this.getRetryCount(context.operationId)
    };
  }
  
  /**
   * Convert any error to a standardized ZeroError
   */
  private normalizeError(error: any, context: ErrorContext): ZeroError {
    if (error instanceof ZeroError) {
      return error;
    }
    
    // Convert common error types
    if (error instanceof TypeError && error.message.includes('slice')) {
      return new ConfigError(
        'Invalid TTL value passed to Zero.js',
        'ttl',
        context.ttl,
        { originalError: error.message, operation: context.operation }
      );
    }
    
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR') {
      return new ConnectionError(
        error.message || 'Network connection failed',
        context.endpoint,
        error.status,
        { originalError: error }
      );
    }
    
    if (error.status === 401 || error.message.includes('unauthorized')) {
      return new AuthError(
        error.message || 'Authentication failed',
        'token',
        { originalError: error }
      );
    }
    
    if (error.status === 403 || error.message.includes('forbidden')) {
      return new AuthError(
        error.message || 'Permission denied',
        'permission',
        { originalError: error }
      );
    }
    
    // Default to QueryError for unknown errors
    return new QueryError(
      error.message || 'Unknown error occurred',
      context.operation || 'unknown',
      context,
      ZeroConfigHelpers.isRetryableError(error)
    );
  }
  
  /**
   * Determine if error should be retried
   */
  private shouldRetry(error: ZeroError, context: ErrorContext): boolean {
    if (!error.retryable) {
      return false;
    }
    
    const currentAttempts = this.getRetryCount(context.operationId);
    const maxRetries = ZERO_CONFIG.query.MAX_RETRIES;
    
    return currentAttempts < maxRetries;
  }
  
  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(operationId: string): number {
    const attempts = this.getRetryCount(operationId);
    this.retryAttempts.set(operationId, attempts + 1);
    
    return ZeroConfigHelpers.getRetryDelay(attempts);
  }
  
  /**
   * Get current retry count for operation
   */
  private getRetryCount(operationId: string): number {
    return this.retryAttempts.get(operationId) || 0;
  }
  
  /**
   * Reset retry count for operation
   */
  resetRetries(operationId: string): void {
    this.retryAttempts.delete(operationId);
  }
  
  /**
   * Log error based on configuration
   */
  private logError(error: ZeroError, context: ErrorContext): void {
    if (!ZERO_CONFIG.error.ERROR_REPORTING) return;
    
    const logLevel = error.retryable ? 'warn' : 'error';
    const message = error.toLogFormat();
    
    if (ZERO_CONFIG.error.LOG_STACK_TRACES && error.stack) {
      console[logLevel](message, '\nStack:', error.stack);
    } else {
      console[logLevel](message);
    }
    
    // Include query context if enabled
    if (ZERO_CONFIG.error.INCLUDE_QUERY_CONTEXT && context) {
      console.debug('Error context:', context);
    }
  }
  
  /**
   * Subscribe to error notifications
   */
  onError(errorType: string, callback: (error: ZeroError) => void): () => void {
    if (!this.errorCallbacks.has(errorType)) {
      this.errorCallbacks.set(errorType, []);
    }
    
    const callbacks = this.errorCallbacks.get(errorType)!;
    callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify error callbacks
   */
  private notifyErrorCallbacks(error: ZeroError, context: ErrorContext): void {
    const callbacks = this.errorCallbacks.get(error.name) || [];
    const allCallbacks = this.errorCallbacks.get('*') || [];
    
    [...callbacks, ...allCallbacks].forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        debugDatabase.error('Error in error callback', { error: err, originalError: error });
      }
    });
  }
}

// Global error handler instance
export const zeroErrorHandler = new ZeroErrorHandler();

// Types and interfaces

export interface ErrorContext {
  operationId: string;
  operation?: string;
  endpoint?: string;
  ttl?: any;
  queryType?: string;
  queryParams?: any;
  userId?: string;
  timestamp?: number;
}

export interface ErrorResult {
  error: ZeroError;
  shouldRetry: boolean;
  retryDelay: number;
  retryAttempt: number;
}

/**
 * Error boundary helper for Svelte components
 */
export function createErrorBoundary(
  onError?: (error: ZeroError, context: ErrorContext) => void
) {
  return {
    handleError: async (error: any, context: Partial<ErrorContext> = {}) => {
      const fullContext: ErrorContext = {
        operationId: crypto.randomUUID(),
        timestamp: Date.now(),
        ...context
      };
      
      const result = await zeroErrorHandler.handleError(error, fullContext);
      
      if (onError) {
        onError(result.error, fullContext);
      }
      
      return result;
    }
  };
}

/**
 * Helper function to create operation IDs for retry tracking
 */
export function createOperationId(operation: string, params?: any): string {
  const paramsHash = params ? JSON.stringify(params) : '';
  return `${operation}-${btoa(paramsHash).slice(0, 8)}`;
}

// Error types are already exported above - no need to re-export