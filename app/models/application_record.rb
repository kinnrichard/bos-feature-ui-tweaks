class ApplicationRecord < ActiveRecord::Base
  include Touchable

  primary_abstract_class

  # All models now use UUID as primary key
  self.primary_key = :id

  # Generate cache key with version for ETag support
  def cache_key_with_version
    timestamp = updated_at&.utc&.to_fs(:usec) || "nil"
    "#{model_name.cache_key}/#{id}-#{timestamp}"
  end

  # to_param already returns the ID (which is now a UUID)
  # No need to override since Rails will use the primary key
end
