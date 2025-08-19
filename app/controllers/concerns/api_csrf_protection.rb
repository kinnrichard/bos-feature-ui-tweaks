module ApiCsrfProtection
  extend ActiveSupport::Concern

  included do
    # Only verify CSRF token for cookie-based auth (not Bearer token auth)
    before_action :verify_csrf_token_for_cookie_auth
  end

  private

  def verify_csrf_token_for_cookie_auth
    # Skip CSRF check if using Bearer token authentication
    return if request.headers["Authorization"].present?

    # Skip CSRF check for safe methods
    return if request.get? || request.head? || request.options?

    # Skip CSRF check if no auth cookie is present (unauthenticated request)
    # Use lenient check consistent with token distribution
    return unless cookies.signed[:auth_token].present? || cookies.signed[:user_id].present?

    # Add debug logging in development
    if Rails.env.development?
      token_from_header = request.headers["X-CSRF-Token"] || request.headers["X-XSRF-Token"]
      session_token = session[:_csrf_token]

      Rails.logger.info "CSRF DEBUG: Request to #{request.path}"
      Rails.logger.info "CSRF DEBUG: Auth cookies - user_id: #{cookies.signed[:user_id].present?}, auth_token: #{cookies.signed[:auth_token].present?}"
      Rails.logger.info "CSRF DEBUG: Header token: #{token_from_header ? token_from_header[0..8] + '...' : 'MISSING'}"
      Rails.logger.info "CSRF DEBUG: Session token: #{session_token ? session_token[0..8] + '...' : 'MISSING'}"
      Rails.logger.info "CSRF DEBUG: Session ID: #{session.id}"
    end

    # Verify CSRF token for cookie-based authentication
    unless valid_csrf_token?
      # Always regenerate token on failure to provide fresh one in error response
      session[:_csrf_token] = generate_csrf_token
      set_csrf_token_header

      render json: {
        errors: [ {
          status: "403",
          code: "INVALID_CSRF_TOKEN",
          title: "CSRF Token Validation Failed",
          detail: "The CSRF token is missing or invalid. For cookie-based authentication, include a valid CSRF token in the X-CSRF-Token header."
        } ]
      }, status: :forbidden
    end
  end

  def valid_csrf_token?
    # Get CSRF token from header
    token_from_header = request.headers["X-CSRF-Token"] || request.headers["X-XSRF-Token"]
    return false if token_from_header.blank?

    # Get session token (we'll store it in the session for API requests)
    session_token = session[:_csrf_token] ||= generate_csrf_token

    # Verify token matches
    ActiveSupport::SecurityUtils.secure_compare(token_from_header, session_token)
  end

  def generate_csrf_token
    SecureRandom.base64(32)
  end

  # Include CSRF token in response headers for client to use
  def set_csrf_token_header
    # Ensure we have a fresh token in the session
    session[:_csrf_token] ||= generate_csrf_token

    # Always include the token in response headers for authenticated requests
    response.headers["X-CSRF-Token"] = session[:_csrf_token]

    # Manually set CORS expose header for X-CSRF-Token (backup for CORS config)
    response.headers["Access-Control-Expose-Headers"] = "X-CSRF-Token, X-Request-ID"

    # Add debug logging in development
    if Rails.env.development?
      Rails.logger.debug "CSRF: Setting token in response header: #{session[:_csrf_token][0..8]}..."
    end
  end
end
