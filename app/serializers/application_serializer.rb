class ApplicationSerializer
  include JSONAPI::Serializer

  # Common configuration for all serializers
  # Use camelCase for consistency with frontend expectations
  set_key_transform :camel_lower

  # Use UUID primary key as the ID for all serializers
  # Since we migrated to UUID-only, the :id field contains UUIDs
  # No need to set_id explicitly as it defaults to :id

  # Helper method to serialize timestamps
  def self.timestamp_attributes(*attrs)
    attrs.each do |attr|
      attribute attr do |object|
        object.send(attr)&.iso8601
      end
    end
  end

  # Helper method to define UUID-based relationships
  def self.belongs_to_uuid(name, **options)
    belongs_to name, **options do |object|
      association = object.send(name)
      association&.uuid
    end
  end

  def self.has_many_uuid(name, **options)
    has_many name, **options do |object|
      object.send(name).pluck(:uuid)
    end
  end

  def self.has_one_uuid(name, **options)
    has_one name, **options do |object|
      association = object.send(name)
      association&.uuid
    end
  end
end
