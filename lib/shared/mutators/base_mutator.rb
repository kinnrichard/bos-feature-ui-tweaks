module Shared
  module Mutators
    class BaseMutator
      def self.mutate(data, context = {})
        raise NotImplementedError, "Subclasses must implement the mutate method"
      end
    end
  end
end
