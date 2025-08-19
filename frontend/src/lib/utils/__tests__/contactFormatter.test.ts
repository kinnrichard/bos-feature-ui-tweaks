/**
 * Contact Formatter Tests
 *
 * Tests for contact method display formatting functionality
 */

import { describe, it, expect } from 'vitest';
import {
  formatPhone,
  formatEmail,
  formatContactMethod,
  isTollFree,
  parseFormattedPhone,
  shouldUseTollFreeFormat,
  type PhoneStyle,
} from '../contactFormatter';
import type { ContactMethodData } from '../../models/types/contact-method-data';

describe('contactFormatter', () => {
  describe('isTollFree', () => {
    it('should identify toll-free numbers', () => {
      expect(isTollFree('+18005551212')).toBe(true);
      expect(isTollFree('+18335551212')).toBe(true);
      expect(isTollFree('+18445551212')).toBe(true);
      expect(isTollFree('+18555551212')).toBe(true);
      expect(isTollFree('+18665551212')).toBe(true);
      expect(isTollFree('+18775551212')).toBe(true);
      expect(isTollFree('+18885551212')).toBe(true);
    });

    it('should reject non-toll-free numbers', () => {
      expect(isTollFree('+17275551212')).toBe(false);
      expect(isTollFree('+12125551212')).toBe(false);
      expect(isTollFree('+14155551212')).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isTollFree('')).toBe(false);
      expect(isTollFree('+44123456789')).toBe(false);
      expect(isTollFree('invalid')).toBe(false);
    });
  });

  describe('formatPhone', () => {
    it('should format toll-free numbers as 1-XXX-XXX-XXXX', () => {
      expect(formatPhone('+18005551212')).toBe('1-800-555-1212');
      expect(formatPhone('+18335551212')).toBe('1-833-555-1212');
      expect(formatPhone('+18885551212')).toBe('1-888-555-1212');
    });

    it('should format regular US numbers as (XXX) XXX-XXXX', () => {
      expect(formatPhone('+17275551212')).toBe('(727) 555-1212');
      expect(formatPhone('+12125551212')).toBe('(212) 555-1212');
    });

    it('should handle extensions correctly', () => {
      expect(formatPhone('+18005551212,123')).toBe('1-800-555-1212 ext. 123');
      expect(formatPhone('+17275551212,456')).toBe('(727) 555-1212 ext. 456');
    });

    it('should handle international style formatting', () => {
      const international: PhoneStyle = 'international';
      expect(formatPhone('+18005551212', international)).toBe('1-800-555-1212');
      expect(formatPhone('+17275551212', international)).toBe('+1 727 555 1212');
    });

    it('should handle invalid inputs gracefully', () => {
      expect(formatPhone('')).toBe('');
      expect(formatPhone('invalid')).toBe('invalid');
    });
  });

  describe('formatEmail', () => {
    it('should format emails consistently', () => {
      expect(formatEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
      expect(formatEmail('User@Domain.org')).toBe('user@domain.org');
    });

    it('should handle empty inputs', () => {
      expect(formatEmail('')).toBe('');
      expect(formatEmail('   ')).toBe('');
    });
  });

  describe('formatContactMethod', () => {
    it('should format phone contact methods', () => {
      const phoneMethod: ContactMethodData = {
        id: '1',
        contact_type: 'phone',
        normalized_value: '+18005551212',
        value: '800-555-1212',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      expect(formatContactMethod(phoneMethod)).toBe('1-800-555-1212');
    });

    it('should format phone contact methods with extensions', () => {
      const phoneMethodWithExt: ContactMethodData = {
        id: '1',
        contact_type: 'phone',
        normalized_value: '+17275551212,123',
        value: '(727) 555-1212 ext. 123',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      expect(formatContactMethod(phoneMethodWithExt)).toBe('(727) 555-1212 ext. 123');
    });

    it('should format email contact methods', () => {
      const emailMethod: ContactMethodData = {
        id: '1',
        contact_type: 'email',
        normalized_value: 'test@example.com',
        value: 'Test@Example.com',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      expect(formatContactMethod(emailMethod)).toBe('test@example.com');
    });

    it('should format address contact methods', () => {
      const addressMethod: ContactMethodData = {
        id: '1',
        contact_type: 'address',
        normalized_value: '123 Main St, City, ST 12345',
        value: '123 Main St, City, ST 12345',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      expect(formatContactMethod(addressMethod)).toBe('123 Main St, City, ST 12345');
    });

    it('should fallback to value when normalized_value is missing', () => {
      const method: ContactMethodData = {
        id: '1',
        contact_type: 'phone',
        normalized_value: '',
        value: '800-555-1212',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      expect(formatContactMethod(method)).toBe('800-555-1212');
    });
  });

  describe('parseFormattedPhone', () => {
    it('should parse phone numbers with extensions', () => {
      expect(parseFormattedPhone('(727) 555-1212 ext. 123')).toEqual({
        phone: '(727) 555-1212',
        extension: '123',
      });

      expect(parseFormattedPhone('1-800-555-1212 ext. 456')).toEqual({
        phone: '1-800-555-1212',
        extension: '456',
      });
    });

    it('should parse phone numbers without extensions', () => {
      expect(parseFormattedPhone('(727) 555-1212')).toEqual({
        phone: '(727) 555-1212',
      });

      expect(parseFormattedPhone('1-800-555-1212')).toEqual({
        phone: '1-800-555-1212',
      });
    });

    it('should handle empty inputs', () => {
      expect(parseFormattedPhone('')).toEqual({ phone: '' });
      expect(parseFormattedPhone('   ')).toEqual({ phone: '' });
    });
  });

  describe('shouldUseTollFreeFormat', () => {
    it('should detect toll-free in normalized format', () => {
      expect(shouldUseTollFreeFormat('+18005551212')).toBe(true);
      expect(shouldUseTollFreeFormat('+17275551212')).toBe(false);
    });

    it('should detect toll-free in 10-digit format', () => {
      expect(shouldUseTollFreeFormat('8005551212')).toBe(true);
      expect(shouldUseTollFreeFormat('7275551212')).toBe(false);
    });

    it('should detect toll-free in 11-digit format', () => {
      expect(shouldUseTollFreeFormat('18005551212')).toBe(true);
      expect(shouldUseTollFreeFormat('17275551212')).toBe(false);
    });

    it('should handle formatted numbers', () => {
      expect(shouldUseTollFreeFormat('(800) 555-1212')).toBe(true);
      expect(shouldUseTollFreeFormat('(727) 555-1212')).toBe(false);
      expect(shouldUseTollFreeFormat('1-800-555-1212')).toBe(true);
    });

    it('should handle invalid inputs', () => {
      expect(shouldUseTollFreeFormat('')).toBe(false);
      expect(shouldUseTollFreeFormat('invalid')).toBe(false);
    });
  });
});
