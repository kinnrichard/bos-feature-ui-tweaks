# Epic: Normalize Contact Methods and Link Front Data

## Problem Statement

We need to efficiently link Front conversations and messages to our internal People and Clients data. Currently:
- ContactMethod stores display-formatted values that don't match Front's normalized format
- No efficient way to join FrontMessageRecipient → Person → Client without N+1 queries
- Display formatting is stored in the database instead of being a frontend concern
- As the dataset grows (40k+ conversations), performance becomes critical

## Solution Overview

Add a `normalized_value` column to ContactMethod that stores canonical formats (E.164 for phones, lowercase for emails) to enable efficient indexed joins with Front data, which already stores normalized values.

## Success Criteria

- [ ] Front conversations can be efficiently linked to clients via ContactMethod
- [ ] Front message recipients can be linked to people without N+1 queries
- [ ] Display formatting moved to frontend (separation of concerns)
- [ ] All queries using these relationships complete in <50ms for lists of 100 items
- [ ] Zero.js sync continues to work with new associations

## Technical Approach

### Key Insights
1. **Front data is already normalized** - phones are in E.164 format (+17272727272), emails are lowercase
2. **Rails supports associations on any columns** - not just foreign keys
3. **Display formatting belongs in frontend** - database should store canonical data
4. **Single source of truth** - ContactMethod remains the authoritative link between handles and people

### Architecture Decisions
- Use `normalized_value` as the join column between ContactMethod and Front tables
- Keep `value` column for original user input (for editing)
- Move all display formatting to frontend utilities
- Use Rails associations with `primary_key`/`foreign_key` options for clean queries
- No data duplication - no foreign keys added to Front tables

## Implementation Tasks

### Task 1: Add normalized_value to ContactMethod
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] Migration adds `normalized_value` column with index
- [ ] Compound index on `[normalized_value, contact_type]` for efficient lookups
- [ ] Column allows null for migration period

**Implementation**:
```ruby
class AddNormalizedValueToContactMethods < ActiveRecord::Migration[7.0]
  def change
    add_column :contact_methods, :normalized_value, :string
    add_index :contact_methods, :normalized_value
    add_index :contact_methods, [:normalized_value, :contact_type]
  end
end
```

### Task 2: Implement normalization logic
**Priority**: High  
**Estimate**: 3 hours

**Acceptance Criteria**:
- [ ] Phone numbers normalized to E.164 format (+17272727272)
- [ ] Emails normalized to lowercase, trimmed
- [ ] Addresses stored as-is in normalized_value
- [ ] Normalization happens in before_validation callback
- [ ] Class method available for external normalization

**Implementation**:
```ruby
# app/models/contact_method.rb
class ContactMethod < ApplicationRecord
  before_validation :detect_and_format_type, :normalize_value
  
  def self.normalize(value, type = nil)
    # Class method for external use
    case type || detect_type(value)
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
    digits = value.gsub(/\D/, '')
    return nil if digits.blank?
    
    if digits.length == 10
      "+1#{digits}"
    elsif digits.length == 11 && digits[0] == '1'
      "+#{digits}"
    else
      # Non-US phone number, store as-is with +
      "+#{digits}"
    end
  end
end
```

### Task 3: Backfill existing contact methods
**Priority**: High  
**Estimate**: 1 hour

**Acceptance Criteria**:
- [ ] All existing ContactMethod records have normalized_value populated
- [ ] Backfill handles US phone numbers correctly
- [ ] Emails are lowercased and trimmed
- [ ] Can be run multiple times safely (idempotent)

**Implementation**:
```ruby
# lib/tasks/contact_methods.rake
namespace :contact_methods do
  desc "Backfill normalized_value for existing contact methods"
  task backfill_normalized: :environment do
    ContactMethod.find_each do |cm|
      cm.send(:normalize_value)
      cm.save!(validate: false) if cm.normalized_value_changed?
      print '.'
    end
    puts "\nBackfilled #{ContactMethod.count} contact methods"
  end
end
```

### Task 4: Create Rails associations for Front data
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] FrontConversation can access person and client through contact_method
- [ ] FrontMessageRecipient can access person through contact_method
- [ ] Associations use normalized_value for joining
- [ ] includes() works to prevent N+1 queries

**Implementation**:
```ruby
# app/models/front_conversation.rb
class FrontConversation < ApplicationRecord
  belongs_to :matched_contact,
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

### Task 5: Create frontend formatting utilities
**Priority**: Medium  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] Phone formatter handles US numbers (10 and 11 digit)
- [ ] Phone formatter has local and international display modes
- [ ] Email formatter (mainly for consistency)
- [ ] Utilities are pure functions (no side effects)
- [ ] TypeScript types included

**Implementation**:
```typescript
// frontend/src/lib/utils/contact-formatting.ts
export function formatPhone(
  normalized: string, 
  style: 'local' | 'international' = 'local'
): string {
  if (!normalized || !normalized.startsWith('+')) return normalized || '';
  
  const digits = normalized.replace(/\D/g, '');
  
  // US phone number formatting
  if (digits.startsWith('1') && digits.length === 11) {
    const areaCode = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const lineNumber = digits.slice(7, 11);
    
    if (style === 'local') {
      return `(${areaCode}) ${prefix}-${lineNumber}`;
    } else {
      return `+1 ${areaCode}-${prefix}-${lineNumber}`;
    }
  }
  
  // Non-US or invalid format, return as-is
  return normalized;
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
```

### Task 6: Update UI components to use formatters
**Priority**: Medium  
**Estimate**: 3 hours

**Acceptance Criteria**:
- [ ] All places displaying contact methods use the formatter
- [ ] Remove dependency on formatted_value from frontend
- [ ] Consistent display across the application
- [ ] No hardcoded formatting in components

**Files to update**:
- Components displaying person contact information
- Client detail views
- Conversation views showing recipients
- Any reports or exports

### Task 7: Deprecate formatted_value column
**Priority**: Low  
**Estimate**: 1 hour

**Acceptance Criteria**:
- [ ] Verify frontend no longer uses formatted_value
- [ ] Remove column from Zero sync
- [ ] Add deprecation comment to model
- [ ] Schedule removal for next major version

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
- ContactMethod normalization for various phone formats
- ContactMethod normalization for emails
- Frontend formatting utilities with edge cases

### Integration Tests
- FrontConversation → Client association queries
- FrontMessageRecipient → Person association queries
- N+1 query prevention with includes()

### Performance Tests
- Query time for 100 conversations with client data: <50ms
- Query time for 1000 message recipients with people: <100ms
- Backfill script on 10k contact methods: <60 seconds

## Rollback Plan

If issues arise:
1. Frontend can temporarily use `value` field for display
2. Associations are optional, so missing links won't break queries
3. normalized_value column can be dropped without affecting existing functionality
4. Keep formatted_value column until fully deprecated

## Dependencies

- No external dependencies
- Must coordinate with frontend team on formatter rollout
- Should notify API consumers if they use formatted_value

## Success Metrics

- **Performance**: 90% reduction in query time for conversation lists with client data
- **Maintainability**: Display logic centralized in one utility file
- **Data Quality**: 100% of contact methods have normalized values
- **Developer Experience**: Can use standard Rails includes() for all queries

## Timeline

- Week 1: Tasks 1-4 (Database and associations)
- Week 2: Tasks 5-6 (Frontend formatting)
- Week 3: Testing and monitoring
- Week 4: Task 7 (Cleanup)

## Notes

- This approach avoids data duplication and sync complexity
- The single source of truth (ContactMethod) ensures consistency
- Rails associations on non-foreign-key columns work perfectly with proper indexes
- Frontend gains flexibility to format based on user locale/preferences