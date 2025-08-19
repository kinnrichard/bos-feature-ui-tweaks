import fastRedact from 'fast-redact';

/**
 * Security redactor configuration for sensitive data patterns
 * This module handles all security-related redaction for debug logging
 */

/**
 * Sensitive data patterns to redact from debug output
 * Covers tokens, passwords, auth headers, CSRF tokens, session data, etc.
 */
const SENSITIVE_PATHS = [
  'password',
  'token',
  'auth',
  'authorization',
  'csrf',
  'csrf_token',
  '["csrf-token"]',        // Fixed: bracket notation for hyphenated key
  'csrfToken',
  '["x-csrf-token"]',      // Fixed: bracket notation for hyphenated key
  'x_csrf_token',          // Alternative: underscore version
  'session',
  'sessionId',
  'session_id',
  'apiKey',
  'api_key',
  'secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'jwt',
  'bearer',
  'cookie',
  'cookies',
  'user.password',
  'user.token',
  'headers.authorization',
  'headers.cookie',
  'headers["x-csrf-token"]',
  'headers["csrf-token"]',
  'request.headers.authorization',
  'request.headers.cookie',
  'response.headers["set-cookie"]',
  'body.password',
  'body.token',
  'body.csrf_token',
  'data.password',
  'data.token',
  'data.csrf_token',
  'params.password',
  'params.token',
  'params.csrf_token'
];

/**
 * Create a security redactor instance with proper error handling
 */
export function createSecurityRedactor() {
  try {
    return fastRedact({
      paths: SENSITIVE_PATHS,
      strict: false,
      serialize: false
    });
  } catch (error) {
    // Enhanced error handling with specific validation error details
    console.error('Failed to create security redactor:', error);
    
    // Log specific path validation errors if available
    if (error instanceof Error && error.message.includes('Invalid path')) {
      console.error('Invalid path detected in SENSITIVE_PATHS configuration');
      console.error('This may be due to unsupported characters in path names');
    }
    
    console.warn('Falling back to basic redactor - security filtering may be less comprehensive');
    
    // Robust fallback redactor that handles various data structures
    return (data: any) => {
      if (typeof data === 'object' && data !== null) {
        try {
          return JSON.parse(JSON.stringify(data, (key, value) => {
            // Check for sensitive key patterns (case-insensitive)
            const keyLower = key.toLowerCase();
            const sensitivePatterns = [
              'password', 'token', 'auth', 'csrf', 'session', 'secret', 
              'apikey', 'jwt', 'bearer', 'cookie'
            ];
            
            if (sensitivePatterns.some(pattern => keyLower.includes(pattern))) {
              return '[REDACTED]';
            }
            
            // Check for hyphenated sensitive keys
            if (keyLower.includes('csrf-token') || keyLower.includes('x-csrf-token')) {
              return '[REDACTED]';
            }
            
            return value;
          }));
        } catch (jsonError) {
          // If JSON processing fails, return a safe placeholder
          console.error('JSON processing failed in fallback redactor:', jsonError);
          return '[REDACTION_ERROR]';
        }
      }
      return data;
    };
  }
}

/**
 * Pre-configured security redactor instance
 * Exported for direct use in debug functions
 */
export const securityRedactor = createSecurityRedactor();

/**
 * Type definition for the redactor function
 */
export type SecurityRedactor = ReturnType<typeof createSecurityRedactor>;