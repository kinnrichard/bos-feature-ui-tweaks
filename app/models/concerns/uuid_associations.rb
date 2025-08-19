# Concern to add UUID-based associations alongside existing ID associations
module UuidAssociations
  extend ActiveSupport::Concern

  class_methods do
    # Define a belongs_to association that works with both ID and UUID
    def belongs_to_dual(name, scope = nil, **options)
      # Ensure name is a symbol
      name = name.to_sym if name.is_a?(String)

      # Original ID-based association
      belongs_to name, scope, **options

      # UUID-based association
      uuid_options = options.dup
      uuid_options[:foreign_key] = "#{name}_uuid"
      uuid_options[:primary_key] = :uuid

      # Create UUID association with _by_uuid suffix
      uuid_association_name = "#{name}_by_uuid".to_sym
      belongs_to uuid_association_name, scope,
        class_name: options[:class_name] || name.to_s.classify,
        foreign_key: uuid_options[:foreign_key],
        primary_key: uuid_options[:primary_key],
        optional: true  # Always optional since it's for lookups only
    end

    # Define a has_many association that works with both ID and UUID
    def has_many_dual(name, scope = nil, **options)
      # Ensure name is a symbol
      name = name.to_sym if name.is_a?(String)

      # Original ID-based association
      has_many name, scope, **options

      # Handle polymorphic associations differently
      if options[:as]
        # For polymorphic associations, we need a different approach
        # The UUID column is named after the polymorphic association, not the model
        # e.g., for "has_many :notes, as: :notable", we need notable_uuid, not job_uuid
        return
      end

      # UUID-based association
      uuid_options = options.dup
      uuid_options[:foreign_key] ||= "#{self.name.underscore}_uuid"
      uuid_options[:primary_key] = :uuid

      # Create UUID association with _by_uuid suffix
      uuid_association_name = "#{name}_by_uuid".to_sym
      has_many uuid_association_name, scope,
        class_name: options[:class_name] || name.to_s.classify.singularize,
        foreign_key: uuid_options[:foreign_key],
        primary_key: uuid_options[:primary_key],
        dependent: options[:dependent]
    end

    # Define a has_one association that works with both ID and UUID
    def has_one_dual(name, scope = nil, **options)
      # Ensure name is a symbol
      name = name.to_sym if name.is_a?(String)

      # Original ID-based association
      has_one name, scope, **options

      # Handle polymorphic associations differently
      if options[:as]
        # For polymorphic associations, we need a different approach
        return
      end

      # UUID-based association
      uuid_options = options.dup
      uuid_options[:foreign_key] ||= "#{self.name.underscore}_uuid"
      uuid_options[:primary_key] = :uuid

      # Create UUID association with _by_uuid suffix
      uuid_association_name = "#{name}_by_uuid".to_sym
      has_one uuid_association_name, scope,
        class_name: options[:class_name] || name.to_s.classify,
        foreign_key: uuid_options[:foreign_key],
        primary_key: uuid_options[:primary_key],
        dependent: options[:dependent]
    end
  end

  included do
    # Helper method to find by either ID or UUID
    scope :find_by_id_or_uuid, ->(identifier) {
      if identifier.to_s.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
        find_by(uuid: identifier)
      else
        find_by(id: identifier)
      end
    }
  end

  # Instance method to get either ID or UUID based on context
  def identifier_for_api
    uuid
  end
end
