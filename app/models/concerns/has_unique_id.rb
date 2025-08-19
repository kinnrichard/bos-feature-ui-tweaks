module HasUniqueId
  extend ActiveSupport::Concern

  included do
    has_one :unique_id, as: :identifiable, dependent: :destroy

    before_create :generate_unique_id

    # Allow configuring UniqueID options at the model level
    class_attribute :unique_id_options
    self.unique_id_options = {}
  end

  class_methods do
    # Configure unique ID options for this model
    def unique_id(options = {})
      self.unique_id_options = options
    end
  end

  private

  def generate_unique_id
    options = self.class.unique_id_options.dup

    # Create and associate the unique ID
    uid = UniqueId.generate(options)
    self.unique_id = uid

    # Optionally set the generated ID on a column of the model
    if respond_to?(:identifier=)
      self.identifier = uid.generated_id
    end
  end

  # Helper method to get the generated ID
  def generated_id
    unique_id&.generated_id
  end
end
