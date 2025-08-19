module ApplicationCable
  class Channel < ActionCable::Channel::Base
    # Shared channel functionality

    private

    def ensure_authorized!
      reject unless current_user.present?
    end
  end
end
