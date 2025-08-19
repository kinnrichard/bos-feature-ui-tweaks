# Tag synchronization service for Front API
# Handles syncing tags with parent relationships and visibility settings
class FrontSync::TagSyncService < FrontSyncService
  def sync_all
    Rails.logger.tagged("TagSync") do
      Rails.logger.info "Starting tag synchronization"

      start_time = Time.current
      log_sync_start("tags")

      # Fetch all tags from Front API
      tags_data = fetch_all_data("tags")
      Rails.logger.info "Fetched #{tags_data.size} tags from Front API"

      # First pass: Create/update all tags without parent relationships
      tags_data.each do |tag_data|
        sync_tag(tag_data, skip_parent: true)
      end

      # Second pass: Update parent relationships after all tags exist
      tags_data.each do |tag_data|
        update_parent_relationship(tag_data)
      end

      duration = Time.current - start_time
      Rails.logger.info "Tag sync completed in #{duration.round(2)}s: #{@stats[:created]} created, #{@stats[:updated]} updated, #{@stats[:failed]} failed"

      log_sync_completion("tags", @stats, duration)
      @stats
    end
  end

  private

  # Sync individual tag
  def sync_tag(tag_data, skip_parent: false)
    front_id = tag_data["id"]
    return unless front_id

    upsert_record(FrontTag, front_id, tag_data) do |data, existing_record|
      transform_tag_attributes(data, existing_record, skip_parent: skip_parent)
    end
  end

  # Update parent relationship in second pass
  def update_parent_relationship(tag_data)
    return unless tag_data["parent_tag_id"]

    tag = FrontTag.find_by(front_id: tag_data["id"])
    return unless tag

    parent_tag = FrontTag.find_by(front_id: tag_data["parent_tag_id"])
    if parent_tag
      tag.update(parent_tag: parent_tag)
      Rails.logger.debug "Updated parent relationship: #{tag.name} -> #{parent_tag.name}"
    else
      Rails.logger.warn "Parent tag not found for tag #{tag.name} (parent_id: #{tag_data['parent_tag_id']})"
    end
  end

  # Transform Front tag attributes to FrontTag model attributes
  def transform_tag_attributes(tag_data, existing_record = nil, skip_parent: false)
    attributes = {
      front_id: tag_data["id"],
      name: tag_data["name"],
      highlight: tag_data["highlight"],
      description: tag_data["description"],
      is_private: tag_data["is_private"] || false,
      is_visible_in_conversation_lists: tag_data["is_visible_in_conversation_lists"] || false,
      created_at_timestamp: tag_data["created_at"],
      updated_at_timestamp: tag_data["updated_at"]
    }

    # Handle parent tag relationship in first pass vs second pass
    unless skip_parent
      if tag_data["parent_tag_id"]
        parent_tag = FrontTag.find_by(front_id: tag_data["parent_tag_id"])
        attributes[:parent_tag] = parent_tag if parent_tag
      end
    end

    attributes
  end
end
