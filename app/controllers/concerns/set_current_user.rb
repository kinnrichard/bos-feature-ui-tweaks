# frozen_string_literal: true

module SetCurrentUser
  extend ActiveSupport::Concern

  included do
    before_action :set_current_user
    after_action :clear_current_user
  end

  private

  def set_current_user
    User.current_user = current_user
  end

  def clear_current_user
    User.current_user = nil
  end
end
