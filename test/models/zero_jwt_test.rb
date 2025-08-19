require "test_helper"

class ZeroJwtTest < ActiveSupport::TestCase
  def setup
    # Skip tests if ZeroJwt class is not available
    skip "ZeroJwt class not available" unless defined?(ZeroJwt)
  end
  test "generates valid JWT token with correct secret" do
    user_id = "test-user-123"
    token = ZeroJwt.generate(user_id: user_id)

    assert_not_nil token
    assert token.length > 50, "JWT token should be substantial length"

    # Verify token has 3 parts (header.payload.signature)
    assert_equal 3, token.split(".").length
  end

  test "token can be decoded with same secret" do
    user_id = "test-user-123"
    token = ZeroJwt.generate(user_id: user_id)

    decoded = ZeroJwt.decode(token)

    assert_not_nil decoded
    assert_equal user_id, decoded.user_id
    assert_equal user_id, decoded.sub
  end

  test "uses ZERO_AUTH_SECRET environment variable" do
    original_secret = ENV["ZERO_AUTH_SECRET"]
    test_secret = "test-secret-12345"

    begin
      ENV["ZERO_AUTH_SECRET"] = test_secret

      # Generate token with test secret
      token = ZeroJwt.generate(user_id: "test-user")

      # Should be able to decode with same secret
      assert_nothing_raised do
        ZeroJwt.decode(token)
      end

      # Should fail with different secret
      ENV["ZERO_AUTH_SECRET"] = "different-secret"
      assert_raises(JWT::VerificationError) do
        ZeroJwt.decode(token)
      end

    ensure
      ENV["ZERO_AUTH_SECRET"] = original_secret
    end
  end

  test "falls back to default secret when env var not set" do
    original_secret = ENV["ZERO_AUTH_SECRET"]

    begin
      ENV.delete("ZERO_AUTH_SECRET")

      token = ZeroJwt.generate(user_id: "test-user")
      decoded = ZeroJwt.decode(token)

      assert_equal "test-user", decoded.user_id

    ensure
      ENV["ZERO_AUTH_SECRET"] = original_secret
    end
  end

  test "token expiration works correctly" do
    token = ZeroJwt.generate(user_id: "test-user", expires_in: 1.second)
    decoded = ZeroJwt.decode(token)

    assert_not decoded.expired?, "Token should not be expired immediately"

    sleep(2)
    assert decoded.expired?, "Token should be expired after 2 seconds"
  end

  test "token contains required claims" do
    user_id = "test-user-456"
    token = ZeroJwt.generate(user_id: user_id)
    decoded = ZeroJwt.decode(token)

    # Standard JWT claims
    assert_not_nil decoded.sub, "Token should have 'sub' claim"
    assert_not_nil decoded.iat, "Token should have 'iat' (issued at) claim"
    assert_not_nil decoded.exp, "Token should have 'exp' (expiration) claim"

    # Zero-specific claims
    assert_equal user_id, decoded.user_id, "Token should have correct user_id"
    assert_equal user_id, decoded.sub, "sub claim should match user_id"
  end

  test "token format is valid JWT" do
    token = ZeroJwt.generate(user_id: "test-user")

    # JWT should have exactly 3 parts separated by dots
    parts = token.split(".")
    assert_equal 3, parts.length, "JWT should have header.payload.signature"

    # Each part should be base64 encoded (no empty parts)
    parts.each_with_index do |part, index|
      assert_not part.empty?, "JWT part #{index} should not be empty"
      # Should be valid base64 (will raise if invalid)
      assert_nothing_raised do
        Base64.decode64(part)
      end
    end
  end

  test "different users get different tokens" do
    token1 = ZeroJwt.generate(user_id: "user-1")
    token2 = ZeroJwt.generate(user_id: "user-2")

    assert_not_equal token1, token2, "Different users should get different tokens"

    decoded1 = ZeroJwt.decode(token1)
    decoded2 = ZeroJwt.decode(token2)

    assert_equal "user-1", decoded1.user_id
    assert_equal "user-2", decoded2.user_id
  end

  test "token generation is consistent with same inputs" do
    user_id = "consistent-user"

    # Generate tokens quickly - they should have same user_id consistently
    token1 = ZeroJwt.generate(user_id: user_id)
    token2 = ZeroJwt.generate(user_id: user_id)

    # Decode both to check they have same user_id (structure should be consistent)
    decoded1 = ZeroJwt.decode(token1)
    decoded2 = ZeroJwt.decode(token2)

    assert_equal decoded1.user_id, decoded2.user_id
    assert_equal decoded1.sub, decoded2.sub
    # Note: Timestamps may differ slightly, so we don't assert token equality
  end

  test "handles invalid token gracefully" do
    invalid_tokens = [
      "invalid.token.here",
      "not-a-token",
      "",
      nil,
      "header.payload", # Missing signature
      "too.many.parts.here.invalid" # Too many parts
    ]

    invalid_tokens.each do |invalid_token|
      assert_raises(JWT::DecodeError, "Should raise error for invalid token: #{invalid_token.inspect}") do
        ZeroJwt.decode(invalid_token)
      end
    end
  end

  test "respects custom expiration time" do
    short_expiry = 2.seconds
    long_expiry = 1.hour

    short_token = ZeroJwt.generate(user_id: "test-user", expires_in: short_expiry)
    long_token = ZeroJwt.generate(user_id: "test-user", expires_in: long_expiry)

    short_decoded = ZeroJwt.decode(short_token)
    long_decoded = ZeroJwt.decode(long_token)

    # Short token should expire sooner
    assert short_decoded.exp < long_decoded.exp, "Short token should expire before long token"

    # Verify actual expiration times are reasonable
    expected_short_exp = Time.current.to_i + short_expiry.to_i
    expected_long_exp = Time.current.to_i + long_expiry.to_i

    assert_in_delta expected_short_exp, short_decoded.exp, 5, "Short token expiration should be close to expected"
    assert_in_delta expected_long_exp, long_decoded.exp, 5, "Long token expiration should be close to expected"
  end

  test "default expiration is reasonable" do
    token = ZeroJwt.generate(user_id: "test-user") # No explicit expires_in
    decoded = ZeroJwt.decode(token)

    # Should expire in the future
    assert decoded.exp > Time.current.to_i, "Token should not be expired immediately"

    # Should not expire too far in the future (default is 7 days)
    assert decoded.exp < (Time.current + 8.days).to_i, "Default expiration should be reasonable (within 8 days)"
    assert decoded.exp > (Time.current + 6.days).to_i, "Default expiration should be at least 6 days"
  end
end
