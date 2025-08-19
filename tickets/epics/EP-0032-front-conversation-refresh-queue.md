# EP-0032: Front Conversation Refresh Queue System

**Epic ID**: EP-0032  
**Created**: 2025-08-05  
**Status**: Open  
**Priority**: High  
**Component**: Backend/Integration  
**Depends On**: EP-0031 (Front API Direct Synchronization)

## Overview

Implement a robust queue-based system for tracking and refreshing Front conversations that have been updated. This system will use event polling to detect changes and maintain a dedicated queue table for processing conversation updates efficiently. The architecture provides observability, resilience, and sets the foundation for future webhook integration.

## Business Value

- **Data Freshness**: Ensure conversations are updated within minutes of changes in Front
- **System Resilience**: Queue-based architecture prevents data loss and handles failures gracefully
- **Performance**: Batch processing and deduplication reduce unnecessary API calls
- **Observability**: Clear visibility into sync status, processing times, and failures
- **Scalability**: Handle increasing conversation volumes with priority-based processing
- **Migration Path**: Clean architecture ready for webhook integration (EP-0033)

## Requirements

### Core Queue Features

1. **Refresh Queue Table**
   - Track conversations needing refresh with status and priority
   - Support multiple trigger sources (events, manual, scheduled)
   - Maintain processing history and error tracking
   - Enable deduplication to prevent redundant processing

2. **Event Detection**
   - Poll Front Events API every 5 minutes
   - Identify conversations with new activity
   - Extract relevant metadata for processing
   - Handle pagination efficiently

3. **Queue Processing**
   - Process conversations in priority order
   - Support batch operations for efficiency
   - Implement retry logic with exponential backoff
   - Isolate failures to prevent blocking

4. **Monitoring & Observability**
   - Track queue depth and processing times
   - Monitor success/failure rates
   - Alert on queue backup or high failure rates
   - Provide admin UI for queue management

## Technical Design

### Database Schema

```ruby
# Migration: create_front_conversation_refresh_queue
create_table :front_conversation_refresh_queue do |t|
  t.string :front_conversation_id, null: false, index: true
  t.string :reason, null: false # 'event_activity', 'manual', 'scheduled'
  t.string :status, null: false, default: 'pending' # pending, processing, completed, failed
  t.integer :priority, default: 0 # higher = more urgent
  t.datetime :detected_at, null: false
  t.datetime :processed_at
  t.integer :retry_count, default: 0
  t.text :error_message
  t.jsonb :metadata, default: {} # event_ids, event_types, etc.
  t.timestamps
  
  t.index [:status, :priority, :created_at], name: 'idx_queue_processing'
  t.index [:front_conversation_id, :status], name: 'idx_conversation_status'
end
```

### Service Architecture

```
┌─────────────────────────┐
│   EventPollerJob        │ ← Runs every 5 minutes
│   (Sidekiq/SolidQueue)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  EventSyncService       │ ← Detects conversation changes
│  (existing)             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ RefreshQueueService     │ ← Manages queue entries
│ - enqueue()             │
│ - deduplicate()         │
│ - calculate_priority()  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ FrontConversationRefreshQueue │ ← Queue table
│ (ActiveRecord Model)          │
└───────────┬─────────────────┘
            │
            ▼
┌─────────────────────────┐
│ RefreshWorkerJob        │ ← Processes queue
│ (Sidekiq/SolidQueue)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ ConversationSyncService │ ← Syncs individual conversations
│ (enhanced)              │
└─────────────────────────┘
```

### Priority Levels

- **10 (High)**: Manual refresh requests, critical conversations
- **5 (Medium)**: Recent activity (< 1 hour old)
- **0 (Low)**: Older activity (> 1 hour old)

## Implementation Phases

### Phase 1: Queue Infrastructure (2 days)

**Tickets:**
- [ ] Create refresh queue migration and model
- [ ] Implement RefreshQueueService with deduplication
- [ ] Build FrontConversationRefreshQueue model with state machine
- [ ] Add model validations and scopes

**Acceptance Criteria:**
- Queue table created with proper indexes
- Model includes state transitions (pending → processing → completed/failed)
- Deduplication prevents duplicate entries
- Priority calculation based on reason and age

### Phase 2: Event Detection Integration (2 days)

**Tickets:**
- [ ] Create EventPollerJob for periodic polling
- [ ] Enhance EventSyncService to return event metadata
- [ ] Integrate RefreshQueueService with event detection
- [ ] Configure job scheduling (every 5 minutes)

**Acceptance Criteria:**
- EventPollerJob runs reliably every 5 minutes
- Detected conversations are queued with proper metadata
- Event types and counts are tracked
- Polling respects API rate limits

### Phase 3: Queue Processing (3 days)

**Tickets:**
- [ ] Create RefreshWorkerJob for queue processing
- [ ] Enhance ConversationSyncService for single conversation sync
- [ ] Implement batch processing for efficiency
- [ ] Add retry logic and error handling

**Acceptance Criteria:**
- Worker processes queue in priority order
- Batch processing handles up to 10 conversations per job
- Failed items retry with exponential backoff (max 3 attempts)
- Errors are logged with full context

### Phase 4: Monitoring & Admin Tools (2 days)

**Tickets:**
- [ ] Add queue metrics and monitoring
- [ ] Create admin UI for queue management
- [ ] Implement queue health checks
- [ ] Add manual refresh capability

**Acceptance Criteria:**
- Admin can view queue status and depths
- Manual refresh creates high-priority queue entries
- Health endpoint reports queue status
- Alerts configured for queue backup (> 100 items)

### Phase 5: Performance Optimization (1 day)

**Tickets:**
- [ ] Optimize event polling with smart pagination
- [ ] Implement queue cleanup for old completed items
- [ ] Add database query optimizations
- [ ] Performance test with high volumes

**Acceptance Criteria:**
- Event polling completes within 30 seconds
- Old queue items auto-archived after 7 days
- Queue processing handles 100+ items smoothly
- No N+1 queries in processing pipeline

## Success Metrics

1. **Queue Performance**
   - Average queue depth < 50 items
   - 95th percentile processing time < 10 seconds
   - Queue backup incidents < 1 per week

2. **Data Freshness**
   - 95% of changes reflected within 10 minutes
   - 99% of changes reflected within 30 minutes
   - Zero data loss from queue failures

3. **System Reliability**
   - Queue worker uptime > 99.9%
   - Successful processing rate > 95%
   - Failed items eventually succeed > 99%

## Monitoring & Alerting

1. **Key Metrics**
   - Queue depth by status
   - Processing time percentiles
   - Success/failure rates
   - API rate limit usage

2. **Alerts**
   - Queue depth > 100 items
   - Worker job failures
   - Processing time > 30 seconds
   - High failure rate (> 10%)

## Future Considerations

- Webhook integration (EP-0033) will replace polling
- Consider using Redis for high-frequency queue operations
- Evaluate streaming architecture for real-time updates
- Machine learning for priority optimization

## Dependencies

- EP-0031: Front API Direct Synchronization (must be complete)
- Existing EventSyncService functionality
- Job processing infrastructure (Sidekiq/SolidQueue)
- Admin UI framework for queue management

## Risks & Mitigations

1. **Risk**: Event API rate limits
   - **Mitigation**: Smart polling intervals, caching, batch operations

2. **Risk**: Queue table growth
   - **Mitigation**: Auto-archival, partitioning strategy

3. **Risk**: Processing bottlenecks
   - **Mitigation**: Multiple workers, batch processing, priority system

4. **Risk**: Data consistency issues
   - **Mitigation**: Idempotent operations, transaction integrity