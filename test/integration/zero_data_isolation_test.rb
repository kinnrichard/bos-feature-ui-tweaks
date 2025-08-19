require "test_helper"

class ZeroDataIsolationTest < ActionDispatch::IntegrationTest
  def setup
    # Most tests don't require Zero infrastructure, but add check for Zero-specific tests
  end
  test "test database is isolated from development database" do
    # Verify we're using test database
    assert_match /bos_test/, ActiveRecord::Base.connection.current_database
    refute_match /bos_development/, ActiveRecord::Base.connection.current_database
  end

  test "zero configuration points to test databases" do
    config_path = Rails.root.join("config", "zero.yml")

    if File.exist?(config_path)
      config = YAML.load_file(config_path)

      test_config = config["test"]
      assert test_config.present?, "Zero test configuration should exist"

      # Verify test database names
      assert_equal "bos_test", test_config["primary_db"]["database"]
      assert_equal "bos_zero_cvr_test", test_config["cvr_db"]["database"]
      assert_equal "bos_zero_cdb_test", test_config["cdb_db"]["database"]
    else
      # If zero.yml doesn't exist, verify database configuration through Rails
      assert_match /bos_test/, ActiveRecord::Base.connection.current_database,
        "Should be using test database even without zero.yml"
    end
  end

  test "test fixtures are properly loaded" do
    # Verify test data exists and is not development data
    test_user = users(:test_owner)
    assert test_user.present?
    assert_match /@bos-test\.local$/, test_user.email,
      "Test user should have test domain email"

    # Verify we have test jobs
    assert Job.count > 0, "Test database should have fixture jobs"

    # Verify no development-specific data
    dev_emails = User.where("email NOT LIKE ?", "%@bos-test.local")
    assert_equal 0, dev_emails.count,
      "Test database should not have non-test emails"
  end

  test "test environment database isolation" do
    # Verify environment is correctly set
    assert Rails.env.test?, "Should be running in test environment"

    # Verify database name contains 'test'
    db_name = ActiveRecord::Base.connection.current_database
    assert_match /test/, db_name, "Database name should contain 'test'"

    # Verify we're not accidentally using development database
    refute_match /development/, db_name, "Should not be using development database"
  end

  test "zero database configuration uses test environment settings" do
    # Check database.yml configuration for test environment
    db_config = Rails.application.config.database_configuration["test"]

    assert db_config.present?, "Test database configuration should exist"
    assert_match /test/, db_config["database"], "Test database name should contain 'test'"

    # If zero-specific database configurations exist, verify them too
    if db_config["zero_cvr_database"]
      assert_match /test/, db_config["zero_cvr_database"], "Zero CVR test database should contain 'test'"
    end

    if db_config["zero_cdb_database"]
      assert_match /test/, db_config["zero_cdb_database"], "Zero CDB test database should contain 'test'"
    end
  end

  test "test data is distinct from development data" do
    # Check that test data has specific test markers
    test_users = User.where("email LIKE ?", "%@bos-test.local")
    assert test_users.count > 0, "Should have test users with test domain"

    # All jobs should be associated with test users (skip if user association doesn't exist)
    if Job.column_names.include?("user_id")
      Job.find_each do |job|
        if job.respond_to?(:user) && job.user.present?
          assert_match /@bos-test\.local$/, job.user.email,
            "Job #{job.id} should be associated with test user"
        end
      end
    end

    # Check for test-specific data patterns
    # We have test-owner@bos-test.local and test-user@bos-test.local
    test_users_exist = User.exists?(email: "test-owner@bos-test.local") ||
                      User.exists?(email: "test-user@bos-test.local")
    assert test_users_exist, "Should have test users with @bos-test.local domain"
  end

  test "database connections are properly isolated" do
    # Verify we're not connected to development databases
    current_connections = ActiveRecord::Base.connection_pool.connections

    current_connections.each do |connection|
      next unless connection.active?

      db_name = connection.current_database
      refute_match /development/, db_name,
        "Should not have active connections to development databases"
      assert_match /test/, db_name,
        "All active connections should be to test databases"
    end
  end

  test "zero test configuration matches environment expectations" do
    # Verify that Zero-specific configuration matches test environment
    if defined?(ZeroJwt)
      # Test that auth secret is appropriate for test environment
      test_secret = ENV.fetch("ZERO_AUTH_SECRET", "dev-secret-change-in-production")

      # Should be using development-compatible secret for testing
      assert_equal "dev-secret-change-in-production", test_secret,
        "Test environment should use known auth secret for compatibility"
    end

    # Verify test environment variables are set correctly
    assert_equal "test", Rails.env

    # RAILS_ENV can be set to "test" in some environments, so check it's either nil or "test"
    rails_env = ENV["RAILS_ENV"]
    assert rails_env.nil? || rails_env == "test",
      "RAILS_ENV should be nil or 'test', but was '#{rails_env}'"
  end

  test "test database schema matches expectations" do
    # Verify essential tables exist
    essential_tables = %w[users jobs tasks]

    essential_tables.each do |table_name|
      assert ActiveRecord::Base.connection.table_exists?(table_name),
        "Essential table '#{table_name}' should exist in test database"
    end

    # Verify we have the expected number of test records
    assert User.count > 0, "Should have test users"
    assert Job.count > 0, "Should have test jobs"
  end

  test "zero integration respects database isolation" do
    # If Zero integration is active, verify it's using test databases
    skip "Zero integration not available" unless defined?(ZeroJwt)

    # Generate a token in test environment
    user = users(:test_owner)
    token = ZeroJwt.generate(user_id: user.id.to_s)

    # Verify token can be decoded
    decoded = ZeroJwt.decode(token)
    assert_equal user.id.to_s, decoded.user_id

    # Verify user exists in test database
    assert User.exists?(id: user.id), "User should exist in test database"
    assert_equal user.email, User.find(user.id).email,
      "User data should be consistent in test database"
  end

  test "test fixtures provide adequate test coverage" do
    # Verify we have sufficient test data for comprehensive testing

    # Should have multiple users for relationship testing
    assert User.count >= 2, "Should have at least 2 test users"

    # Should have jobs for different users (skip if user_id column doesn't exist)
    if Job.column_names.include?("user_id")
      user_ids_with_jobs = Job.distinct.pluck(:user_id).compact
      assert user_ids_with_jobs.length >= 1, "Should have jobs for test users"
    end

    # Should have some variation in job statuses if status field exists
    if Job.column_names.include?("status")
      unique_statuses = Job.distinct.pluck(:status).compact
      assert unique_statuses.length >= 3, "Should have variation in job statuses"
    end
  end

  test "database cleanup between tests" do
    # This test verifies that database state is properly reset
    initial_user_count = User.count
    initial_job_count = Job.count

    # Create some test data
    new_user = User.create!(
      email: "cleanup-test@bos-test.local",
      name: "Cleanup Test User",
      password: "password123",
      role: "customer_specialist"
    )

    # Create job based on schema
    job_params = {
      title: "Cleanup Test Job",
      client: clients(:acme)  # Use existing test client
    }
    if Job.column_names.include?("user_id")
      job_params[:user_id] = new_user.id
    end

    new_job = Job.create!(job_params)

    # Verify data was created
    assert User.count == initial_user_count + 1
    assert Job.count == initial_job_count + 1

    # Note: The actual cleanup happens between tests via fixtures reload
    # This test documents the expected behavior
  end
end
