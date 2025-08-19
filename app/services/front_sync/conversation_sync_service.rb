# Conversation synchronization service for Front API
# Handles syncing conversations with tags, inbox relationships, and assignee mapping
class FrontSync::ConversationSyncService < FrontSyncService
  def sync_all(since: nil, max_results: nil)
    Rails.logger.tagged("ConversationSync") do
      sync_type = since ? "incremental" : "full"
      Rails.logger.info "Starting #{sync_type} conversation synchronization#{ since ? " since #{since}" : ""}"

      start_time = Time.current
      log_sync_start("conversations")

      # Preload lookup caches for performance
      preload_caches

      if since
        # Use Events API for incremental sync
        sync_conversations_using_events(since: since, max_results: max_results)
      else
        # Full sync - get all conversations
        sync_all_conversations(max_results: max_results)
      end

      duration = Time.current - start_time
      Rails.logger.info "Conversation sync completed in #{duration.round(2)}s: #{@stats[:created]} created, #{@stats[:updated]} updated, #{@stats[:failed]} failed"

      log_sync_completion("conversations", @stats, duration)
      @stats
    end
  end

  # Sync specific conversation IDs
  def sync_conversation_ids(conversation_ids)
    Rails.logger.tagged("ConversationSync") do
      Rails.logger.info "Syncing #{conversation_ids.size} specific conversations"

      start_time = Time.current

      # Preload lookup caches for performance
      preload_caches

      # Process each conversation ID
      conversation_ids.each_with_index do |conversation_id, index|
        begin
          # Fetch conversation data from API
          conversation_data = client.get_conversation(conversation_id)

          # Sync the conversation
          sync_conversation(conversation_data)

          # Log progress
          if (index + 1) % 100 == 0
            Rails.logger.info "Processed #{index + 1} of #{conversation_ids.size} conversations"
          end
        rescue => e
          Rails.logger.error "Failed to sync conversation #{conversation_id}: #{e.message}"
          increment_failed("Failed to fetch conversation #{conversation_id}: #{e.message}")
        end
      end

      duration = Time.current - start_time
      Rails.logger.info "Synced #{conversation_ids.size} conversations in #{duration.round(2)}s"

      @stats
    end
  end

  private

  # Sync conversations using Events API for incremental updates
  def sync_conversations_using_events(since:, max_results: nil)
    Rails.logger.info "Using Events API to detect conversation changes since #{since}"

    # Use the event sync service to get conversation IDs with activity
    event_service = FrontSync::EventSyncService.new
    result = event_service.incremental_sync(since: since)

    conversation_ids = result[:conversation_ids]

    if conversation_ids.empty?
      Rails.logger.info "No conversations with activity since #{since}"
      return
    end

    Rails.logger.info "Found #{conversation_ids.size} conversations with activity (#{result[:active_count]} active, #{result[:new_count]} new)"

    # Limit the number of conversations if max_results is specified
    if max_results && conversation_ids.size > max_results
      conversation_ids = conversation_ids.first(max_results)
      Rails.logger.info "Limiting to first #{max_results} conversations"
    end

    # Sync the specific conversations
    sync_conversation_ids(conversation_ids)
  end

  # Sync all conversations (full sync)
  def sync_all_conversations(max_results: nil)
    # Build query parameters
    params = {}
    params[:limit] = max_results if max_results

    # Process conversations in batches to avoid memory issues
    batch_count = 0
    batch_for_bulk = []
    batch_size = 100

    fetch_all_data("conversations", params) do |conversation_data|
      batch_for_bulk << conversation_data
      batch_count += 1

      # Process in chunks for efficiency
      if batch_for_bulk.size >= batch_size
        process_conversation_batch(batch_for_bulk)
        batch_for_bulk = []
        Rails.logger.info "Processed #{batch_count} conversations so far..."
      end
    end

    # Process remaining conversations
    process_conversation_batch(batch_for_bulk) if batch_for_bulk.any?

    Rails.logger.info "Processed #{batch_count} conversations total"
  end

  # Preload all lookup data into memory for fast access
  def preload_caches
    Rails.logger.info "Preloading lookup caches..."

    @teammate_cache = FrontTeammate.pluck(:front_id, :id).to_h
    @contact_cache = FrontContact.pluck(:handle, :id).to_h
    @tag_cache = FrontTag.pluck(:front_id, :id).to_h
    @inbox_cache = FrontInbox.pluck(:front_id, :id).to_h

    Rails.logger.info "Cached #{@teammate_cache.size} teammates, #{@contact_cache.size} contacts, #{@tag_cache.size} tags, #{@inbox_cache.size} inboxes"
  end

  # Process a batch of conversations efficiently
  def process_conversation_batch(conversation_batch)
    return if conversation_batch.empty?

    # Collect all conversations for bulk operations
    conversations_to_sync = []
    conversation_tags_data = {}
    conversation_inboxes_data = {}

    conversation_batch.each do |conversation_data|
      front_id = conversation_data["id"]
      next unless front_id

      conversation = upsert_record(FrontConversation, front_id, conversation_data) do |data, existing_record|
        transform_conversation_attributes(data, existing_record)
      end

      if conversation
        conversations_to_sync << conversation
        conversation_tags_data[conversation.id] = conversation_data["tags"] || []
        conversation_inboxes_data[conversation.id] = conversation_data["inboxes"] || []
      end
    rescue => e
      Rails.logger.error "Failed to sync conversation #{conversation_data['id']}: #{e.message}"
      increment_failed("Conversation sync error: #{e.message}")
    end

    # Bulk sync relationships
    bulk_sync_conversation_tags(conversations_to_sync, conversation_tags_data)
    bulk_sync_conversation_inboxes(conversations_to_sync, conversation_inboxes_data)
  end

  # Sync individual conversation with associated relationships
  def sync_conversation(conversation_data)
    front_id = conversation_data["id"]
    return unless front_id

    conversation = upsert_record(FrontConversation, front_id, conversation_data) do |data, existing_record|
      transform_conversation_attributes(data, existing_record)
    end

    return unless conversation

    # Sync conversation relationships
    sync_conversation_tags(conversation, conversation_data["tags"] || [])
    sync_conversation_inboxes(conversation, conversation_data["inboxes"] || [])

  rescue => e
    Rails.logger.error "Failed to sync conversation #{conversation_data['id']}: #{e.message}"
    increment_failed("Conversation sync error: #{e.message}")
  end

  # Transform Front conversation attributes to FrontConversation model attributes
  def transform_conversation_attributes(conversation_data, existing_record = nil)
    # Use cached lookups instead of database queries
    assignee_id = conversation_data.dig("assignee", "id").then { |id| @teammate_cache[id] }

    # Extract recipient information
    recipient_data = conversation_data["recipient"] || {}
    recipient_handle = recipient_data["handle"]
    recipient_role = recipient_data["role"]
    recipient_contact_id = recipient_handle ? @contact_cache[recipient_handle] : nil

    # Extract last message ID from API links
    last_message_front_id = extract_last_message_id(conversation_data["_links"])

    # Base attributes
    attributes = {
      subject: conversation_data["subject"],
      status: conversation_data["status"],
      status_category: determine_status_category(conversation_data["status"]),
      status_id: conversation_data["status_id"],
      is_private: conversation_data["is_private"] || false,
      created_at_timestamp: conversation_data["created_at"],
      waiting_since_timestamp: conversation_data["waiting_since"],
      custom_fields: conversation_data["custom_fields"] || {},
      assignee_id: assignee_id,
      recipient_contact_id: recipient_contact_id,
      recipient_handle: recipient_handle,
      recipient_role: recipient_role,
      last_message_front_id: last_message_front_id,
      api_links: conversation_data["_links"] || {}
    }

    # Handle metadata - merge links, scheduled reminders, and other metadata
    metadata = {}
    metadata["links"] = conversation_data["links"] if conversation_data["links"]
    metadata["scheduled_reminders"] = conversation_data["scheduled_reminders"] if conversation_data["scheduled_reminders"]
    metadata["last_message"] = conversation_data["last_message"] if conversation_data["last_message"]

    attributes[:metadata] = metadata
    attributes[:links] = conversation_data["links"] || []
    attributes[:scheduled_reminders] = conversation_data["scheduled_reminders"] || []

    attributes
  end

  # Determine status category based on status
  def determine_status_category(status)
    case status&.downcase
    when "archived", "deleted"
      "closed"
    when "unassigned", "assigned"
      "open"
    else
      "open"
    end
  end

  # Find assignee teammate ID from Front assignee data (using cache)
  def find_assignee_id(assignee_data)
    return nil unless assignee_data && assignee_data["id"]
    @teammate_cache[assignee_data["id"]]
  end

  # Find recipient contact ID from Front recipient data (using cache)
  def find_recipient_contact_id(recipient_data)
    return nil unless recipient_data && recipient_data["handle"]
    @contact_cache[recipient_data["handle"]]
  end

  # Bulk sync conversation tags for multiple conversations
  def bulk_sync_conversation_tags(conversations, tags_data_by_conversation_id)
    return if conversations.empty?

    conversation_ids = conversations.map(&:id)

    # Get all current associations in one query
    current_associations = FrontConversationTag
      .where(front_conversation_id: conversation_ids)
      .pluck(:front_conversation_id, :front_tag_id)
      .group_by(&:first)
      .transform_values { |v| v.map(&:last).to_set }

    # Prepare bulk insert data
    new_associations = []
    associations_to_delete = []

    conversations.each do |conversation|
      tags_data = tags_data_by_conversation_id[conversation.id] || []
      current_tag_ids = current_associations[conversation.id] || Set.new
      new_tag_ids = Set.new

      tags_data.each do |tag_data|
        tag_id = @tag_cache[tag_data["id"]]
        if tag_id
          new_tag_ids << tag_id
          unless current_tag_ids.include?(tag_id)
            new_associations << {
              front_conversation_id: conversation.id,
              front_tag_id: tag_id,
              created_at: Time.current,
              updated_at: Time.current
            }
          end
        end
      end

      # Track associations to remove
      tags_to_remove = current_tag_ids - new_tag_ids
      tags_to_remove.each do |tag_id|
        associations_to_delete << [ conversation.id, tag_id ]
      end
    end

    # Bulk insert new associations
    if new_associations.any?
      FrontConversationTag.insert_all(new_associations)
    end

    # Bulk delete old associations
    if associations_to_delete.any?
      FrontConversationTag
        .where(associations_to_delete.map { |conv_id, tag_id|
          "(front_conversation_id = '#{conv_id}' AND front_tag_id = '#{tag_id}')"
        }.join(" OR "))
        .delete_all
    end

  rescue => e
    Rails.logger.error "Failed to bulk sync tags: #{e.message}"
  end

  # Bulk sync conversation inboxes for multiple conversations
  def bulk_sync_conversation_inboxes(conversations, inboxes_data_by_conversation_id)
    return if conversations.empty?

    conversation_ids = conversations.map(&:id)

    # Get all current associations in one query
    current_associations = FrontConversationInbox
      .where(front_conversation_id: conversation_ids)
      .pluck(:front_conversation_id, :front_inbox_id)
      .group_by(&:first)
      .transform_values { |v| v.map(&:last).to_set }

    # Prepare bulk insert data
    new_associations = []
    associations_to_delete = []

    conversations.each do |conversation|
      inboxes_data = inboxes_data_by_conversation_id[conversation.id] || []
      current_inbox_ids = current_associations[conversation.id] || Set.new
      new_inbox_ids = Set.new

      inboxes_data.each do |inbox_data|
        inbox_id = @inbox_cache[inbox_data["id"]]
        if inbox_id
          new_inbox_ids << inbox_id
          unless current_inbox_ids.include?(inbox_id)
            new_associations << {
              front_conversation_id: conversation.id,
              front_inbox_id: inbox_id,
              created_at: Time.current,
              updated_at: Time.current
            }
          end
        end
      end

      # Track associations to remove
      inboxes_to_remove = current_inbox_ids - new_inbox_ids
      inboxes_to_remove.each do |inbox_id|
        associations_to_delete << [ conversation.id, inbox_id ]
      end
    end

    # Bulk insert new associations
    if new_associations.any?
      FrontConversationInbox.insert_all(new_associations)
    end

    # Bulk delete old associations
    if associations_to_delete.any?
      FrontConversationInbox
        .where(associations_to_delete.map { |conv_id, inbox_id|
          "(front_conversation_id = '#{conv_id}' AND front_inbox_id = '#{inbox_id}')"
        }.join(" OR "))
        .delete_all
    end

  rescue => e
    Rails.logger.error "Failed to bulk sync inboxes: #{e.message}"
  end

  # Original sync methods kept for backward compatibility
  def sync_conversation_tags(conversation, tags_data)
    return unless tags_data.any?

    # Get current tag IDs
    current_tag_ids = conversation.front_conversation_tags.pluck(:front_tag_id)

    # Process each tag from API
    new_tag_ids = []
    tags_data.each do |tag_data|
      tag_id = @tag_cache[tag_data["id"]]
      if tag_id
        new_tag_ids << tag_id

        # Create association if it doesn't exist
        unless current_tag_ids.include?(tag_id)
          FrontConversationTag.create!(
            front_conversation: conversation,
            front_tag_id: tag_id
          )
        end
      else
        Rails.logger.warn "Tag not found for conversation #{conversation.front_id}: #{tag_data['id']}"
      end
    end

    # Remove associations for tags no longer present
    tags_to_remove = current_tag_ids - new_tag_ids
    if tags_to_remove.any?
      conversation.front_conversation_tags
                  .where(front_tag_id: tags_to_remove)
                  .destroy_all
    end

  rescue => e
    Rails.logger.error "Failed to sync tags for conversation #{conversation.front_id}: #{e.message}"
  end

  # Sync conversation inboxes relationship
  def sync_conversation_inboxes(conversation, inboxes_data)
    return unless inboxes_data.any?

    # Get current inbox IDs
    current_inbox_ids = conversation.front_conversation_inboxes.pluck(:front_inbox_id)

    # Process each inbox from API
    new_inbox_ids = []
    inboxes_data.each do |inbox_data|
      inbox_id = @inbox_cache[inbox_data["id"]]
      if inbox_id
        new_inbox_ids << inbox_id

        # Create association if it doesn't exist
        unless current_inbox_ids.include?(inbox_id)
          FrontConversationInbox.create!(
            front_conversation: conversation,
            front_inbox_id: inbox_id
          )
        end
      else
        Rails.logger.warn "Inbox not found for conversation #{conversation.front_id}: #{inbox_data['id']}"
      end
    end

    # Remove associations for inboxes no longer present
    inboxes_to_remove = current_inbox_ids - new_inbox_ids
    if inboxes_to_remove.any?
      conversation.front_conversation_inboxes
                  .where(front_inbox_id: inboxes_to_remove)
                  .destroy_all
    end

  rescue => e
    Rails.logger.error "Failed to sync inboxes for conversation #{conversation.front_id}: #{e.message}"
  end

  # Extract last message ID from API links
  def extract_last_message_id(links)
    return nil unless links && links["related"] && links["related"]["last_message"]

    # Extract message ID from URL like ".../messages/msg_2khzjx7i?referer=conversation"
    if links["related"]["last_message"] =~ /\/messages\/(msg_\w+)/
      $1
    end
  end
end
