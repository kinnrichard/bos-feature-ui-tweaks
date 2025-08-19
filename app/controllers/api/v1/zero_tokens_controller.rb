class Api::V1::ZeroTokensController < Api::V1::BaseController
  # Skip authentication for Zero token endpoint in development
  skip_before_action :authenticate_request, only: [ :create ]

  def create
    # Since we skip authenticate_request, manually resolve user from JWT token
    user = resolve_user_from_cookies

    if user
      token = ZeroJwt.generate(user_id: user.id)
      render json: {
        token: token,
        user_id: user.id.to_s  # Zero needs string user ID
      }, status: :ok
    else
      # No user authenticated - return unauthorized
      render json: { error: "Authentication required" }, status: :unauthorized
    end
  end

  private

  def resolve_user_from_cookies
    # Get JWT token from cookies
    token = cookies.signed[:auth_token]

    # Debug logging for troubleshooting
    if Rails.env.test?
      Rails.logger.info "ZERO RESOLVE DEBUG: auth_token present: #{token.present?}"
    end

    if token.present?
      begin
        # Decode JWT to get user info
        payload = JwtService.decode(token)

        # Check if token is revoked
        if payload[:jti] && RevokedToken.revoked?(payload[:jti])
          Rails.logger.info "ZERO RESOLVE DEBUG: Token is revoked" if Rails.env.test?
          return nil
        end

        # Find user from JWT payload
        user = User.find_by(id: payload[:user_id])
        Rails.logger.info "ZERO RESOLVE DEBUG: Found user: #{user&.name}" if Rails.env.test?
        user
      rescue JWT::DecodeError, JWT::ExpiredSignature => e
        Rails.logger.info "ZERO RESOLVE DEBUG: JWT decode error: #{e.message}" if Rails.env.test?
        nil
      end
    else
      Rails.logger.info "ZERO RESOLVE DEBUG: No auth token found" if Rails.env.test?
      nil
    end
  end
end
