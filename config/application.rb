require_relative "boot"

# Load only the Rails components needed for API mode
require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
# require "active_storage/railtie" # Not needed - will use direct S3 uploads in future
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_cable/engine"
# require "action_mailbox/railtie"
# require "action_text/railtie"
# require "action_view/railtie"
require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Bos
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.0

    # Configure Rails as API-only mode for Svelte frontend
    config.api_only = true

    # Enable cookies and sessions for API authentication and CSRF protection
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use ActionDispatch::Session::CookieStore
    config.middleware.use ActionDispatch::Flash
    config.session_store :cookie_store, key: "_bos_api_session"

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Autoload custom error classes
    config.autoload_paths << Rails.root.join("app/errors")

    # Configure strong parameters to raise on unpermitted parameters
    config.action_controller.action_on_unpermitted_parameters = :raise

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    config.time_zone = "Eastern Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")
  end
end
