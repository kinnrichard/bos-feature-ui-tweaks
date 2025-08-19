/**
 * Example of how to properly use the contact normalization functions
 *
 * This example shows the correct way to normalize email addresses
 * and handle the results.
 */

import { normalizeContact, normalizeEmail } from './contactNormalizer';

// Example 1: Using normalizeContact (auto-detects contact type)
export function exampleNormalizeContact() {
  const userInput = 'USER@EXAMPLE.COM';

  // Call normalizeContact - it will auto-detect the type
  const result = normalizeContact(userInput);

  if (result) {
    console.log('Original value:', result.value); // 'USER@EXAMPLE.COM'
    console.log('Normalized:', result.normalized_value); // 'user@example.com'
    console.log('Type:', result.contact_type); // 'email'
  } else {
    console.log('Invalid or empty input');
  }

  return result;
}

// Example 2: Using normalizeEmail directly (if you know it's an email)
export function exampleNormalizeEmail() {
  const userInput = '  Test@Domain.ORG  ';

  // Call normalizeEmail directly
  const normalized = normalizeEmail(userInput);

  if (normalized) {
    console.log('Normalized email:', normalized); // 'test@domain.org'
  } else {
    console.log('Invalid or empty email');
  }

  return normalized;
}

// Example 3: Handling in a form component
export function handleContactInput(value: string) {
  // Normalize the contact
  const normalized = normalizeContact(value);

  if (!normalized) {
    // Handle empty input
    return {
      isValid: false,
      error: 'Please enter a contact method',
    };
  }

  // Check the type and handle accordingly
  switch (normalized.contact_type) {
    case 'email':
      return {
        isValid: true,
        type: 'email',
        value: normalized.normalized_value,
        displayValue: normalized.value,
      };

    case 'phone':
      return {
        isValid: true,
        type: 'phone',
        value: normalized.normalized_value,
        displayValue: normalized.value,
      };

    case 'address':
      return {
        isValid: true,
        type: 'address',
        value: normalized.normalized_value,
        displayValue: normalized.value,
      };
  }
}

// Example 4: Common mistake - using wrong function name
export function commonMistake() {
  const userInput = 'user@example.com';

  // WRONG - this function doesn't exist
  // const result = normalizeContactMethod(userInput);  // ❌ This will throw an error

  // CORRECT - use normalizeContact
  const result = normalizeContact(userInput); // ✅ This works

  return result;
}
