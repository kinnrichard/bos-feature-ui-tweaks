namespace :test do
  desc "Run Playwright tests"
  task playwright: :environment do
    $LOAD_PATH << Rails.root.join("test")

    # Ensure Playwright is installed
    unless File.exist?(Rails.root.join("node_modules/.bin/playwright"))
      puts "Installing Playwright browsers..."
      system("npx playwright install chromium") || abort("Failed to install Playwright browsers")
    end

    # Run all Playwright tests
    test_files = Dir[Rails.root.join("test/playwright/**/*_test.rb")]

    if test_files.empty?
      puts "No Playwright tests found in test/playwright/"
      exit 0
    end

    puts "Running #{test_files.length} Playwright test file(s)..."

    # Use Rails test runner
    require "rails/test_unit/runner"
    Rails::TestUnit::Runner.run(test_files)
  end

  desc "Run a specific Playwright test file"
  task :playwright_file, [ :file ] => :environment do |t, args|
    unless args[:file]
      puts "Usage: rails test:playwright_file[path/to/test_file.rb]"
      exit 1
    end

    $LOAD_PATH << Rails.root.join("test")

    test_file = args[:file].to_s
    test_file = Rails.root.join("test/playwright", test_file).to_s unless test_file.include?("/")
    test_file += "_test.rb" unless test_file.end_with?("_test.rb")

    unless File.exist?(test_file)
      puts "Test file not found: #{test_file}"
      exit 1
    end

    puts "Running Playwright test: #{test_file}"

    require "rails/test_unit/runner"
    Rails::TestUnit::Runner.run([ test_file ])
  end

  desc "Run Playwright tests with visible browser (non-headless)"
  task playwright_debug: :environment do
    ENV["PLAYWRIGHT_HEADFUL"] = "true"
    ENV["DEBUG"] = "true"
    Rake::Task["test:playwright"].invoke
  end

  desc "Run Playwright tests and capture screenshots"
  task playwright_screenshots: :environment do
    ENV["SCREENSHOT"] = "true"

    # Create screenshots directory
    FileUtils.mkdir_p(Rails.root.join("tmp/screenshots"))

    Rake::Task["test:playwright"].invoke

    # List captured screenshots
    screenshots = Dir[Rails.root.join("tmp/screenshots/*.png")]
    if screenshots.any?
      puts "\nScreenshots captured:"
      screenshots.each { |s| puts "  - #{s}" }
    end
  end
end

# Add Playwright tests to the default test task
Rake::Task["test"].enhance do
  Rake::Task["test:playwright"].invoke
end

# Alias for convenience
desc "Run Playwright tests (alias for test:playwright)"
task playwright: "test:playwright"
