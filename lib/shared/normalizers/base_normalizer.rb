module Shared
  module Normalizers
    class BaseNormalizer
      def self.normalize(value)
        raise NotImplementedError, "Subclasses must implement the normalize method"
      end
    end
  end
end
