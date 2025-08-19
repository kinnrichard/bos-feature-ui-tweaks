# Front API synchronization service base class
# Provides common functionality for syncing different resource types from Front API
class FrontSyncService
  include ActiveSupport::Benchmarkable

  attr_reader :client, :stats

  def initialize
    api_token = ENV["FRONT_API_TOKEN"] || Rails.application.credentials.dig(:front, :api_token)
    raise KeyError, "FRONT_API_TOKEN environment variable or credentials not set" unless api_token

    @client = Frontapp::Client.new(auth_token: api_token)
    @stats = { created: 0, updated: 0, failed: 0, errors: [] }
  end

  # Main sync method with dependency ordering
  # Syncs all Front resources in correct order to handle dependencies
  def sync_all(since: nil)
    Rails.logger.tagged("FrontSync") do
      sync_type = since ? "incremental" : "full"
      Rails.logger.info "Starting complete Front API #{sync_type} synchronization#{ since ? " since #{since}" : ""}"

      start_time = Time.current

      # Phase 1: Foundation Resources (required for other resources)
      sync_teammates
      sync_tags
      sync_inboxes

      # Phase 2: Core Resources
      sync_contacts

      # Phase 3: Conversation Data (depends on contacts)
      sync_conversations(since: since)

      # Phase 4: Message Data (depends on conversations)
      sync_messages(since: since)

      duration = Time.current - start_time
      Rails.logger.info "Complete sync finished in #{duration.round(2)}s"

      @stats
    end
  end

  # Sync teammates from Front API
  def sync_teammates
    Rails.logger.info "Starting teammates sync..."
    service = FrontSync::TeammateSyncService.new
    result = service.sync_all
    aggregate_stats!(result)
    result
  end

  # Sync contacts from Front API
  def sync_contacts
    Rails.logger.info "Starting contacts sync..."
    service = FrontSync::ContactSyncService.new
    result = service.sync_all
    aggregate_stats!(result)
    result
  end

  # Sync tags from Front API
  def sync_tags
    Rails.logger.info "Starting tags sync..."
    service = FrontSync::TagSyncService.new
    result = service.sync_all
    aggregate_stats!(result)
    result
  end

  # Sync inboxes from Front API
  def sync_inboxes
    Rails.logger.info "Starting inboxes sync..."
    service = FrontSync::InboxSyncService.new
    result = service.sync_all
    aggregate_stats!(result)
    result
  end

  # Sync conversations from Front API
  def sync_conversations(since: nil, max_results: nil)
    Rails.logger.info "Starting conversations sync#{ since ? " since #{since}" : ""}..."
    service = FrontSync::ConversationSyncService.new
    result = service.sync_all(since: since, max_results: max_results)
    aggregate_stats!(result)
    result
  end

  # Sync messages from Front API
  def sync_messages(since: nil, max_results: nil, conversation_ids: nil)
    Rails.logger.info "Starting messages sync..."
    service = FrontSync::MessageSyncService.new

    if conversation_ids
      result = service.sync_for_conversations(conversation_ids)
    else
      result = service.sync_all(since: since, max_results: max_results)
    end

    aggregate_stats!(result)
    result
  end

  protected

  # Aggregate stats from another service into this one
  def aggregate_stats!(other_stats)
    @stats[:created] += other_stats[:created] || 0
    @stats[:updated] += other_stats[:updated] || 0
    @stats[:failed] += other_stats[:failed] || 0
    @stats[:errors].concat(other_stats[:errors] || [])
  end

  # Increment created counter
  def increment_created
    @stats[:created] += 1
  end

  # Increment updated counter
  def increment_updated
    @stats[:updated] += 1
  end

  # Increment failed counter with optional error message
  def increment_failed(error_message = nil)
    @stats[:failed] += 1
    @stats[:errors] << error_message if error_message
  end

  # Upsert a record using Front ID as unique identifier
  def upsert_record(model_class, front_id, front_data)
    Rails.logger.tagged("Upsert") do
      Rails.logger.debug "Upserting #{model_class} with front_id: #{front_id}"

      existing = model_class.find_by(front_id: front_id)

      if existing
        # Check if update is needed using Front's updated_at
        front_updated_at = extract_timestamp(front_data["updated_at"])

        if existing.updated_at && front_updated_at && existing.updated_at >= front_updated_at
          Rails.logger.debug "Skipping #{model_class} #{front_id} - local data is newer"
          return existing
        end

        # Update existing record
        attributes = block_given? ? yield(front_data, existing) : transform_attributes(front_data)

        if existing.update(attributes)
          increment_updated
          existing
        else
          increment_failed("Update failed for #{model_class} #{front_id}: #{existing.errors.full_messages.join(', ')}")
          nil
        end
      else
        # Create new record
        attributes = block_given? ? yield(front_data, nil) : transform_attributes(front_data)
        attributes[:front_id] = front_id

        record = model_class.create(attributes)
        if record.persisted?
          increment_created
          record
        else
          increment_failed("Creation failed for #{model_class} #{front_id}: #{record.errors.full_messages.join(', ')}")
          nil
        end
      end
    rescue => e
      increment_failed("Exception upserting #{model_class} #{front_id}: #{e.message}")
      nil
    end
  end

  # Transform Front API attributes to Rails model attributes
  # Override in subclasses for resource-specific transformations
  def transform_attributes(front_data)
    # Base implementation - subclasses should override
    front_data.except("id", "_links")
  end

  # Fetch all data from Front API
  # The monkeypatch handles pagination automatically when fetch_all: true
  # If a block is given, yields each page for batch processing
  def fetch_all_data(resource_type, params = {}, &block)
    Rails.logger.tagged("FrontAPI") do
      Rails.logger.info "Fetching all #{resource_type}"

      begin
        # Add fetch_all parameter for automatic pagination via monkeypatch
        params = params.merge(fetch_all: true)

        # If block given, we'll process in batches
        if block_given?
          total_processed = 0

          # Use the appropriate client method based on resource type
          # The monkeypatch will yield each page when a block is given
          case resource_type
          when "contacts"
            client.contacts(params) do |page_results|
              Rails.logger.info "Processing batch of #{page_results.size} #{resource_type} (total: #{total_processed})"
              page_results.each { |item| yield item }
              total_processed += page_results.size
            end
          when "tags"
            client.tags(params) do |page_results|
              Rails.logger.info "Processing batch of #{page_results.size} #{resource_type} (total: #{total_processed})"
              page_results.each { |item| yield item }
              total_processed += page_results.size
            end
          when "teammates"
            client.teammates(params) do |page_results|
              Rails.logger.info "Processing batch of #{page_results.size} #{resource_type} (total: #{total_processed})"
              page_results.each { |item| yield item }
              total_processed += page_results.size
            end
          when "channels", "inboxes"
            client.channels(params) do |page_results|
              Rails.logger.info "Processing batch of #{page_results.size} #{resource_type} (total: #{total_processed})"
              page_results.each { |item| yield item }
              total_processed += page_results.size
            end
          when "conversations"
            client.conversations(params) do |page_results|
              Rails.logger.info "Processing batch of #{page_results.size} #{resource_type} (total: #{total_processed})"
              page_results.each { |item| yield item }
              total_processed += page_results.size
            end
          when "comments"
            # Comments need a conversation_id
            raise ArgumentError, "Comments require conversation_id in params" unless params[:conversation_id]
            client.conversation_comments(params[:conversation_id], params.except(:conversation_id)) do |page_results|
              Rails.logger.info "Processing batch of #{page_results.size} #{resource_type} (total: #{total_processed})"
              page_results.each { |item| yield item }
              total_processed += page_results.size
            end
          else
            raise ArgumentError, "Unknown resource type: #{resource_type}"
          end

          Rails.logger.info "Processed #{total_processed} #{resource_type} in batches"
          total_processed
        else
          # Original behavior - return all results as array
          response = case resource_type
          when "contacts"
                       client.contacts(params)
          when "tags"
                       client.tags(params)
          when "teammates"
                       client.teammates(params)
          when "channels", "inboxes"
                       client.channels(params)
          when "conversations"
                       client.conversations(params)
          when "comments"
                       # Comments need a conversation_id
                       raise ArgumentError, "Comments require conversation_id in params" unless params[:conversation_id]
                       client.conversation_comments(params[:conversation_id], params.except(:conversation_id))
          else
                       raise ArgumentError, "Unknown resource type: #{resource_type}"
          end

          # The response is an array when fetch_all: true
          results = response.is_a?(Array) ? response : (response["_results"] || [])

          Rails.logger.info "Fetched #{results.size} #{resource_type}"
          results
        end

      rescue => e
        Rails.logger.error "Failed to fetch #{resource_type}: #{e.message}"
        Rails.logger.error e.backtrace.first(5).join("\n")
        block_given? ? 0 : []
      end
    end
  end

  # Log sync operation start
  def log_sync_start(resource_type)
    Rails.logger.info "Starting #{resource_type} sync at #{Time.current}"
  end

  # Log sync operation completion
  def log_sync_completion(resource_type, stats, duration)
    Rails.logger.info "#{resource_type.capitalize} sync completed in #{duration.round(2)}s"
    Rails.logger.info "Stats: #{stats[:created]} created, #{stats[:updated]} updated, #{stats[:failed]} failed"
    Rails.logger.info "Errors: #{stats[:errors].join('; ')}" if stats[:errors].any?
  end

  private

  # Extract timestamp from Front API format
  def extract_timestamp(timestamp_value)
    return nil unless timestamp_value

    case timestamp_value
    when Numeric
      Time.at(timestamp_value).utc
    when String
      Time.parse(timestamp_value).utc
    else
      nil
    end
  rescue => e
    Rails.logger.warn "Failed to parse timestamp #{timestamp_value}: #{e.message}"
    nil
  end
end
