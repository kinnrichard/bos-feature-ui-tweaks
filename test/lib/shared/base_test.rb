require "test_helper"

class SharedLogicInfrastructureTest < ActiveSupport::TestCase
  test "normalizers directory exists" do
    assert File.directory?(Rails.root.join("lib/shared/normalizers"))
  end

  test "validators directory exists" do
    assert File.directory?(Rails.root.join("lib/shared/validators"))
  end

  test "mutators directory exists" do
    assert File.directory?(Rails.root.join("lib/shared/mutators"))
  end

  test "loads BaseNormalizer" do
    assert_nothing_raised { Shared::Normalizers::BaseNormalizer }
  end

  test "loads BaseValidator" do
    assert_nothing_raised { Shared::Validators::BaseValidator }
  end

  test "loads BaseMutator" do
    assert_nothing_raised { Shared::Mutators::BaseMutator }
  end

  test "BaseNormalizer defines normalize interface" do
    assert_respond_to Shared::Normalizers::BaseNormalizer, :normalize
  end

  test "BaseNormalizer raises NotImplementedError for base class" do
    assert_raises(NotImplementedError) do
      Shared::Normalizers::BaseNormalizer.normalize("test")
    end
  end

  test "BaseValidator defines validate interface" do
    assert_respond_to Shared::Validators::BaseValidator, :validate
  end

  test "BaseValidator returns validation result structure" do
    # Create a concrete validator for testing
    test_validator = Class.new(Shared::Validators::BaseValidator) do
      def self.validate(value, context = {})
        validation_result(valid: true)
      end
    end

    result = test_validator.validate("test")
    assert_includes result, :valid
    assert_includes result, :errors
    assert result[:valid]
    assert_equal({}, result[:errors])
  end

  test "BaseMutator defines mutate interface" do
    assert_respond_to Shared::Mutators::BaseMutator, :mutate
  end

  test "BaseMutator raises NotImplementedError for base class" do
    assert_raises(NotImplementedError) do
      Shared::Mutators::BaseMutator.mutate({})
    end
  end

  test "BaseMutator passes through data in concrete implementation" do
    # Create a concrete mutator for testing
    test_mutator = Class.new(Shared::Mutators::BaseMutator) do
      def self.mutate(data, context = {})
        data
      end
    end

    data = { name: "test" }
    assert_equal data, test_mutator.mutate(data)
  end
end
