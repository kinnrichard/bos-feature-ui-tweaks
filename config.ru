# This file is used by Rack-based servers to start the application.

require_relative "config/environment"

# Simple health check that bypasses Rails entirely
map "/up" do
  run lambda { |env| [ 200, { "Content-Type" => "text/plain" }, [ "OK" ] ] }
end

# Everything else goes to Rails
run Rails.application
Rails.application.load_server
