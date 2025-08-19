/**
 * Contact Normalization Utility
 *
 * Provides client-side contact normalization for email addresses, phone numbers, and addresses.
 * Matches backend normalization behavior using libphonenumber-js for E.164 phone formatting.
 *
 * This is the shared version that maintains backward compatibility with existing components.
 * For the full implementation, see '../contactNormalizer.ts'.
 */

// Re-export everything from the main contactNormalizer
export {
  normalizeContact,
  normalizePhone,
  normalizeEmail,
  normalizeAddress,
  formatPhoneForDisplay,
  getContactTypeIcon,
  getContactTypeLabel,
  type ContactType,
  type NormalizedContact,
} from '../contactNormalizer';
