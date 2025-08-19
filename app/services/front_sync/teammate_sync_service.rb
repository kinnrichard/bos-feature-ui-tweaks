# Teammate synchronization service for Front API
# Handles syncing teammates (users) from Front
class FrontSync::TeammateSyncService < FrontSyncService
  def sync_all
    Rails.logger.tagged("TeammateSync") do
      Rails.logger.info "Starting teammate synchronization"

      start_time = Time.current
      log_sync_start("teammates")

      # Fetch all teammates from Front API
      teammates_data = fetch_all_data("teammates")
      Rails.logger.info "Fetched #{teammates_data.size} teammates from Front API"

      # Sync each teammate
      teammates_data.each do |teammate_data|
        sync_teammate(teammate_data)
      end

      duration = Time.current - start_time
      Rails.logger.info "Teammate sync completed in #{duration.round(2)}s: #{@stats[:created]} created, #{@stats[:updated]} updated, #{@stats[:failed]} failed"

      log_sync_completion("teammates", @stats, duration)
      @stats
    end
  end

  private

  # Sync individual teammate
  def sync_teammate(teammate_data)
    front_id = teammate_data["id"]
    return unless front_id

    upsert_record(FrontTeammate, front_id, teammate_data) do |data, existing_record|
      transform_teammate_attributes(data, existing_record)
    end
  end

  # Transform Front teammate attributes to FrontTeammate model attributes
  def transform_teammate_attributes(teammate_data, existing_record = nil)
    {
      front_id: teammate_data["id"],
      email: teammate_data["email"],
      username: teammate_data["username"],
      first_name: teammate_data["first_name"],
      last_name: teammate_data["last_name"],
      is_admin: teammate_data["is_admin"] || false,
      is_available: teammate_data["is_available"] || true,
      is_blocked: teammate_data["is_blocked"] || false,
      teammate_type: teammate_data["type"],
      custom_fields: teammate_data["custom_fields"] || {},
      api_links: teammate_data["_links"] || {},
      created_at_timestamp: teammate_data["created_at"],
      updated_at_timestamp: teammate_data["updated_at"]
    }
  end
end
