class ZeroJwt
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :user_id, :string
  attribute :sub, :string
  attribute :exp, :integer
  attribute :iat, :integer

  def self.generate(user_id:, expires_in: 7.days)
    now = Time.current.to_i
    payload = {
      sub: user_id.to_s,  # Zero requires sub to be a string
      user_id: user_id.to_s,  # Also include user_id for compatibility
      exp: now + expires_in.to_i,
      iat: now  # Include issued at timestamp
    }

    # Use the same secret as zero-config.json
    secret = ENV["ZERO_AUTH_SECRET"] || "dev-secret-change-in-production"
    JWT.encode(payload, secret)
  end

  def self.decode(token)
    # Use the same secret as zero-config.json
    secret = ENV["ZERO_AUTH_SECRET"] || "dev-secret-change-in-production"
    payload = JWT.decode(token, secret).first
    new(
      user_id: payload["user_id"] || payload["sub"],
      sub: payload["sub"],
      exp: payload["exp"],
      iat: payload["iat"]
    )
  rescue JWT::DecodeError, JWT::VerificationError => e
    Rails.logger.error "JWT decode error: #{e.message}"
    raise e  # Re-raise for proper error handling in tests
  end

  def expired?
    return true unless exp
    Time.current.to_i > exp
  end

  def valid?
    user_id.present? && !expired?
  end
end
