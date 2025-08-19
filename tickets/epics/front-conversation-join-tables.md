# Epic: Front Conversation Join Tables for Direct Person/Client Access

## Problem Statement

Currently, accessing People and Clients from a FrontConversation requires multiple joins through intermediate tables:
- FrontConversation → FrontMessage → FrontMessageRecipient → ContactMethod → Person → Client

This creates performance issues for client-side Zero/ReactiveRecord queries, especially with 40k+ conversations. The multi-hop relationship chain puts significant burden on the client-side database and makes queries complex.

## Solution Overview

Create two join tables to enable direct relationships:
1. `people_front_conversations` - Direct link between Person and FrontConversation
2. `clients_front_conversations` - Direct link between Client and FrontConversation

This reduces the relationship to a single join and significantly improves query performance on the client side.

## Success Criteria

- [ ] Direct access from FrontConversation to all related People with single join
- [ ] Direct access from FrontConversation to all related Clients with single join  
- [ ] Queries complete in <20ms for conversations with associated people/clients
- [ ] Zero.js can use standard relationships after schema regeneration
- [ ] No duplicate entries (one record per person-conversation or client-conversation pair)
- [ ] All existing conversations have their relationships populated

## Technical Approach

### Key Design Decisions
1. **Simple join tables** - No role/type tracking, just presence in conversation
2. **Single source of truth** - Use FrontMessageRecipient data only
3. **Automatic client association** - Since every Person belongs to a Client
4. **Bulk operations** - Handle 40k+ conversations efficiently

## Implementation Tasks

### Task 1: Create database migrations
**Priority**: High  
**Estimate**: 1 hour

**Acceptance Criteria**:
- [ ] Migration creates `people_front_conversations` table with proper indexes
- [ ] Migration creates `clients_front_conversations` table with proper indexes
- [ ] Both tables use UUID primary keys
- [ ] Unique constraints prevent duplicate entries
- [ ] Foreign key constraints ensure referential integrity

**Implementation**:
```ruby
# db/migrate/XXXXXX_create_people_front_conversations.rb
class CreatePeopleFrontConversations < ActiveRecord::Migration[7.0]
  def change
    create_table :people_front_conversations, id: :uuid do |t|
      t.references :person, type: :uuid, null: false, foreign_key: true
      t.references :front_conversation, type: :uuid, null: false, foreign_key: true
      
      t.timestamps
      
      # One entry per person-conversation pair
      t.index [:person_id, :front_conversation_id], unique: true, name: 'idx_person_front_conversation'
      t.index :front_conversation_id
    end
  end
end

# db/migrate/XXXXXX_create_clients_front_conversations.rb
class CreateClientsFrontConversations < ActiveRecord::Migration[7.0]
  def change
    create_table :clients_front_conversations, id: :uuid do |t|
      t.references :client, type: :uuid, null: false, foreign_key: true
      t.references :front_conversation, type: :uuid, null: false, foreign_key: true
      
      t.timestamps
      
      # One entry per client-conversation pair
      t.index [:client_id, :front_conversation_id], unique: true, name: 'idx_client_front_conversation'
      t.index :front_conversation_id
    end
  end
end
```

### Task 2: Create ActiveRecord models
**Priority**: High  
**Estimate**: 1 hour

**Acceptance Criteria**:
- [ ] Join table models created with proper associations
- [ ] FrontConversation model updated with has_many :through associations
- [ ] Person model updated with has_many :through associations
- [ ] Client model updated with has_many :through associations
- [ ] All associations work bidirectionally

**Implementation**:
```ruby
# app/models/person_front_conversation.rb
class PersonFrontConversation < ApplicationRecord
  self.table_name = 'people_front_conversations'
  
  belongs_to :person
  belongs_to :front_conversation
  
  validates :person_id, uniqueness: { scope: :front_conversation_id }
end

# app/models/client_front_conversation.rb  
class ClientFrontConversation < ApplicationRecord
  self.table_name = 'clients_front_conversations'
  
  belongs_to :client
  belongs_to :front_conversation
  
  validates :client_id, uniqueness: { scope: :front_conversation_id }
end

# app/models/front_conversation.rb - add associations
class FrontConversation < ApplicationRecord
  # Existing associations...
  
  has_many :people_front_conversations, class_name: 'PersonFrontConversation'
  has_many :people, through: :people_front_conversations
  
  has_many :clients_front_conversations, class_name: 'ClientFrontConversation'
  has_many :clients, through: :clients_front_conversations
end

# app/models/person.rb - add associations
class Person < ApplicationRecord
  # Existing associations...
  
  has_many :people_front_conversations, class_name: 'PersonFrontConversation'
  has_many :front_conversations, through: :people_front_conversations
end

# app/models/client.rb - add associations
class Client < ApplicationRecord
  # Existing associations...
  
  has_many :clients_front_conversations, class_name: 'ClientFrontConversation'
  has_many :front_conversations, through: :clients_front_conversations
end
```

### Task 3: Create rake task for initial population
**Priority**: High  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] Rake task efficiently processes all conversations in batches
- [ ] Uses single query to gather person/client relationships per batch
- [ ] Handles duplicates gracefully with upsert
- [ ] Provides progress feedback and final statistics
- [ ] Can be run multiple times safely (idempotent)
- [ ] Completes in under 5 minutes for 40k conversations

**Implementation**:
```ruby
# lib/tasks/front_conversations.rake
namespace :front_conversations do
  desc "Populate people and clients join tables from existing message recipients"
  task populate_joins: :environment do
    puts "🔄 Populating front conversation join tables..."
    puts "📊 Total conversations to process: #{FrontConversation.count}"
    
    start_time = Time.current
    processed = 0
    people_created = 0
    clients_created = 0
    
    FrontConversation.find_in_batches(batch_size: 500) do |conversations|
      conversation_ids = conversations.map(&:id)
      
      # Get all people linked to these conversations via message recipients
      # This single query gets person_id, client_id, and conversation_id
      people_data = FrontMessageRecipient
        .joins(:front_message, contact_method: :person)
        .where(front_messages: { front_conversation_id: conversation_ids })
        .where.not(contact_methods: { person_id: nil })
        .group('front_messages.front_conversation_id', 'people.id', 'people.client_id')
        .pluck(
          'front_messages.front_conversation_id',
          'people.id',
          'people.client_id'
        )
      
      # Prepare bulk insert data
      people_records = []
      client_records = []
      seen_people = Set.new
      seen_clients = Set.new
      
      people_data.each do |conv_id, person_id, client_id|
        # Track unique person-conversation pairs
        people_key = "#{person_id}-#{conv_id}"
        unless seen_people.include?(people_key)
          seen_people << people_key
          people_records << {
            id: SecureRandom.uuid,
            person_id: person_id,
            front_conversation_id: conv_id,
            created_at: Time.current,
            updated_at: Time.current
          }
        end
        
        # Track unique client-conversation pairs
        client_key = "#{client_id}-#{conv_id}"
        unless seen_clients.include?(client_key)
          seen_clients << client_key
          client_records << {
            id: SecureRandom.uuid,
            client_id: client_id,
            front_conversation_id: conv_id,
            created_at: Time.current,
            updated_at: Time.current
          }
        end
      end
      
      # Bulk upsert with conflict handling
      if people_records.any?
        result = PersonFrontConversation.upsert_all(
          people_records, 
          unique_by: [:person_id, :front_conversation_id],
          returning: false
        )
        people_created += people_records.size
      end
      
      if client_records.any?
        result = ClientFrontConversation.upsert_all(
          client_records, 
          unique_by: [:client_id, :front_conversation_id],
          returning: false
        )
        clients_created += client_records.size
      end
      
      processed += conversations.size
      
      # Progress indicator
      if processed % 5000 == 0
        elapsed = Time.current - start_time
        rate = processed / elapsed
        eta = (FrontConversation.count - processed) / rate
        puts "  Processed: #{processed} | Rate: #{rate.round}/sec | ETA: #{eta.round}s"
      end
    end
    
    duration = Time.current - start_time
    
    puts "\n✅ Population complete!"
    puts "⏱️  Duration: #{duration.round(2)} seconds"
    puts "📊 Final Statistics:"
    puts "  - Conversations processed: #{processed}"
    puts "  - PersonFrontConversation records created: #{people_created}"
    puts "  - ClientFrontConversation records created: #{clients_created}"
    puts "  - Total PersonFrontConversation records: #{PersonFrontConversation.count}"
    puts "  - Total ClientFrontConversation records: #{ClientFrontConversation.count}"
    puts "  - Conversations with people: #{FrontConversation.joins(:people).distinct.count}"
    puts "  - Conversations with clients: #{FrontConversation.joins(:clients).distinct.count}"
    puts "  - Orphaned conversations: #{FrontConversation.left_joins(:people).where(people: { id: nil }).count}"
  end

  desc "Verify join table integrity"
  task verify_joins: :environment do
    puts "🔍 Verifying join table integrity..."
    
    # Check for orphaned records
    orphaned_people = PersonFrontConversation
      .left_joins(:person, :front_conversation)
      .where('people.id IS NULL OR front_conversations.id IS NULL')
      .count
    
    orphaned_clients = ClientFrontConversation
      .left_joins(:client, :front_conversation)
      .where('clients.id IS NULL OR front_conversations.id IS NULL')
      .count
    
    # Check for duplicates (should be 0 due to unique constraint)
    duplicate_people = PersonFrontConversation
      .group(:person_id, :front_conversation_id)
      .having('COUNT(*) > 1')
      .count
      .size
    
    duplicate_clients = ClientFrontConversation
      .group(:client_id, :front_conversation_id)
      .having('COUNT(*) > 1')
      .count
      .size
    
    puts "📊 Integrity Check Results:"
    puts "  - Orphaned PersonFrontConversation records: #{orphaned_people}"
    puts "  - Orphaned ClientFrontConversation records: #{orphaned_clients}"
    puts "  - Duplicate person-conversation pairs: #{duplicate_people}"
    puts "  - Duplicate client-conversation pairs: #{duplicate_clients}"
    
    if orphaned_people + orphaned_clients + duplicate_people + duplicate_clients == 0
      puts "✅ All integrity checks passed!"
    else
      puts "❌ Integrity issues found. Run cleanup tasks if needed."
    end
  end
end
```

### Task 4: Update Zero schema generation
**Priority**: Medium  
**Estimate**: 1 hour

**Acceptance Criteria**:
- [ ] Run rails zero:generate_schema after migrations
- [ ] Verify new tables appear in generated-schema.ts
- [ ] Verify relationships are properly defined
- [ ] Test that Zero queries work with new relationships

**Implementation**:
```bash
# After running migrations and models are in place
rails zero:generate_schema

# The generated schema should include the new relationships
# allowing queries like:
# const conversation = await FrontConversation
#   .where({ id: conversationId })
#   .include('people', 'clients')
#   .one();
```

### Task 5: Add background job for ongoing sync
**Priority**: Low  
**Estimate**: 2 hours

**Acceptance Criteria**:
- [ ] Background job to sync new conversations daily
- [ ] Only processes conversations created/updated since last run
- [ ] Handles message recipient changes
- [ ] Logs sync statistics

**Implementation**:
```ruby
# app/jobs/sync_front_conversation_joins_job.rb
class SyncFrontConversationJoinsJob < ApplicationJob
  queue_as :low_priority

  def perform(since: 1.day.ago)
    conversations = FrontConversation
      .joins(:front_messages)
      .where('front_conversations.updated_at > ? OR front_messages.updated_at > ?', since, since)
      .distinct
    
    Rails.logger.info "Syncing #{conversations.count} conversations updated since #{since}"
    
    # Use same logic as rake task but for subset of conversations
    # ... (implementation similar to rake task)
  end
end
```

## Testing Requirements

### Unit Tests
```ruby
# test/models/person_front_conversation_test.rb
class PersonFrontConversationTest < ActiveSupport::TestCase
  test "enforces uniqueness of person and conversation pair" do
    person = create(:person)
    conversation = create(:front_conversation)
    
    create(:person_front_conversation, person: person, front_conversation: conversation)
    
    duplicate = build(:person_front_conversation, person: person, front_conversation: conversation)
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:person_id], "has already been taken"
  end
  
  test "allows same person in different conversations" do
    person = create(:person)
    conv1 = create(:front_conversation)
    conv2 = create(:front_conversation)
    
    pfc1 = create(:person_front_conversation, person: person, front_conversation: conv1)
    pfc2 = build(:person_front_conversation, person: person, front_conversation: conv2)
    
    assert pfc2.valid?
  end
end

# test/models/front_conversation_test.rb
class FrontConversationTest < ActiveSupport::TestCase
  test "can access people through join table" do
    conversation = create(:front_conversation)
    person1 = create(:person)
    person2 = create(:person)
    
    create(:person_front_conversation, person: person1, front_conversation: conversation)
    create(:person_front_conversation, person: person2, front_conversation: conversation)
    
    assert_equal 2, conversation.people.count
    assert_includes conversation.people, person1
    assert_includes conversation.people, person2
  end
  
  test "can access clients through join table" do
    conversation = create(:front_conversation)
    client1 = create(:client)
    client2 = create(:client)
    
    create(:client_front_conversation, client: client1, front_conversation: conversation)
    create(:client_front_conversation, client: client2, front_conversation: conversation)
    
    assert_equal 2, conversation.clients.count
    assert_includes conversation.clients, client1
    assert_includes conversation.clients, client2
  end
end
```

### Integration Tests
- Test rake task with sample data
- Verify performance with large datasets
- Test Zero.js queries after schema regeneration

### Performance Tests
- Query time for conversation.people: <10ms
- Query time for conversation.clients: <10ms  
- Query time for person.front_conversations: <20ms
- Query time for client.front_conversations: <50ms
- Bulk populate 10k conversations: <30 seconds

## Rollback Plan

If issues arise:
1. The join tables are purely derived data - can be dropped without data loss
2. Remove associations from models
3. Drop the tables: `drop_table :people_front_conversations` and `drop_table :clients_front_conversations`
4. Regenerate Zero schema
5. Original query patterns through ContactMethod still work

## Dependencies

- Must run after ContactMethod normalization is complete
- Requires all Person records to have client_id (which is already true)
- Zero schema must be regenerated after implementation

## Success Metrics

- **Performance**: 95% reduction in query complexity for conversation → people/clients
- **Reliability**: Zero duplicate records in join tables
- **Completeness**: 100% of conversations with message recipients have join records
- **Maintainability**: Simple schema with no complex logic
- **Developer Experience**: Direct `conversation.people` and `conversation.clients` access

## Timeline

- **Day 1**: Create migrations and models
- **Day 2**: Implement and test rake task
- **Day 3**: Run on production data, verify integrity
- **Day 4**: Regenerate Zero schema, test frontend queries
- **Day 5**: Documentation and monitoring

## Notes

- Join tables are kept simple intentionally - no role tracking or metadata
- Data sourced only from FrontMessageRecipient for consistency
- Bulk operations critical for handling 40k+ conversations efficiently
- These tables optimize read performance at the cost of additional storage