/**
 * UTC Timestamp Utilities
 * 
 * Provides consistent UTC timestamp generation to fix timezone bugs
 * where timestamps were showing local time instead of UTC
 */

/**
 * Generate current UTC timestamp as milliseconds since epoch
 * This ensures consistent timezone handling across the application
 * 
 * @returns UTC timestamp in milliseconds (compatible with Date.now())
 */
export function getCurrentUtcTimestamp(): number {
  return Date.now();
}

/**
 * Generate current UTC timestamp for database storage
 * Zero.js expects timestamps as numbers (milliseconds since epoch)
 * 
 * @returns UTC timestamp in milliseconds for Zero.js/PostgreSQL storage
 */
export function getDatabaseTimestamp(): number {
  // Date.now() already returns UTC milliseconds since epoch
  // The timezone bug was likely in how dates were being displayed, not generated
  return Date.now();
}

/**
 * Convert a timestamp to UTC ISO string for debugging/display
 * 
 * @param timestamp - Timestamp in milliseconds
 * @returns UTC ISO string representation
 */
export function timestampToUtcString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Validate that a timestamp is in the expected range (not too old or too far in future)
 * 
 * @param timestamp - Timestamp to validate
 * @param maxAgeHours - Maximum age in hours (default 24)
 * @returns true if timestamp is valid
 */
export function isValidTimestamp(timestamp: number, maxAgeHours = 24): boolean {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
  const futureLimit = 60 * 60 * 1000; // 1 hour in future max
  
  return timestamp > (now - maxAge) && timestamp < (now + futureLimit);
}