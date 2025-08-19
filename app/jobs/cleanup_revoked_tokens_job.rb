class CleanupRevokedTokensJob < ApplicationJob
  queue_as :low

  def perform
    # Remove revoked tokens that have already expired
    # (no need to keep them since the JWT itself is expired)
    deleted_count = RevokedToken.cleanup_expired!

    Rails.logger.info "Cleaned up #{deleted_count} expired revoked tokens"
  end
end
