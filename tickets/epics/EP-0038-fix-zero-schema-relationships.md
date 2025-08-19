# Epic: Fix Missing Model Relationships in Zero Schema Generation

**Epic ID**: EP-0038  
**Created**: 2025-08-07  
**Status**: Open  
**Priority**: High  
**Team**: Backend / Frontend Integration  

## Problem Statement

The Zero schema generator is not including relationships for several models (particularly Front-related models) because it uses a hardcoded list of models to discover. This causes the generated `generated-schema.ts` file to be incomplete, missing critical relationships like:

- `FrontConversation` → `ClientsFrontConversations` → `Clients`
- `FrontConversation` → `PeopleFrontConversations` → `People`
- Other Front model relationships

This breaks TypeScript type safety and Zero.js reactive queries for these models. Specifically, queries like `z.query.frontConversation.whereExists('clientsFrontConversations', q => q.where('client_id', clientId))` are impossible because the join table relationships aren't generated.

## Current State

### The Issue
1. `lib/zero_schema_generator/rails_schema_introspector.rb` has a hardcoded model list:
   ```ruby
   model_names = %w[User Client Job Task Person Device Note ActivityLog ContactMethod ScheduledDateTime JobAssignment JobPerson]
   ```

2. This excludes 23 additional models beyond the hardcoded 12:
   - All Front-related models (14 total)
   - JobTarget, ParsedEmail, PeopleGroup, PeopleGroupMembership
   - ScheduledDateTimeUser, RefreshToken, RevokedToken, UniqueId
   - Multiple join tables for many-to-many relationships

3. Result: No `frontConversationsRelationships` in generated schema

## Success Criteria

1. ✅ All ActiveRecord models are discovered dynamically (~35 models vs current 12)
2. ✅ Front model relationships appear in `generated-schema.ts`
3. ✅ Join tables are properly linked with bidirectional relationships
4. ✅ Zero.js whereExists queries work through join tables (e.g., filtering FrontConversations by client_id)
5. ✅ No hardcoded model lists in the introspector
6. ✅ Schema generation doesn't break with loading errors

## Technical Approach

### Solution Architecture
Replace static model discovery with dynamic discovery that:
1. Safely eager loads all models
2. Handles models that may fail to load
3. Excludes system tables automatically
4. Discovers all relationships including polymorphic ones

### Implementation Strategy
1. Use Rails autoloaders to discover models
2. Handle edge cases like missing constants
3. Filter out non-ApplicationRecord descendants
4. Maintain backwards compatibility

## Stories

**Note**: Complete stories in order 1→2→3→4→5 due to dependencies.

### Story 1: Implement Dynamic Model Discovery
**Points**: 3  
**Description**: Replace hardcoded model list with dynamic discovery in RailsSchemaIntrospector

**Tasks**:
- [ ] Update `discover_models` method to use Rails autoloaders
- [ ] Add error handling for models that fail to load
- [ ] Filter out non-database-backed models
- [ ] Add logging for discovered models

**Acceptance Criteria**:
- All ApplicationRecord descendants are discovered
- Models that fail to load don't crash the process
- System tables remain excluded

### Story 2: Fix Model Loading Issues
**Points**: 2  
**Description**: Handle edge cases in model loading (like ExampleUniqueIdUsage)

**Tasks**:
- [ ] Identify models that fail to load properly
- [ ] Add skip list for problematic files
- [ ] Ensure eager loading doesn't trigger side effects
- [ ] Add rescue blocks for NameError/LoadError

**Acceptance Criteria**:
- No "expected file to define constant" errors
- All valid models are loaded successfully
- Models without database tables are skipped gracefully

### Story 3: Generate Complete Relationships
**Points**: 2  
**Description**: Ensure all model relationships are extracted and included

**Tasks**:
- [ ] Verify belongs_to relationships are captured
- [ ] Verify has_many relationships are captured
- [ ] Verify has_many through relationships work
- [ ] Test polymorphic relationships
- [ ] Test whereExists queries through join tables work correctly

**Acceptance Criteria**:
- FrontConversation relationships appear in schema
- Join tables are properly linked
- All existing relationships still work

### Story 4: Verify Schema Generation
**Points**: 1  
**Description**: Verify auto-regeneration produces complete relationships

**Tasks**:
- [ ] Run bin/dev to trigger auto-regeneration
- [ ] Verify generated TypeScript is valid
- [ ] Test Zero.js queries with new relationships
- [ ] Update any affected frontend code

**Acceptance Criteria**:
- generated-schema.ts includes all relationships (auto-generated on bin/dev)
- TypeScript compilation succeeds
- Zero.js queries work with Front models
- Query `z.query.frontConversation.whereExists('clientsFrontConversations', q => q.where('client_id', clientId))` works

### Story 5: Add Tests
**Points**: 2  
**Description**: Add tests for dynamic model discovery

**Tasks**:
- [ ] Unit test for discover_models method
- [ ] Integration test for schema generation
- [ ] Test with models that fail to load
- [ ] Test relationship extraction

**Acceptance Criteria**:
- Tests cover happy path and error cases
- Tests verify Front models are included
- Tests ensure backwards compatibility

## Implementation Notes

### Current Hardcoded List
```ruby
model_names = %w[User Client Job Task Person Device Note ActivityLog ContactMethod ScheduledDateTime JobAssignment JobPerson]
```

### Proposed Dynamic Discovery
```ruby
def discover_models
  # Skip problematic files
  skip_files = ['example_unique_id_usage']
  
  # Ensure models are loaded
  Rails.application.eager_load! unless Rails.application.config.eager_load
  
  # Get all ApplicationRecord descendants
  ApplicationRecord.descendants.select do |model|
    begin
      # Skip if in skip list
      next if skip_files.include?(model.name.underscore)
      
      # Check if model has a table
      model.table_exists? && !excluded_table?(model.table_name)
    rescue => e
      Rails.logger.warn "Skipping model #{model.name}: #{e.message}"
      false
    end
  end
end
```

**Note**: This will discover ~35 ApplicationRecord models vs the current 12 hardcoded ones.

### Models Currently Missing (23 additional models beyond the 12 hardcoded)

**Front Communication Models (9):**
- FrontConversation
- FrontMessage
- FrontContact
- FrontTeammate
- FrontTicket
- FrontTag
- FrontInbox
- FrontAttachment
- FrontSyncLog

**Front Join Tables (6):**
- ClientFrontConversation
- PersonFrontConversation
- FrontConversationTag
- FrontConversationInbox
- FrontConversationTicket
- FrontMessageRecipient

**Other Business Models (8):**
- JobTarget (polymorphic target relationships)
- ParsedEmail (email parsing system)
- PeopleGroup (client's people grouping)
- PeopleGroupMembership (join table)
- ScheduledDateTimeUser (join table)
- RefreshToken (authentication)
- RevokedToken (authentication)
- UniqueId (polymorphic identifiable)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Model loading side effects | Medium | Use safe loading with rescue blocks |
| Breaking existing schema | Medium | Test schema generation before committing |

## Dependencies

- Rails autoloader configuration
- ApplicationRecord inheritance hierarchy
- Zero.js schema format requirements
- TypeScript compilation

## Definition of Done

- [ ] All ~35 models are dynamically discovered (vs 12 hardcoded)
- [ ] Front model relationships appear in generated schema
- [ ] Join table relationships enable whereExists queries
- [ ] No hardcoded model lists remain
- [ ] Tests pass
- [ ] Schema generation is documented
- [ ] Frontend can query Front models with relationships
- [ ] Query pattern `z.query.frontConversation.whereExists('clientsFrontConversations', ...)` works

### Validation Checklist for generated-schema.ts
- [ ] `frontConversationsRelationships` object exists
- [ ] `clientsFrontConversationsRelationships` object exists
- [ ] `peopleFrontConversationsRelationships` object exists
- [ ] All 35 table definitions present (up from 32)
- [ ] Bidirectional join table relationships verified

## Future Considerations

1. **Configuration**: Add ability to explicitly include/exclude specific models if needed
2. **Documentation**: Update schema generation docs with dynamic discovery approach
3. **Relationship Naming**: Note that Zero.js uses Rails relationship names (e.g., `clientsFrontConversations` not `clientFrontAssignments`)

## References

- Current issue: FrontConversations not linked to join tables
- File: `lib/zero_schema_generator/rails_schema_introspector.rb`
- Generated file: `frontend/src/lib/zero/generated-schema.ts`
- Front model example: `app/models/front_conversation.rb`