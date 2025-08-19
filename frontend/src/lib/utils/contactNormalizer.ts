/**
 * Contact Normalization Utility
 *
 * Provides client-side contact normalization for email addresses, phone numbers, and addresses.
 * Matches backend normalization behavior using libphonenumber-js for E.164 phone formatting.
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export type ContactType = 'email' | 'phone' | 'address';

export interface NormalizedContact {
  value: string;
  normalized_value: string | null;
  contact_type: ContactType;
}

/**
 * Normalizes a contact value and detects its type
 * @param value - Raw contact value to normalize
 * @returns Normalized contact object or null if empty
 */
export function normalizeContact(value: string): NormalizedContact | null {
  if (!value?.trim()) return null;

  const trimmed = value.trim();

  // Email detection and normalization
  if (trimmed.match(/^[^@\s]+@[^@\s]+$/)) {
    return {
      value: trimmed,
      normalized_value: normalizeEmail(trimmed),
      contact_type: 'email',
    };
  }

  // Phone detection using libphonenumber-js
  if (isPhoneNumber(trimmed)) {
    return {
      value: trimmed,
      normalized_value: normalizePhone(trimmed),
      contact_type: 'phone',
    };
  }

  // Address as fallback
  return {
    value: trimmed,
    normalized_value: normalizeAddress(trimmed),
    contact_type: 'address',
  };
}

/**
 * Checks if a value looks like a phone number using libphonenumber-js
 * @param value - Value to check
 * @returns True if value appears to be a phone number
 */
function isPhoneNumber(value: string): boolean {
  try {
    // First try libphonenumber-js validation
    if (isValidPhoneNumber(value)) {
      return true;
    }

    // Try parsing to see if we can extract a number
    const parsed = parsePhoneNumber(value);
    if (parsed && parsed.number) {
      return true;
    }

    // Fallback to digit counting for simple cases
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  } catch {
    // Fallback to simple digit pattern
    const digits = value.replace(/\D/g, '');
    return /^\d{10,15}$/.test(digits);
  }
}

/**
 * Normalizes a phone number to E.164 format with extension support
 * @param value - Phone number to normalize
 * @returns E.164 formatted phone number with comma-separated extension or null
 */
export function normalizePhone(value: string): string | null {
  if (!value?.trim()) return null;

  try {
    // Check for extension patterns in the original value
    const extensionMatch = value.match(/(?:ext?\.?|extension|x)\s*(\d+)$/i);

    // Remove extension from value for parsing
    const cleanValue = extensionMatch
      ? value.replace(/(?:ext?\.?|extension|x)\s*\d+$/i, '').trim()
      : value;

    // Try parsing with US country code assumption first for 10-digit numbers
    let parsed;
    const digits = cleanValue.replace(/\D/g, '');

    if (digits.length === 10) {
      // Assume US for 10-digit numbers
      parsed = parsePhoneNumber(cleanValue, 'US');
    } else {
      // Parse normally for other formats
      parsed = parsePhoneNumber(cleanValue);
    }

    if (parsed && parsed.number) {
      // Get E.164 format
      let normalized = parsed.format('E.164');

      // Add extension if found
      if (extensionMatch) {
        const extension = extensionMatch[1];
        normalized = `${normalized},${extension}`;
      }

      return normalized;
    }

    // Fallback for invalid phone numbers (maintain backward compatibility)
    if (digits.length >= 10) {
      // Add US country code for 10 or 11 digit numbers
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits[0] === '1') {
        return `+${digits}`;
      } else {
        return `+${digits}`;
      }
    }

    return value;
  } catch {
    // Final fallback to original behavior
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 10) {
      // Add US country code for 10 digit numbers
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits[0] === '1') {
        return `+${digits}`;
      } else {
        return `+${digits}`;
      }
    }
    return value;
  }
}

/**
 * Normalizes an email address
 * @param value - Email to normalize
 * @returns Lowercase, trimmed email or null
 */
export function normalizeEmail(value: string): string | null {
  if (!value?.trim()) return null;
  return value.toLowerCase().trim();
}

/**
 * Normalizes an address
 * @param value - Address to normalize
 * @returns Trimmed address or null
 */
export function normalizeAddress(value: string): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

/**
 * Gets the icon path for a contact type
 * @param type - Contact type
 * @returns Icon path for the contact type
 */
export function getContactTypeIcon(type: ContactType): string {
  switch (type) {
    case 'email':
      return '/icons/envelope.svg';
    case 'phone':
      return '/icons/phone.svg';
    case 'address':
      return '/icons/mappin.and.ellipse.svg';
    default:
      return '/icons/note.svg';
  }
}

/**
 * Gets a human-readable label for a contact type
 * @param type - Contact type
 * @returns Display label for the contact type
 */
export function getContactTypeLabel(type: ContactType): string {
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
 * Formats a phone number for display (US format)
 * @param value - Phone number to format
 * @returns Formatted phone number for display
 */
export function formatPhoneForDisplay(value: string): string {
  if (!value?.trim()) return value;

  try {
    // Try parsing with US assumption for 10-digit numbers
    const digits = value.replace(/\D/g, '');
    let parsed;

    if (digits.length === 10) {
      parsed = parsePhoneNumber(value, 'US');
    } else {
      parsed = parsePhoneNumber(value);
    }

    if (parsed && parsed.number) {
      // Format as national format for US numbers, international for others
      if (parsed.country === 'US') {
        return parsed.formatNational();
      } else {
        return parsed.formatInternational();
      }
    }

    // Fallback to simple US formatting
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      const cleanDigits = digits.slice(1);
      return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
    }

    return value;
  } catch {
    // Final fallback to simple US formatting
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      const cleanDigits = digits.slice(1);
      return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
    }
    return value;
  }
}
