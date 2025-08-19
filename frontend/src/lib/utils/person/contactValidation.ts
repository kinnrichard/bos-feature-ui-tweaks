/**
 * Contact Method Validation Utilities
 *
 * Provides validation helpers for contact methods used in person forms.
 * Includes validation for emails, phone numbers, and addresses.
 */

import {
  normalizeContact,
  type NormalizedContact,
  type ContactType,
} from '../shared/contactNormalizer';

/**
 * Validation result for contact methods
 */
export interface ContactValidationResult {
  isValid: boolean;
  errors: string[];
  normalized?: NormalizedContact;
}

/**
 * Validates an email address
 * @param email - Email to validate
 * @returns Validation result
 */
export function validateEmail(email: string): ContactValidationResult {
  const trimmed = email.trim();

  if (!trimmed) {
    return { isValid: false, errors: ['Email is required'] };
  }

  // Basic email regex - more permissive than the normalizer
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { isValid: false, errors: ['Please enter a valid email address'] };
  }

  const normalized = normalizeContact(trimmed);

  return {
    isValid: true,
    errors: [],
    normalized: normalized || undefined,
  };
}

/**
 * Validates a phone number
 * @param phone - Phone number to validate
 * @returns Validation result
 */
export function validatePhone(phone: string): ContactValidationResult {
  const trimmed = phone.trim();

  if (!trimmed) {
    return { isValid: false, errors: ['Phone number is required'] };
  }

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 10) {
    return { isValid: false, errors: ['Phone number must have at least 10 digits'] };
  }

  if (digits.length > 11) {
    return { isValid: false, errors: ['Phone number has too many digits'] };
  }

  if (digits.length === 11 && digits[0] !== '1') {
    return { isValid: false, errors: ['11-digit phone numbers must start with 1'] };
  }

  const normalized = normalizeContact(trimmed);

  return {
    isValid: true,
    errors: [],
    normalized: normalized || undefined,
  };
}

/**
 * Validates an address
 * @param address - Address to validate
 * @returns Validation result
 */
export function validateAddress(address: string): ContactValidationResult {
  const trimmed = address.trim();

  if (!trimmed) {
    return { isValid: false, errors: ['Address is required'] };
  }

  if (trimmed.length < 5) {
    return { isValid: false, errors: ['Address is too short'] };
  }

  const normalized = normalizeContact(trimmed);

  return {
    isValid: true,
    errors: [],
    normalized: normalized || undefined,
  };
}

/**
 * Validates a contact method based on its detected or specified type
 * @param value - Contact value to validate
 * @param expectedType - Expected contact type (optional)
 * @returns Validation result
 */
export function validateContact(
  value: string,
  expectedType?: ContactType
): ContactValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { isValid: true, errors: [] }; // Empty values are allowed for optional fields
  }

  const normalized = normalizeContact(trimmed);

  if (!normalized) {
    return { isValid: false, errors: ['Invalid contact format'] };
  }

  // If an expected type is provided, validate it matches
  if (expectedType && normalized.contact_type !== expectedType) {
    const typeLabel = getContactTypeLabel(expectedType);
    return {
      isValid: false,
      errors: [`This doesn't appear to be a valid ${typeLabel.toLowerCase()}`],
    };
  }

  // Perform type-specific validation
  switch (normalized.contact_type) {
    case 'email':
      return validateEmail(trimmed);
    case 'phone':
      return validatePhone(trimmed);
    case 'address':
      return validateAddress(trimmed);
    default:
      return { isValid: true, errors: [], normalized };
  }
}

/**
 * Gets a human-readable label for a contact type
 */
function getContactTypeLabel(type: ContactType): string {
  switch (type) {
    case 'email':
      return 'Email';
    case 'phone':
      return 'Phone';
    case 'address':
      return 'Address';
    default:
      return 'Contact';
  }
}

/**
 * Validates multiple contact methods
 * @param contacts - Array of contact values to validate
 * @returns Map of validation results by index
 */
export function validateContactMethods(
  contacts: Array<{ value: string; type?: ContactType }>
): Map<number, ContactValidationResult> {
  const results = new Map<number, ContactValidationResult>();

  contacts.forEach((contact, index) => {
    const result = validateContact(contact.value, contact.type);
    if (!result.isValid) {
      results.set(index, result);
    }
  });

  return results;
}

/**
 * Checks if a contact value appears to be a specific type
 * @param value - Contact value to check
 * @param type - Type to check against
 * @returns True if the value appears to be the specified type
 */
export function isContactType(value: string, type: ContactType): boolean {
  const normalized = normalizeContact(value);
  return normalized?.contact_type === type;
}
