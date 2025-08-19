# Concern to add ETag support for API controllers
module EtagSupport
  extend ActiveSupport::Concern

  private

  # Generate ETag for a single record
  def etag_for_record(record, *additional_keys)
    # Include record, its cache key with version, and any additional keys
    [ record, record.cache_key_with_version, *additional_keys ]
  end

  # Generate ETag for a collection
  def etag_for_collection(collection, *additional_keys)
    # For paginated collections, we need to get the total count differently
    if collection.respond_to?(:total_count)
      # It's a paginated collection (Kaminari)
      count = collection.total_count
      # Get max updated from the base relation
      max_updated = collection.except(:limit, :offset).maximum(:updated_at)
    else
      count = collection.count
      max_updated = collection.maximum(:updated_at)
    end

    collection_key = [
      collection.model.name,
      count,
      max_updated&.to_i,
      *additional_keys
    ]
  end

  # Check freshness and set ETag headers
  def check_freshness(record_or_collection, options = {})
    if record_or_collection.respond_to?(:maximum)
      # It's a collection
      etag = etag_for_collection(record_or_collection, current_user.id, options[:additional_keys])
      max_updated = record_or_collection.maximum(:updated_at)
      fresh_when(etag: etag, last_modified: max_updated)
    else
      # It's a single record
      etag = etag_for_record(record_or_collection, current_user.id, options[:additional_keys])
      fresh_when(etag: etag, last_modified: record_or_collection.updated_at)
    end
  end

  # Check if stale and needs re-rendering
  def stale_check?(record_or_collection, options = {})
    if record_or_collection.respond_to?(:maximum) || record_or_collection.respond_to?(:total_count)
      # It's a collection
      etag = etag_for_collection(record_or_collection, current_user.id, options[:additional_keys])

      # Get max updated_at, handling paginated collections
      max_updated = if record_or_collection.respond_to?(:total_count)
        record_or_collection.except(:limit, :offset).maximum(:updated_at)
      else
        record_or_collection.maximum(:updated_at)
      end

      stale?(etag: etag, last_modified: max_updated)
    else
      # It's a single record
      etag = etag_for_record(record_or_collection, current_user.id, options[:additional_keys])
      stale?(etag: etag, last_modified: record_or_collection.updated_at)
    end
  end
end
