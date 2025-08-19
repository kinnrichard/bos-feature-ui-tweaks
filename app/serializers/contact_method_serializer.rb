class ContactMethodSerializer < ApplicationSerializer
  set_type :contact_methods

  attributes :contact_type, :value, :formatted_value

  timestamp_attributes :created_at, :updated_at

  # Metadata (for API compatibility)
  attribute :metadata do |contact_method|
    {}
  end

  # Flags (for API compatibility)
  attribute :is_primary do |contact_method|
    false
  end

  attribute :is_verified do |contact_method|
    true
  end

  # Relationships
  belongs_to :contactable, serializer: PersonSerializer, polymorphic: false do |contact_method|
    contact_method.person
  end

  # Computed attributes
  attribute :type_label do |contact_method|
    contact_method.contact_type_label
  end

  attribute :type_emoji do |contact_method|
    contact_method.contact_type_emoji
  end

  attribute :display_value do |contact_method|
    contact_method.formatted_value || contact_method.value
  end

  attribute :method_type do |contact_method|
    contact_method.contact_type
  end

  attribute :label do |contact_method|
    contact_method.contact_type_label
  end

  attribute :type_label do |contact_method|
    contact_method.contact_type_label
  end

  attribute :can_receive_sms do |contact_method|
    contact_method.phone?
  end

  attribute :verified_at do |contact_method|
    nil
  end
end
