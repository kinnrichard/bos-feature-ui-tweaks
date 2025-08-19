require "test_helper"
require "open3"

class NameNormalizerParityTest < ActiveSupport::TestCase
  # Test cases to ensure Ruby and TypeScript implementations match
  TEST_CASES = [
    # Basic cases
    "Test",
    "test",
    "TEST",
    "MiXeD",

    # Accented characters
    "Café",
    "niño",
    "François",
    "Zürich",
    "São Paulo",
    "Köln",

    # Special characters
    "ABC & Co.",
    "Test-Name",
    "Name (with) [brackets]",
    "Name @ Company",
    "Test!@#$%^&*()",

    # Whitespace
    "  spaced   out  ",
    "line\nbreak",
    "tab\tseparated",

    # Numbers
    "Test123",
    "123Test",
    "12345",

    # Edge cases
    "",
    "!@#$%^&*()",
    "   ",
    "\n\t\r",

    # Unicode edge cases
    "naïve",
    "résumé",
    "piñata",
    "über"
  ]

  def ruby_normalize(value)
    Shared::Normalizers::NameNormalizer.normalize(value)
  end

  def typescript_normalize(value)
    # Run TypeScript implementation via Node.js
    script = <<~JS
      const { normalizeString } = require('./frontend/src/lib/shared/normalizers/name-normalizer.ts');
      const input = process.argv[2];
      const result = normalizeString(input);
      console.log(result === null ? 'null' : result);
    JS

    # Use tsx to run TypeScript directly
    cmd = [ "npx", "tsx", "-e", script, "--", value ]
    stdout, stderr, status = Open3.capture3(*cmd)

    if !status.success?
      raise "TypeScript execution failed: #{stderr}"
    end

    result = stdout.strip
    result == "null" ? nil : result
  end

  test "Ruby and TypeScript implementations produce identical results" do
    TEST_CASES.each do |test_case|
      ruby_result = ruby_normalize(test_case)
      ts_result = typescript_normalize(test_case)

      assert_equal ruby_result, ts_result,
        "Mismatch for input '#{test_case}': Ruby=#{ruby_result.inspect}, TypeScript=#{ts_result.inspect}"
    end
  end
end
