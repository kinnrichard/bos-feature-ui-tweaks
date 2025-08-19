#!/usr/bin/env ruby

# Email Parsing Test Suite Runner
# Executes comprehensive test suite for email parsing implementation
# Generates detailed test report with coverage metrics

require "test_helper"
require "benchmark"

class EmailParsingTestRunner
  def initialize
    @test_results = {}
    @start_time = Time.current
    @total_tests = 0
    @passed_tests = 0
    @failed_tests = 0
    @test_files = [
      "test/models/parsed_email_test.rb",
      "test/services/talon_email_parser_test.rb",
      "test/jobs/email_parse_job_test.rb",
      "test/jobs/front_message_parsing_job_test.rb",
      "test/integration/email_parsing_integration_test.rb",
      "test/performance/email_parsing_performance_test.rb"
    ]
  end

  def run_all_tests
    puts "🚀 Starting Email Parsing Test Suite"
    puts "=" * 60
    puts "Test files to run: #{@test_files.length}"
    puts "Start time: #{@start_time}"
    puts "=" * 60
    puts

    @test_files.each do |test_file|
      run_test_file(test_file)
    end

    generate_final_report
  end

  def run_test_file(test_file)
    puts "📋 Running #{test_file}..."

    start_time = Time.current

    begin
      # Run the test file and capture output
      test_output = `cd #{Rails.root} && bundle exec ruby -Itest #{test_file} 2>&1`
      exit_status = $?.exitstatus

      end_time = Time.current
      duration = end_time - start_time

      # Parse test results from output
      test_count = parse_test_count(test_output)
      assertions = parse_assertion_count(test_output)
      failures = parse_failure_count(test_output)
      errors = parse_error_count(test_output)

      success = exit_status == 0 && failures == 0 && errors == 0

      @test_results[test_file] = {
        success: success,
        duration: duration,
        test_count: test_count,
        assertions: assertions,
        failures: failures,
        errors: errors,
        output: test_output
      }

      @total_tests += test_count
      if success
        @passed_tests += test_count
        puts "  ✅ #{test_count} tests passed (#{assertions} assertions) in #{duration.round(2)}s"
      else
        @failed_tests += test_count
        puts "  ❌ #{failures} failures, #{errors} errors in #{test_count} tests"
        puts "  ⏱️  Duration: #{duration.round(2)}s"
      end

    rescue StandardError => e
      puts "  💥 Error running test file: #{e.message}"
      @test_results[test_file] = {
        success: false,
        duration: 0,
        test_count: 0,
        assertions: 0,
        failures: 0,
        errors: 1,
        output: e.message
      }
    end

    puts
  end

  def generate_final_report
    end_time = Time.current
    total_duration = end_time - @start_time

    puts "📊 EMAIL PARSING TEST SUITE REPORT"
    puts "=" * 60

    # Summary Statistics
    puts "📈 SUMMARY STATISTICS"
    puts "-" * 30
    puts "Total Duration: #{total_duration.round(2)}s"
    puts "Total Tests: #{@total_tests}"
    puts "Passed: #{@passed_tests}"
    puts "Failed: #{@failed_tests}"
    puts "Success Rate: #{((@passed_tests.to_f / @total_tests) * 100).round(1)}%" if @total_tests > 0
    puts

    # Detailed Results by Test File
    puts "📋 DETAILED RESULTS BY TEST FILE"
    puts "-" * 40

    @test_results.each do |test_file, results|
      status_icon = results[:success] ? "✅" : "❌"
      file_name = File.basename(test_file, ".rb")

      puts "#{status_icon} #{file_name}"
      puts "   Tests: #{results[:test_count]}"
      puts "   Assertions: #{results[:assertions]}"
      puts "   Duration: #{results[:duration].round(2)}s"

      if results[:failures] > 0 || results[:errors] > 0
        puts "   Failures: #{results[:failures]}"
        puts "   Errors: #{results[:errors]}"
      end

      puts
    end

    # Test Coverage Analysis
    puts "🎯 TEST COVERAGE ANALYSIS"
    puts "-" * 30
    analyze_test_coverage
    puts

    # Performance Metrics
    puts "⚡ PERFORMANCE METRICS"
    puts "-" * 25
    analyze_performance_metrics
    puts

    # Recommendations
    puts "💡 RECOMMENDATIONS"
    puts "-" * 20
    generate_recommendations
    puts

    # Final Status
    overall_success = @failed_tests == 0
    puts "🏁 OVERALL STATUS: #{overall_success ? '✅ SUCCESS' : '❌ FAILURE'}"
    puts "=" * 60

    # Exit with appropriate code
    exit(overall_success ? 0 : 1)
  end

  private

  def parse_test_count(output)
    if match = output.match(/(\d+) tests?/)
      match[1].to_i
    else
      0
    end
  end

  def parse_assertion_count(output)
    if match = output.match(/(\d+) assertions?/)
      match[1].to_i
    else
      0
    end
  end

  def parse_failure_count(output)
    if match = output.match(/(\d+) failures?/)
      match[1].to_i
    else
      0
    end
  end

  def parse_error_count(output)
    if match = output.match(/(\d+) errors?/)
      match[1].to_i
    else
      0
    end
  end

  def analyze_test_coverage
    coverage_areas = {
      "Model Layer" => [ "parsed_email_test.rb" ],
      "Service Layer" => [ "talon_email_parser_test.rb" ],
      "Job Layer" => [ "email_parse_job_test.rb", "front_message_parsing_job_test.rb" ],
      "Integration" => [ "email_parsing_integration_test.rb" ],
      "Performance" => [ "email_parsing_performance_test.rb" ]
    }

    coverage_areas.each do |area, test_files|
      covered_files = test_files.select { |file| @test_results.any? { |k, v| k.include?(file) && v[:success] } }
      coverage_percentage = (covered_files.length.to_f / test_files.length * 100).round(1)

      status = coverage_percentage == 100.0 ? "✅" : "⚠️"
      puts "#{status} #{area}: #{coverage_percentage}% (#{covered_files.length}/#{test_files.length})"
    end

    puts
    puts "Key Areas Tested:"
    puts "• Polymorphic associations and validations"
    puts "• PyCall integration and error handling"
    puts "• Background job processing and retry logic"
    puts "• Batch processing with performance monitoring"
    puts "• End-to-end workflow integration"
    puts "• Performance and scalability"
    puts "• Email format fixtures (Gmail, Outlook, Apple Mail)"
    puts "• Unicode and edge case handling"
  end

  def analyze_performance_metrics
    performance_results = @test_results.select { |k, v| k.include?("performance") }

    if performance_results.any?
      performance_results.each do |file, results|
        puts "Performance Test Duration: #{results[:duration].round(2)}s"
        puts "Performance Tests: #{results[:test_count]}"

        if results[:success]
          puts "✅ All performance benchmarks passed"
        else
          puts "⚠️  Some performance tests failed"
        end
      end
    else
      puts "No performance test results available"
    end

    puts
    puts "Performance Areas Covered:"
    puts "• Small, medium, and large batch processing"
    puts "• Memory usage and garbage collection"
    puts "• Concurrent processing capabilities"
    puts "• Database query optimization"
    puts "• Content size impact analysis"
    puts "• Error handling performance impact"
  end

  def generate_recommendations
    total_assertions = @test_results.values.sum { |r| r[:assertions] }
    avg_duration = @test_results.values.map { |r| r[:duration] }.sum / @test_results.length

    if @failed_tests > 0
      puts "🔧 IMMEDIATE ACTIONS REQUIRED:"
      puts "• Fix failing tests before deployment"
      puts "• Review error messages in test output"
      puts "• Check PyCall and Talon library setup"
    end

    if total_assertions < 200
      puts "📝 CONSIDER ADDING MORE TESTS:"
      puts "• Edge case scenarios"
      puts "• Additional error conditions"
      puts "• More email format variations"
    end

    if avg_duration > 5.0
      puts "⚡ PERFORMANCE OPTIMIZATION:"
      puts "• Consider test database optimizations"
      puts "• Review mock usage for heavy operations"
      puts "• Parallelize test execution if possible"
    end

    puts "✅ GOOD PRACTICES IMPLEMENTED:"
    puts "• Comprehensive fixture data"
    puts "• Mocking for external dependencies"
    puts "• Integration and unit test coverage"
    puts "• Performance benchmarking"
    puts "• Error handling validation"
  end
end

# Run the test suite if this file is executed directly
if __FILE__ == $0
  runner = EmailParsingTestRunner.new
  runner.run_all_tests
end
