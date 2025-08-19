# Epic: Normalize Contact Methods and Link Front Data (v2)

## Problem Statement

We need to efficiently link Front conversations and messages to our internal People and Clients data. Currently:
- ContactMethod stores display-formatted values that don't match Front's normalized format
- No efficient way to join FrontMessageRecipient → Person → Client without N+1 queries
- Display formatting is stored in the database instead of being a frontend concern
- Frontend and backend use different normalization formats causing inconsistencies
- No support for phone extensions which are common in business environments
- As the dataset grows (40k+ conversations), performance becomes critical

## Solution Overview

Add a `normalized_value` column to ContactMethod that stores canonical formats (E.164 for phones with extension support, lowercase for emails) to enable efficient indexed joins with Front data. Use consistent normalization libraries across frontend and backend to ensure data integrity.

## Success Criteria

- [ ] Front conversations can be efficiently linked to clients via ContactMethod
- [ ] Front message recipients can be linked to people without N+1 queries
- [ ] Display formatting moved to frontend with proper toll-free and extension handling
- [ ] All queries using these relationships complete in <50ms for lists of 100 items
- [ ] Zero.js sync continues to work with new associations
- [ ] Phone numbers with extensions are properly supported and validated
- [ ] Frontend and backend produce identical normalized values
- [ ] Duplicate contact methods are detected and reported before validation is added

## Technical Approach

### Key Insights
1. **Front data is already normalized** - phones are in E.164 format (+17272727272), emails are lowercase
2. **Rails supports associations on any columns** - not just foreign keys
3. **Display formatting belongs in frontend** - database should store canonical data
4. **Extensions need special handling** - Store as `+15555555555,123` for uniqueness
5. **Consistent libraries ensure compatibility** - phonelib (Ruby) and libphonenumber-js (JS) use same data source

### Architecture Decisions
- Use `normalized_value` as the join column between ContactMethod and Front tables
- Keep `value` column for original user input (for editing)
- Move all display formatting to frontend utilities with toll-free detection
- Use Rails associations with `primary_key`/`foreign_key` options for clean queries
- No data duplication - no foreign keys added to Front tables
- Support extensions with comma separator in normalized format

## Implementation Tasks

### Task 1: Add phonelib gem and normalized_value column
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] Phonelib gem added to Gemfile
- [ ] Migration adds `normalized_value` column with index (nullable initially)
- [ ] Compound index on `[normalized_value, contact_type]` for efficient lookups
- [ ] Column allows null for safe migration period

**Implementation**:
```ruby
# Gemfile
gem 'phonelib'

# config/initializers/phonelib.rb
Phonelib.default_country = "US"
Phonelib.extension_separator = ","

# Migration
class AddNormalizedValueToContactMethods < ActiveRecord::Migration[7.0]
  def change
    add_column :contact_methods, :normalized_value, :string
    add_index :contact_methods, :normalized_value
    add_index :contact_methods, [:normalized_value, :contact_type]
  end
end
```

### Task 2: Implement normalization logic with extension support
**Priority**: High  
**Estimate**: 4 hours

**Acceptance Criteria**:
- [ ] Phone numbers normalized to E.164 format with extensions (+17272727272,123)
- [ ] Emails normalized to lowercase, trimmed
- [ ] Addresses stored as-is in normalized_value
- [ ] Normalization happens in before_validation callback
- [ ] Class method available for external normalization
- [ ] Handles international phone numbers correctly

**Implementation**:
```ruby
# app/models/contact_method.rb
class ContactMethod < ApplicationRecord
  before_validation :detect_and_format_type, :normalize_value
  
  # Uniqueness validation per person including extensions
  validates :normalized_value, uniqueness: { 
    scope: [:person_id, :contact_type],
    message: "This contact method already exists for this person"
  }, allow_nil: true # Will be removed after backfill
  
  def self.normalize(value, type = nil)
    type ||= detect_type(value)
    case type
    when :phone
      normalize_phone(value)
    when :email
      value.downcase.strip
    else
      value
    end
  end
  
  private
  
  def normalize_value
    self.normalized_value = case contact_type
    when 'phone'
      self.class.normalize_phone(value)
    when 'email'
      value.downcase.strip
    else
      value
    end
  end
  
  def self.normalize_phone(value)
    return nil if value.blank?
    
    # Parse with phonelib
    phone = Phonelib.parse(value)
    
    # If valid, return E.164 with extension if present
    if phone.valid?
      normalized = phone.e164
      if phone.extension.present?
        normalized += ",#{phone.extension}"
      end
      normalized
    else
      # Fallback for invalid numbers - store as-is
      # This will be categorized as 'address' in detect_and_format_type
      nil
    end
  end
  
  def detect_and_format_type
    return unless value.present?
    
    # Check if it's an email
    if value.match?(/\A[^@\s]+@[^@\s]+\z/)
      self.contact_type = :email
    # Check if it's a valid phone number using phonelib
    elsif Phonelib.valid?(value)
      self.contact_type = :phone
    else
      self.contact_type = :address
    end
  end
end
```

### Task 3: Detect and report duplicates
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] Script identifies all duplicate contact methods per person
- [ ] Report generated in CSV format for CTO review
- [ ] Includes person name, contact type, values, and IDs
- [ ] Safe to run multiple times

**Implementation**:
```ruby
# lib/tasks/contact_methods.rake
namespace :contact_methods do
  desc "Detect duplicate contact methods per person"
  task detect_duplicates: :environment do
    require 'csv'
    
    duplicates = []
    
    # First, normalize all values in memory to detect duplicates
    ContactMethod.includes(:person).find_each do |cm|
      normalized = ContactMethod.normalize(cm.value, cm.contact_type.to_sym)
      next unless normalized
      
      # Find other contact methods for same person with same normalized value
      same_person_cms = ContactMethod
        .where(person_id: cm.person_id, contact_type: cm.contact_type)
        .where.not(id: cm.id)
      
      same_person_cms.each do |other_cm|
        other_normalized = ContactMethod.normalize(other_cm.value, other_cm.contact_type.to_sym)
        if normalized == other_normalized
          duplicates << {
            person_id: cm.person_id,
            person_name: cm.person&.full_name,
            contact_type: cm.contact_type,
            value1: cm.value,
            value2: other_cm.value,
            normalized: normalized,
            id1: cm.id,
            id2: other_cm.id
          }
        end
      end
    end
    
    # Remove duplicate entries from the report
    duplicates.uniq! { |d| [d[:id1], d[:id2]].sort }
    
    # Generate CSV report
    if duplicates.any?
      CSV.open("tmp/duplicate_contact_methods_#{Date.today}.csv", "wb") do |csv|
        csv << duplicates.first.keys
        duplicates.each { |d| csv << d.values }
      end
      
      puts "Found #{duplicates.size} duplicate contact methods"
      puts "Report saved to tmp/duplicate_contact_methods_#{Date.today}.csv"
      puts "Please review with CTO before proceeding with migration"
    else
      puts "No duplicate contact methods found"
    end
  end
end
```

### Task 4: Backfill existing contact methods (after duplicate review)
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] All existing ContactMethod records have normalized_value populated
- [ ] Backfill handles US and international phone numbers correctly
- [ ] Extensions preserved if present in original data
- [ ] Emails are lowercased and trimmed
- [ ] Can be run multiple times safely (idempotent)
- [ ] Progress reporting for large datasets

**Implementation**:
```ruby
# lib/tasks/contact_methods.rake
namespace :contact_methods do
  desc "Backfill normalized_value for existing contact methods"
  task backfill_normalized: :environment do
    total = ContactMethod.count
    processed = 0
    failed = []
    
    ContactMethod.find_in_batches(batch_size: 500) do |batch|
      batch.each do |cm|
        begin
          # Use the model's normalization logic
          cm.send(:normalize_value)
          
          if cm.normalized_value_changed?
            cm.save!(validate: true) # Run validations to catch issues
          end
          
          processed += 1
          print '.' if processed % 100 == 0
        rescue => e
          failed << { id: cm.id, value: cm.value, error: e.message }
          print 'F'
        end
      end
    end
    
    puts "\n\nBackfill Summary:"
    puts "Total: #{total}"
    puts "Processed: #{processed}"
    puts "Failed: #{failed.size}"
    
    if failed.any?
      puts "\nFailed records:"
      failed.each do |f|
        puts "  ID: #{f[:id]}, Value: #{f[:value]}, Error: #{f[:error]}"
      end
    end
  end
  
  desc "Add NOT NULL constraint after backfill"
  task add_not_null_constraint: :environment do
    # Verify all records have normalized_value
    without_normalized = ContactMethod.where(normalized_value: nil).count
    
    if without_normalized > 0
      puts "ERROR: #{without_normalized} records still have null normalized_value"
      puts "Run backfill_normalized task first"
      exit 1
    end
    
    # Add NOT NULL constraint
    ActiveRecord::Base.connection.execute(
      "ALTER TABLE contact_methods ALTER COLUMN normalized_value SET NOT NULL"
    )
    
    puts "Successfully added NOT NULL constraint to normalized_value"
  end
end
```

### Task 5: Create Rails associations for Front data
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] FrontConversation can access person and client through contact_method
- [ ] FrontMessageRecipient can access person through contact_method
- [ ] Associations use normalized_value for joining
- [ ] includes() works to prevent N+1 queries
- [ ] Extensions handled correctly in lookups

**Implementation**:
```ruby
# app/models/front_conversation.rb
class FrontConversation < ApplicationRecord
  belongs_to :matched_contact,
             -> { where(contact_type: ['phone', 'email']) },
             class_name: 'ContactMethod',
             primary_key: :normalized_value,
             foreign_key: :recipient_handle,
             optional: true
  
  has_one :person, through: :matched_contact
  has_one :client, through: :person
  
  scope :with_client_data, -> { includes(:matched_contact, person: :client) }
end

# app/models/front_message_recipient.rb
class FrontMessageRecipient < ApplicationRecord
  belongs_to :matched_contact,
             -> { where(contact_type: ['phone', 'email']) },
             class_name: 'ContactMethod',
             primary_key: :normalized_value,
             foreign_key: :handle,
             optional: true
  
  has_one :person, through: :matched_contact
  
  scope :with_person_data, -> { includes(:matched_contact, :person) }
end

# app/models/contact_method.rb
class ContactMethod < ApplicationRecord
  has_many :front_conversations,
           primary_key: :normalized_value,
           foreign_key: :recipient_handle
  
  has_many :front_message_recipients,
           primary_key: :normalized_value,
           foreign_key: :handle
end
```

### Task 6: Add libphonenumber-js and update frontend normalization
**Priority**: Medium  
**Estimate**: 3 hours

**Acceptance Criteria**:
- [ ] libphonenumber-js added to package.json
- [ ] Normalizer outputs E.164 format matching backend
- [ ] Extension support in normalization
- [ ] TypeScript types included
- [ ] All existing tests pass

**Implementation**:
```typescript
// package.json
{
  "dependencies": {
    "libphonenumber-js": "^1.10.51"
  }
}

// frontend/src/lib/utils/contactNormalizer.ts
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export interface NormalizedContact {
  value: string;
  normalized_value: string | null;
  contact_type: 'phone' | 'email' | 'address';
}

export function normalizeContact(value: string): NormalizedContact {
  if (!value) {
    return { value, normalized_value: null, contact_type: 'address' };
  }
  
  const trimmed = value.trim();
  
  // Check if it's an email
  if (/^[^@\s]+@[^@\s]+$/.test(trimmed)) {
    return {
      value: trimmed,
      normalized_value: trimmed.toLowerCase(),
      contact_type: 'email'
    };
  }
  
  // Try to parse as phone number
  try {
    // Check for extension (anything after 'ext', 'x', or comma)
    const extensionMatch = trimmed.match(/(?:ext\.?|x|,)\s*(\d+)$/i);
    const extension = extensionMatch ? extensionMatch[1] : null;
    const phoneValue = extension ? trimmed.replace(extensionMatch[0], '') : trimmed;
    
    if (isValidPhoneNumber(phoneValue, 'US')) {
      const parsed = parsePhoneNumber(phoneValue, 'US');
      let normalized = parsed.format('E.164');
      
      // Add extension if present
      if (extension) {
        normalized += `,${extension}`;
      }
      
      return {
        value: trimmed,
        normalized_value: normalized,
        contact_type: 'phone'
      };
    }
  } catch (e) {
    // Not a valid phone number
  }
  
  // Default to address
  return {
    value: trimmed,
    normalized_value: trimmed,
    contact_type: 'address'
  };
}

// Ensure backend compatibility
export function normalizePhone(value: string): string | null {
  const result = normalizeContact(value);
  return result.contact_type === 'phone' ? result.normalized_value : null;
}

export function normalizeEmail(value: string): string | null {
  const result = normalizeContact(value);
  return result.contact_type === 'email' ? result.normalized_value : null;
}
```

### Task 7: Create frontend formatting utilities with toll-free support
**Priority**: Medium  
**Estimate**: 3 hours

**Acceptance Criteria**:
- [ ] Phone formatter handles US numbers with extensions
- [ ] Toll-free numbers display with 1- prefix (1-800-555-1212)
- [ ] International numbers handled gracefully
- [ ] Email formatter for consistency
- [ ] TypeScript types included
- [ ] Pure functions with no side effects

**Implementation**:
```typescript
// frontend/src/lib/utils/contactFormatter.ts
import { parsePhoneNumber, ParseError } from 'libphonenumber-js';

// Toll-free area codes (8XX with repeating digits)
const TOLL_FREE_PATTERNS = ['800', '833', '844', '855', '866', '877', '888'];

export function formatPhone(
  normalized: string, 
  style: 'local' | 'international' = 'local'
): string {
  if (!normalized || !normalized.startsWith('+')) return normalized || '';
  
  // Extract extension if present
  const [phoneNumber, extension] = normalized.split(',');
  
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    
    if (parsed.country === 'US') {
      const nationalNumber = parsed.nationalNumber;
      const areaCode = nationalNumber.substring(0, 3);
      const prefix = nationalNumber.substring(3, 6);
      const lineNumber = nationalNumber.substring(6, 10);
      
      let formatted: string;
      
      // Check if toll-free
      if (TOLL_FREE_PATTERNS.includes(areaCode)) {
        formatted = `1-${areaCode}-${prefix}-${lineNumber}`;
      } else if (style === 'local') {
        formatted = `(${areaCode}) ${prefix}-${lineNumber}`;
      } else {
        formatted = `+1 ${areaCode}-${prefix}-${lineNumber}`;
      }
      
      // Add extension if present
      if (extension) {
        formatted += ` ext. ${extension}`;
      }
      
      return formatted;
    } else {
      // International number - try to format in national format
      try {
        let formatted = parsed.formatNational();
        if (extension) {
          formatted += ` ext. ${extension}`;
        }
        return formatted;
      } catch {
        // Fallback to E.164 if national format fails
        return normalized;
      }
    }
  } catch (e) {
    // Return as-is if parsing fails
    return normalized;
  }
}

export function formatEmail(normalized: string): string {
  return normalized?.toLowerCase() || '';
}

export function formatContactMethod(method: {
  contact_type: string;
  normalized_value?: string;
  value: string;
}): string {
  if (!method.normalized_value) return method.value;
  
  switch (method.contact_type) {
    case 'phone':
      return formatPhone(method.normalized_value);
    case 'email':
      return formatEmail(method.normalized_value);
    default:
      return method.value;
  }
}

// Helper to detect if a formatted number is toll-free
export function isTollFree(normalized: string): boolean {
  if (!normalized || !normalized.startsWith('+1')) return false;
  
  const areaCode = normalized.substring(2, 5);
  return TOLL_FREE_PATTERNS.includes(areaCode);
}
```

### Task 8: Update UI components to use formatters
**Priority**: Medium  
**Estimate**: 3 hours

**Acceptance Criteria**:
- [ ] All places displaying contact methods use the formatter
- [ ] Remove dependency on formatted_value from frontend
- [ ] Consistent display across the application
- [ ] No hardcoded formatting in components
- [ ] Toll-free numbers display correctly

**Files to update**:
- Components displaying person contact information
- Client detail views
- Conversation views showing recipients
- Any reports or exports

### Task 9: Remove formatted_value column
**Priority**: Low  
**Estimate**: 1 hour

**Acceptance Criteria**:
- [ ] Verify frontend no longer uses formatted_value
- [ ] Remove column from database
- [ ] Zero.js auto-updates to remove field
- [ ] Update any API documentation

**Implementation**:
```ruby
# After confirming everything works
class RemoveFormattedValueFromContactMethods < ActiveRecord::Migration[7.0]
  def change
    remove_column :contact_methods, :formatted_value, :string
  end
end
```

## Testing Requirements

### Unit Tests

**Backend (Ruby)**:
```ruby
# test/models/contact_method_test.rb
class ContactMethodTest < ActiveSupport::TestCase
  test "normalizes US phone numbers to E.164" do
    cm = ContactMethod.new(value: "(727) 272-7272")
    cm.send(:normalize_value)
    assert_equal "+17272727272", cm.normalized_value
  end
  
  test "handles phone extensions" do
    cm = ContactMethod.new(value: "727-272-7272 ext 123")
    cm.send(:normalize_value)
    assert_equal "+17272727272,123", cm.normalized_value
  end
  
  test "normalizes international numbers" do
    cm = ContactMethod.new(value: "+44 20 7123 4567")
    cm.send(:normalize_value)
    assert_equal "+442071234567", cm.normalized_value
  end
  
  test "handles malformed numbers gracefully" do
    cm = ContactMethod.new(value: "not a phone")
    cm.send(:detect_and_format_type)
    assert_equal "address", cm.contact_type
  end
  
  test "validates uniqueness including extensions" do
    person = create(:person)
    create(:contact_method, person: person, normalized_value: "+17272727272,123")
    
    duplicate = build(:contact_method, person: person, normalized_value: "+17272727272,123")
    assert_not duplicate.valid?
    
    different_ext = build(:contact_method, person: person, normalized_value: "+17272727272,456")
    assert different_ext.valid?
  end
end
```

**Frontend (TypeScript)**:
```typescript
// frontend/src/lib/utils/__tests__/contactNormalizer.test.ts
describe('Contact Normalization', () => {
  test('normalizes US phones to E.164', () => {
    expect(normalizePhone('(727) 272-7272')).toBe('+17272727272');
    expect(normalizePhone('727.272.7272')).toBe('+17272727272');
    expect(normalizePhone('1-727-272-7272')).toBe('+17272727272');
  });
  
  test('handles extensions', () => {
    expect(normalizePhone('727-272-7272 ext 123')).toBe('+17272727272,123');
    expect(normalizePhone('727-272-7272 x456')).toBe('+17272727272,456');
    expect(normalizePhone('727-272-7272,789')).toBe('+17272727272,789');
  });
  
  test('formats toll-free numbers', () => {
    expect(formatPhone('+18005551212')).toBe('1-800-555-1212');
    expect(formatPhone('+18885551212')).toBe('1-888-555-1212');
    expect(formatPhone('+18445551212')).toBe('1-844-555-1212');
  });
  
  test('formats extensions', () => {
    expect(formatPhone('+17272727272,123')).toBe('(727) 272-7272 ext. 123');
    expect(formatPhone('+18005551212,456')).toBe('1-800-555-1212 ext. 456');
  });
});
```

### Integration Tests
- FrontConversation → Client association queries
- FrontMessageRecipient → Person association queries  
- N+1 query prevention with includes()
- Extension-based lookups work correctly

### Performance Tests
- Query time for 100 conversations with client data: <50ms
- Query time for 1000 message recipients with people: <100ms
- Backfill script on 10k contact methods: <60 seconds
- Association lookups with extensions maintain performance

### Edge Case Tests
- Malformed phone numbers → categorized as address
- Special characters in emails → normalized correctly
- International numbers without country code → handled gracefully
- Very long extensions → stored properly
- Concurrent updates → uniqueness validation enforced

## Rollback Plan

If issues arise:
1. Frontend can temporarily use `value` field for display
2. Associations are optional, so missing links won't break queries
3. normalized_value column can be dropped without affecting existing functionality
4. Keep formatted_value column until Phase 4 completion

## Dependencies

- Backend: `phonelib` gem
- Frontend: `libphonenumber-js` npm package
- Must coordinate with frontend team on formatter rollout
- CTO review required for duplicate contact methods before adding uniqueness validation

## Success Metrics

- **Performance**: 90% reduction in query time for conversation lists with client data
- **Maintainability**: Display logic centralized in formatter utilities
- **Data Quality**: 100% of contact methods have normalized values
- **Consistency**: Frontend and backend produce identical E.164 outputs
- **Developer Experience**: Can use standard Rails includes() for all queries
- **Business Value**: Support for phone extensions enables proper B2B contact management

## Timeline

### Week 1: Backend Foundation
- Days 1-2: Add phonelib, create migration, implement normalization
- Days 3-4: Detect duplicates, CTO review
- Day 5: Run backfill after duplicate resolution

### Week 2: Backend Completion  
- Days 1-2: Add validations and NOT NULL constraint
- Days 3-4: Create and test Rails associations
- Day 5: Performance testing and optimization

### Week 3: Frontend Updates
- Days 1-2: Add libphonenumber-js, update normalizer
- Days 3-4: Implement formatters with toll-free support
- Day 5: Update all UI components

### Week 4: Cleanup & Monitoring
- Days 1-2: Remove formatted_value column
- Days 3-4: Production monitoring and optimization
- Day 5: Documentation and knowledge transfer

## Notes

- Phone extension support is critical for B2B use cases
- Toll-free number formatting improves professional appearance
- Using same data source (Google's libphonenumber) ensures consistency
- Phased approach with nullable column reduces risk
- Duplicate detection prevents data integrity issues
- Frontend gains flexibility to format based on user locale/preferences