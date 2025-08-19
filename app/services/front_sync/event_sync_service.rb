# Event synchronization service for Front API
# Uses the Events API to detect conversation activity and changes
require "net/http"
require "json"
require "uri"

class FrontSync::EventSyncService < FrontSyncService
  # Event types that indicate conversation activity
  # We focus on message events which are the most important for sync
  CONVERSATION_EVENT_TYPES = %w[
    inbound
    outbound
    out_reply
    comment
  ].freeze

  # Get conversation IDs that have had activity since a given time
  def get_active_conversation_ids(since:, until_time: nil, max_events: 1000)
    Rails.logger.tagged("EventSync") do
      Rails.logger.info "Fetching events since #{since}#{until_time ? " until #{until_time}" : ""}"

      conversation_ids = Set.new
      event_count = 0

      # Build query parameters for events
      params = {
        "q[after]" => since.to_i,
        "q[types]" => CONVERSATION_EVENT_TYPES,
        limit: 100  # Get 100 events per page
      }

      # Add before parameter if until_time is specified
      params["q[before]"] = until_time.to_i if until_time

      # Fetch events page by page until we have enough unique conversations
      # or hit the max_events limit
      fetch_events_with_limit(params, max_events) do |event|
        event_count += 1

        # Extract conversation ID from the event
        conversation_id = extract_conversation_id(event)
        conversation_ids.add(conversation_id) if conversation_id

        # Log progress every 100 events
        if event_count % 100 == 0
          Rails.logger.info "Processed #{event_count} events, found #{conversation_ids.size} unique conversations"
        end
      end

      Rails.logger.info "Processed #{event_count} total events (max: #{max_events}), found #{conversation_ids.size} unique conversations with activity"

      conversation_ids.to_a
    end
  end

  # Get newly created conversations since a given time
  def get_new_conversation_ids(since:, until_time: nil)
    Rails.logger.tagged("EventSync") do
      Rails.logger.info "Fetching new conversations created since #{since}"

      conversation_ids = []
      pages_checked = 0
      max_pages = 10  # Limit pages to check for new conversations

      # Since q[created_after] doesn't actually filter, we need to check conversations
      # manually until we find ones older than our cutoff
      params = {
        limit: 50  # Check 50 at a time
      }

      # Fetch conversations page by page (they're ordered by most recent first)
      conversations = []
      found_old_conversation = false

      # Use manual pagination to avoid fetch_all
      while pages_checked < max_pages && !found_old_conversation
        page_conversations = client.conversations(params.merge(limit: 50))
        pages_checked += 1

        break if page_conversations.empty?

        page_conversations.each do |conv|
          created_at = Time.at(conv["created_at"])

          # If this conversation is older than our cutoff, we can stop
          if created_at < since
            found_old_conversation = true
            break
          end

          # If it's within our time range, add it
          if until_time.nil? || created_at <= until_time
            conversation_ids << conv["id"]
          end
        end

        # For next page, we'd need to implement pagination token handling
        # For now, just get the first batch of recent conversations
        break  # TODO: Implement proper pagination if needed
      end

      Rails.logger.info "Found #{conversation_ids.size} new conversations (checked #{pages_checked} pages)"

      conversation_ids
    end
  end

  # Perform incremental sync using events to detect changes
  def incremental_sync(since:, until_time: nil, max_events: 1000)
    Rails.logger.tagged("EventSync") do
      start_time = Time.current

      # Get conversations with activity
      active_ids = get_active_conversation_ids(since: since, until_time: until_time, max_events: max_events)

      # Get newly created conversations
      new_ids = get_new_conversation_ids(since: since, until_time: until_time)

      # Combine and deduplicate
      all_conversation_ids = (active_ids + new_ids).uniq

      Rails.logger.info "Total conversations to sync: #{all_conversation_ids.size} (#{active_ids.size} active, #{new_ids.size} new)"

      if all_conversation_ids.empty?
        Rails.logger.info "No conversations with activity since #{since}"
        return { conversation_ids: [], stats: @stats }
      end

      # Return the conversation IDs that need syncing
      {
        conversation_ids: all_conversation_ids,
        active_count: active_ids.size,
        new_count: new_ids.size,
        since: since,
        until: until_time,
        duration: Time.current - start_time
      }
    end
  end

  private

  # Fetch events with a limit to prevent timeout
  def fetch_events_with_limit(params, max_events, &block)
    events_processed = 0
    next_url = nil

    loop do
      if next_url
        uri = URI.parse(next_url)
      else
        uri = URI.parse("https://api2.frontapp.com/events")
        uri.query = URI.encode_www_form(params.reject { |k, v| k == :fetch_all })
      end

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 10
      http.read_timeout = 30

      request = Net::HTTP::Get.new(uri)
      request["Authorization"] = "Bearer #{ENV["FRONT_API_TOKEN"] || Rails.application.credentials.dig(:front, :api_token)}"
      request["Accept"] = "application/json"

      response = http.request(request)

      if response.code == "200"
        data = JSON.parse(response.body)
        results = data["_results"] || []

        # Process events from this page
        results.each do |event|
          yield event
          events_processed += 1

          # Stop if we've hit the limit
          return if events_processed >= max_events
        end

        # Check for next page
        pagination = data["_pagination"]
        if pagination && pagination["next"]
          next_url = pagination["next"]
        else
          break
        end
      else
        Rails.logger.error "Failed to fetch events: #{response.code} - #{response.body}"
        break
      end
    end
  end

  # Fetch all events using the client (legacy method kept for compatibility)
  def fetch_all_events(params, &block)
    # The events endpoint needs to be added to our client
    # For now, we'll make a direct API call
    events = fetch_events_directly(params)

    events.each do |event|
      yield event
    end
  end

  # Make direct API call to events endpoint
  # This is temporary until we add events support to the client
  def fetch_events_directly(params)
    require "net/http"
    require "json"

    all_events = []
    next_url = nil

    loop do
      if next_url
        uri = URI.parse(next_url)
      else
        uri = URI.parse("https://api2.frontapp.com/events")
        uri.query = URI.encode_www_form(params.reject { |k, v| k == :fetch_all })
      end

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true

      request = Net::HTTP::Get.new(uri)
      request["Authorization"] = "Bearer #{ENV["FRONT_API_TOKEN"] || Rails.application.credentials.dig(:front, :api_token)}"
      request["Accept"] = "application/json"

      response = http.request(request)

      if response.code == "200"
        data = JSON.parse(response.body)
        results = data["_results"] || []
        all_events.concat(results)

        # Check for next page
        pagination = data["_pagination"]
        if pagination && pagination["next"]
          next_url = pagination["next"]
        else
          break
        end
      else
        Rails.logger.error "Failed to fetch events: #{response.code} - #{response.body}"
        break
      end
    end

    all_events
  end

  # Extract conversation ID from an event
  def extract_conversation_id(event)
    # Events have a conversation object with an ID
    event.dig("conversation", "id")
  end
end
