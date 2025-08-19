# Inbox synchronization service for Front API
# Handles syncing inboxes (channels in Front API) with settings and types
class FrontSync::InboxSyncService < FrontSyncService
  def sync_all
    Rails.logger.tagged("InboxSync") do
      Rails.logger.info "Starting inbox synchronization"

      start_time = Time.current
      log_sync_start("inboxes")

      # Fetch all channels (inboxes) from Front API
      channels_data = fetch_all_data("channels")
      Rails.logger.info "Fetched #{channels_data.size} channels from Front API"

      # Sync each channel as an inbox
      channels_data.each do |channel_data|
        sync_inbox(channel_data)
      end

      duration = Time.current - start_time
      Rails.logger.info "Inbox sync completed in #{duration.round(2)}s: #{@stats[:created]} created, #{@stats[:updated]} updated, #{@stats[:failed]} failed"

      log_sync_completion("inboxes", @stats, duration)
      @stats
    end
  end

  private

  # Sync individual inbox (channel)
  def sync_inbox(channel_data)
    front_id = channel_data["id"]
    return unless front_id

    upsert_record(FrontInbox, front_id, channel_data) do |data, existing_record|
      transform_inbox_attributes(data, existing_record)
    end
  end

  # Transform Front channel attributes to FrontInbox model attributes
  def transform_inbox_attributes(channel_data, existing_record = nil)
    # Extract settings from various channel properties
    settings = {}

    # Map common channel settings
    if channel_data["settings"]
      settings = channel_data["settings"]
    end

    # Add other channel properties to settings
    %w[is_private send_as address].each do |key|
      settings[key] = channel_data[key] if channel_data.key?(key)
    end

    # Determine inbox type from channel type
    inbox_type = determine_inbox_type(channel_data)

    attributes = {
      front_id: channel_data["id"],
      name: channel_data["name"],
      inbox_type: inbox_type,
      handle: channel_data["address"] || channel_data["handle"],
      settings: settings,
      api_links: channel_data["_links"] || {}
    }

    attributes
  end

  # Determine inbox type from channel data
  def determine_inbox_type(channel_data)
    # Map Front channel types to our inbox types
    case channel_data["type"]
    when "smtp"
      "email"
    when "imap"
      "email"
    when "exchange"
      "email"
    when "gmail"
      "email"
    when "office365"
      "email"
    when "twilio"
      "sms"
    when "facebook"
      "facebook"
    when "twitter"
      "twitter"
    when "intercom"
      "intercom"
    when "front_chat"
      "chat"
    when "custom"
      "custom"
    else
      channel_data["type"] || "unknown"
    end
  end
end
