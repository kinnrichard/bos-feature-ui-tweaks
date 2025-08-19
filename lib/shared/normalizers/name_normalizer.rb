module Shared
  module Normalizers
    class NameNormalizer < BaseNormalizer
      def self.normalize(value)
        return nil if value.blank?

        # Remove accents using Unicode normalization
        # NFD = Canonical Decomposition
        # This separates base characters from combining marks (accents)
        normalized = value.unicode_normalize(:nfd)

        # Remove combining marks (accents)
        # \p{Mn} matches Unicode Mark, Nonspacing characters
        normalized = normalized.gsub(/\p{Mn}/, "")

        # Convert to uppercase
        normalized = normalized.upcase

        # Remove all non-alphanumeric characters
        normalized = normalized.gsub(/[^A-Z0-9]/, "")

        # Return nil if result is empty
        normalized.presence
      end
    end
  end
end
