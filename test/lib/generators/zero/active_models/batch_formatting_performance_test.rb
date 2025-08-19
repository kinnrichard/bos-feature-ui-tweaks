# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "json"
require "pathname"
require "benchmark"
require "mocha/minitest"
require "generators/zero/active_models/generation_coordinator"
require "generators/zero/active_models/service_registry"
require "generators/zero/active_models/file_manager"

module Zero
  module Generators
    class BatchFormattingPerformanceTest < ActiveSupport::TestCase
      def setup
        @temp_dir = Dir.mktmpdir
        @output_dir = File.join(@temp_dir, "output")
        @frontend_dir = File.join(@temp_dir, "frontend")

        # Create silent shell for performance testing
        @shell = Object.new
        def @shell.say(message, color = nil); end
        def @shell.say_status(status, message, color = nil); end

        # Setup Rails.root mock
        Rails.stubs(:root).returns(Pathname.new(@temp_dir))
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))

        # Create frontend environment with prettier
        create_frontend_environment

        # Performance test parameters
        @file_count = 20  # Number of files to test with
        @target_improvement = 80  # Minimum 80% improvement required
        @baseline_time = 30.0  # Engineer reported 30s baseline before optimization
      end

      def teardown
        FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
      end

      # =============================================================================
      # Performance Validation Tests - 80-95% Improvement Target
      # =============================================================================

      test "batch formatting achieves 80-95% performance improvement over individual formatting" do
        # Skip if prettier is not available (CI environments)
        skip "Prettier not available for performance testing" unless prettier_available_for_testing?

        # Generate test content that simulates real TypeScript models
        test_files = generate_realistic_model_content(@file_count)

        # Measure individual formatting performance (baseline)
        individual_time = measure_individual_formatting_time(test_files)

        # Measure batch formatting performance (optimized)
        batch_time = measure_batch_formatting_time(test_files)

        # Calculate improvement percentage
        improvement_percent = ((individual_time - batch_time) / individual_time * 100).round(2)

        # Log performance results
        puts "\n=== Performance Test Results ==="
        puts "Individual formatting: #{individual_time.round(4)}s"
        puts "Batch formatting: #{batch_time.round(4)}s"
        puts "Improvement: #{improvement_percent}%"
        puts "Target: #{@target_improvement}% minimum"

        # Verify improvement meets target
        assert improvement_percent >= @target_improvement,
               "Performance improvement (#{improvement_percent}%) must be at least #{@target_improvement}%"

        # Verify absolute performance meets Engineer's reported improvement
        expected_max_time = @baseline_time * (1 - @target_improvement / 100.0)
        assert batch_time <= expected_max_time,
               "Batch time (#{batch_time}s) should be <= #{expected_max_time}s (#{@target_improvement}% improvement from #{@baseline_time}s baseline)"
      end

      test "batch formatting performance scales linearly with file count" do
        skip "Prettier not available for scaling test" unless prettier_available_for_testing?

        file_counts = [ 5, 10, 20 ]
        performance_data = []

        file_counts.each do |count|
          test_files = generate_realistic_model_content(count)

          # Measure batch formatting time for this file count
          batch_time = measure_batch_formatting_time(test_files)
          time_per_file = batch_time / count

          performance_data << {
            file_count: count,
            total_time: batch_time,
            time_per_file: time_per_file
          }

          puts "#{count} files: #{batch_time.round(4)}s total, #{time_per_file.round(4)}s per file"
        end

        # Verify scaling is reasonable (time per file shouldn't increase dramatically)
        times_per_file = performance_data.map { |d| d[:time_per_file] }
        max_time_per_file = times_per_file.max
        min_time_per_file = times_per_file.min

        scaling_factor = max_time_per_file / min_time_per_file

        # Scaling factor should be reasonable (< 2x degradation)
        assert scaling_factor < 2.0,
               "Performance should scale linearly. Scaling factor: #{scaling_factor.round(2)}"
      end

      test "memory usage remains within configured limits during batch processing" do
        # Test with memory-constrained configuration
        options = {
          dry_run: false,
          skip_prettier: false,
          batch_max_files: 50,
          batch_max_memory_mb: 10,  # 10MB limit
          output_dir: @output_dir
        }

        coordinator = GenerationCoordinator.new(options, @shell)
        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Generate large content that approaches memory limits
        large_files = generate_large_model_content(15, 1024)  # 15 files, ~1KB each

        # Track memory usage during processing
        max_memory_used = 0
        memory_snapshots = []

        large_files.each do |file_info|
          file_manager.send(:collect_for_batch_formatting,
                           file_info[:path], file_info[:content], file_info[:relative_path])

          current_memory = file_manager.batch_status[:memory_estimate_mb]
          max_memory_used = [ max_memory_used, current_memory ].max
          memory_snapshots << current_memory
        end

        puts "\nMemory Usage Analysis:"
        puts "Max memory used: #{max_memory_used.round(2)}MB"
        puts "Memory limit: #{options[:batch_max_memory_mb]}MB"
        puts "Memory snapshots: #{memory_snapshots.map { |m| m.round(2) }}"

        # Verify memory usage stays within limits
        assert max_memory_used <= options[:batch_max_memory_mb] * 1.1,  # 10% tolerance
               "Memory usage (#{max_memory_used}MB) should stay within limit (#{options[:batch_max_memory_mb]}MB)"

        # Verify memory tracking is working (should increase over time)
        assert memory_snapshots.last > memory_snapshots.first,
               "Memory tracking should show increasing usage"
      end

      test "batch processing performance with concurrent operations" do
        skip "Prettier not available for concurrency test" unless prettier_available_for_testing?

        # Simulate multiple generators running with batch processing
        coordinators = 3.times.map do |i|
          options = {
            dry_run: false,
            skip_prettier: false,
            batch_max_files: 10,
            batch_max_memory_mb: 20,
            output_dir: File.join(@output_dir, "coordinator_#{i}")
          }
          GenerationCoordinator.new(options, @shell)
        end

        test_files = generate_realistic_model_content(8)

        # Measure concurrent batch processing
        concurrent_time = Benchmark.realtime do
          threads = coordinators.map.with_index do |coordinator, i|
            Thread.new do
              file_manager = coordinator.service_registry.get_service(:file_manager)

              test_files.each do |file_info|
                adjusted_path = File.join(coordinator.options[:output_dir], file_info[:relative_path])
                file_manager.send(:collect_for_batch_formatting,
                                 adjusted_path, file_info[:content], file_info[:relative_path])
              end

              # Process the batch
              file_manager.process_batch_formatting
            end
          end

          threads.each(&:join)
        end

        # Measure sequential processing for comparison
        sequential_time = Benchmark.realtime do
          coordinators.each do |coordinator|
            file_manager = coordinator.service_registry.get_service(:file_manager)

            test_files.each do |file_info|
              adjusted_path = File.join(coordinator.options[:output_dir], file_info[:relative_path])
              file_manager.send(:collect_for_batch_formatting,
                               adjusted_path, file_info[:content], file_info[:relative_path])
            end

            file_manager.process_batch_formatting
          end
        end

        puts "\nConcurrency Performance:"
        puts "Concurrent: #{concurrent_time.round(4)}s"
        puts "Sequential: #{sequential_time.round(4)}s"

        # Concurrent should be faster or at least not significantly slower
        efficiency_ratio = concurrent_time / sequential_time
        assert efficiency_ratio <= 1.5,
               "Concurrent processing should be efficient. Ratio: #{efficiency_ratio.round(2)}"
      end

      test "error recovery performance doesn't degrade batch processing" do
        skip "Prettier not available for error recovery test" unless prettier_available_for_testing?

        options = {
          dry_run: false,
          skip_prettier: false,
          batch_max_files: 15,
          output_dir: @output_dir
        }

        coordinator = GenerationCoordinator.new(options, @shell)
        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Create test files with some that will cause formatting errors
        mixed_files = generate_mixed_quality_content(12)

        # Mock prettier to fail on specific files
        original_system = file_manager.method(:system)
        file_manager.define_singleton_method(:system) do |command|
          # Fail on batch commands 50% of the time to test fallback
          if command.include?("prettier") && rand < 0.5
            false
          else
            true
          end
        end

        # Measure performance with error recovery
        error_recovery_time = Benchmark.realtime do
          mixed_files.each do |file_info|
            file_manager.send(:collect_for_batch_formatting,
                             file_info[:path], file_info[:content], file_info[:relative_path])
          end

          # Process batch (may trigger fallback due to mocked failures)
          result = file_manager.process_batch_formatting
        end

        puts "\nError Recovery Performance: #{error_recovery_time.round(4)}s"

        # Error recovery should still be reasonable (not more than 2x normal batch time)
        normal_batch_time = measure_batch_formatting_time(generate_realistic_model_content(12))
        recovery_overhead = error_recovery_time / normal_batch_time

        assert recovery_overhead <= 3.0,
               "Error recovery overhead should be reasonable. Factor: #{recovery_overhead.round(2)}"
      end

      # =============================================================================
      # Stress Testing for Large-Scale Generation
      # =============================================================================

      test "batch processing handles large file counts efficiently" do
        skip "Prettier not available for stress test" unless prettier_available_for_testing?

        large_file_count = 50
        large_files = generate_realistic_model_content(large_file_count)

        # Configure for large batch processing
        options = {
          dry_run: false,
          skip_prettier: false,
          batch_max_files: 25,  # Process in multiple batches
          batch_max_memory_mb: 50,
          output_dir: @output_dir
        }

        coordinator = GenerationCoordinator.new(options, @shell)
        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Track batch operations
        batch_count = 0
        total_processed = 0

        original_process_batch = file_manager.method(:process_batch_formatting)
        file_manager.define_singleton_method(:process_batch_formatting) do
          batch_count += 1
          result = original_process_batch.call
          total_processed += result[:processed]
          result
        end

        # Measure large-scale processing
        large_scale_time = Benchmark.realtime do
          large_files.each do |file_info|
            file_manager.send(:collect_for_batch_formatting,
                             file_info[:path], file_info[:content], file_info[:relative_path])
          end

          # Final batch processing
          file_manager.process_batch_formatting
        end

        puts "\nLarge-Scale Performance:"
        puts "Files processed: #{large_file_count}"
        puts "Batch operations: #{batch_count}"
        puts "Total time: #{large_scale_time.round(4)}s"
        puts "Time per file: #{(large_scale_time / large_file_count).round(4)}s"

        # Verify all files were processed
        assert_equal large_file_count, total_processed,
                     "All files should be processed in batches"

        # Verify reasonable performance (< 0.1s per file)
        time_per_file = large_scale_time / large_file_count
        assert time_per_file < 0.1,
               "Time per file (#{time_per_file.round(4)}s) should be reasonable"
      end

      private

      def create_frontend_environment
        FileUtils.mkdir_p(@frontend_dir)

        package_json = {
          "name" => "test-project",
          "version" => "1.0.0",
          "devDependencies" => {
            "prettier" => "^2.8.0"
          }
        }

        File.write(File.join(@frontend_dir, "package.json"), JSON.pretty_generate(package_json))

        # Create prettier config
        prettier_config = {
          "semi" => true,
          "singleQuote" => true,
          "tabWidth" => 2,
          "trailingComma" => "es5"
        }

        File.write(File.join(@frontend_dir, ".prettierrc"), JSON.pretty_generate(prettier_config))
      end

      def prettier_available_for_testing?
        return false unless File.exist?(File.join(@frontend_dir, "package.json"))

        # Try to run prettier to verify it's actually available
        Dir.chdir(@frontend_dir) do
          system("npx prettier --version > /dev/null 2>&1")
        end
      end

      def generate_realistic_model_content(count)
        (1..count).map do |i|
          content = <<~TYPESCRIPT
            // Generated from Rails schema: #{Time.current.strftime("%Y-%m-%d %H:%M:%S UTC")}

            import { ActiveRecord } from './base/active-record';
            import type { #{model_name(i)}Data, Create#{model_name(i)}Data, Update#{model_name(i)}Data } from './types/#{model_name(i).underscore.dasherize}-data';

            /**
             * #{model_name(i)} ActiveRecord model
             *#{' '}
             * Represents #{model_name(i).underscore.humanize.downcase} data with full CRUD operations
             * and relationship management.
             */
            export class #{model_name(i)} extends ActiveRecord<#{model_name(i)}Data, Create#{model_name(i)}Data, Update#{model_name(i)}Data> {
              static tableName = '#{model_name(i).underscore.pluralize}';
            #{'  '}
              // Standard fields
              declare id: number;
              declare name: string;
              declare description: string;
              declare status: 'active' | 'inactive' | 'pending';
              declare metadata: Record<string, any>;
              declare created_at: Date;
              declare updated_at: Date;
            #{'  '}
              #{generate_model_methods(i)}
            }
          TYPESCRIPT

          {
            path: File.join(@output_dir, "#{model_name(i).underscore.dasherize}.ts"),
            content: content,
            relative_path: "#{model_name(i).underscore.dasherize}.ts"
          }
        end
      end

      def generate_large_model_content(count, size_per_file_kb)
        (1..count).map do |i|
          # Generate content of specified size
          base_content = generate_realistic_model_content(1).first[:content]
          padding_size = (size_per_file_kb * 1024) - base_content.bytesize

          if padding_size > 0
            padding = "// " + ("Padding content to reach target size. " * (padding_size / 50)).ljust(padding_size, "x")
            content = base_content + "\n\n" + padding
          else
            content = base_content
          end

          {
            path: File.join(@output_dir, "large_#{i}.ts"),
            content: content,
            relative_path: "large_#{i}.ts"
          }
        end
      end

      def generate_mixed_quality_content(count)
        (1..count).map do |i|
          # Generate some files with formatting issues, some clean
          if i % 3 == 0
            # Badly formatted content
            content = <<~TYPESCRIPT
              //Generated badly
              import{ActiveRecord}from'./base/active-record';export class Test#{i} extends ActiveRecord{
              static tableName='tests';declare id:number;
              method(){return this.id;}}
            TYPESCRIPT
          else
            # Well formatted content
            content = generate_realistic_model_content(1).first[:content]
          end

          {
            path: File.join(@output_dir, "mixed_#{i}.ts"),
            content: content,
            relative_path: "mixed_#{i}.ts"
          }
        end
      end

      def model_name(index)
        names = [ "User", "Post", "Comment", "Project", "Task", "Client", "Invoice", "Product", "Order", "Category" ]
        names[index % names.length] + (index > names.length ? index.to_s : "")
      end

      def generate_model_methods(index)
        methods = [
          "// Standard query methods\nstatic async findByStatus(status: string) {\n  return this.where({ status }).all();\n}",
          "// Instance methods\nasync updateStatus(newStatus: string) {\n  return this.update({ status: newStatus });\n}",
          "// Relationship methods\nasync getRelated() {\n  return this.hasMany('RelatedModel').all();\n}"
        ]

        methods.take(index % 3 + 1).join("\n\n")
      end

      def measure_individual_formatting_time(test_files)
        options = {
          dry_run: false,
          skip_prettier: false,
          disable_batch_formatting: true,  # Force individual formatting
          output_dir: File.join(@output_dir, "individual")
        }

        coordinator = GenerationCoordinator.new(options, @shell)
        file_manager = coordinator.service_registry.get_service(:file_manager)

        FileUtils.mkdir_p(options[:output_dir])

        Benchmark.realtime do
          test_files.each do |file_info|
            adjusted_path = File.join(options[:output_dir], file_info[:relative_path])
            file_manager.write_with_formatting(file_info[:relative_path], file_info[:content])
          end
        end
      end

      def measure_batch_formatting_time(test_files)
        options = {
          dry_run: false,
          skip_prettier: false,
          batch_max_files: test_files.length + 5,  # Allow all files in one batch
          batch_max_memory_mb: 100,
          output_dir: File.join(@output_dir, "batch")
        }

        coordinator = GenerationCoordinator.new(options, @shell)
        file_manager = coordinator.service_registry.get_service(:file_manager)

        FileUtils.mkdir_p(options[:output_dir])

        Benchmark.realtime do
          test_files.each do |file_info|
            adjusted_path = File.join(options[:output_dir], file_info[:relative_path])
            file_manager.write_with_formatting(file_info[:relative_path], file_info[:content])
          end

          # Process any remaining batch
          file_manager.process_batch_formatting
        end
      end
    end
  end
end
