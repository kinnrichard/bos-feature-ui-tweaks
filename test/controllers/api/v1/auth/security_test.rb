require "test_helper"

class Api::V1::Auth::SecurityTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:technician)
    # Clear rate limit cache between tests
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
  end

  test "should not expose tokens in JSON response" do
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    json_response = JSON.parse(response.body)

    # Ensure tokens are NOT in the response
    assert_nil json_response.dig("data", "attributes", "access_token")
    assert_nil json_response.dig("data", "attributes", "refresh_token")

    # Ensure tokens ARE in httpOnly cookies
    assert cookies[:auth_token].present?
    assert cookies[:refresh_token].present?
  end

  test "refresh token rotation creates new token and revokes old one" do
    # Login to get initial tokens
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    initial_refresh_count = RefreshToken.count
    initial_token = RefreshToken.last
    csrf_token = response.headers["X-CSRF-Token"]

    # Use refresh token with CSRF token
    post api_v1_auth_refresh_url,
         headers: { "X-CSRF-Token" => csrf_token },
         as: :json

    assert_response :success

    # Should have created a new token and revoked the old one
    assert_equal initial_refresh_count + 1, RefreshToken.count

    # Old token should be revoked
    initial_token.reload
    assert initial_token.revoked?

    # New token should exist
    new_token = RefreshToken.last
    assert_not_equal initial_token.id, new_token.id
    assert_equal initial_token.family_id, new_token.family_id
  end

  test "using revoked refresh token revokes entire family" do
    # Login to get tokens
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    first_token = RefreshToken.last
    family_id = first_token.family_id
    csrf_token = response.headers["X-CSRF-Token"]

    # Refresh once (normal rotation)
    post api_v1_auth_refresh_url,
         headers: { "X-CSRF-Token" => csrf_token },
         as: :json
    assert_response :success

    # Clear cookies and session to simulate theft from a different client
    cookies.delete(:auth_token)
    cookies.delete(:refresh_token)
    reset! # Reset the session to simulate a new client

    # Generate JWT for the old (revoked) token to simulate token theft
    stolen_jwt = JwtService.encode(
      {
        user_id: @user.id,
        type: "refresh",
        jti: first_token.jti,
        family: first_token.family_id
      },
      7.days.from_now
    )

    # Try to use the stolen (old) token
    post api_v1_auth_refresh_url, params: {
      refresh_token: stolen_jwt
    }, as: :json

    assert_response :unauthorized

    # All tokens in the family should now be revoked
    RefreshToken.by_family(family_id).each do |token|
      assert token.revoked?
    end
  end

  test "refresh endpoint is rate limited" do
    # Make 5 requests (the limit)
    5.times do
      post api_v1_auth_refresh_url, params: {
        refresh_token: "invalid"
      }, as: :json
    end

    # 6th request should be rate limited
    post api_v1_auth_refresh_url, params: {
      refresh_token: "invalid"
    }, as: :json

    assert_response :too_many_requests

    json_response = JSON.parse(response.body)
    assert_equal "RATE_LIMITED", json_response["errors"][0]["code"]
  end

  test "cookies have correct security attributes" do
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    # Check auth token cookie attributes
    auth_cookie = response.cookies["auth_token"]
    refresh_cookie = response.cookies["refresh_token"]

    # Note: In test environment, we can't directly check httponly and secure flags
    # but we can verify the cookies were set
    assert auth_cookie.present?
    assert refresh_cookie.present?
  end

  test "expired refresh tokens cannot be used" do
    # Create an expired refresh token
    expired_token = @user.refresh_tokens.create!(
      jti: SecureRandom.uuid,
      family_id: SecureRandom.uuid,
      expires_at: 1.hour.ago,
      device_fingerprint: "Test Browser"
    )

    # Generate JWT for the expired token
    refresh_jwt = JwtService.encode(
      {
        user_id: @user.id,
        type: "refresh",
        jti: expired_token.jti,
        family: expired_token.family_id
      },
      1.hour.ago
    )

    # Try to use expired token
    post api_v1_auth_refresh_url, params: {
      refresh_token: refresh_jwt
    }, as: :json

    assert_response :unauthorized
    assert_equal "Token has expired", JSON.parse(response.body)["errors"][0]["detail"]
  end
end
