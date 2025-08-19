require "test_helper"

class UniqueIdTest < ActiveSupport::TestCase
  test "generates unique ID with default settings" do
    unique_id = UniqueId.generate
    assert unique_id.persisted?
    assert_not_nil unique_id.generated_id
    assert unique_id.generated_id.length >= 5
  end

  test "generates unique ID with checksum" do
    unique_id = UniqueId.generate(use_checksum: true, minimum_length: 5)
    assert unique_id.use_checksum
    assert UniqueId.valid_checksum?(unique_id.generated_id, unique_id_record: unique_id)
  end

  test "generates unique ID without checksum" do
    unique_id = UniqueId.generate(use_checksum: false, minimum_length: 5)
    assert_not unique_id.use_checksum
    assert unique_id.generated_id.length >= 5
  end

  test "generates unique ID with prefix" do
    unique_id = UniqueId.generate(prefix: "P", use_checksum: true, minimum_length: 6)
    assert unique_id.generated_id.start_with?("P")
    assert unique_id.generated_id.length >= 6
    assert UniqueId.valid_checksum?(unique_id.generated_id, unique_id_record: unique_id)
  end

  test "generates unique ID with suffix" do
    unique_id = UniqueId.generate(suffix: "-X", use_checksum: true, minimum_length: 7)
    assert unique_id.generated_id.end_with?("-X")
    assert unique_id.generated_id.length >= 7
    assert UniqueId.valid_checksum?(unique_id.generated_id, unique_id_record: unique_id)
  end

  test "generates unique ID with prefix and suffix" do
    unique_id = UniqueId.generate(prefix: "NEW-", suffix: ".tmp", use_checksum: true, minimum_length: 12)
    assert unique_id.generated_id.start_with?("NEW-")
    assert unique_id.generated_id.end_with?(".tmp")
    assert unique_id.generated_id.length >= 12
    assert UniqueId.valid_checksum?(unique_id.generated_id, unique_id_record: unique_id)
  end

  test "enforces uniqueness of generated_id" do
    unique_id1 = UniqueId.generate
    assert_raises(ActiveRecord::RecordInvalid) do
      UniqueId.create!(generated_id: unique_id1.generated_id)
    end
  end

  test "calculate_checksum returns correct value" do
    # Test known values from the legacy system
    assert_equal 5, UniqueId.calculate_checksum("6348")
    assert_equal 5, UniqueId.calculate_checksum("8587")
    assert_equal 1, UniqueId.calculate_checksum("1234")
    assert_equal 1, UniqueId.calculate_checksum("5678")
    assert_equal 1, UniqueId.calculate_checksum("9999")
  end

  test "valid_checksum? validates correctly with known IDs" do
    # Test IDs from the legacy system
    assert UniqueId.valid_checksum?("63485")
    assert UniqueId.valid_checksum?("P85875")
    assert UniqueId.valid_checksum?("30219")
    assert UniqueId.valid_checksum?("81064")

    # Test invalid checksums
    assert_not UniqueId.valid_checksum?("12345")
    assert_not UniqueId.valid_checksum?("P11114")
  end

  test "valid_checksum? works with UniqueId record" do
    unique_id = UniqueId.generate(prefix: "TEST-", suffix: ".id", use_checksum: true)
    assert UniqueId.valid_checksum?(unique_id.generated_id, unique_id_record: unique_id)
  end

  test "regenerate_id! creates new ID" do
    unique_id = UniqueId.generate
    original_id = unique_id.generated_id

    unique_id.regenerate_id!
    assert_not_equal original_id, unique_id.generated_id
    assert unique_id.persisted?
  end

  test "minimum_length validation" do
    assert_raises(ActiveRecord::RecordInvalid) do
      UniqueId.generate(minimum_length: 0)
    end
  end

  test "increases length when exhausting shorter IDs" do
    # This test is conceptual - in practice we'd need to mock random generation
    # to force collisions and test the length increase logic
    unique_id = UniqueId.new(minimum_length: 5, use_checksum: true)
    unique_id.send(:generate_id)
    assert_not_nil unique_id.generated_id
  end

  test "polymorphic association works correctly" do
    unique_id = UniqueId.generate
    # Can be associated with any model via identifiable
    assert_nil unique_id.identifiable
    assert unique_id.valid?
  end
end
