require "test_helper"

class JwtServiceTest < ActiveSupport::TestCase
  test "encodes and decodes a valid token" do
    payload = { user_id: 1, role: "admin" }
    token = JwtService.encode(payload)

    decoded = JwtService.decode(token)

    assert_equal 1, decoded[:user_id]
    assert_equal "admin", decoded[:role]
    assert decoded[:exp].present?
    assert decoded[:iat].present?
    assert decoded[:jti].present?
  end

  test "raises error for expired token" do
    payload = { user_id: 1 }
    token = JwtService.encode(payload, 1.second.ago)

    assert_raises(JWT::ExpiredSignature) do
      JwtService.decode(token)
    end
  end

  test "raises error for invalid token" do
    assert_raises(JWT::DecodeError) do
      JwtService.decode("invalid.token.here")
    end
  end

  test "decode without verification returns payload for invalid signature" do
    payload = { user_id: 1 }
    token = JwtService.encode(payload)
    # Tamper with the token
    tampered_token = token.split(".")[0..1].join(".") + ".invalidsignature"

    decoded = JwtService.decode_without_verification(tampered_token)

    assert_equal 1, decoded["user_id"]
  end
end
