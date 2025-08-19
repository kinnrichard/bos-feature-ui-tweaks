# Mutators

Mutators transform data before it's saved, adding computed fields, timestamps, or other modifications. They run in a specific order and can be chained together.

## Usage

Create a new mutator by extending `BaseMutator`:

```ruby
module Shared
  module Mutators
    class UserAttributionMutator < BaseMutator
      def self.mutate(data, context = {})
        user = context[:current_user]
        raise "No authenticated user for attribution" unless user
        
        if data[:id].nil? # New record
          data.merge(
            created_by_id: user.id,
            updated_by_id: user.id
          )
        else # Update
          data.merge(updated_by_id: user.id)
        end
      end
    end
  end
end
```

## Common Mutators

- **UserAttributionMutator**: Adds created_by/updated_by fields
- **TimestampMutator**: Manages created_at/updated_at
- **SoftDeleteMutator**: Handles discarded_at for soft deletes
- **PositioningMutator**: Manages position fields for ordered lists

## Parity with TypeScript

Each mutator should have an equivalent TypeScript implementation in `frontend/src/lib/shared/mutators/` to ensure consistent behavior between client and server.