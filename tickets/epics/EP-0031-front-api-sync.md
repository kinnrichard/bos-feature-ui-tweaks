# EP-0031: Front API Direct Synchronization System

**Epic ID**: EP-0031  
**Created**: 2025-01-06  
**Status**: Open  
**Priority**: High  
**Component**: Backend/Integration  

## Overview

Implement a comprehensive direct synchronization system between Front API and our Rails application, eliminating the dependency on JSON file intermediaries. This system will provide real-time data synchronization, incremental updates, and robust error handling while leveraging our existing Front data models and enhanced monkeypatch capabilities.

## Business Value

- **Real-Time Data Access**: Eliminate stale data issues by syncing directly from Front API
- **Operational Efficiency**: Reduce manual steps and potential errors from file-based imports
- **Incremental Updates**: Only sync changed data, reducing API usage and processing time
- **Better Error Recovery**: Automatic retry logic and detailed sync logging for troubleshooting
- **Scalability**: Handle growing conversation volumes with smart pagination and filtering
- **Data Integrity**: Automated conflict resolution using Front timestamps as source of truth
- **Cost Efficiency**: Optimize API usage through intelligent sync strategies

## Requirements

### Core Synchronization Features

1. **Incremental Sync Capability**
   - Use `q[updated_after]` parameter for date-based filtering
   - Track last successful sync timestamp per resource type
   - Support configurable sync windows (hourly, daily, weekly)
   - Handle timezone conversions properly

2. **Full Sync Support**
   - Initial data load for new installations
   - Manual trigger for data reconciliation
   - Chunked processing to avoid memory issues
   - Progress tracking and resumability

3. **Conflict Resolution**
   - Use Front's decimal timestamps (precision: 15, scale: 3) as source of truth
   - Never overwrite local changes newer than Front data
   - Flag conflicts for manual review when necessary
   - Maintain audit trail of all sync operations

4. **Background Processing**
   - Leverage Solid Queue for async job processing
   - Configurable job priorities and retry policies
   - Concurrent sync for independent resources
   - Rate limiting to respect API quotas

### Resource Synchronization Priority

#### Priority 1: Foundation Resources (Small, Stable)
- **Contacts**: Essential for message attribution
  - Handle contacts without unified Front IDs
  - Deduplicate by email handle
  - Sync handles array for multi-channel contacts
- **Tags**: Required for conversation categorization
  - Support hierarchical parent_tag relationships
  - Sync visibility and privacy settings
- **Inboxes**: Core organizational structure
  - Map to internal mailbox concepts
  - Track inbox-specific settings

#### Priority 2: Conversation Data (Core Business Data)
- **Conversations**: Primary communication threads
  - Use date filtering for incremental updates
  - Sync status, assignee, and custom fields
  - Handle large volume efficiently with pagination
  - Track scheduled reminders and links

#### Priority 3: Message Content (Detailed Data)
- **Messages**: Individual communication items
  - Sync both HTML and plain text bodies
  - Track inbound/outbound direction
  - Handle draft and error states
- **Message Recipients**: Detailed routing information
  - Track specific email handles used
  - Map roles (from, to, cc, bcc)
- **Attachments**: File metadata and references
  - Store metadata only, not file content initially
  - Plan for future file storage strategy

### Sync Strategies

1. **Hybrid Sync Approach** (Recommended)
   ```ruby
   # Daily: Full sync of small datasets
   FrontSyncService.sync_contacts(full: true)
   FrontSyncService.sync_tags(full: true)
   FrontSyncService.sync_inboxes(full: true)
   
   # Hourly: Incremental conversation sync
   FrontSyncService.sync_conversations(since: 1.hour.ago)
   
   # On-demand: Message sync for specific conversations
   FrontSyncService.sync_messages(conversation_ids: [...])
   ```

2. **Smart Pagination Using Monkeypatch**
   - Leverage `max_results` parameter for controlled fetching
   - Use `conversations_page` method for manual pagination
   - Stop fetching when reaching target date range

3. **Error Recovery Strategy**
   - Exponential backoff: 1s, 2s, 4s, 8s, 16s
   - Max retry attempts: 5
   - Dead letter queue for persistent failures
   - Alert on repeated failures

## Technical Architecture

### Service Layer Design

```ruby
# app/services/front_sync_service.rb
class FrontSyncService
  def initialize(client = nil)
    @client = client || Frontapp::Client.new(auth_token: ENV['FRONT_API_TOKEN'])
    @logger = Rails.logger.tagged('FrontSync')
  end
  
  def sync_all(since: nil)
    since ||= last_sync_time || 24.hours.ago
    
    # Sync in dependency order
    sync_contacts
    sync_tags
    sync_inboxes
    sync_conversations(since: since)
    sync_messages_for_recent_conversations(since: since)
    
    record_sync_completion
  end
  
  private
  
  def sync_with_upsert(model_class, front_data, identifier_field = :front_id)
    model_class.upsert_all(
      front_data,
      unique_by: identifier_field,
      update_only: [:updated_at, ...],
      record_timestamps: true
    )
  end
end
```

### Resource-Specific Services

```ruby
# app/services/front_sync/contact_sync_service.rb
class FrontSync::ContactSyncService
  def sync_all
    contacts = fetch_all_contacts
    
    contacts.each_batch do |batch|
      upsert_contacts(batch)
      sync_contact_handles(batch)
    end
  end
  
  private
  
  def upsert_contacts(contacts)
    # Handle contacts with and without front_id
    with_id = contacts.select { |c| c['id'].present? }
    without_id = contacts.reject { |c| c['id'].present? }
    
    # Upsert by front_id
    FrontContact.upsert_all(with_id.map { |c| transform_contact(c) })
    
    # Handle by email for contacts without IDs
    without_id.each do |contact|
      FrontContact.find_or_create_by(handle: contact['handle']) do |c|
        c.assign_attributes(transform_contact(contact))
      end
    end
  end
end
```

### Sync Tracking Schema

```ruby
# Migration: create_front_sync_logs
create_table :front_sync_logs, id: :uuid do |t|
  t.string :resource_type, null: false
  t.string :sync_type, null: false # 'full' or 'incremental'
  t.datetime :started_at, null: false
  t.datetime :completed_at
  t.datetime :synced_until # For incremental syncs
  t.integer :records_synced, default: 0
  t.integer :records_created, default: 0
  t.integer :records_updated, default: 0
  t.integer :records_failed, default: 0
  t.text :error_messages
  t.jsonb :metadata, default: {}
  
  t.timestamps
end

add_index :front_sync_logs, [:resource_type, :completed_at]
add_index :front_sync_logs, :started_at
```

### Background Job Implementation

```ruby
# app/jobs/front_sync_job.rb
class FrontSyncJob < ApplicationJob
  queue_as :default
  
  retry_on Frontapp::Error, wait: :exponentially_longer, attempts: 5
  
  def perform(resource_type: 'all', sync_type: 'incremental', since: nil)
    sync_log = FrontSyncLog.create!(
      resource_type: resource_type,
      sync_type: sync_type,
      started_at: Time.current
    )
    
    begin
      service = FrontSyncService.new
      
      case resource_type
      when 'all'
        service.sync_all(since: since)
      when 'contacts'
        service.sync_contacts(full: sync_type == 'full')
      when 'conversations'
        service.sync_conversations(since: since || 1.hour.ago)
      # ... other resource types
      end
      
      sync_log.update!(
        completed_at: Time.current,
        synced_until: Time.current,
        records_synced: service.stats[:total],
        records_created: service.stats[:created],
        records_updated: service.stats[:updated]
      )
    rescue => e
      sync_log.update!(
        error_messages: e.message,
        records_failed: service.stats[:failed]
      )
      raise
    end
  end
end
```

### Scheduled Sync Configuration

```ruby
# config/solid_queue.yml
dispatchers:
  - polling_interval: 1
    batch_size: 500
    
recurring_tasks:
  front_sync_hourly:
    class: FrontSyncJob
    args:
      resource_type: conversations
      sync_type: incremental
    schedule: every 1 hour
    
  front_sync_daily:
    class: FrontSyncJob
    args:
      resource_type: all
      sync_type: full
    schedule: every day at 2am
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create FrontSyncService base class with client initialization
- [ ] Implement front_sync_logs table and model
- [ ] Create FrontSyncJob for background processing
- [ ] Set up error handling and retry logic
- [ ] Implement basic logging and monitoring

### Phase 2: Core Resource Sync (Week 2-3)
- [ ] Implement FrontSync::ContactSyncService
  - [ ] Handle contacts with/without Front IDs
  - [ ] Sync handles array properly
  - [ ] Implement deduplication logic
- [ ] Implement FrontSync::TagSyncService
  - [ ] Handle hierarchical relationships
  - [ ] Sync tag metadata
- [ ] Implement FrontSync::InboxSyncService
  - [ ] Map inbox settings
  - [ ] Handle inbox types

### Phase 3: Conversation Sync (Week 3-4)
- [ ] Implement FrontSync::ConversationSyncService
  - [ ] Use date filtering for incremental sync
  - [ ] Handle pagination with max_results
  - [ ] Sync custom fields and metadata
- [ ] Implement FrontSync::MessageSyncService
  - [ ] Sync message bodies (HTML and plain)
  - [ ] Handle message recipients
  - [ ] Track attachments metadata

### Phase 4: Production Features (Week 5)
- [ ] Create admin interface for manual sync triggers
- [ ] Build sync status dashboard
  - [ ] Show last sync times per resource
  - [ ] Display sync statistics
  - [ ] Error reporting and alerts
- [ ] Implement performance optimizations
  - [ ] Batch database operations
  - [ ] Add caching where appropriate
  - [ ] Optimize N+1 queries
- [ ] Add comprehensive error alerting
  - [ ] Email notifications for failures
  - [ ] Slack integration for critical errors

### Phase 5: Testing & Documentation (Week 6)
- [ ] Write comprehensive test suite
  - [ ] Unit tests for sync logic
  - [ ] Integration tests with VCR
  - [ ] Performance benchmarks
- [ ] Create operational documentation
  - [ ] Runbook for sync issues
  - [ ] API quota management guide
  - [ ] Data recovery procedures

## Success Criteria

1. **Reliability Metrics**
   - Sync success rate > 99.5%
   - Mean time to recovery < 15 minutes
   - Zero data loss during sync operations

2. **Performance Benchmarks**
   - Full contact sync < 30 seconds for 10,000 contacts
   - Incremental conversation sync < 10 seconds for 100 conversations
   - Message sync < 1 second per conversation

3. **Data Integrity Requirements**
   - 100% accuracy in Front ID mapping
   - Proper handling of all edge cases (null IDs, duplicates)
   - Consistent timezone handling across all timestamps

4. **Operational Standards**
   - Automated recovery from transient failures
   - Clear audit trail for all sync operations
   - Actionable error messages and logging

## Testing Requirements

### Unit Tests
```ruby
# spec/services/front_sync_service_spec.rb
RSpec.describe FrontSyncService do
  describe '#sync_contacts' do
    it 'creates new contacts from Front data'
    it 'updates existing contacts with newer data'
    it 'handles contacts without Front IDs'
    it 'deduplicates by email handle'
    it 'logs sync statistics correctly'
  end
  
  describe '#handle_api_errors' do
    it 'retries on rate limit errors'
    it 'logs and continues on single record failures'
    it 'raises on authentication errors'
  end
end
```

### Integration Tests
```ruby
# spec/integration/front_sync_integration_spec.rb
RSpec.describe 'Front API Sync Integration', :vcr do
  it 'performs full sync successfully'
  it 'performs incremental sync with date filtering'
  it 'handles pagination correctly'
  it 'recovers from mid-sync failures'
end
```

### Performance Tests
```ruby
# spec/performance/sync_performance_spec.rb
RSpec.describe 'Sync Performance' do
  it 'syncs 10,000 contacts in under 30 seconds'
  it 'handles 1,000 conversations without memory issues'
  it 'maintains sub-second response times under load'
end
```

## Security Considerations

1. **API Key Management**
   - Store Front API token in encrypted credentials
   - Rotate tokens regularly
   - Implement token refresh mechanism

2. **Data Privacy**
   - Ensure PII is properly handled
   - Implement data retention policies
   - Audit access to synced data

3. **Rate Limiting**
   - Respect Front API quotas
   - Implement backoff strategies
   - Monitor API usage metrics

## Performance Optimizations

1. **Database Optimizations**
   ```ruby
   # Use upsert_all for bulk operations
   FrontContact.upsert_all(
     contacts_data,
     unique_by: :front_id,
     returning: false, # Faster without returning
     update_only: [:name, :handle, :handles, :updated_at]
   )
   ```

2. **Pagination Strategy**
   ```ruby
   # Use our monkeypatch for efficient pagination
   client.conversations(
     max_results: 100,
     q: { updated_after: 1.hour.ago.to_i }
   )
   ```

3. **Caching Strategy**
   - Cache tag and inbox lists (change infrequently)
   - Use Rails.cache for temporary data
   - Implement ETags for conditional requests

## Monitoring & Alerting

1. **Key Metrics to Track**
   - Sync duration by resource type
   - API calls per sync operation
   - Error rates and types
   - Data freshness (time since last sync)

2. **Alerting Thresholds**
   - Sync failure rate > 5%
   - Sync duration > 2x normal
   - API quota usage > 80%
   - No successful sync in 2 hours

3. **Dashboard Components**
   - Real-time sync status
   - Historical sync performance
   - Error log with details
   - API quota consumption

## Future Enhancements

1. **Real-Time Updates**
   - Implement Front webhooks for instant updates
   - WebSocket integration for live data
   - Event-driven architecture

2. **Two-Way Sync**
   - Send data changes back to Front
   - Handle local edits and conflicts
   - Implement optimistic UI updates

3. **Advanced Features**
   - Smart sync scheduling based on usage patterns
   - Predictive sync for anticipated needs
   - Multi-tenant sync management
   - Differential sync using checksums

4. **Analytics Integration**
   - Sync analytics data to data warehouse
   - Generate sync performance reports
   - Track data quality metrics

## Dependencies

- Front API gem (frontapp 0.0.13) with monkeypatch
- Solid Queue for background jobs
- PostgreSQL with JSONB support
- Rails 8.0+ with upsert_all support
- VCR for API testing

## Risk Mitigation

1. **API Changes**
   - Monitor Front API changelog
   - Implement version checking
   - Maintain backward compatibility

2. **Data Volume Growth**
   - Plan for 10x data growth
   - Implement archival strategies
   - Optimize query performance regularly

3. **Service Availability**
   - Design for Front API downtime
   - Implement circuit breakers
   - Maintain sync queue during outages

## Rollout Strategy

1. **Beta Testing**
   - Deploy to staging environment
   - Sync subset of production data
   - Monitor for issues for 1 week

2. **Gradual Rollout**
   - Start with read-only sync
   - Enable for specific clients first
   - Monitor performance and errors

3. **Full Production**
   - Enable for all clients
   - Activate automated sync schedules
   - Provide admin tools for operations

## Success Metrics

- **Week 1**: Foundation complete, basic sync working
- **Week 2**: Contact and tag sync operational
- **Week 3**: Conversation sync with pagination
- **Week 4**: Message sync with attachments
- **Week 5**: Production features and monitoring
- **Week 6**: Full test coverage and documentation

## Estimated Timeline

- **Total Duration**: 6 weeks
- **Development**: 4 weeks
- **Testing & Refinement**: 1 week
- **Documentation & Deployment**: 1 week
- **Total Engineering Hours**: 160-200 hours

## Related Epics

- Previous work: Front API models and migrations (completed)
- Future work: Front webhook integration (planned)
- Related: Email integration system (if applicable)