import { describe, it, expect } from 'vitest';
import { normalizeContact } from '../contactNormalizer';

describe('Contact Normalization Integration', () => {
  it('should handle typical user input scenarios', () => {
    // Email scenarios
    expect(normalizeContact('john@company.com')).toEqual({
      value: 'john@company.com',
      normalized_value: 'john@company.com',
      contact_type: 'email',
    });

    expect(normalizeContact('  JANE@COMPANY.COM  ')).toEqual({
      value: 'JANE@COMPANY.COM',
      normalized_value: 'jane@company.com',
      contact_type: 'email',
    });

    // Phone scenarios
    expect(normalizeContact('555-123-4567')).toEqual({
      value: '555-123-4567',
      normalized_value: '+15551234567',
      contact_type: 'phone',
    });

    expect(normalizeContact('(555) 123 4567')).toEqual({
      value: '(555) 123 4567',
      normalized_value: '+15551234567',
      contact_type: 'phone',
    });

    expect(normalizeContact('15551234567')).toEqual({
      value: '15551234567',
      normalized_value: '+15551234567',
      contact_type: 'phone',
    });

    expect(normalizeContact('5551234567')).toEqual({
      value: '5551234567',
      normalized_value: '+15551234567',
      contact_type: 'phone',
    });

    // Address scenarios
    expect(normalizeContact('123 Main St, Anytown, ST 12345')).toEqual({
      value: '123 Main St, Anytown, ST 12345',
      normalized_value: '123 Main St, Anytown, ST 12345',
      contact_type: 'address',
    });

    expect(normalizeContact('P.O. Box 123')).toEqual({
      value: 'P.O. Box 123',
      normalized_value: 'P.O. Box 123',
      contact_type: 'address',
    });

    // Edge cases that should be addresses
    expect(normalizeContact('@mention without domain')).toEqual({
      value: '@mention without domain',
      normalized_value: '@mention without domain',
      contact_type: 'address',
    });

    expect(normalizeContact('555-123')).toEqual({
      value: '555-123',
      normalized_value: '555-123',
      contact_type: 'address',
    });
  });

  it('should work with ContactMethod data structure', () => {
    // Simulate what happens in the form
    const userInputs = ['john.doe@company.com', '(555) 123-4567', '123 Main St, Anytown ST'];

    const normalizedResults = userInputs.map((input) => {
      const normalized = normalizeContact(input);
      return {
        value: normalized?.value || input,
        contact_type: normalized?.contact_type,
        normalized_value: normalized?.normalized_value,
      };
    });

    expect(normalizedResults).toEqual([
      {
        value: 'john.doe@company.com',
        contact_type: 'email',
        normalized_value: 'john.doe@company.com',
      },
      {
        value: '(555) 123-4567',
        contact_type: 'phone',
        normalized_value: '+15551234567',
      },
      {
        value: '123 Main St, Anytown ST',
        contact_type: 'address',
        normalized_value: '123 Main St, Anytown ST',
      },
    ]);
  });
});
