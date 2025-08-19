require "test_helper"
require "csv"

class UniqueIdCsvValidationTest < ActiveSupport::TestCase
  def setup
    @csv_path = Rails.root.join("import", "legacy_unique_ids.csv")
  end

  test "CSV file exists" do
    assert File.exist?(@csv_path), "Legacy CSV file not found at #{@csv_path}"
  end

  test "all legacy IDs with checksums pass validation" do
    skip "CSV file not found" unless File.exist?(@csv_path)

    csv_text = File.read(@csv_path)
    entries = csv_text.split(/"\r"/)

    total_with_checksum = 0
    valid_count = 0
    invalid_ids = []

    entries.each_with_index do |entry, index|
      entry = entry.gsub(/^"/, "").gsub(/"$/, "")
      parts = entry.split('","')

      next unless parts.length >= 8

      id = parts[0]
      prefix = parts[4]
      suffix = parts[5]
      use_checksum = parts[7] == "1"

      if use_checksum
        total_with_checksum += 1

        if FxChecksum.valid?(id, prefix: prefix, suffix: suffix)
          valid_count += 1
        else
          invalid_ids << { index: index, id: id, prefix: prefix, suffix: suffix }
        end
      end
    end

    # Assert all IDs are valid
    assert_equal total_with_checksum, valid_count,
                 "Found #{invalid_ids.length} invalid IDs out of #{total_with_checksum} total"

    # If any are invalid, provide details
    if invalid_ids.any?
      invalid_ids.first(5).each do |invalid|
        puts "Invalid ID at index #{invalid[:index]}: #{invalid[:id]} (prefix: '#{invalid[:prefix]}', suffix: '#{invalid[:suffix]}')"
      end
    end
  end

  test "validates specific ID formats from CSV" do
    skip "CSV file not found" unless File.exist?(@csv_path)

    csv_text = File.read(@csv_path)
    entries = csv_text.split(/"\r"/)

    # Track different ID formats
    formats = {
      no_prefix_no_suffix: [],
      with_p_prefix: [],
      with_dot_suffix: [],
      with_dash_suffix: []
    }

    entries.each do |entry|
      entry = entry.gsub(/^"/, "").gsub(/"$/, "")
      parts = entry.split('","')

      next unless parts.length >= 8

      id = parts[0]
      prefix = parts[4]
      suffix = parts[5]
      use_checksum = parts[7] == "1"

      next unless use_checksum

      # Categorize by format
      if prefix.empty? && suffix.empty?
        formats[:no_prefix_no_suffix] << id if formats[:no_prefix_no_suffix].length < 5
      elsif prefix == "P"
        formats[:with_p_prefix] << id if formats[:with_p_prefix].length < 5
      elsif suffix == "."
        formats[:with_dot_suffix] << id if formats[:with_dot_suffix].length < 5
      elsif suffix == "-"
        formats[:with_dash_suffix] << id if formats[:with_dash_suffix].length < 5
      end
    end

    # Test each format
    formats[:no_prefix_no_suffix].each do |id|
      assert FxChecksum.valid?(id), "Failed to validate no-prefix ID: #{id}"
    end

    formats[:with_p_prefix].each do |id|
      assert FxChecksum.valid?(id, prefix: "P"), "Failed to validate P-prefix ID: #{id}"
    end

    formats[:with_dot_suffix].each do |id|
      assert FxChecksum.valid?(id, suffix: "."), "Failed to validate dot-suffix ID: #{id}"
    end

    formats[:with_dash_suffix].each do |id|
      assert FxChecksum.valid?(id, suffix: "-"), "Failed to validate dash-suffix ID: #{id}"
    end
  end

  test "CSV parsing handles malformed structure correctly" do
    skip "CSV file not found" unless File.exist?(@csv_path)

    csv_text = File.read(@csv_path)

    # The CSV uses \r as line separator and has no headers
    entries = csv_text.split(/"\r"/)

    # Verify we can parse entries
    assert entries.length > 0, "No entries found in CSV"

    # Check first entry structure
    first_entry = entries.first.gsub(/^"/, "").gsub(/"$/, "")
    parts = first_entry.split('","')

    assert_equal 8, parts.length, "Expected 8 columns in CSV"

    # Verify expected column positions based on documentation
    # Columns: ID, [unknown], ID Formatted, Minimum Length, Prefix, Suffix, [unknown], Use Checksum?
    id = parts[0]
    id_formatted = parts[2]
    min_length = parts[3]
    prefix = parts[4]
    suffix = parts[5]
    use_checksum = parts[7]

    assert_not_nil id, "ID column should not be nil"
    assert_match(/^\d+$/, min_length, "Minimum length should be numeric")
    assert [ "0", "1" ].include?(use_checksum), "Use checksum should be 0 or 1"
  end

  test "UniqueId model can validate all legacy CSV IDs" do
    skip "CSV file not found" unless File.exist?(@csv_path)

    csv_text = File.read(@csv_path)
    entries = csv_text.split(/"\r"/)

    # Test a sample of IDs using UniqueId class methods
    sample_count = 0
    max_samples = 20

    entries.each do |entry|
      break if sample_count >= max_samples

      entry = entry.gsub(/^"/, "").gsub(/"$/, "")
      parts = entry.split('","')

      next unless parts.length >= 8

      id = parts[0]
      use_checksum = parts[7] == "1"

      if use_checksum
        sample_count += 1

        # Create a temporary UniqueId record to test with
        temp_record = UniqueId.new(
          generated_id: id,
          prefix: parts[4],
          suffix: parts[5],
          minimum_length: parts[3].to_i,
          use_checksum: true
        )

        assert UniqueId.valid_checksum?(id, unique_id_record: temp_record),
               "UniqueId.valid_checksum? failed for legacy ID: #{id}"
      end
    end

    assert_equal max_samples, sample_count, "Should have tested #{max_samples} samples"
  end

  test "counts match expected totals" do
    skip "CSV file not found" unless File.exist?(@csv_path)

    csv_text = File.read(@csv_path)
    entries = csv_text.split(/"\r"/)

    stats = {
      total_entries: 0,
      with_checksum: 0,
      without_checksum: 0,
      by_prefix: Hash.new(0),
      by_suffix: Hash.new(0)
    }

    entries.each do |entry|
      entry = entry.gsub(/^"/, "").gsub(/"$/, "")
      parts = entry.split('","')

      next unless parts.length >= 8

      stats[:total_entries] += 1

      prefix = parts[4]
      suffix = parts[5]
      use_checksum = parts[7] == "1"

      if use_checksum
        stats[:with_checksum] += 1
        stats[:by_prefix][prefix.empty? ? "[none]" : prefix] += 1
        stats[:by_suffix][suffix.empty? ? "[none]" : suffix] += 1
      else
        stats[:without_checksum] += 1
      end
    end

    # Verify expected counts based on comprehensive analysis
    assert_equal 853, stats[:total_entries], "Total entries mismatch"
    assert_equal 852, stats[:with_checksum], "Entries with checksum mismatch"
    assert_equal 1, stats[:without_checksum], "Entries without checksum mismatch"

    # Verify prefix distribution
    assert_equal 831, stats[:by_prefix]["[none]"], "No-prefix count mismatch"
    assert_equal 21, stats[:by_prefix]["P"], "P-prefix count mismatch"

    # Verify suffix distribution
    assert_equal 629, stats[:by_suffix]["[none]"], "No-suffix count mismatch"
    assert_equal 222, stats[:by_suffix]["."], "Dot-suffix count mismatch"
    assert_equal 1, stats[:by_suffix]["-"], "Dash-suffix count mismatch"
  end
end
