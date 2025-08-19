class RefreshToken < ApplicationRecord
  belongs_to :user

  validates :jti, presence: true, uniqueness: true
  validates :family_id, presence: true
  validates :expires_at, presence: true

  scope :active, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }
  scope :by_family, ->(family_id) { where(family_id: family_id) }

  def revoke!
    update!(revoked_at: Time.current)
  end

  def revoked?
    revoked_at.present?
  end

  def expired?
    expires_at < Time.current
  end

  def valid_for_refresh?
    !revoked? && !expired?
  end

  # Revoke entire token family (used when potential token theft detected)
  def self.revoke_family!(family_id)
    by_family(family_id).update_all(revoked_at: Time.current)
  end
end
