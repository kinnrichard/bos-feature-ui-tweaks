# Validators

Validators ensure data meets business rules before it's saved. They return a validation result with a boolean `valid` flag and optional error messages.

## Usage

Create a new validator by extending `BaseValidator`:

```ruby
module Shared
  module Validators
    class UniqueNameValidator < BaseValidator
      def self.validate(value, context = {})
        model_class = context[:model_class]
        scope = context[:scope]
        existing_id = context[:id]
        
        query = model_class.where(normalized_name: value)
        query = query.where.not(id: existing_id) if existing_id
        query = query.where(scope) if scope
        
        if query.exists?
          validation_result(
            valid: false,
            errors: { normalized_name: ["has already been taken"] }
          )
        else
          validation_result(valid: true)
        end
      end
    end
  end
end
```

## Parity with TypeScript

Each validator should have an equivalent TypeScript implementation in `frontend/src/lib/shared/validators/` to ensure consistent validation between client and server.