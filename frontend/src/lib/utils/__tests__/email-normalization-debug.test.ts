import { describe, it, expect } from 'vitest';
import { normalizeContact, normalizeEmail } from '../contactNormalizer';

describe('Email Normalization Debug Tests', () => {
  describe('normalizeContact - email detection', () => {
    it('should properly detect and normalize standard emails', () => {
      const testEmails = [
        { input: 'user@example.com', expected: 'user@example.com' },
        { input: 'test@domain.org', expected: 'test@domain.org' },
        { input: 'admin@company.net', expected: 'admin@company.net' },
        { input: 'USER@EXAMPLE.COM', expected: 'user@example.com' },
        { input: '  user@example.com  ', expected: 'user@example.com' },
        { input: 'user.name@example.com', expected: 'user.name@example.com' },
        { input: 'user+tag@example.com', expected: 'user+tag@example.com' },
        { input: 'user_name@example.com', expected: 'user_name@example.com' },
        { input: 'user-name@example.com', expected: 'user-name@example.com' },
        { input: 'user@sub.example.com', expected: 'user@sub.example.com' },
      ];

      testEmails.forEach(({ input, expected }) => {
        const result = normalizeContact(input);
        console.log(`Testing: "${input}"`);
        console.log(`Result:`, result);

        expect(result).not.toBeNull();
        expect(result?.contact_type).toBe('email');
        expect(result?.normalized_value).toBe(expected);
      });
    });

    it('should handle edge cases', () => {
      // These should NOT be detected as emails
      const nonEmails = [
        'user@',
        '@example.com',
        'user @example.com', // space in email
        'user@ example.com', // space after @
        'plaintext',
      ];

      nonEmails.forEach((input) => {
        const result = normalizeContact(input);
        console.log(`Testing non-email: "${input}"`);
        console.log(`Result:`, result);

        expect(result?.contact_type).not.toBe('email');
      });
    });

    it('should return null for empty/invalid inputs', () => {
      const emptyInputs = ['', '   ', null, undefined];

      emptyInputs.forEach((input) => {
        const result = normalizeContact(input as string);
        console.log(`Testing empty: "${input}"`);
        console.log(`Result:`, result);

        expect(result).toBeNull();
      });
    });
  });

  describe('normalizeEmail - direct function', () => {
    it('should normalize emails correctly', () => {
      expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
      expect(normalizeEmail('  test@domain.org  ')).toBe('test@domain.org');
      expect(normalizeEmail('Admin@Company.Net')).toBe('admin@company.net');
    });

    it('should return null for empty inputs', () => {
      expect(normalizeEmail('')).toBeNull();
      expect(normalizeEmail('   ')).toBeNull();
      expect(normalizeEmail(null as any)).toBeNull();
      expect(normalizeEmail(undefined as any)).toBeNull();
    });
  });

  describe('Email regex pattern test', () => {
    it('should match valid emails with current regex', () => {
      const emailRegex = /^[^@\s]+@[^@\s]+$/;

      const validEmails = [
        'user@example.com',
        'test@domain.org',
        'user.name@example.com',
        'user+tag@example.com',
        'user@sub.domain.com',
      ];

      validEmails.forEach((email) => {
        console.log(`Regex test for: "${email}" = ${emailRegex.test(email)}`);
        expect(emailRegex.test(email)).toBe(true);
      });
    });
  });
});
