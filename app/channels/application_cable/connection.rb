module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      if verified_user = User.find_by(id: decoded_auth_token[:user_id])
        verified_user
      else
        reject_unauthorized_connection
      end
    rescue StandardError => e
      Rails.logger.error "WebSocket authentication error: #{e.message}"
      reject_unauthorized_connection
    end

    def decoded_auth_token
      @decoded_auth_token ||= begin
        token = request.params[:token] || auth_token_from_headers
        JwtService.decode(token) if token.present?
      end || {}
    end

    def auth_token_from_headers
      request.headers["Authorization"]&.split(" ")&.last
    end
  end
end
