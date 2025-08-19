require "jwt"

# Make sure JWT is available globally
Rails.application.config.to_prepare do
  require "jwt"
end
