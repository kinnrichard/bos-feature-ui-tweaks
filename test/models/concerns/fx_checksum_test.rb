require "test_helper"

class FxChecksumTest < ActiveSupport::TestCase
  test "calculates checksum for single digit" do
    # These are the actual values from the FileMaker algorithm
    assert_equal 1, FxChecksum.calculate("1")
    assert_equal 2, FxChecksum.calculate("2")
    assert_equal 3, FxChecksum.calculate("3")
    assert_equal 4, FxChecksum.calculate("4")
    assert_equal 5, FxChecksum.calculate("5")
  end

  test "calculates checksum for multi-digit numbers" do
    assert_equal 1, FxChecksum.calculate("1234")
    assert_equal 1, FxChecksum.calculate("5678")
    assert_equal 5, FxChecksum.calculate("6348")
    assert_equal 5, FxChecksum.calculate("8587")
    assert_equal 0, FxChecksum.calculate("1003")
  end

  test "validates numbers with correct checksums" do
    assert FxChecksum.valid?("63485")
    assert FxChecksum.valid?("30219")
    assert FxChecksum.valid?("81064")
    assert FxChecksum.valid?("12341")  # 1234 with checksum 1
    assert FxChecksum.valid?("56781")  # 5678 with checksum 1
  end

  test "rejects numbers with incorrect checksums" do
    assert_not FxChecksum.valid?("12345")  # Should be 12341
    assert_not FxChecksum.valid?("63486")  # Should be 63485
    assert_not FxChecksum.valid?("30210")  # Should be 30219
  end

  test "validates with prefix removal" do
    assert FxChecksum.valid?("P85875", prefix: "P")
    assert FxChecksum.valid?("P57862", prefix: "P")
    assert FxChecksum.valid?("NEW-100880", prefix: "NEW-")  # Valid checksum

    # Wrong prefix means it won't remove the P, so P85875 is invalid
    assert_not FxChecksum.valid?("P85875", prefix: "Q")
  end

  test "validates with suffix removal" do
    assert FxChecksum.valid?("63485.tmp", suffix: ".tmp")
    assert FxChecksum.valid?("30219-X", suffix: "-X")

    # Wrong suffix shouldn't affect validation if number is still valid
    assert_not FxChecksum.valid?("63485.tmp", suffix: ".doc")  # Tries to validate 63485.tmp which is invalid
  end

  test "validates with both prefix and suffix removal" do
    assert FxChecksum.valid?("P85875.tmp", prefix: "P", suffix: ".tmp")
    assert FxChecksum.valid?("NEW-63485-END", prefix: "NEW-", suffix: "-END")
  end

  test "handles edge cases" do
    # Empty string
    assert_not FxChecksum.valid?("")

    # Single digit (too short)
    assert_not FxChecksum.valid?("5")

    # Non-numeric characters without proper prefix/suffix
    assert_not FxChecksum.valid?("ABC123")

    # Valid after prefix removal
    assert FxChecksum.valid?("ABC12341", prefix: "ABC")
  end

  test "processes digits right-to-left with incrementing indices" do
    # This tests the FileMaker algorithm implementation
    # The algorithm processes from right to left with position 0, 1, 2, etc.

    # Test with known values from FileMaker implementation
    checksum1 = FxChecksum.calculate("6348")  # Should be 5
    assert_equal 5, checksum1

    checksum2 = FxChecksum.calculate("8587")  # Should be 5
    assert_equal 5, checksum2
  end

  test "handles nil and empty prefixes/suffixes gracefully" do
    assert FxChecksum.valid?("63485", prefix: nil, suffix: nil)
    assert FxChecksum.valid?("63485", prefix: "", suffix: "")
    assert FxChecksum.valid?("P85875", prefix: "P", suffix: nil)
    assert FxChecksum.valid?("63485.tmp", prefix: nil, suffix: ".tmp")
  end

  test "validates legacy IDs from CSV examples" do
    # Test a variety of IDs from the legacy system
    # Note: In the CSV, the ID column has the raw ID, and formatting is separate
    legacy_ids = [
      { id: "63485", prefix: "", suffix: "" },
      { id: "P85875", prefix: "P", suffix: "" },
      { id: "974174", prefix: "", suffix: "" },  # Dots are formatting, not part of ID
      { id: "955832", prefix: "", suffix: "" },  # Dots are formatting, not part of ID
      { id: "97175", prefix: "", suffix: "" }    # Dashes are formatting, not part of ID
    ]

    legacy_ids.each do |test_case|
      assert FxChecksum.valid?(test_case[:id], prefix: test_case[:prefix], suffix: test_case[:suffix]),
             "Failed to validate legacy ID: #{test_case[:id]}"
    end
  end
end
