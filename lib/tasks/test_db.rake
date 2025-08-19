namespace :db do
  namespace :test do
    desc "Setup test database with comprehensive seed data"
    task seed: :environment do
      unless Rails.env.test?
        puts "❌ This task can only be run in test environment"
        puts "   Run with: RAILS_ENV=test rails db:test:seed"
        exit 1
      end

      puts "🚀 Setting up test database with seed data..."

      # Ensure test database exists and is current
      Rake::Task["db:test:prepare"].invoke

      # Load comprehensive test seeds
      load Rails.root.join("db", "test_seeds.rb")

      puts "✅ Test database ready for comprehensive testing!"
    end

    desc "Reset test database with fresh seed data"
    task reset: :environment do
      unless Rails.env.test?
        puts "❌ This task can only be run in test environment"
        exit 1
      end

      puts "🔄 Resetting test database..."

      # Drop and recreate test database
      Rake::Task["db:test:purge"].invoke
      Rake::Task["db:test:prepare"].invoke

      # Load fresh seed data
      load Rails.root.join("db", "test_seeds.rb")

      puts "✅ Test database reset complete!"
    end

    desc "Verify test database integrity"
    task verify: :environment do
      unless Rails.env.test?
        puts "❌ This task can only be run in test environment"
        exit 1
      end

      puts "🔍 Verifying test database integrity..."

      checks = [
        { model: User, min_count: 5, description: "test users with different roles" },
        { model: Client, min_count: 4, description: "clients (active and inactive)" },
        { model: Job, min_count: 5, description: "jobs with various complexities" },
        { model: Task, min_count: 10, description: "tasks including hierarchical" },
        { model: Device, min_count: 3, description: "test devices" },
        { model: Person, min_count: 3, description: "client contacts" }
      ]

      all_passed = true

      checks.each do |check|
        count = check[:model].count
        if count >= check[:min_count]
          puts "  ✅ #{count} #{check[:description]}"
        else
          puts "  ❌ Only #{count} #{check[:description]} (expected >= #{check[:min_count]})"
          all_passed = false
        end
      end

      # Check for specific test scenarios
      puts "\n🎯 Checking test scenarios..."

      scenarios = [
        {
          name: "Simple job workflow",
          check: -> { Job.find_by(title: "Simple Website Setup")&.tasks&.count&.positive? }
        },
        {
          name: "Hierarchical tasks",
          check: -> { Task.joins(:subtasks).distinct.count > 0 }
        },
        {
          name: "Mixed task statuses",
          check: -> { Task.distinct.pluck(:status).count >= 4 }
        },
        {
          name: "Test users with credentials",
          check: -> { User.where(email: [ "admin@bos-test.local", "tech@bos-test.local" ]).count >= 2 }
        },
        {
          name: "Drag & drop test data",
          check: -> { Job.find_by(title: "System Migration Project")&.tasks&.count&.>= 15 }
        }
      ]

      scenarios.each do |scenario|
        if scenario[:check].call
          puts "  ✅ #{scenario[:name]}"
        else
          puts "  ❌ #{scenario[:name]}"
          all_passed = false
        end
      end

      if all_passed
        puts "\n🎉 Test database verification passed!"
        puts "   Ready for comprehensive Playwright testing"
      else
        puts "\n💥 Test database verification failed!"
        puts "   Run 'rails db:test:reset' to fix issues"
        exit 1
      end
    end

    desc "Quick setup for development testing"
    task quick_setup: :environment do
      unless Rails.env.test?
        puts "❌ This task can only be run in test environment"
        exit 1
      end

      puts "⚡ Quick test database setup..."

      # Only reload seeds if database seems empty
      if User.count < 3 || Job.count < 3
        puts "📊 Database appears empty, loading seed data..."
        load Rails.root.join("db", "test_seeds.rb")
      else
        puts "📊 Database has data, skipping seed loading"
      end

      puts "✅ Quick setup complete!"
    end

    desc "Show test database status"
    task status: :environment do
      unless Rails.env.test?
        puts "❌ This task can only be run in test environment"
        exit 1
      end

      puts "📊 Test Database Status"
      puts "=" * 50

      models = [ User, Client, Job, Task, Device, Person, JobAssignment, ActivityLog ]

      models.each do |model|
        count = model.count
        puts "#{model.name.pluralize.ljust(20)} #{count.to_s.rjust(6)}"
      end

      puts "=" * 50

      # Show test users for easy reference
      if User.count > 0
        puts "\n🔑 Test User Credentials:"
        test_emails = [
          "owner@bos-test.local",
          "admin@bos-test.local",
          "techlead@bos-test.local",
          "tech@bos-test.local",
          "tech2@bos-test.local"
        ]

        User.where(email: test_emails).find_each do |user|
          puts "  #{user.role.capitalize.ljust(12)} #{user.email.ljust(25)} password123"
        end
      end

      # Show job scenarios
      if Job.count > 0
        puts "\n📝 Available Test Scenarios:"
        Job.limit(10).find_each do |job|
          task_count = job.tasks.count
          puts "  #{job.title.ljust(30)} #{task_count} tasks"
        end
      end
    end
  end
end

# Convenience aliases
desc "Setup test database (alias for db:test:seed)"
task "test:db:setup" => "db:test:seed"

desc "Reset test database (alias for db:test:reset)"
task "test:db:reset" => "db:test:reset"

desc "Verify test database (alias for db:test:verify)"
task "test:db:verify" => "db:test:verify"
