class NoteSerializer < ApplicationSerializer
  set_type :notes

  attributes :content, :notable_type, :notable_id

  timestamp_attributes :created_at, :updated_at

  # Metadata
  attribute :metadata do |note|
    note.metadata || {}
  end

  # Relationships
  belongs_to :author, serializer: PersonSerializer do |note|
    note.user
  end

  belongs_to :notable, polymorphic: true do |note|
    note.notable
  end

  # User info for display
  attribute :author_name do |note|
    note.user&.name
  end

  attribute :author_initials do |note|
    note.user&.initials
  end
end
