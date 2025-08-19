source "https://rubygems.org"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 8.0.2"
# Action Cable for WebSocket connections (real-time features)
gem "actioncable", "~> 8.0.2"
# The modern asset pipeline for Rails [https://github.com/rails/propshaft]
# gem "propshaft" # Not needed for API mode
# Dart Sass for SCSS compilation
# gem "dartsass-rails" # Not needed for API mode
# Use PostgreSQL as the database for Active Record
gem "pg", "~> 1.1"
# Use Active Storage for file uploads
gem "image_processing", "~> 1.2"
# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"
# API-only mode gems
gem "rack-cors"
gem "jsonapi-serializer"
# gem "rack-attack" # Temporarily disabled for development
# For drag-and-drop ordering - REMOVED (using custom position calculation system)
# gem "positioning"
# Soft deletion
gem "discard", "~> 1.3"
# Pagination
gem "kaminari"

gem "faraday-retry"

gem "frontapp"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
gem "bcrypt", "~> 3.1.7"
# JWT for token-based authentication
gem "jwt"

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Use the database-backed adapters for Rails.cache and Action Cable
gem "solid_cache"
# gem "solid_queue" # Replaced with GoodJob due to heartbeat issues
gem "good_job", "~> 4.0"
gem "solid_cable"

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Deploy this application anywhere as a Docker container [https://kamal-deploy.org]
gem "kamal", require: false

# Add HTTP asset caching/compression and X-Sendfile acceleration to Puma [https://github.com/basecamp/thruster/]
gem "thruster", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
# gem "image_processing", "~> 1.2"

# CSV parsing
gem "csv"

# Phone number parsing and validation
gem "phonelib"

# GitHub API client for issue creation and PR management
gem "octokit", "~> 9.1"

# PyCall for Python integration (email parsing with Talon)
gem "pycall", "~> 1.5"
# Explicit fiddle dependency (required for pycall, no longer default in Ruby 3.5+)
gem "fiddle"

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"

  # Static analysis for security vulnerabilities [https://brakemanscanner.org/]
  gem "brakeman", require: false

  # Omakase Ruby styling [https://github.com/rails/rubocop-rails-omakase/]
  gem "rubocop-rails-omakase", require: false
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem "web-console"

  # Process manager for multi-service development
  gem "foreman"

  # Load environment variables from .env files
  gem "dotenv-rails"
end

group :test do
  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem "capybara"
  gem "selenium-webdriver"
  # Mocking and stubbing
  gem "mocha"
end
