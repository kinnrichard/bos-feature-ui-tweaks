# Completely disable rack-attack for development
# This file must be named rack_attack.rb to override any gem defaults

if Rails.env.development?
  # Create empty module to prevent any configuration from loading
  module Rack
    class Attack
      def self.enabled?
        false
      end

      def self.throttle(*args)
        # no-op
      end

      def self.blocklist(*args)
        # no-op
      end

      def self.safelist(*args)
        # no-op
      end

      def self.cache
        @cache ||= ActiveSupport::Cache::NullStore.new
      end
    end
  end

  # No need to remove middleware since we're stubbing the class
end
