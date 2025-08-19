# Contact Formatter Utility

A TypeScript utility for formatting normalized contact methods for display in the frontend.

## Features

- **Toll-free Number Detection**: Automatically detects and formats toll-free numbers (800, 833, 844, 855, 866, 877, 888) as `1-XXX-XXX-XXXX`
- **Extension Support**: Handles phone extensions in comma-separated format and displays as "ext. 123"
- **US Number Formatting**: Formats regular US numbers as `(XXX) XXX-XXXX`
- **International Support**: Gracefully handles international numbers with proper formatting
- **Type Safety**: Full TypeScript support with proper interfaces
- **Pure Functions**: No side effects, consistent input/output behavior

## Usage

### Basic Contact Method Formatting

```typescript
import { formatContactMethod } from '../utils/contactFormatter';
import type { ContactMethodData } from '../models/types/contact-method-data';

const phoneMethod: ContactMethodData = {
  id: '1',
  contact_type: 'phone',
  normalized_value: '+18005551212,123', // E.164 with extension
  value: '(800) 555-1212 ext. 123',
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};

const formatted = formatContactMethod(phoneMethod);
// Output: "1-800-555-1212 ext. 123"
```

### Direct Phone Formatting

```typescript
import { formatPhone } from '../utils/contactFormatter';

// Toll-free numbers
formatPhone('+18005551212');         // "1-800-555-1212"
formatPhone('+18885551212,123');     // "1-888-555-1212 ext. 123"

// Regular US numbers
formatPhone('+17275551212');         // "(727) 555-1212"
formatPhone('+17275551212,456');     // "(727) 555-1212 ext. 456"

// International formatting
formatPhone('+17275551212', 'international'); // "+1 727 555 1212"
```

### Toll-free Detection

```typescript
import { isTollFree, shouldUseTollFreeFormat } from '../utils/contactFormatter';

// Check normalized E.164 numbers
isTollFree('+18005551212');          // true
isTollFree('+17275551212');          // false

// Check various formats
shouldUseTollFreeFormat('8005551212');        // true
shouldUseTollFreeFormat('(800) 555-1212');   // true
shouldUseTollFreeFormat('1-800-555-1212');   // true
```

### Email and Address Formatting

```typescript
import { formatEmail, formatContactMethod } from '../utils/contactFormatter';

// Email formatting
formatEmail('Test@Example.COM');     // "test@example.com"

// Unified formatting
const emailMethod: ContactMethodData = {
  id: '1',
  contact_type: 'email',
  normalized_value: 'john@example.com',
  value: 'John@Example.com',
  // ... other fields
};

formatContactMethod(emailMethod);    // "john@example.com"
```

## API Reference

### `formatContactMethod(method, style?)`
- **method**: `ContactMethodData` - Contact method object with type and normalized value
- **style**: `'local' | 'international'` (optional) - Phone formatting style
- **Returns**: `string` - Formatted contact method for display

### `formatPhone(normalized, style?)`
- **normalized**: `string` - E.164 formatted phone with optional comma-separated extension
- **style**: `'local' | 'international'` (optional) - Formatting style
- **Returns**: `string` - User-friendly formatted phone number

### `formatEmail(normalized)`
- **normalized**: `string` - Normalized email address
- **Returns**: `string` - Lowercase formatted email

### `isTollFree(normalized)`
- **normalized**: `string` - E.164 formatted phone number
- **Returns**: `boolean` - True if number is toll-free

### `parseFormattedPhone(formatted)`
- **formatted**: `string` - Formatted phone number with possible extension
- **Returns**: `{ phone: string; extension?: string }` - Parsed components

## Supported Toll-free Area Codes

- 800, 833, 844, 855, 866, 877, 888

## Integration

The formatter works seamlessly with the existing `contactNormalizer` utility:

1. Use `contactNormalizer` to convert user input to E.164 format with extensions
2. Store normalized values in the database
3. Use `contactFormatter` to display normalized values in a user-friendly format

## Testing

Comprehensive test suite covers:
- Toll-free number detection and formatting
- Extension handling
- International number support
- Edge cases and error handling
- Integration with ContactMethodData types

Run tests with:
```bash
npm run test:vitest:run src/lib/utils/__tests__/contactFormatter.test.ts
```