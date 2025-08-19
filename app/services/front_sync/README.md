# Front API Sync Services

This directory contains specialized synchronization services for different Front API resources.

## Phase 3 Implementation: Conversation and Message Sync

The Phase 3 implementation adds conversation and message synchronization capabilities to the Front API integration.

### Services

#### ConversationSyncService
- **File**: `conversation_sync_service.rb`
- **Purpose**: Syncs conversations from Front API with tags, inbox relationships, and assignee mapping
- **Features**:
  - Incremental sync with `since` parameter
  - Pagination support with `max_results` parameter
  - Tag association management
  - Inbox relationship management
  - Status category mapping (open/closed)
  - Custom fields and metadata storage

#### MessageSyncService
- **File**: `message_sync_service.rb`
- **Purpose**: Syncs messages for conversations with recipients and attachment metadata
- **Features**:
  - Full sync with `sync_all()` method
  - Conversation-specific sync with `sync_for_conversations()`
  - Recipient role management (from, to, cc, bcc)
  - Attachment metadata storage (not file content)
  - Author contact mapping
  - Draft and error state handling

### Usage Examples

```ruby
# Full conversation sync
conversation_service = FrontSync::ConversationSyncService.new
stats = conversation_service.sync_all

# Incremental conversation sync (last 24 hours)
stats = conversation_service.sync_all(since: 1.day.ago)

# Limited conversation sync
stats = conversation_service.sync_all(max_results: 100)

# Full message sync
message_service = FrontSync::MessageSyncService.new
stats = message_service.sync_all

# Sync messages for specific conversations
conversation_ids = ['cnv_123', 'cnv_456']
stats = message_service.sync_for_conversations(conversation_ids)

# Complete sync using main service
main_service = FrontSyncService.new
total_stats = main_service.sync_all(since: 1.day.ago)
```

### Integration with Main FrontSyncService

The main `FrontSyncService` has been updated to include Phase 3 resources:

- `sync_conversations(since: nil, max_results: nil)` - Delegate to ConversationSyncService
- `sync_messages(since: nil, max_results: nil, conversation_ids: nil)` - Delegate to MessageSyncService
- `sync_all(since: nil)` - Now includes conversation and message sync

### Dependencies

Phase 3 sync respects resource dependencies:

1. **Phase 2** (must run first):
   - Tags → Conversations (tag associations)
   - Inboxes → Conversations (inbox associations)
   - Contacts → Conversations (recipient mapping)

2. **Phase 3** (current):
   - Conversations → Messages (message-conversation relationships)

### Data Models

The services work with these ActiveRecord models:

- `FrontConversation` - Main conversation records
- `FrontMessage` - Message records linked to conversations
- `FrontConversationTag` - Join table for conversation-tag associations
- `FrontConversationInbox` - Join table for conversation-inbox associations
- `FrontMessageRecipient` - Join table for message-recipient associations
- `FrontAttachment` - Attachment metadata (no file content)

### Error Handling

All services include comprehensive error handling:
- Individual record failures don't stop the sync process
- Missing dependencies (tags, inboxes, contacts) are logged but don't cause failures
- Statistics track created, updated, and failed records
- Error messages are collected for debugging

### Performance Considerations

- Uses pagination to handle large datasets efficiently
- Incremental sync support reduces API calls and processing time
- Bulk operations for relationship management (tags, inboxes, recipients)
- Proper indexing on `front_id` and timestamp fields for fast lookups