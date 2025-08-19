import { describe, it, expect } from 'vitest';
import {
  normalizeContact,
  normalizePhone,
  normalizeEmail,
  formatPhoneForDisplay,
  getContactTypeIcon,
  getContactTypeLabel,
} from '../contactNormalizer';

describe('contactNormalizer', () => {
  describe('email normalization', () => {
    it('should detect and lowercase emails', () => {
      const result = normalizeContact('TEST@EXAMPLE.COM');
      expect(result).toEqual({
        value: 'TEST@EXAMPLE.COM',
        normalized_value: 'test@example.com',
        contact_type: 'email',
      });
    });

    it('should trim whitespace from emails', () => {
      const result = normalizeContact('  user@example.com  ');
      expect(result).toEqual({
        value: 'user@example.com',
        normalized_value: 'user@example.com',
        contact_type: 'email',
      });
    });

    it('should reject invalid email formats', () => {
      const invalid = ['user@', '@example.com', 'user.example.com', 'user @example.com'];
      invalid.forEach((email) => {
        const result = normalizeContact(email);
        expect(result?.contact_type).not.toBe('email');
      });
    });
  });

  describe('phone normalization', () => {
    it('should normalize 10-digit US phones to E.164', () => {
      const result = normalizeContact('8123213123');
      expect(result).toEqual({
        value: '8123213123',
        normalized_value: '+18123213123',
        contact_type: 'phone',
      });
    });

    it('should handle phones with formatting', () => {
      const result = normalizeContact('812-321-3123');
      expect(result).toEqual({
        value: '812-321-3123',
        normalized_value: '+18123213123',
        contact_type: 'phone',
      });
    });

    it('should handle US phones with country code', () => {
      const result = normalizeContact('18123213123');
      expect(result).toEqual({
        value: '18123213123',
        normalized_value: '+18123213123',
        contact_type: 'phone',
      });
    });

    it('should handle phone with parentheses and spaces', () => {
      const result = normalizeContact('(812) 321 3123');
      expect(result).toEqual({
        value: '(812) 321 3123',
        normalized_value: '+18123213123',
        contact_type: 'phone',
      });
    });

    it('should handle phone extensions with comma separator', () => {
      const result = normalizeContact('812-321-3123 ext 123');
      expect(result).toEqual({
        value: '812-321-3123 ext 123',
        normalized_value: '+18123213123,123',
        contact_type: 'phone',
      });
    });

    it('should handle phone extensions with x', () => {
      const result = normalizeContact('(812) 321-3123 x456');
      expect(result).toEqual({
        value: '(812) 321-3123 x456',
        normalized_value: '+18123213123,456',
        contact_type: 'phone',
      });
    });

    it('should handle extension format variations', () => {
      const testCases = [
        { input: '812-321-3123 extension 789', expected: '+18123213123,789' },
        { input: '812-321-3123 ext. 111', expected: '+18123213123,111' },
        { input: '812-321-3123 ext 222', expected: '+18123213123,222' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = normalizeContact(input);
        expect(result?.normalized_value).toBe(expected);
        expect(result?.contact_type).toBe('phone');
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalid = ['123', '12345', '123456789'];
      invalid.forEach((phone) => {
        const result = normalizeContact(phone);
        expect(result?.contact_type).not.toBe('phone');
      });
    });
  });

  describe('address handling', () => {
    it('should detect addresses as fallback', () => {
      const result = normalizeContact('123 Main St, Anytown USA');
      expect(result).toEqual({
        value: '123 Main St, Anytown USA',
        normalized_value: '123 Main St, Anytown USA',
        contact_type: 'address',
      });
    });

    it('should handle simple text as address', () => {
      const result = normalizeContact('Some random text');
      expect(result).toEqual({
        value: 'Some random text',
        normalized_value: 'Some random text',
        contact_type: 'address',
      });
    });

    it('should trim addresses', () => {
      const result = normalizeContact('  123 Main St  ');
      expect(result).toEqual({
        value: '123 Main St',
        normalized_value: '123 Main St',
        contact_type: 'address',
      });
    });
  });

  describe('individual normalization functions', () => {
    describe('normalizePhone', () => {
      it('should normalize phone to E.164', () => {
        expect(normalizePhone('8123213123')).toBe('+18123213123');
        expect(normalizePhone('812-321-3123')).toBe('+18123213123');
        expect(normalizePhone('+1 812 321 3123')).toBe('+18123213123');
      });

      it('should handle extensions', () => {
        expect(normalizePhone('812-321-3123 ext 123')).toBe('+18123213123,123');
        expect(normalizePhone('812-321-3123 x456')).toBe('+18123213123,456');
        expect(normalizePhone('812-321-3123 extension 789')).toBe('+18123213123,789');
      });

      it('should return null for empty input', () => {
        expect(normalizePhone('')).toBeNull();
        expect(normalizePhone('  ')).toBeNull();
      });
    });

    describe('normalizeEmail', () => {
      it('should lowercase and trim emails', () => {
        expect(normalizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
        expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
      });

      it('should return null for empty input', () => {
        expect(normalizeEmail('')).toBeNull();
        expect(normalizeEmail('  ')).toBeNull();
      });
    });

    describe('formatPhoneForDisplay', () => {
      it('should format US phones for display', () => {
        expect(formatPhoneForDisplay('8123213123')).toBe('(812) 321-3123');
        expect(formatPhoneForDisplay('+18123213123')).toBe('(812) 321-3123');
      });

      it('should handle international phones', () => {
        const intlPhone = '+447700900123';
        const result = formatPhoneForDisplay(intlPhone);
        expect(result).toContain('+44');
      });

      it('should return original for invalid input', () => {
        expect(formatPhoneForDisplay('invalid')).toBe('invalid');
        expect(formatPhoneForDisplay('')).toBe('');
      });
    });
  });

  describe('edge cases', () => {
    it('should return null for empty input', () => {
      expect(normalizeContact('')).toBeNull();
      expect(normalizeContact('  ')).toBeNull();
      expect(normalizeContact(null as any)).toBeNull();
      expect(normalizeContact(undefined as any)).toBeNull();
    });
  });

  describe('helper functions', () => {
    it('should return correct icons for contact types', () => {
      expect(getContactTypeIcon('email')).toBe('/icons/envelope.svg');
      expect(getContactTypeIcon('phone')).toBe('/icons/phone.svg');
      expect(getContactTypeIcon('address')).toBe('/icons/mappin.and.ellipse.svg');
    });

    it('should return correct labels for contact types', () => {
      expect(getContactTypeLabel('email')).toBe('Email');
      expect(getContactTypeLabel('phone')).toBe('Phone');
      expect(getContactTypeLabel('address')).toBe('Address');
    });
  });
});
