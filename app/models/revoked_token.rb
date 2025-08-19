class RevokedToken < ApplicationRecord
  belongs_to :user

  validates :jti, presence: true, uniqueness: true
  validates :revoked_at, presence: true
  validates :expires_at, presence: true

  # Cleanup old expired tokens periodically
  scope :expired, -> { where("expires_at < ?", Time.current) }
  scope :active, -> { where("expires_at > ?", Time.current) }

  def self.revoked?(jti)
    active.exists?(jti: jti)
  end

  def self.revoke!(jti, user_id, expires_at)
    create!(
      jti: jti,
      user_id: user_id,
      revoked_at: Time.current,
      expires_at: expires_at
    )
  end

  # Clean up expired revoked tokens (run periodically)
  def self.cleanup_expired!
    expired.delete_all
  end
end
