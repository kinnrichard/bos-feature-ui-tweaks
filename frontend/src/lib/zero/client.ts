/**
 * Zero.js Client Wrapper for Epic-008
 * 
 * Provides centralized error handling, connection availability checking,
 * and improved TypeScript type safety for Zero.js operations.
 * 
 * This wrapper eliminates verbose null checking and error handling duplication
 * throughout the codebase while maintaining compatibility with existing patterns.
 */

import { getZero, getZeroAsync, type ZeroClient } from './zero-client';
import type { schema } from './generated-schema';
import { debugDatabase } from '$lib/utils/debug';

// Error types for better error handling
export class ZeroNotAvailableError extends Error {
  constructor(message: string = 'Zero client is not available') {
    super(message);
    this.name = 'ZeroNotAvailableError';
  }
}

export class ZeroConnectionError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'ZeroConnectionError';
  }
}

export class ZeroValidationError extends Error {
  constructor(message: string, public readonly field?: string, public readonly value?: unknown) {
    super(message);
    this.name = 'ZeroValidationError';
  }
}

// Connection state interface
export interface ZeroConnectionState {
  isAvailable: boolean;
  isInitialized: boolean;
  canPerformQueries: boolean;
  error: Error | null;
}

/**
 * Enhanced Zero client wrapper with centralized error handling
 * and connection state management
 */
export class ZeroClientWrapper {
  private static instance: ZeroClientWrapper | null = null;
  
  private constructor() {}
  
  /**
   * Get singleton instance of ZeroClientWrapper
   */
  static getInstance(): ZeroClientWrapper {
    if (!ZeroClientWrapper.instance) {
      ZeroClientWrapper.instance = new ZeroClientWrapper();
    }
    return ZeroClientWrapper.instance;
  }
  
  /**
   * Get Zero client with proper error handling
   * Returns null if not available (for optional operations)
   */
  getClient(): ZeroClient | null {
    try {
      return getZero();
    } catch (error) {
      debugDatabase.warn('Failed to get Zero client', { error });
      return null;
    }
  }
  
  /**
   * Get Zero client asynchronously with proper error handling
   * Throws ZeroNotAvailableError if initialization fails
   */
  async getClientAsync(): Promise<ZeroClient> {
    try {
      return await getZeroAsync();
    } catch (error) {
      throw new ZeroNotAvailableError(
        `Failed to initialize Zero client: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  /**
   * Check if Zero client is available and ready for operations
   */
  isAvailable(): boolean {
    const client = this.getClient();
    return client !== null && client !== undefined;
  }
  
  /**
   * Get current connection state
   */
  getConnectionState(): ZeroConnectionState {
    try {
      const client = this.getClient();
      const isAvailable = client !== null;
      
      return {
        isAvailable,
        isInitialized: isAvailable,
        canPerformQueries: isAvailable,
        error: null
      };
    } catch (error) {
      return {
        isAvailable: false,
        isInitialized: false,
        canPerformQueries: false,
        error: error instanceof Error ? error : new Error('Unknown connection error')
      };
    }
  }
  
  /**
   * Execute a query operation with proper error handling
   * Returns null if Zero is not available (for optional operations)
   */
  async executeQuery<T>(
    operation: (client: ZeroClient) => T | Promise<T>,
    { 
      required = false, 
      errorMessage = 'Query operation failed' 
    }: { 
      required?: boolean; 
      errorMessage?: string; 
    } = {}
  ): Promise<T | null> {
    const client = this.getClient();
    
    if (!client) {
      if (required) {
        throw new ZeroNotAvailableError('Zero client is required but not available');
      }
      return null;
    }
    
    try {
      const result = await operation(client);
      return result;
    } catch (error) {
      const errorMsg = `${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      if (required) {
        throw new ZeroConnectionError(errorMsg, error);
      }
      
      debugDatabase.warn('Zero client connection issue', { errorMsg, error });
      return null;
    }
  }
  
  /**
   * Execute a mutation operation with proper error handling
   * Always throws on error since mutations should not fail silently
   */
  async executeMutation<T>(
    operation: (client: ZeroClient) => T | Promise<T>,
    errorMessage: string = 'Mutation operation failed'
  ): Promise<T> {
    const client = this.getClient();
    
    if (!client) {
      throw new ZeroNotAvailableError('Zero client is required for mutations');
    }
    
    try {
      return await operation(client);
    } catch (error) {
      throw new ZeroConnectionError(
        `${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }
  
  /**
   * Validate UUID format for Zero operations
   */
  validateUUID(id: string, fieldName: string = 'id'): void {
    if (!id || typeof id !== 'string') {
      throw new ZeroValidationError(`${fieldName} is required and must be a string`, fieldName, id);
    }
    
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      throw new ZeroValidationError(`${fieldName} must be a valid UUID`, fieldName, id);
    }
  }
  
  /**
   * Validate required fields for create/update operations
   */
  validateRequired<T>(data: T, requiredFields: Array<keyof T>): void {
    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null) {
        throw new ZeroValidationError(
          `${String(field)} is required`,
          String(field),
          value
        );
      }
    }
  }
  
  /**
   * Validate update data (must have at least one field)
   */
  validateUpdateData<T extends Record<string, unknown>>(data: T): void {
    if (!data || Object.keys(data).length === 0) {
      throw new ZeroValidationError('Update data is required - at least one field must be provided');
    }
  }
  
  /**
   * Generate a validated UUID for new records
   */
  generateUUID(): string {
    const id = crypto.randomUUID();
    this.validateUUID(id);
    return id;
  }
  
  /**
   * Get current timestamp for Zero operations
   */
  getCurrentTimestamp(): number {
    return Date.now();
  }
  
  /**
   * Create standardized mutation result
   */
  createMutationResult(id: string): { id: string } {
    return { id };
  }
  
  /**
   * Wait for Zero client to become available with timeout
   */
  async waitForAvailability(timeoutMs: number = 5000): Promise<ZeroClient> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const client = this.getClient();
      if (client) {
        return client;
      }
      
      // Wait 100ms before next check
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new ZeroNotAvailableError(`Zero client did not become available within ${timeoutMs}ms`);
  }
}

// Export singleton instance for easy access
export const zeroClient = ZeroClientWrapper.getInstance();

// Convenience functions for common operations
export const getZeroClient = () => zeroClient.getClient();
export const getZeroClientAsync = () => zeroClient.getClientAsync();
export const isZeroAvailable = () => zeroClient.isAvailable();
export const getZeroConnectionState = () => zeroClient.getConnectionState();

// Convenience functions for operations
export const executeQuery = <T>(
  operation: (client: ZeroClient) => T | Promise<T>,
  options?: { required?: boolean; errorMessage?: string }
) => zeroClient.executeQuery(operation, options);

export const executeMutation = <T>(
  operation: (client: ZeroClient) => T | Promise<T>,
  errorMessage?: string
) => zeroClient.executeMutation(operation, errorMessage);

// Validation utilities
export const validateUUID = (id: string, fieldName?: string) => zeroClient.validateUUID(id, fieldName);
export const validateRequired = <T>(data: T, requiredFields: Array<keyof T>) => 
  zeroClient.validateRequired(data, requiredFields);
export const validateUpdateData = <T extends Record<string, unknown>>(data: T) => 
  zeroClient.validateUpdateData(data);

// Utility functions
export const generateUUID = () => zeroClient.generateUUID();
export const getCurrentTimestamp = () => zeroClient.getCurrentTimestamp();
export const createMutationResult = (id: string) => zeroClient.createMutationResult(id);