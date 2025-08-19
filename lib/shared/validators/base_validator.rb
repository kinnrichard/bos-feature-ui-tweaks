module Shared
  module Validators
    class BaseValidator
      def self.validate(value, context = {})
        raise NotImplementedError, "Subclasses must implement the validate method"
      end

      protected

      def self.validation_result(valid:, errors: {})
        { valid: valid, errors: errors }
      end
    end
  end
end
