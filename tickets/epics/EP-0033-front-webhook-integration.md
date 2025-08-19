# EP-0033: Front Webhook Integration

**Epic ID**: EP-0033  
**Created**: 2025-08-05  
**Status**: Open  
**Priority**: High  
**Component**: Backend/Integration  
**Depends On**: EP-0032 (Front Conversation Refresh Queue)

## Overview

Implement webhook integration with Front to receive real-time notifications of conversation changes, replacing the polling-based approach with instant updates. This system will leverage the existing refresh queue infrastructure while adding webhook endpoints, signature validation, and event processing capabilities.

## Business Value

- **Real-Time Updates**: Instant notification of conversation changes (< 1 second latency)
- **Reduced API Usage**: Eliminate polling overhead and API rate limit concerns
- **Cost Efficiency**: Significantly reduce API calls and processing overhead
- **Improved User Experience**: Users see updates immediately without refresh delays
- **Scalability**: Handle any volume of updates without polling intervals
- **Reliability**: Front guarantees webhook delivery with retry mechanisms

## Requirements

### Webhook Infrastructure

1. **Webhook Endpoint**
   - Secure HTTPS endpoint for receiving Front webhooks
   - Support for all relevant Front event types
   - High availability and low latency response
   - Graceful handling of duplicate events

2. **Security & Validation**
   - HMAC signature validation for all webhooks
   - IP allowlist for Front servers (optional)
   - Request body size limits and timeout protection
   - Replay attack prevention

3. **Event Processing**
   - Map Front events to refresh queue entries
   - Extract conversation IDs and metadata
   - Handle batch webhook deliveries
   - Process events asynchronously

4. **Reliability & Monitoring**
   - Acknowledge webhooks quickly (< 3 seconds)
   - Queue events for async processing
   - Monitor webhook success rates
   - Alert on validation failures

## Technical Design

### Webhook Architecture

```
┌─────────────────────────┐
│    Front Platform       │
│  (Webhook Sender)       │
└───────────┬─────────────┘
            │ HTTPS POST
            ▼
┌─────────────────────────┐
│   Load Balancer/WAF     │ ← Rate limiting, DDoS protection
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  WebhooksController     │ ← Signature validation
│  /api/webhooks/front    │ ← Quick acknowledgment
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  WebhookProcessorJob    │ ← Async processing
│  (Sidekiq/SolidQueue)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  WebhookEventService    │ ← Event parsing & routing
│  - parse_event()        │
│  - extract_conversations│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ RefreshQueueService     │ ← Existing queue system
│ (from EP-0032)          │
└─────────────────────────┘
```

### Webhook Event Types

```ruby
# Conversation Events (Priority: High)
- conversation.created
- conversation.updated  
- conversation.archived
- conversation.reopened
- conversation.deleted
- conversation.restored

# Message Events (Priority: High)
- message.received
- message.sent
- comment.added

# Assignment Events (Priority: Medium)
- conversation.assigned
- conversation.unassigned

# Tag Events (Priority: Low)
- conversation.tagged
- conversation.untagged
```

### Database Schema

```ruby
# Migration: create_webhook_events
create_table :webhook_events do |t|
  t.string :event_id, null: false, index: { unique: true }
  t.string :event_type, null: false
  t.string :webhook_id
  t.jsonb :payload, null: false
  t.string :status, default: 'pending' # pending, processed, failed
  t.datetime :received_at, null: false
  t.datetime :processed_at
  t.text :error_message
  t.timestamps
  
  t.index [:status, :created_at]
  t.index [:event_type, :received_at]
end
```

### Webhook Endpoint

```ruby
# routes.rb
namespace :api do
  namespace :webhooks do
    post 'front', to: 'front_webhooks#create'
  end
end

# Controllers
class Api::Webhooks::FrontWebhooksController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :verify_webhook_signature
  
  def create
    # Quick acknowledgment
    WebhookProcessorJob.perform_later(
      event_id: request.headers['X-Front-Event-ID'],
      event_type: params[:type],
      payload: params
    )
    
    head :ok
  rescue => e
    Rails.logger.error "Webhook processing failed: #{e.message}"
    head :ok # Still acknowledge to prevent retries
  end
  
  private
  
  def verify_webhook_signature
    signature = request.headers['X-Front-Signature']
    payload = request.raw_post
    expected = OpenSSL::HMAC.hexdigest(
      'SHA256',
      Rails.application.credentials.front[:webhook_secret],
      payload
    )
    
    unless ActiveSupport::SecurityUtils.secure_compare(signature, expected)
      head :unauthorized
    end
  end
end
```

## Implementation Phases

### Phase 1: Webhook Infrastructure (2 days)

**Tickets:**
- [ ] Create webhook events table and model
- [ ] Implement webhook controller with signature validation
- [ ] Set up webhook processing job
- [ ] Add webhook configuration and secrets

**Acceptance Criteria:**
- Webhook endpoint responds in < 100ms
- Signature validation prevents unauthorized requests
- Events are queued for async processing
- Duplicate events are handled gracefully

### Phase 2: Event Processing (3 days)

**Tickets:**
- [ ] Create WebhookEventService for event parsing
- [ ] Map Front events to conversation IDs
- [ ] Integrate with RefreshQueueService
- [ ] Handle all relevant event types

**Acceptance Criteria:**
- All event types correctly parsed
- Conversation IDs extracted from nested payloads
- High-priority events create high-priority queue items
- Unknown events logged but don't fail

### Phase 3: Front Configuration (1 day)

**Tickets:**
- [ ] Document webhook setup in Front admin
- [ ] Configure webhook URL and events
- [ ] Set up webhook secret
- [ ] Test end-to-end flow

**Acceptance Criteria:**
- Webhook configured in Front settings
- Test events received and processed
- Documentation includes screenshots
- Rollback procedure documented

### Phase 4: Migration & Cutover (2 days)

**Tickets:**
- [ ] Create feature flag for webhook mode
- [ ] Run webhook and polling in parallel
- [ ] Compare results and verify accuracy
- [ ] Disable polling after verification

**Acceptance Criteria:**
- Feature flag controls processing mode
- Parallel operation shows identical results
- No events missed during transition
- Polling disabled without data loss

### Phase 5: Monitoring & Optimization (2 days)

**Tickets:**
- [ ] Add webhook-specific metrics
- [ ] Create webhook health dashboard
- [ ] Implement webhook replay capability
- [ ] Optimize for high-volume events

**Acceptance Criteria:**
- Dashboard shows webhook success rate > 99.9%
- Failed webhooks can be replayed
- System handles 1000+ events/minute
- P95 processing time < 1 second

## Success Metrics

1. **Webhook Performance**
   - Endpoint response time < 100ms
   - Signature validation time < 10ms
   - Event processing time < 1 second
   - Zero webhook timeouts

2. **Data Freshness**
   - 99% of changes reflected within 5 seconds
   - 99.9% of changes reflected within 30 seconds
   - Real-time user experience

3. **System Reliability**
   - Webhook success rate > 99.9%
   - Zero data loss from webhook failures
   - Automatic recovery from Front retries

4. **Cost Efficiency**
   - 90% reduction in API calls
   - Eliminated polling infrastructure costs
   - Reduced processing overhead

## Security Considerations

1. **Webhook Validation**
   ```ruby
   # HMAC-SHA256 signature validation
   # Timestamp validation (prevent replay attacks)
   # Request size limits (max 1MB)
   # Rate limiting per IP
   ```

2. **Infrastructure Security**
   - HTTPS only with valid certificates
   - Optional IP allowlist for Front servers
   - WAF rules for webhook endpoints
   - Audit logging for all webhook events

3. **Data Protection**
   - PII handling in webhook payloads
   - Encryption at rest for webhook events
   - Retention policies for webhook data
   - GDPR compliance for event storage

## Monitoring & Alerting

1. **Key Metrics**
   - Webhook receipt rate
   - Signature validation failures
   - Processing success rate
   - Event type distribution

2. **Alerts**
   - Webhook endpoint down
   - High validation failure rate (> 1%)
   - Processing queue backup
   - Unusual event patterns

3. **Dashboards**
   - Real-time webhook activity
   - Processing pipeline health
   - Event type breakdown
   - Error analysis

## Rollback Strategy

1. **Immediate Rollback**
   - Re-enable polling via feature flag
   - Disable webhook endpoint
   - Process any queued events

2. **Gradual Rollback**
   - Run polling and webhooks in parallel
   - Compare results and fix issues
   - Gradually shift traffic back

3. **Emergency Procedures**
   - Documented runbook for operators
   - Clear escalation path
   - Automated rollback triggers

## Future Enhancements

1. **Advanced Processing**
   - Webhook event deduplication
   - Intelligent batching
   - Priority optimization via ML

2. **Extended Integration**
   - Webhook forwarding to other systems
   - Event stream for real-time UI updates
   - Webhook replay API

3. **Multi-tenant Support**
   - Per-organization webhook configs
   - Isolated processing queues
   - Tenant-specific rate limits

## Dependencies

- EP-0032: Refresh Queue System (must be complete)
- Front webhook documentation
- Webhook secret management
- Load balancer configuration support

## Risks & Mitigations

1. **Risk**: Webhook endpoint availability
   - **Mitigation**: Multi-region deployment, Front retry mechanism

2. **Risk**: Signature validation failures
   - **Mitigation**: Secret rotation process, monitoring

3. **Risk**: Event volume spikes
   - **Mitigation**: Auto-scaling, queue buffering

4. **Risk**: Front webhook changes
   - **Mitigation**: Version handling, backwards compatibility