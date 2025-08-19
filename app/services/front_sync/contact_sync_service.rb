# Contact synchronization service for Front API
# Handles syncing contacts with deduplication by email and handles array management
class FrontSync::ContactSyncService < FrontSyncService
  def sync_all
    Rails.logger.tagged("ContactSync") do
      Rails.logger.info "Starting contact synchronization"

      start_time = Time.current
      log_sync_start("contacts")

      # Fetch all contacts from Front API
      contacts_data = fetch_all_data("contacts")
      Rails.logger.info "Fetched #{contacts_data.size} contacts from Front API"

      # Sync each contact
      contacts_data.each do |contact_data|
        sync_contact(contact_data)
      end

      duration = Time.current - start_time
      Rails.logger.info "Contact sync completed in #{duration.round(2)}s: #{@stats[:created]} created, #{@stats[:updated]} updated, #{@stats[:failed]} failed"

      log_sync_completion("contacts", @stats, duration)
      @stats
    end
  end

  private

  # Sync individual contact with deduplication logic
  def sync_contact(contact_data)
    front_id = contact_data["id"]

    # Extract handles for deduplication
    handles = contact_data["handles"] || []
    primary_handle = contact_data["handle"]

    # Find all email handles for deduplication
    email_handles = handles.select { |h| h["source"] == "email" }.map { |h| h["handle"] }
    email_handles << primary_handle if primary_handle&.include?("@")
    email_handles = email_handles.compact.uniq

    # Check for existing contact by front_id first
    existing_contact = FrontContact.find_by(front_id: front_id) if front_id

    # If no front_id match, try to find by email deduplication
    if !existing_contact && email_handles.any?
      existing_contact = find_contact_by_email_deduplication(email_handles)
    end

    front_id = contact_data["id"]
    return unless front_id

    upsert_record(FrontContact, front_id, contact_data) do |data, existing_record|
      transform_contact_attributes(data, existing_record)
    end
  end

  # Find existing contact by email deduplication
  def find_contact_by_email_deduplication(email_handles)
    email_handles.each do |email|
      # Check primary handle
      contact = FrontContact.find_by(handle: email)
      return contact if contact

      # Check handles JSONB array
      contact = FrontContact.where("handles @> ?", [ { source: "email", handle: email } ].to_json).first
      return contact if contact
    end
    nil
  end

  # Transform Front contact attributes to FrontContact model attributes
  def transform_contact_attributes(contact_data, existing_record = nil)
    # Extract primary handle from handles array
    handles_array = contact_data["handles"] || []
    primary_handle = handles_array.first&.dig("handle")

    # Base attributes
    attributes = {
      name: contact_data["name"],
      handle: primary_handle, # Use the first handle as the primary
      handles: handles_array,
      api_links: contact_data["_links"] || {}
    }

    # Only set front_id if it exists (some contacts may not have unified Front contact)
    attributes[:front_id] = contact_data["id"] if contact_data["id"]

    # If this is an update and we're merging handles, ensure uniqueness
    if existing_record&.handles
      merged_handles = (existing_record.handles + attributes[:handles]).uniq do |h|
        [ h["source"], h["handle"] ]
      end
      attributes[:handles] = merged_handles
    end

    attributes
  end
end
