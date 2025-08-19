# PyCall configuration for Python integration
# This initializer sets up PyCall to interface with Python libraries
# for email reply parsing using the Talon library

# IMPORTANT: PyCall initialization is lazy-loaded to prevent blocking Rails startup
# The actual Python import happens on first use, not during Rails initialization

module TalonParserHelper
  class << self
    def parser
      @parser ||= initialize_parser
    end

    def available?
      return false unless defined?(PyCall)

      # Try to initialize if not already done
      parser.present?
    rescue StandardError
      false
    end

    def health_check
      return { status: :unavailable, message: "PyCall not loaded" } unless defined?(PyCall)

      begin
        if parser
          # Test basic Talon functionality
          test_email = "Reply text\n\nOn Mon, Dec 1, 2014 at 11:55 AM, Original Sender wrote:\n> Original message"

          # This will fail gracefully if Talon isn't properly installed
          quotations = parser.quotations rescue nil
          if quotations
            result = quotations.extract_from(test_email) rescue nil

            {
              status: :available,
              message: "Talon parser is working correctly",
              test_result: result
            }
          else
            {
              status: :unavailable,
              message: "Talon quotations module not available"
            }
          end
        else
          {
            status: :unavailable,
            message: "Talon not initialized"
          }
        end
      rescue StandardError => e
        {
          status: :error,
          message: "Talon parser error: #{e.message}"
        }
      end
    end

    private

    def initialize_parser
      return nil unless defined?(PyCall)

      begin
        # Set a timeout for the import to prevent hanging
        Timeout.timeout(5) do
          talon = PyCall.import_module("talon")
          Rails.logger.info "PyCall initialized successfully with Talon library"
          talon
        end
      rescue Timeout::Error
        Rails.logger.error "Timeout: Failed to initialize Talon library within 5 seconds"
        nil
      rescue PyCall::PyError => e
        Rails.logger.error "Failed to initialize Talon library: #{e.message}"
        nil
      rescue StandardError => e
        Rails.logger.error "Unexpected error initializing PyCall: #{e.message}"
        nil
      end
    end
  end
end

# Store reference for backward compatibility
Rails.application.config.talon_parser = TalonParserHelper
