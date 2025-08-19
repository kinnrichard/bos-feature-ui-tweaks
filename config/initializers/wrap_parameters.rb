# Be sure to restart your server when you modify this file.

# This file configures how Rails wraps parameters.
# For API-only applications, we want to disable parameter wrapping
# to avoid issues with strong parameters.

# Disable parameter wrapping for API controllers
ActiveSupport.on_load(:action_controller) do
  wrap_parameters false if respond_to?(:wrap_parameters)
end
