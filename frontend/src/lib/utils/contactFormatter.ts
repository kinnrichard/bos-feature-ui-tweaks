/**
 * Contact Formatter Utility
 *
 * Provides display formatting for normalized contact methods.
 * Handles toll-free numbers, extensions, and user-friendly formatting.
 */

import { parsePhoneNumber } from 'libphonenumber-js';
import type { ContactMethodData } from '../models/types/contact-method-data';

/**
 * Toll-free area codes that should be formatted as 1-XXX-XXX-XXXX
 */
const TOLL_FREE_PATTERNS = ['800', '833', '844', '855', '866', '877', '888'];

/**
 * Style options for phone number formatting
 */
export type PhoneStyle = 'local' | 'international';

/**
 * Checks if a normalized phone number is toll-free
 * @param normalized - E.164 formatted phone number
 * @returns True if the number is toll-free
 */
export function isTollFree(normalized: string): boolean {
  if (!normalized?.startsWith('+1')) return false;

  // Extract the area code (characters 2-5 in +1XXXXXXXXXX)
  const areaCode = normalized.slice(2, 5);
  return TOLL_FREE_PATTERNS.includes(areaCode);
}

/**
 * Formats a normalized phone number for display
 * @param normalized - E.164 formatted phone number with optional comma-separated extension
 * @param style - Formatting style ('local' or 'international')
 * @returns User-friendly formatted phone number
 */
export function formatPhone(normalized: string, style: PhoneStyle = 'local'): string {
  if (!normalized?.trim()) return normalized || '';

  try {
    // Split normalized value and extension
    const [phoneNumber, extension] = normalized.split(',').map((part) => part.trim());

    // Parse the phone number
    const parsed = parsePhoneNumber(phoneNumber);
    if (!parsed || !parsed.number) {
      return normalized;
    }

    let formatted: string;

    // Check if it's a toll-free number
    if (isTollFree(phoneNumber)) {
      // Format toll-free as 1-XXX-XXX-XXXX
      const digits = phoneNumber.replace(/^\+1/, '');
      formatted = `1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (parsed.country === 'US' && style === 'local') {
      // Format US numbers as (XXX) XXX-XXXX for local style
      formatted = parsed.formatNational();
    } else {
      // Use international format for non-US numbers or international style
      formatted =
        style === 'international' ? parsed.formatInternational() : parsed.formatNational();
    }

    // Add extension if present
    if (extension) {
      formatted += ` ext. ${extension}`;
    }

    return formatted;
  } catch {
    // Fallback: return original normalized value
    return normalized;
  }
}

/**
 * Formats a normalized email address for display
 * @param normalized - Normalized email address
 * @returns Formatted email (currently just returns lowercase)
 */
export function formatEmail(normalized: string): string {
  if (!normalized?.trim()) return '';
  return normalized.toLowerCase();
}

/**
 * Formats an address for display
 * @param normalized - Normalized address
 * @returns Formatted address (currently just returns trimmed)
 */
export function formatAddress(normalized: string): string {
  if (!normalized?.trim()) return normalized || '';
  return normalized.trim();
}

/**
 * Formats a contact method for display using unified formatting
 * @param method - ContactMethod data object
 * @param style - Phone formatting style (optional)
 * @returns Formatted contact method value
 */
export function formatContactMethod(method: ContactMethodData, style?: PhoneStyle): string {
  if (!method?.normalized_value) return method?.value || '';

  switch (method.contact_type) {
    case 'phone':
      return formatPhone(method.normalized_value, style);
    case 'email':
      return formatEmail(method.normalized_value);
    case 'address':
      return formatAddress(method.normalized_value);
    default:
      return method.normalized_value;
  }
}

/**
 * Helper function to extract extension from a formatted phone number display
 * @param formatted - Formatted phone number that may contain extension
 * @returns Object with phone and extension parts
 */
export function parseFormattedPhone(formatted: string): { phone: string; extension?: string } {
  if (!formatted?.trim()) return { phone: '' };

  const extMatch = formatted.match(/^(.+?)\s+ext\.\s*(\d+)$/);
  if (extMatch) {
    return {
      phone: extMatch[1].trim(),
      extension: extMatch[2],
    };
  }

  return { phone: formatted.trim() };
}

/**
 * Determines if a phone number should use toll-free formatting based on display format
 * @param phoneNumber - Phone number to check (normalized or formatted)
 * @returns True if should use toll-free formatting
 */
export function shouldUseTollFreeFormat(phoneNumber: string): boolean {
  if (!phoneNumber) return false;

  // If it's already normalized (E.164), check directly
  if (phoneNumber.startsWith('+1')) {
    return isTollFree(phoneNumber);
  }

  // Extract digits and check if it matches toll-free pattern
  const digits = phoneNumber.replace(/\D/g, '');
  if (digits.length === 10) {
    const areaCode = digits.slice(0, 3);
    return TOLL_FREE_PATTERNS.includes(areaCode);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    return TOLL_FREE_PATTERNS.includes(areaCode);
  }

  return false;
}
