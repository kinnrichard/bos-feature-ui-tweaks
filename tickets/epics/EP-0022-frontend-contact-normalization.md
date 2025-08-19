# EP-0022: Frontend Contact Normalization

## Overview
Implement client-side contact normalization in Svelte to automatically detect and format email addresses, phone numbers, and physical addresses before persisting to the frontend ActiveRecord layer. This ensures consistent data formatting at the point of entry without requiring backend changes for MVP.

## Problem Statement
Currently, contact normalization happens server-side in `contact_method.rb`, requiring a round-trip to the backend and providing no immediate user feedback. The frontend creates ContactMethod records with only `person_id` and `value`, leaving type detection and formatting to the backend. This creates several issues:
- No immediate user feedback on contact type detection
- Inconsistent data entry across the application
- Unnecessary backend processing for simple formatting tasks
- Frontend cannot display type-specific UI elements until after save

## Business Value
- **Instant user feedback**: Users see contact type detection and formatting in real-time
- **Data consistency**: All contacts normalized before persistence, ensuring uniform formatting
- **Reduced backend load**: Formatting happens client-side, reducing server processing
- **Better UX**: Dynamic placeholders and type indicators guide users during data entry
- **Frontend autonomy**: Frontend can make UI decisions based on detected contact types

## Solution: Client-Side Normalization Library

### 1. TypeScript Contact Normalizer Utility

#### Create Normalization Library
```typescript
// src/lib/utils/contactNormalizer.ts

export type ContactType = 'email' | 'phone' | 'address';

export interface NormalizedContact {
  contact_type: ContactType;
  formatted_value: string;
}

export function normalizeContact(value: string): NormalizedContact | null {
  if (!value?.trim()) return null;
  
  const trimmed = value.trim();
  
  // Email detection and normalization
  if (trimmed.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/i)) {
    return { 
      contact_type: 'email', 
      formatted_value: trimmed.toLowerCase() 
    };
  }
  
  // Phone detection and formatting (US format)
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10 || (digits.length === 11 && digits[0] === '1')) {
    const cleaned = digits.length === 11 ? digits.slice(1) : digits;
    if (cleaned.length === 10) {
      return {
        contact_type: 'phone',
        formatted_value: `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`
      };
    }
  }
  
  // Address as fallback
  return { 
    contact_type: 'address', 
    formatted_value: trimmed 
  };
}

// Helper function to get display icon for contact type
export function getContactTypeIcon(type: ContactType): string {
  switch (type) {
    case 'email': return '✉️';
    case 'phone': return '📱';
    case 'address': return '📍';
    default: return '📝';
  }
}
```

### 2. Update ContactMethod Model Interface

#### Extend Type Definition
```typescript
// src/lib/models/contact-method.ts

interface CreateContactMethodData {
  person_id: string;
  value: string;
  contact_type?: 'email' | 'phone' | 'address';  // New field
  formatted_value?: string;  // New field
}

// Ensure the model accepts these fields in create()
export class ContactMethod extends BaseModel {
  static async create(data: CreateContactMethodData) {
    // Existing create logic, now accepting normalized fields
  }
}
```

### 3. Integration in New Person Form

#### Update Form Component
```typescript
// src/routes/(authenticated)/clients/[id]/people/new/+page.svelte

// Add to imports
import { normalizeContact, type NormalizedContact } from '$lib/utils/contactNormalizer';

// Enhanced contact method interface
interface TempContactMethod {
  id: string;
  value: string;
  normalized?: NormalizedContact | null;  // Store normalization result
}

// Initialize with normalized field
let contactMethods = $state<TempContactMethod[]>([
  { id: crypto.randomUUID(), value: '', normalized: null },
  { id: crypto.randomUUID(), value: '', normalized: null },
]);

// Add normalization handler
function handleContactBlur(method: TempContactMethod) {
  method.normalized = normalizeContact(method.value);
}

// Update handleSubmit to use normalized data
async function handleSubmit(event?: Event) {
  // ... existing validation ...
  
  try {
    const newPerson = await Person.create(personData);
    
    // Create contact methods with normalized data
    const validContactMethods = contactMethods.filter((cm) => cm.value.trim());
    for (const cm of validContactMethods) {
      const normalized = cm.normalized || normalizeContact(cm.value);
      
      await ContactMethod.create({
        person_id: newPerson.id,
        value: cm.value.trim(),
        contact_type: normalized?.contact_type,
        formatted_value: normalized?.formatted_value || cm.value.trim(),
      });
    }
    
    // ... rest of submission logic ...
  }
}
```

#### Update Template with Type Indicators
```svelte
<!-- Contact Methods Section -->
<div class="contact-methods">
  {#each contactMethods as method, index (method.id)}
    <div class="contact-method">
      <ChromelessInput
        bind:value={method.value}
        placeholder={
          index === 0 
            ? 'Email or phone' 
            : 'Address or other contact method'
        }
        customClass="contact-input"
        type="text"
        ariaLabel={`Contact method ${index + 1}`}
        onblur={() => handleContactBlur(method)}
      />
      
      {#if method.normalized}
        <span class="contact-type-indicator" title={method.normalized.contact_type}>
          {#if method.normalized.contact_type === 'email'}
            <img src="/icons/envelope.svg" alt="Email" width="16" height="16" />
          {:else if method.normalized.contact_type === 'phone'}
            <img src="/icons/phone.svg" alt="Phone" width="16" height="16" />
          {:else}
            <img src="/icons/location.svg" alt="Address" width="16" height="16" />
          {/if}
        </span>
      {/if}
      
      <CircularButton
        iconSrc={TrashIcon}
        size="small"
        variant="danger"
        onclick={() => removeContactMethod(method.id)}
        title="Remove contact method"
        disabled={contactMethods.length <= 2}
      />
    </div>
  {/each}
  
  <!-- ... add button ... -->
</div>
```

### 4. Styling for Type Indicators

#### Add CSS for Visual Feedback
```css
/* Add to component styles */
.contact-type-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 8px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.contact-type-indicator:hover {
  opacity: 1;
}

.contact-type-indicator img {
  filter: var(--icon-filter, none);
}

/* Update contact-method to accommodate indicator */
.contact-method {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
```

## Testing Strategy

### Unit Tests for Normalizer
```typescript
// src/lib/utils/__tests__/contactNormalizer.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeContact } from '../contactNormalizer';

describe('contactNormalizer', () => {
  describe('email normalization', () => {
    it('should detect and lowercase emails', () => {
      const result = normalizeContact('TEST@EXAMPLE.COM');
      expect(result).toEqual({
        contact_type: 'email',
        formatted_value: 'test@example.com'
      });
    });
    
    it('should trim whitespace from emails', () => {
      const result = normalizeContact('  user@example.com  ');
      expect(result).toEqual({
        contact_type: 'email',
        formatted_value: 'user@example.com'
      });
    });
  });
  
  describe('phone normalization', () => {
    it('should format 10-digit US phones', () => {
      const result = normalizeContact('8123213123');
      expect(result).toEqual({
        contact_type: 'phone',
        formatted_value: '(812) 321-3123'
      });
    });
    
    it('should handle phones with formatting', () => {
      const result = normalizeContact('812-321-3123');
      expect(result).toEqual({
        contact_type: 'phone',
        formatted_value: '(812) 321-3123'
      });
    });
    
    it('should strip US country code', () => {
      const result = normalizeContact('18123213123');
      expect(result).toEqual({
        contact_type: 'phone',
        formatted_value: '(812) 321-3123'
      });
    });
  });
  
  describe('address handling', () => {
    it('should detect addresses as fallback', () => {
      const result = normalizeContact('123 Main St, Anytown USA');
      expect(result).toEqual({
        contact_type: 'address',
        formatted_value: '123 Main St, Anytown USA'
      });
    });
  });
  
  describe('edge cases', () => {
    it('should return null for empty input', () => {
      expect(normalizeContact('')).toBeNull();
      expect(normalizeContact('  ')).toBeNull();
    });
  });
});
```

## Implementation Steps

1. **Create normalizer utility** (1 hour)
   - Implement `contactNormalizer.ts` with TypeScript types
   - Add helper functions for UI display

2. **Update ContactMethod model** (30 minutes)
   - Extend type definitions
   - Ensure backend accepts new fields

3. **Integrate into new person form** (2 hours)
   - Import normalizer
   - Add blur handlers
   - Update submission logic
   - Add type indicators

4. **Add visual feedback** (1 hour)
   - Style type indicators
     - phone.svg, envelope.svg, and mappin.and.ellipse.svg for phone, email, and address
   - Ensure responsive design
   - Test with existing themes

5. **Write tests** (1 hour)
   - Unit tests for normalizer
   - Integration tests for form
   - Verify data persistence

## Success Criteria
- [ ] Contact types detected on blur in new person form
- [ ] Visual indicators show detected type
- [ ] Phone numbers formatted consistently as (XXX) XXX-XXXX
- [ ] Emails normalized to lowercase
- [ ] Addresses accepted as fallback
- [ ] Data persists correctly to backend with type and formatted_value
- [ ] All tests passing
- [ ] No regression in existing functionality

## MVP Scope Limitations
- US phone numbers only (10/11 digits)
- Basic email regex validation
- No external validation services
- No internationalization
- Address is simple text fallback
- Only implemented in new person form (not edit forms)

## Future Enhancements (Out of Scope)
- International phone number support (libphonenumber-js)
- Email deliverability verification
- Address autocomplete and validation
- Edit form integration
- Bulk contact import with normalization
- Contact preference management
- Custom formatting rules per client

## Dependencies
- TypeScript support in project
- Existing ChromelessInput component
- ContactMethod model accepting new fields
- Icons for type indicators

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Backend rejection of new fields | High | Verify API accepts contact_type and formatted_value fields |
| Incorrect phone formatting | Medium | Comprehensive test coverage, US-only for MVP |
| Performance impact on large forms | Low | Normalization only on blur, not on every keystroke |
| User confusion about formatting | Low | Clear visual indicators and consistent behavior |

## Estimated Effort
- **Total**: 5-6 hours
- **Development**: 4 hours
- **Testing**: 1 hour  
- **Integration & QA**: 1 hour

## Definition of Done
- [ ] Normalizer utility created with TypeScript types
- [ ] New person form uses normalization on blur
- [ ] Type indicators display correctly
- [ ] ContactMethod.create() accepts and persists normalized fields
- [ ] Unit tests for normalizer passing
- [ ] Integration tested in development environment
- [ ] No console errors or warnings
- [ ] Code reviewed and approved
- [ ] Deployed to staging for UAT