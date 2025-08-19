module Authenticatable
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_request
  end

  private

  def authenticate_request
    @current_user = current_user_from_token

    # Debug logging for authentication failures
    if Rails.env.development? && !@current_user
      token = cookies.signed[:auth_token]
      session_user_id = session[:user_id]
      Rails.logger.info "AUTH DEBUG: Authentication failed for #{request.method} #{request.path}"
      Rails.logger.info "AUTH DEBUG: auth_token cookie: #{token.present? ? 'PRESENT' : 'MISSING'}"
      Rails.logger.info "AUTH DEBUG: session user_id: #{session_user_id.present? ? session_user_id : 'MISSING'}"
      Rails.logger.info "AUTH DEBUG: Current user found: #{@current_user ? @current_user.id : 'NONE'}"
    end

    render_unauthorized unless @current_user
  end

  def current_user
    @current_user
  end

  def current_user_from_token
    # Try JWT authentication first
    token = auth_token

    if token.present?
      begin
        payload = JwtService.decode(token)

        # Check if token is revoked
        if RevokedToken.revoked?(payload[:jti])
          return nil
        end

        user = User.find_by(id: payload[:user_id])
        return user if user
      rescue JWT::DecodeError, JWT::ExpiredSignature
        # Token invalid or expired, try refresh
        nil
      end
    end

    # Fallback to session-based authentication
    if session[:user_id].present?
      return User.find_by(id: session[:user_id])
    end

    nil
  rescue StandardError => e
    Rails.logger.info "Authentication error: #{e.message}"
    nil
  end

  def auth_token
    # Authentication strategy:
    # 1. Bearer tokens (Authorization header) - for future Swift/native mobile apps
    # 2. HttpOnly cookies - for the Svelte PWA (better XSS protection)
    # This dual support allows the API to serve both web and mobile clients
    if request.headers["Authorization"].present?
      request.headers["Authorization"].split(" ").last
    else
      # Fall back to cookie for Svelte PWA
      cookies.signed[:auth_token]
    end
  end

  def render_unauthorized
    render json: {
      errors: [ {
        status: "401",
        title: "Unauthorized",
        detail: "Invalid or missing authentication token"
      } ]
    }, status: :unauthorized
  end
end
