# Incremental Sync with Events API

## Overview

The Front API's conversation list endpoint doesn't support filtering by update time. To work around this limitation, we now use the Events API to detect conversation activity for incremental syncs.

## How It Works

1. **Events API**: Queries for conversation-related events (messages, comments) since a given time
2. **Conversation IDs**: Extracts unique conversation IDs from those events
3. **Targeted Sync**: Only syncs the specific conversations that had activity

## Usage

### Basic Incremental Sync

```ruby
# Sync conversations with activity in the last hour
conversation_service = FrontSync::ConversationSyncService.new
stats = conversation_service.sync_all(since: 1.hour.ago)

# Sync messages for those conversations
message_service = FrontSync::MessageSyncService.new
stats = message_service.sync_all(since: 1.hour.ago)
```

### Using the Main Service

```ruby
# Sync all resources incrementally
service = FrontSyncService.new
stats = service.sync_all(since: 1.hour.ago)
```

### Advanced Usage with Event Service

```ruby
# Get conversation IDs with activity
event_service = FrontSync::EventSyncService.new
result = event_service.incremental_sync(
  since: 2.hours.ago,
  max_events: 500  # Limit events to prevent timeout
)

# Sync specific conversations
if result[:conversation_ids].any?
  conv_service = FrontSync::ConversationSyncService.new
  conv_service.sync_conversation_ids(result[:conversation_ids])
end
```

## Performance Optimization

The event sync service includes a `max_events` parameter (default: 1000) to prevent timeouts when there are many events. This ensures incremental syncs complete quickly even during high-activity periods.

## Event Types Used

We monitor these event types to detect conversation activity:
- `inbound` - Incoming messages
- `outbound` - Outgoing messages  
- `out_reply` - Replies sent
- `comment` - Internal comments

## Limitations

1. The Events API may have its own rate limits
2. Very old events may not be available (check Front's data retention policy)
3. Some conversation updates (like tag changes) aren't captured by message events

## Full Sync

Full syncs (without the `since` parameter) continue to work as before, downloading all conversations.