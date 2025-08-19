# Current request attributes using Rails CurrentAttributes
# Stores per-request global data like the authenticated user
class Current < ActiveSupport::CurrentAttributes
  attribute :user
  attribute :request_id
  attribute :user_agent
  attribute :ip_address

  # Helper to check if user is authenticated
  def authenticated?
    user.present?
  end
end
