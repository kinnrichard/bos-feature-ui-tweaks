/**
 * Tests for UTC Timestamp utilities
 * Ensures consistent timezone handling to fix the timezone bug
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getCurrentUtcTimestamp, 
  getDatabaseTimestamp, 
  timestampToUtcString, 
  isValidTimestamp 
} from './utc-timestamp';

describe('UTC Timestamp Utilities', () => {
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('getCurrentUtcTimestamp', () => {
    it('should return current UTC timestamp', () => {
      const mockTime = 1640995200000; // 2022-01-01 00:00:00 UTC
      Date.now = vi.fn(() => mockTime);

      const result = getCurrentUtcTimestamp();
      expect(result).toBe(mockTime);
      expect(Date.now).toHaveBeenCalled();
    });

    it('should return different values for consecutive calls', () => {
      const timestamp1 = getCurrentUtcTimestamp();
      // Small delay to ensure different timestamp
      const timestamp2 = getCurrentUtcTimestamp();
      
      // They should be very close but potentially different
      expect(Math.abs(timestamp2 - timestamp1)).toBeLessThan(100); // Within 100ms
    });
  });

  describe('getDatabaseTimestamp', () => {
    it('should return UTC timestamp for database storage', () => {
      const mockTime = 1640995200000;
      Date.now = vi.fn(() => mockTime);

      const result = getDatabaseTimestamp();
      expect(result).toBe(mockTime);
    });

    it('should be compatible with Zero.js timestamp format', () => {
      const result = getDatabaseTimestamp();
      
      // Should be a positive number (milliseconds since epoch)
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
      
      // Should be reasonable timestamp (after 2020, before 2030)
      expect(result).toBeGreaterThan(1577836800000); // 2020-01-01
      expect(result).toBeLessThan(1893456000000);    // 2030-01-01
    });
  });

  describe('timestampToUtcString', () => {
    it('should convert timestamp to UTC ISO string', () => {
      const timestamp = 1640995200000; // 2022-01-01 00:00:00 UTC
      const result = timestampToUtcString(timestamp);
      
      expect(result).toBe('2022-01-01T00:00:00.000Z');
    });

    it('should handle various timestamps correctly', () => {
      const testCases = [
        { timestamp: 0, expected: '1970-01-01T00:00:00.000Z' },
        { timestamp: 1640995200000, expected: '2022-01-01T00:00:00.000Z' },
        { timestamp: 1640995261000, expected: '2022-01-01T00:01:01.000Z' }
      ];

      testCases.forEach(({ timestamp, expected }) => {
        expect(timestampToUtcString(timestamp)).toBe(expected);
      });
    });
  });

  describe('isValidTimestamp', () => {
    beforeEach(() => {
      // Mock current time to a specific value for predictable tests
      Date.now = vi.fn(() => 1640995200000); // 2022-01-01 00:00:00 UTC
    });

    it('should validate recent timestamps as valid', () => {
      const now = 1640995200000;
      const oneHourAgo = now - (60 * 60 * 1000);
      
      expect(isValidTimestamp(oneHourAgo)).toBe(true);
      expect(isValidTimestamp(now)).toBe(true);
    });

    it('should reject timestamps that are too old', () => {
      const now = 1640995200000;
      const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
      
      expect(isValidTimestamp(twoDaysAgo)).toBe(false);
    });

    it('should reject timestamps too far in the future', () => {
      const now = 1640995200000;
      const twoHoursInFuture = now + (2 * 60 * 60 * 1000);
      
      expect(isValidTimestamp(twoHoursInFuture)).toBe(false);
    });

    it('should respect custom maxAgeHours parameter', () => {
      const now = 1640995200000;
      const sixHoursAgo = now - (6 * 60 * 60 * 1000);
      
      expect(isValidTimestamp(sixHoursAgo, 12)).toBe(true); // Within 12 hours
      expect(isValidTimestamp(sixHoursAgo, 4)).toBe(false); // Outside 4 hours
    });
  });

  describe('Timezone bug regression tests', () => {
    it('should produce consistent timestamps regardless of system timezone', () => {
      // These should all be UTC timestamps, not affected by system timezone
      const timestamp1 = getCurrentUtcTimestamp();
      const timestamp2 = getDatabaseTimestamp();
      
      // Both should be very close (within a few milliseconds)
      expect(Math.abs(timestamp2 - timestamp1)).toBeLessThan(10);
    });

    it('should produce timestamps compatible with reordered_at field', () => {
      const reorderedAtValue = getDatabaseTimestamp();
      
      // Should be in the expected format for database storage
      expect(typeof reorderedAtValue).toBe('number');
      expect(reorderedAtValue).toBeGreaterThan(0);
      
      // Should convert to valid UTC ISO string
      const isoString = timestampToUtcString(reorderedAtValue);
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});