#!/usr/bin/env ruby

require 'fileutils'

if ARGV.length != 1
  puts "Usage: ruby test_result_splitter.rb <test_results_file>"
  puts "Example: ruby test_result_splitter.rb /Users/claude/Projects/bos/frontend/test-results/raw-30-07.txt"
  exit 1
end

input_file = ARGV[0]

unless File.exist?(input_file)
  puts "Error: File #{input_file} does not exist"
  exit 1
end

# Extract filename without extension to create folder name
basename = File.basename(input_file, '.txt')
output_dir = File.join(File.dirname(input_file), basename)

# Create output directory
FileUtils.mkdir_p(output_dir)

# Initialize arrays for different test results
passed_tests = []
failed_tests = []
skipped_tests = []
all_webkit_candidates = [] # To collect all webkit tests and take only the last 88

# Find the failed summary line and skipped summary line to identify the skipped section
failed_summary_line = nil
skipped_summary_line = nil

File.readlines(input_file).each_with_index do |line, index|
  if line.strip.match?(/^\d+\s+failed$/)
    failed_summary_line = index + 1
  elsif line.strip.match?(/^\d+\s+skipped$/)
    skipped_summary_line = index + 1
    break # We can stop after finding the skipped line
  end
end

# Read and parse the file
File.readlines(input_file).each_with_index do |line, index|
  current_line_number = index + 1
  original_line = line
  stripped_line = line.strip
  next if stripped_line.empty?

  # Skip summary lines and meta lines
  next if stripped_line.match?(/^\d+ (skipped|passed|did not run|failed)/)
  next if stripped_line.match?(/^Running \d+ tests/)
  next if stripped_line.match?(/^🎭|^✅|^🔍|^📋|^⏳|^🔄|^🌱|^🔐|^💾|^🎉|^🚀|^🏥/)

  # Process only lines that exactly match playwright test result format
  case original_line
  when /^\s+✓\s+\d+\s+.+›/ # Passed: starts with spaces, ✓, number, has › separator
    clean_line = stripped_line.gsub(/^✓\s*\d+\s+/, '') # Remove ✓ and test number
                              .gsub(/\s*\(\d+\.?\d*[ms]+\)$/, '') # Remove timing info
                              .strip
    passed_tests << clean_line unless clean_line.empty?

  when /^\s+✘\s+\d+\s+.+›/ # Failed: starts with spaces, ✘, number, has › separator
    clean_line = stripped_line.gsub(/^✘\s*\d+\s+/, '') # Remove ✘ and test number
                              .gsub(/\s*\(\d+\.?\d*[ms]+\)$/, '') # Remove timing info
                              .strip
    failed_tests << clean_line unless clean_line.empty?

  when /^\s+\d+\s+.+›/ # IGNORE: These are preview/queue lines, not actual skipped tests
    # Skip these completely - they're duplicates that appear before actual status lines

  when /^\s+\[hybrid-webkit\]\s+›\s+.+›/ # Webkit tests - collect all candidates
    # Only process these if they're in the final section between failed and skipped summaries
    if failed_summary_line && skipped_summary_line &&
       current_line_number > failed_summary_line && current_line_number < skipped_summary_line
      clean_line = stripped_line.gsub(/^\[hybrid-webkit\]\s+›\s+/, '') # Remove browser context
                                .gsub(/\s*\(\d+\.?\d*[ms]+\)$/, '') # Remove timing info
                                .strip
      all_webkit_candidates << clean_line unless clean_line.empty?
    end
  end
end

# Take only the last 88 webkit tests as the actual skipped tests
skipped_tests = all_webkit_candidates.last(88)

# Write results to separate files
File.write(File.join(output_dir, 'passed.txt'), passed_tests.join("\n") + "\n") unless passed_tests.empty?
File.write(File.join(output_dir, 'failed.txt'), failed_tests.join("\n") + "\n") unless failed_tests.empty?
File.write(File.join(output_dir, 'skipped.txt'), skipped_tests.join("\n") + "\n") unless skipped_tests.empty?

puts "Results split into #{output_dir}/"
puts "  passed.txt: #{passed_tests.length} tests"
puts "  failed.txt: #{failed_tests.length} tests"
puts "  skipped.txt: #{skipped_tests.length} tests"
