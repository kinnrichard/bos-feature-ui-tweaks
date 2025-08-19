class Api::V1::Auth::SessionsController < Api::V1::BaseController
  skip_before_action :authenticate_request, only: [ :create, :refresh ]
  skip_before_action :verify_csrf_token_for_cookie_auth, only: [ :create, :refresh ]
  after_action :set_csrf_token_header, only: [ :create ]

  # POST /api/v1/auth/login
  def create
    user = User.find_by(email: login_params[:email]&.downcase)

    if user&.authenticate(login_params[:password])
      # Generate JWT tokens instead of simple tokens
      tokens = generate_tokens(user)
      set_auth_cookie(tokens[:access_token], tokens[:refresh_token])

      render json: {
        data: {
          type: "auth",
          id: user.id.to_s,
          attributes: {
            message: "Successfully authenticated",
            expires_at: tokens[:expires_at]
          },
          relationships: {
            user: {
              data: { type: "users", id: user.id.to_s }
            }
          }
        },
        included: [ {
          type: "users",
          id: user.id.to_s,
          attributes: {
            email: user.email,
            name: user.name,
            role: user.role
          }
        } ]
      }, status: :ok
    else
      render json: {
        errors: [ {
          status: "401",
          code: "INVALID_CREDENTIALS",
          title: "Authentication Failed",
          detail: "Invalid email or password"
        } ]
      }, status: :unauthorized
    end
  end

  # POST /api/v1/auth/refresh
  def refresh
    token = refresh_params[:refresh_token] || cookies.signed[:refresh_token]

    if token.blank?
      return render json: {
        errors: [ {
          status: "400",
          code: "MISSING_TOKEN",
          title: "Missing Refresh Token",
          detail: "Refresh token is required"
        } ]
      }, status: :bad_request
    end

    begin
      payload = JwtService.decode(token)

      if payload[:type] != "refresh"
        raise StandardError, "Invalid token type"
      end

      # Find the refresh token in database
      jti = payload[:jti] || payload["jti"]
      refresh_token_record = RefreshToken.find_by(jti: jti)

      if refresh_token_record.nil?
        raise StandardError, "Token not found"
      end

      # Check if token was already used (revoked) - indicates potential theft
      if refresh_token_record.revoked?
        # Token was already used - revoke entire family as this indicates token theft
        RefreshToken.revoke_family!(refresh_token_record.family_id)
        raise StandardError, "Token has already been used - potential security breach detected"
      end

      # Check if token is expired
      if refresh_token_record.expired?
        raise StandardError, "Token has expired"
      end

      # Revoke the old token (it's been used)
      refresh_token_record.revoke!

      # Generate new tokens with same family ID (rotation)
      user = User.find(payload[:user_id])
      new_tokens = generate_tokens(user, refresh_token_record.family_id)
      set_auth_cookie(new_tokens[:access_token], new_tokens[:refresh_token])

      render json: {
        user: UserSerializer.new(user),
        auth: {
          message: "Token refreshed successfully",
          expires_at: new_tokens[:expires_at],
          session_created_at: refresh_token_record.created_at,
          session_age_hours: ((Time.current - refresh_token_record.created_at) / 1.hour).round(2)
        }
      }, status: :ok
    rescue StandardError => e
      render json: {
        errors: [ {
          status: "401",
          code: "INVALID_TOKEN",
          title: "Invalid Refresh Token",
          detail: e.message
        } ]
      }, status: :unauthorized
    end
  end

  # POST /api/v1/auth/logout
  def destroy
    # Extract token to revoke it
    if auth_token.present?
      begin
        payload = JwtService.decode(auth_token)

        # Revoke the access token
        if payload[:jti] && payload[:exp]
          RevokedToken.revoke!(
            payload[:jti],
            current_user.id,
            Time.at(payload[:exp])
          )
        end

        # Also revoke the refresh token if present
        if cookies.signed[:refresh_token].present?
          refresh_payload = JwtService.decode(cookies.signed[:refresh_token])
          if refresh_payload[:jti] && refresh_payload[:exp]
            RevokedToken.revoke!(
              refresh_payload[:jti],
              current_user.id,
              Time.at(refresh_payload[:exp])
            )
          end
        end
      rescue StandardError => e
        Rails.logger.error "Error revoking tokens on logout: #{e.message}"
      end
    end

    clear_auth_cookies

    render json: {
      data: {
        type: "auth",
        attributes: {
          message: "Successfully logged out"
        }
      }
    }, status: :ok
  end

  private

  def auth_token
    # Use the same logic as Authenticatable concern
    if request.headers["Authorization"].present?
      request.headers["Authorization"].split(" ").last
    else
      cookies.signed[:auth_token]
    end
  end

  def login_params
    params.require(:auth).permit(:email, :password)
  end

  def refresh_params
    params.except(:session, :controller, :action).permit(:refresh_token)
  end

  def generate_tokens(user, existing_family_id = nil)
    # Generate new family ID if not rotating
    family_id = existing_family_id || SecureRandom.uuid
    jti = SecureRandom.uuid
    expires_at = 7.days.from_now

    # Create refresh token record
    user.refresh_tokens.create!(
      jti: jti,
      family_id: family_id,
      expires_at: expires_at,
      device_fingerprint: request.user_agent
    )

    # Generate tokens
    access_token = JwtService.encode(
      { user_id: user.id, type: "access" },
      30.minutes.from_now
    )

    # Generate refresh token with predefined JTI
    refresh_payload = {
      user_id: user.id,
      type: "refresh",
      jti: jti,
      family: family_id
    }
    refresh_payload[:exp] = expires_at.to_i
    refresh_payload[:iat] = Time.current.to_i

    # Encode without generating new JTI
    refresh_token = ::JWT.encode(refresh_payload, Rails.application.credentials.secret_key_base || Rails.application.secret_key_base, "HS256")

    {
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: 30.minutes.from_now.iso8601
    }
  end

  def set_auth_cookie(token, refresh_token = nil)
    cookies.signed[:auth_token] = {
      value: token,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :strict,
      expires: 30.minutes.from_now
    }

    # Set refresh token if provided
    if refresh_token
      cookies.signed[:refresh_token] = {
        value: refresh_token,
        httponly: true,
        secure: Rails.env.production?,
        same_site: :strict,
        expires: 7.days.from_now
      }
    end
  end

  def clear_auth_cookies
    cookies.delete(:auth_token)
    cookies.delete(:refresh_token)
  end
end
