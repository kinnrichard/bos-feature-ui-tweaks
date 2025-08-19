# Concern to handle UUID-based resource finding in controllers
module UuidFindable
  extend ActiveSupport::Concern

  private

  # Find a record by UUID (since everything now uses UUID primary keys)
  def find_record(model_class, identifier)
    model_class.find(identifier)
  rescue ActiveRecord::RecordNotFound
    nil
  end

  # Helper method to determine if an identifier is a UUID
  def uuid?(identifier)
    identifier.to_s.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
  end
end
