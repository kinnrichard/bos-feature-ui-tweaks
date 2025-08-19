# Configuration for Claude CLI automation
Rails.application.config.after_initialize do
  # Ensure Claude CLI is available
  if Rails.env.production? || Rails.env.development?
    claude_available = system("which claude > /dev/null 2>&1")

    unless claude_available
      Rails.logger.warn "Claude CLI not found in PATH. Bug automation will not work."
      Rails.logger.warn "Please install Claude CLI: https://docs.anthropic.com/en/docs/claude-code"
    else
      Rails.logger.info "Claude CLI found. Bug automation is available."
    end
  end

  # Log automation status
  if ENV["BUG_AUTOMATION_ENABLED"] == "false"
    Rails.logger.info "Bug automation is DISABLED via BUG_AUTOMATION_ENABLED environment variable"
  else
    Rails.logger.info "Bug automation is ENABLED (set BUG_AUTOMATION_ENABLED=false to disable)"
  end
end
