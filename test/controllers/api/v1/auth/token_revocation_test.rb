require "test_helper"

class Api::V1::Auth::TokenRevocationTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:technician)
  end

  test "logout should revoke access and refresh tokens" do
    # Login to get tokens
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    assert_response :success
    csrf_token = response.headers["X-CSRF-Token"]

    # Count revoked tokens before logout
    initial_count = RevokedToken.count

    # Logout should revoke tokens
    post api_v1_auth_logout_url,
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    assert_response :success

    # Check that tokens were revoked (should add 2: access + refresh)
    assert_equal initial_count + 2, RevokedToken.count
  end

  test "revoked token should be rejected for API calls" do
    # Login to get tokens
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    csrf_token = response.headers["X-CSRF-Token"]

    # Logout to revoke tokens
    post api_v1_auth_logout_url,
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    # Try to use the revoked token
    get api_v1_jobs_url, as: :json

    assert_response :unauthorized
  end

  test "cleanup job should remove expired revoked tokens" do
    # Create some revoked tokens
    expired_token = RevokedToken.create!(
      jti: SecureRandom.uuid,
      user: @user,
      user_uuid: @user.uuid,
      revoked_at: 2.hours.ago,
      expires_at: 1.hour.ago
    )

    active_token = RevokedToken.create!(
      jti: SecureRandom.uuid,
      user: @user,
      user_uuid: @user.uuid,
      revoked_at: Time.current,
      expires_at: 1.hour.from_now
    )

    # Run cleanup job
    CleanupRevokedTokensJob.perform_now

    # Expired token should be gone
    assert_not RevokedToken.exists?(expired_token.id)

    # Active token should remain
    assert RevokedToken.exists?(active_token.id)
  end

  test "revoked? method should only check active tokens" do
    # Create expired revoked token
    expired_jti = SecureRandom.uuid
    RevokedToken.create!(
      jti: expired_jti,
      user: @user,
      user_uuid: @user.uuid,
      revoked_at: 2.hours.ago,
      expires_at: 1.hour.ago
    )

    # Create active revoked token
    active_jti = SecureRandom.uuid
    RevokedToken.create!(
      jti: active_jti,
      user: @user,
      user_uuid: @user.uuid,
      revoked_at: Time.current,
      expires_at: 1.hour.from_now
    )

    # Should not consider expired tokens as revoked
    assert_not RevokedToken.revoked?(expired_jti)

    # Should consider active tokens as revoked
    assert RevokedToken.revoked?(active_jti)
  end
end
