class Api::V1::BaseController < ActionController::API
  include ActionController::Cookies
  include ActionController::HttpAuthentication::Token::ControllerMethods
  include Authenticatable
  include SetCurrentUser
  include ApiErrorHandler
  include ApiCsrfProtection
  include UuidFindable
  include EtagSupport

  before_action :set_request_id
  after_action :set_csrf_token_header_for_authenticated_requests

  private

  def set_request_id
    response.headers["X-Request-ID"] = request.request_id
  end

  # Automatically include CSRF token in response headers for all authenticated API requests
  def set_csrf_token_header_for_authenticated_requests
    # Only set CSRF token for authenticated requests
    # Use more lenient check to ensure tokens are distributed properly
    if should_provide_csrf_token?
      set_csrf_token_header
    end
  end

  def should_provide_csrf_token?
    # More lenient check for CSRF token distribution
    cookies.signed[:auth_token].present? ||
    cookies.signed[:user_id].present? ||
    (current_user.present? rescue false)
  end

  # Override current_user to resolve from HTTP request cookies only
  def current_user
    # If @current_user is already set (by authenticate_request), use it
    return @current_user if defined?(@current_user)

    # Only get user from signed cookies in the HTTP request
    user_id = cookies.signed[:user_id]
    token = cookies.signed[:auth_token]

    # Debug logging for Zero token endpoint
    if Rails.env.test? && request.path.include?("zero/token")
      Rails.logger.info "ZERO AUTH DEBUG: user_id cookie: #{user_id}"
      Rails.logger.info "ZERO AUTH DEBUG: auth_token present: #{token.present?}"
    end

    if user_id.present? && token.present?
      @current_user = User.find_by(id: user_id)
      Rails.logger.info "ZERO AUTH DEBUG: Found user: #{@current_user&.name}" if Rails.env.test? && request.path.include?("zero/token")
    else
      @current_user = nil
      Rails.logger.info "ZERO AUTH DEBUG: No user found - missing cookies" if Rails.env.test? && request.path.include?("zero/token")
    end

    @current_user
  end
end
