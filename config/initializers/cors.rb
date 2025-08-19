# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Support development (5173, 5174) and test (4173, 6173) frontend servers
    origins ENV.fetch("FRONTEND_URL", "http://localhost:5173"), "http://localhost:4173", "http://localhost:5174", "http://localhost:6173"

    resource "/api/*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options ],
      credentials: true,
      expose: %w[X-CSRF-Token X-Request-ID],  # Expose custom headers for JavaScript access
      max_age: 86400
  end
end
