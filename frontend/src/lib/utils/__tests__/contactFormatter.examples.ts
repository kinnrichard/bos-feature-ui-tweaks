/**
 * Contact Formatter Usage Examples
 *
 * Demonstrates how to use the contactFormatter utility functions
 */

import { formatContactMethod, formatPhone, isTollFree } from '../contactFormatter';
import type { ContactMethodData } from '../../models/types/contact-method-data';

// Example usage of formatContactMethod
const examplePhoneMethod: ContactMethodData = {
  id: '1',
  contact_type: 'phone',
  normalized_value: '+18005551212,123', // E.164 with extension
  value: '(800) 555-1212 ext. 123',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const exampleRegularPhoneMethod: ContactMethodData = {
  id: '2',
  contact_type: 'phone',
  normalized_value: '+17275551212', // Regular US number
  value: '(727) 555-1212',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const exampleEmailMethod: ContactMethodData = {
  id: '3',
  contact_type: 'email',
  normalized_value: 'john.doe@example.com',
  value: 'John.Doe@Example.com',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

console.log('=== Contact Formatter Examples ===');

// Format toll-free number with extension
console.log('Toll-free with extension:', formatContactMethod(examplePhoneMethod));
// Output: "1-800-555-1212 ext. 123"

// Format regular US number
console.log('Regular US phone:', formatContactMethod(exampleRegularPhoneMethod));
// Output: "(727) 555-1212"

// Format email
console.log('Email:', formatContactMethod(exampleEmailMethod));
// Output: "john.doe@example.com"

// Direct phone formatting
console.log('Direct toll-free:', formatPhone('+18005551212'));
// Output: "1-800-555-1212"

console.log('Direct regular phone:', formatPhone('+17275551212'));
// Output: "(727) 555-1212"

console.log('Phone with extension:', formatPhone('+17275551212,456'));
// Output: "(727) 555-1212 ext. 456"

// International formatting
console.log('International style:', formatPhone('+17275551212', 'international'));
// Output: "+1 727 555 1212"

// Toll-free detection
console.log('Is +18005551212 toll-free?', isTollFree('+18005551212')); // true
console.log('Is +17275551212 toll-free?', isTollFree('+17275551212')); // false

export { examplePhoneMethod, exampleRegularPhoneMethod, exampleEmailMethod };
