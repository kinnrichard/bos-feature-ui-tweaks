ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

# Load test infrastructure
require_relative "test_environment"
require_relative "support/tasklist_test_helpers"

# Load Page Objects
Dir[Rails.root.join("test/support/page_objects/*.rb")].sort.each { |f| require f }

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers (reduce for stability)
    parallelize(workers: ENV["CI"] ? 1 : :number_of_processors)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all unless ENV["SKIP_FIXTURES"]

    # Setup test environment before suite
    setup do
      TestEnvironment.before_test
    end

    teardown do
      TestEnvironment.after_test
    end

    # Helper method to run code without activity logging
    def without_activity_logging(&block)
      original_value = ENV["DISABLE_ACTIVITY_LOGGING"]
      ENV["DISABLE_ACTIVITY_LOGGING"] = "true"
      yield
    ensure
      ENV["DISABLE_ACTIVITY_LOGGING"] = original_value
    end

    # Add more helper methods to be used by all tests here...

    # Authentication helpers
    def sign_in_as(user)
      if defined?(post) # Integration/controller tests
        post login_path, params: {
          email: user.email,
          password: "password123"
        }
      else # Model/unit tests
        User.current_user = user
      end
    end

    def sign_out
      if defined?(delete)
        delete logout_path
      else
        User.current_user = nil
      end
    end

    # Activity logging helpers
    def assert_activity_logged(action, resource, user: nil)
      log = ActivityLog.order(created_at: :desc).first
      assert_equal action, log.action
      assert_equal resource.class.name, log.loggable_type
      assert_equal resource.id, log.loggable_id
      assert_equal user || User.current_user, log.user if user || User.current_user
    end

    def assert_no_activity_logged
      count_before = ActivityLog.count
      yield
      assert_equal count_before, ActivityLog.count, "Activity was logged when it shouldn't have been"
    end

    # Task helpers
    def create_tasks_with_positions(job, *positions)
      positions.map.with_index do |pos, index|
        job.tasks.create!(
          title: "Task #{index + 1}",
          position: pos,
          status: 0
        )
      end
    end

    def assert_task_positions(job, expected_positions)
      actual = job.tasks.order(:position).pluck(:position)
      assert_equal expected_positions, actual,
        "Expected positions #{expected_positions.inspect} but got #{actual.inspect}"
    end

    # Job state helpers
    def complete_all_tasks(job)
      job.tasks.each do |task|
        task.update!(status: 2) # completed
      end
    end

    def create_job_with_tasks(client: nil, task_count: 3, user: nil)
      client ||= clients(:acme)
      user ||= users(:admin)

      job = client.jobs.create!(
        title: "Test Job",
        status: 0,
        priority: 2
      )

      task_count.times do |i|
        job.tasks.create!(
          title: "Task #{i + 1}",
          position: (i + 1) * 10,
          status: 0
        )
      end

      job
    end

    # Time helpers
    def travel_to_weekday
      # Travel to a Monday at 10am
      travel_to Time.zone.parse("2024-01-15 10:00:00")
    end

    def with_timezone(zone)
      old_zone = Time.zone
      Time.zone = zone
      yield
    ensure
      Time.zone = old_zone
    end

    # Validation helpers
    def assert_valid(record)
      assert record.valid?, "Expected record to be valid but got errors: #{record.errors.full_messages.join(', ')}"
    end

    def assert_invalid(record, attribute: nil, message: nil)
      assert record.invalid?, "Expected record to be invalid but it was valid"

      if attribute
        assert record.errors[attribute].any?,
          "Expected errors on #{attribute} but none found"

        if message
          assert record.errors[attribute].include?(message),
            "Expected '#{message}' error on #{attribute} but got: #{record.errors[attribute].join(', ')}"
        end
      end
    end

    # Database helpers
    def assert_difference(expression, difference = 1, message = nil, &block)
      expressions = Array(expression)

      exps = expressions.map do |e|
        e.respond_to?(:call) ? e : lambda { eval(e, block.binding) }
      end

      before_values = exps.map(&:call)
      yield

      expressions.zip(exps, before_values) do |expr, exp, before_value|
        after_value = exp.call
        actual_difference = after_value - before_value

        error_message = message || "#{expr} didn't change by #{difference}"
        assert_equal difference, actual_difference, error_message
      end
    end

    def assert_no_difference(expression, message = nil, &block)
      assert_difference(expression, 0, message, &block)
    end

    # Permission helpers
    def assert_authorized(user, action, resource)
      sign_in_as(user)
      assert user.can?(action, resource),
        "Expected #{user.role} to be authorized for #{action} on #{resource.class}"
    end

    def assert_unauthorized(user, action, resource)
      sign_in_as(user)
      assert_not user.can?(action, resource),
        "Expected #{user.role} to NOT be authorized for #{action} on #{resource.class}"
    end

    # Response helpers (for controller/integration tests)
    def assert_json_response(expected)
      assert_equal "application/json", response.content_type
      actual = JSON.parse(response.body)

      if expected.is_a?(Hash)
        expected.each do |key, value|
          assert_equal value, actual[key.to_s],
            "Expected JSON response to include #{key}: #{value}"
        end
      else
        assert_equal expected, actual
      end
    end

    # Cleanup helpers
    def clean_activity_logs
      ActivityLog.delete_all
    end

    def reset_all_positions
      Task.update_all(position: nil)
      Task.all.each_with_index do |task, index|
        task.update_column(:position, (index + 1) * 10)
      end
    end
  end
end

# Integration test helpers
class ActionDispatch::IntegrationTest
  def sign_in_as(user)
    post login_path, params: {
      email: user.email,
      password: "password123"
    }
    assert_redirected_to root_path
    follow_redirect!
  end

  def assert_requires_authentication
    assert_redirected_to login_path
    assert_equal "Please sign in to continue", flash[:alert]
  end

  def assert_requires_authorization
    assert_response :forbidden
  end
end
