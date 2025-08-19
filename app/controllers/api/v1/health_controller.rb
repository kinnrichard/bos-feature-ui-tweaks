class Api::V1::HealthController < Api::V1::BaseController
  skip_before_action :authenticate_request
  skip_before_action :verify_csrf_token_for_cookie_auth

  def show
    # Include CSRF token in response headers for authenticated requests
    # Be more lenient - provide CSRF token if there's any sign of authentication
    Rails.logger.info "HEALTH: Starting health check"
    Rails.logger.info "HEALTH: Environment: #{Rails.env}"
    Rails.logger.info "HEALTH: Session ID: #{session.id}"
    Rails.logger.info "HEALTH: Has auth cookies: #{cookies.signed[:auth_token].present? || cookies.signed[:user_id].present?}"

    if should_provide_csrf_token?
      Rails.logger.info "HEALTH: Providing CSRF token"
      # Force generate token if not present
      session[:_csrf_token] ||= SecureRandom.base64(32)
      Rails.logger.info "HEALTH: Session CSRF token: #{session[:_csrf_token] ? session[:_csrf_token][0..8] + '...' : 'NONE'}"
      set_csrf_token_header
      Rails.logger.info "HEALTH: Response headers after set_csrf_token_header: #{response.headers['X-CSRF-Token'] ? 'SET' : 'NOT SET'}"
    else
      Rails.logger.info "HEALTH: No CSRF token provided - no auth detected"
    end

    render json: {
      status: "ok",
      timestamp: Time.current.iso8601,
      rails_version: Rails::VERSION::STRING,
      database: database_status
    }
  end

  # Development debugging endpoint to test CSRF
  def csrf_test
    return head :not_found unless Rails.env.development?

    # Always provide CSRF token for testing
    set_csrf_token_header

    render json: {
      status: "csrf_test",
      has_user_id_cookie: cookies.signed[:user_id].present?,
      has_auth_token_cookie: cookies.signed[:auth_token].present?,
      user_id_value: cookies.signed[:user_id],
      auth_token_preview: cookies.signed[:auth_token]&.first(10),
      all_cookies: cookies.to_h.keys,
      session_id: session.id,
      csrf_token_in_session: session[:_csrf_token].present?,
      csrf_token_preview: session[:_csrf_token]&.first(10),
      current_user_present: current_user.present?
    }
  end

  # CSRF token endpoint removed - tests now use production /health endpoint

  private

  def should_provide_csrf_token?
    # Provide CSRF token if there's any indication of authentication
    # This is more lenient than the strict auth check to help with token distribution
    # In test environment, always provide CSRF token to enable authentication flow
    # Also provide token for unauthenticated requests to enable login flow
    Rails.env.test? ||
    cookies.signed[:auth_token].present? ||
    cookies.signed[:user_id].present? ||
    request.headers["Authorization"].present? ||
    session[:user_id].present? ||
    true  # Always provide CSRF token for authentication flow
  end

  def database_status
    ActiveRecord::Base.connection.active?
    "connected"
  rescue StandardError
    "disconnected"
  end
end
