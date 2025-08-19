# Normalizers

Normalizers transform data into a consistent format for storage and comparison. They are used to ensure data consistency across the application.

## Usage

Create a new normalizer by extending `BaseNormalizer`:

```ruby
module Shared
  module Normalizers
    class NameNormalizer < BaseNormalizer
      def self.normalize(value)
        return nil if value.blank?
        
        # Remove accents using Unicode normalization
        normalized = value.unicode_normalize(:nfd).gsub(/\p{Mn}/, '')
        
        # Convert to uppercase and remove non-alphanumeric
        normalized.upcase.gsub(/[^A-Z0-9]/, '')
      end
    end
  end
end
```

## Parity with TypeScript

Each normalizer should have an equivalent TypeScript implementation in `frontend/src/lib/shared/normalizers/` to ensure consistent behavior between client and server.