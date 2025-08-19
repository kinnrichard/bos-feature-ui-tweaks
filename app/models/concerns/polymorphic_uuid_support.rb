# Concern to add UUID support for polymorphic associations
module PolymorphicUuidSupport
  extend ActiveSupport::Concern

  included do
    # Before saving, set the UUID column based on the associated record
    before_save :set_polymorphic_uuid
  end

  private

  def set_polymorphic_uuid
    # Find all polymorphic associations
    self.class.reflect_on_all_associations(:belongs_to).select(&:polymorphic?).each do |association|
      type_column = association.foreign_type
      id_column = association.foreign_key
      uuid_column = "#{association.name}_uuid"

      # Skip if we don't have a UUID column for this association
      next unless self.class.column_names.include?(uuid_column)

      # Get the associated record type and ID
      record_type = send(type_column)
      record_id = send(id_column)

      # Skip if no associated record
      next if record_type.blank? || record_id.blank?

      # Find the associated record and get its UUID
      begin
        klass = record_type.constantize
        if klass.column_names.include?("uuid")
          record = klass.find_by(id: record_id)
          send("#{uuid_column}=", record&.uuid)
        end
      rescue NameError
        # Skip if the class doesn't exist
      end
    end
  end
end
