# TaskList Test Management Rake Tasks
# NOTE: Ruby Playwright tests have been archived due to API-only Rails architecture
# Use frontend/tests/ for TaskList UI testing with proper Svelte + mocked API setup

namespace :test do
  namespace :tasklist do
    desc "Run TaskList API tests (Ruby backend)"
    task api: :environment do
      puts "🧪 Running TaskList API tests..."

      # Ensure test environment is ready
      Rake::Task["db:test:quick_setup"].invoke

      # Run Rails API-focused tests
      test_files = Dir[Rails.root.join("test/models/*task*.rb")] +
                   Dir[Rails.root.join("test/controllers/*task*.rb")] +
                   Dir[Rails.root.join("test/integration/*task*.rb")]

      if test_files.empty?
        puts "⚠️  No TaskList API tests found. Consider adding tests for Task model and related API endpoints."
        return
      end

      success = true
      test_files.each do |file|
        puts "\\n📂 Running #{File.basename(file)}..."
        result = system("rails test #{file}")
        success &&= result
      end

      if success
        puts "\\n✅ All TaskList API tests passed!"
      else
        puts "\\n❌ Some TaskList API tests failed!"
        exit 1
      end
    end

    desc "Run TaskList frontend tests (Svelte UI)"
    task frontend: :environment do
      puts "🧪 Running TaskList frontend tests..."

      unless Dir.exist?("frontend")
        puts "❌ Frontend directory not found. Make sure you're in the Rails root directory."
        exit 1
      end

      puts "\\n📂 Running Svelte TaskList tests..."
      Dir.chdir("frontend") do
        success = system("npm run test")
        unless success
          puts "\\n❌ Frontend tests failed!"
          exit 1
        end
      end

      puts "\\n✅ TaskList frontend tests passed!"
    end

    desc "Run all TaskList tests (API + Frontend)"
    task all: :environment do
      puts "🧪 Running all TaskList tests (API + Frontend)..."

      Rake::Task["test:tasklist:api"].invoke
      Rake::Task["test:tasklist:frontend"].invoke

      puts "\\n🎉 All TaskList tests passed!"
    end

    desc "Run TaskList frontend tests with debug mode"
    task debug: :environment do
      puts "🧪 Running TaskList frontend tests in debug mode..."

      Dir.chdir("frontend") do
        ENV["DEBUG"] = "true"
        system("npm run test:debug")
      end
    end

    desc "Run TaskList tests in CI mode"
    task ci: :environment do
      puts "🧪 Running TaskList tests for CI..."

      ENV["CI"] = "true"
      Rake::Task["test:tasklist:all"].invoke
    end

    desc "Setup test environment and run quick smoke test"
    task smoke: :environment do
      puts "🧪 Running TaskList smoke test..."

      # Quick environment verification
      Rake::Task["db:test:verify"].invoke

      # Run a minimal verification to check if everything is set up correctly
      puts "\\n🔥 Smoke test: Basic functionality check..."

      begin
        # Verify test data exists
        simple_job = Job.find_by(title: "Simple Website Setup")
        raise "Simple job not found" unless simple_job

        puts "  ✅ Test jobs exist"

        # Verify tasks exist
        task_count = simple_job.tasks.count
        raise "No tasks found" if task_count == 0

        puts "  ✅ Tasks exist (#{task_count} tasks)"

        # Verify test users exist
        admin_user = User.find_by(email: "admin@bos-test.local")
        raise "Admin user not found" unless admin_user

        puts "  ✅ Test users exist"

        # Verify task statuses
        statuses = Task.distinct.pluck(:status)
        puts "  ✅ Task statuses available: #{statuses.join(', ')}"

        # Check for hierarchical tasks
        parent_tasks = Task.joins(:subtasks).distinct.count
        puts "  ✅ Hierarchical tasks: #{parent_tasks} parent tasks"

        puts "\\n🎉 TaskList smoke test completed successfully!"
        puts "\\n🚀 Ready for full TaskList testing!"
        puts "\\nNext steps:"
        puts "  1. Run Rails API tests:"
        puts "     rake test:tasklist:api"
        puts "  2. Run frontend tests:"
        puts "     rake test:tasklist:frontend"
        puts "  3. Run all tests:"
        puts "     rake test:tasklist:all"

      rescue => e
        puts "\\n❌ Smoke test failed: #{e.message}"
        puts "\\nTry running: RAILS_ENV=test rake db:test:reset"
        exit 1
      end
    end

    desc "Clean up test artifacts and reset test environment"
    task clean: :environment do
      puts "🧹 Cleaning TaskList test environment..."

      # Clean screenshots
      screenshot_dir = Rails.root.join("tmp", "screenshots")
      if screenshot_dir.exist?
        FileUtils.rm_rf(screenshot_dir)
        puts "  ✅ Cleaned screenshots"
      end

      # Reset test database
      Rake::Task["db:test:reset"].invoke
      puts "  ✅ Reset test database"

      # Clear test logs
      test_log = Rails.root.join("log", "test.log")
      if test_log.exist?
        File.truncate(test_log, 0)
        puts "  ✅ Cleared test logs"
      end

      puts "\\n🎉 TaskList test environment cleaned!"
    end

    desc "Generate test report for TaskList functionality"
    task report: :environment do
      puts "📊 Generating TaskList test report..."

      # This is a placeholder for future test reporting functionality
      # Could integrate with test coverage tools, generate HTML reports, etc.

      report_data = {
        timestamp: Time.current,
        api_test_files: (Dir[Rails.root.join("test/models/*task*.rb")] +
                        Dir[Rails.root.join("test/controllers/*task*.rb")] +
                        Dir[Rails.root.join("test/integration/*task*.rb")]).map(&:basename),
        frontend_test_files: Dir[Rails.root.join("frontend/tests/*.spec.ts")].map(&:basename),
        test_data_status: TestEnvironment.verify_test_data!,
        environment: {
          rails_env: Rails.env,
          ruby_version: RUBY_VERSION,
          rails_version: Rails::VERSION::STRING
        }
      }

      puts "\\n📋 TaskList Test Report"
      puts "=" * 50
      puts "Generated: #{report_data[:timestamp]}"
      puts "API Test Files: #{report_data[:api_test_files].count}"
      report_data[:api_test_files].each { |file| puts "  - #{file}" }
      puts "Frontend Test Files: #{report_data[:frontend_test_files].count}"
      report_data[:frontend_test_files].each { |file| puts "  - #{file}" }
      puts "Environment: #{report_data[:environment][:rails_env]}"
      puts "Ruby: #{report_data[:environment][:ruby_version]}"
      puts "Rails: #{report_data[:environment][:rails_version]}"
      puts "=" * 50

      # Save report to file
      report_file = Rails.root.join("tmp", "tasklist_test_report.json")
      FileUtils.mkdir_p(File.dirname(report_file))
      File.write(report_file, JSON.pretty_generate(report_data))
      puts "\\n📄 Report saved to: #{report_file}"
    end

    desc "Show TaskList test help and examples"
    task :help do
      puts <<~HELP
        📚 TaskList Test Rake Tasks

        Available tasks:

        🧪 Running Tests:
        rake test:tasklist:all           # Run all TaskList tests (API + Frontend)
        rake test:tasklist:api           # Run Rails API tests only
        rake test:tasklist:frontend      # Run Svelte frontend tests only#{'  '}
        rake test:tasklist:smoke         # Quick smoke test

        🐛 Debugging:
        rake test:tasklist:debug         # Run frontend tests with debug mode

        🏗️  CI/CD:
        rake test:tasklist:ci            # Run tests in CI mode

        🎯 Frontend Tests (use npm directly for specific tests):
        cd frontend && npm test                    # Run all frontend tests
        cd frontend && npm run test:debug          # Debug frontend tests
        cd frontend && npx playwright test jobs.spec.ts  # Specific test file

        🧹 Maintenance:
        rake test:tasklist:clean         # Clean test artifacts
        rake test:tasklist:report        # Generate test report

        🔧 Test Data:
        rake test:db:setup               # Setup test database
        rake db:test:seed                # Seed with test data
        rake test:db:verify              # Verify test data

        💡 Tips:
        - Rails API tests: Focus on models, controllers, and API endpoints
        - Frontend tests: Run in frontend/ directory with proper mocked APIs
        - Ruby Playwright tests archived due to API-only Rails architecture
        - Use frontend tests for all UI/UX testing scenarios
      HELP
    end
  end

  # Alias for convenience
  task tasklist: "test:tasklist:help"
end

# Default task shows help
task "test:tasklist" => "test:tasklist:help"
