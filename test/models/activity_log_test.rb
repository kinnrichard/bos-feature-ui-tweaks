require "test_helper"

class ActivityLogTest < ActiveSupport::TestCase
  setup do
    @user = users(:admin)
    @client = clients(:acme)
    @job = jobs(:open_job)
    @task = tasks(:open_task_1)
    sign_in_as @user
  end

  teardown do
    User.current_user = nil
  end

  test "valid activity log attributes" do
    log = ActivityLog.new(
      user: @user,
      action: "created",
      loggable: @job,
      client: @client,
      job: @job,
      metadata: { name: "Test Job" }
    )

    assert_valid log
  end

  test "requires user" do
    log = ActivityLog.new(action: "created", loggable: @job)

    assert_invalid log, attribute: :user
  end

  test "requires action" do
    log = ActivityLog.new(user: @user, loggable: @job)

    assert_invalid log, attribute: :action
  end

  test "allows optional loggable" do
    log = ActivityLog.new(user: @user, action: "logged_in")

    assert_valid log
  end

  test "allows optional client" do
    log = ActivityLog.new(user: @user, action: "logged_in")

    assert_valid log
  end

  test "allows optional job" do
    log = ActivityLog.new(user: @user, action: "created", loggable: @client)

    assert_valid log
  end

  test "recent scope orders by created_at descending" do
    # Clear existing logs to ensure clean test
    ActivityLog.destroy_all

    old_log = ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: @job,
      created_at: 2.days.ago
    )

    new_log = ActivityLog.create!(
      user: @user,
      action: "updated",
      loggable: @job,
      created_at: 1.hour.ago
    )

    recent_logs = ActivityLog.recent

    assert_equal new_log.id, recent_logs.first.id
    assert_equal old_log.id, recent_logs.last.id
  end

  test "for_user scope" do
    tech = users(:technician)

    admin_log = ActivityLog.create!(user: @user, action: "created", loggable: @job)
    tech_log = ActivityLog.create!(user: tech, action: "updated", loggable: @job)

    admin_logs = ActivityLog.for_user(@user)

    assert_includes admin_logs, admin_log
    assert_not_includes admin_logs, tech_log
  end

  test "for_loggable scope" do
    other_job = @client.jobs.create!(title: "Other Job")

    job_log = ActivityLog.create!(user: @user, action: "created", loggable: @job)
    other_log = ActivityLog.create!(user: @user, action: "created", loggable: other_job)

    job_logs = ActivityLog.for_loggable(@job)

    assert_includes job_logs, job_log
    assert_not_includes job_logs, other_log
  end

  test "for_client scope" do
    other_client = clients(:techstartup)

    acme_log = ActivityLog.create!(user: @user, action: "created", loggable: @job, client: @client)
    tech_log = ActivityLog.create!(user: @user, action: "created", loggable: other_client, client: other_client)

    acme_logs = ActivityLog.for_client(@client)

    assert_includes acme_logs, acme_log
    assert_not_includes acme_logs, tech_log
  end

  test "loggable_type_emoji for different types" do
    # Client (business)
    business_client = clients(:techstartup) # client_type: business
    log = ActivityLog.new(action: "created", loggable: business_client)
    assert_equal "🏢", log.loggable_type_emoji

    # Client (residential) - acme is actually business, so let's use a different approach
    residential_client = Client.create!(name: "Test Residential", client_type: "residential")
    log = ActivityLog.new(action: "created", loggable: residential_client)
    assert_equal "🏠", log.loggable_type_emoji

    # Job
    log = ActivityLog.new(action: "created", loggable: @job)
    assert_equal "💼", log.loggable_type_emoji

    # Task
    log = ActivityLog.new(action: "created", loggable: @task)
    assert_equal "☑️", log.loggable_type_emoji

    # Person
    person = people(:john_doe)
    log = ActivityLog.new(action: "created", loggable: person)
    assert_equal "👤", log.loggable_type_emoji

    # Unknown type
    log = ActivityLog.new(action: "created", loggable_type: "Device")
    assert_equal "", log.loggable_type_emoji
  end

  test "loggable_name from metadata" do
    log = ActivityLog.new(
      action: "created",
      loggable: @job,
      metadata: { "name" => "Custom Name" }
    )

    assert_equal "Custom Name", log.loggable_name
  end

  test "loggable_name fallback for different types" do
    # Job
    log = ActivityLog.new(action: "created", loggable: @job, metadata: {})
    assert_equal @job.title, log.loggable_name

    # Task
    log = ActivityLog.new(action: "created", loggable: @task, metadata: {})
    assert_equal @task.title, log.loggable_name

    # Client
    log = ActivityLog.new(action: "created", loggable: @client, metadata: {})
    assert_equal @client.name, log.loggable_name

    # Person
    person = people(:john_doe)
    log = ActivityLog.new(action: "created", loggable: person, metadata: {})
    assert_match person.name, log.loggable_name
    assert_match @client.name, log.loggable_name # Should include client name
  end

  test "loggable_name handles nil metadata" do
    log = ActivityLog.new(action: "created", loggable: @job, metadata: nil)
    assert_equal "no metadata", log.loggable_name
  end

  test "message for created action" do
    # Job creation
    log = ActivityLog.new(
      action: "created",
      loggable: @job,
      metadata: { "name" => "New Job" }
    )
    assert_equal "created 💼 New Job", log.message

    # Task creation with job context
    log = ActivityLog.new(
      action: "created",
      loggable: @task,
      metadata: { "name" => "New Task" }
    )
    assert_equal "created ☑️ New Task", log.message
  end

  test "message for viewed action" do
    log = ActivityLog.new(
      action: "viewed",
      loggable: @job,
      metadata: { "name" => "Job Title" }
    )

    assert_equal "viewed 💼 Job Title", log.message
  end

  test "message for renamed action" do
    log = ActivityLog.new(
      action: "renamed",
      loggable: @job,
      metadata: {
        "old_name" => "Old Title",
        "new_name" => "New Title"
      }
    )

    assert_equal "renamed Old Title to New Title", log.message
  end

  test "message for updated action with changes" do
    log = ActivityLog.new(
      action: "updated",
      loggable: @job,
      metadata: {
        "name" => "Job Title",
        "changes" => {
          "status" => [ "open", "in_progress" ],
          "priority" => [ "normal", "high" ]
        }
      }
    )

    message = log.message
    assert_match "updated Job Title:", message
    assert_match "status from 'open' to 'in_progress'", message
    assert_match "priority from 'normal' to 'high'", message
  end

  test "message for updated action without changes" do
    log = ActivityLog.new(
      action: "updated",
      loggable: @job,
      metadata: { "name" => "Job Title" }
    )

    assert_equal "updated Job Title", log.message
  end

  test "message for updated action with only unimportant fields" do
    log = ActivityLog.new(
      action: "updated",
      loggable: @job,
      metadata: {
        "name" => "Job Title",
        "changes" => {
          "position" => [ "6", "10" ],
          "lock_version" => [ "0", "1" ],
          "reordered_at" => [ "2025-06-25T08:40:02.589-04:00", "2025-06-25T15:47:35.972-04:00" ],
          "parent_id" => [ "1", "2" ]
        }
      }
    )

    assert_nil log.message
  end

  test "message for updated action with mixed important and unimportant fields" do
    log = ActivityLog.new(
      action: "updated",
      loggable: @job,
      metadata: {
        "name" => "Job Title",
        "changes" => {
          "status" => [ "open", "in_progress" ],
          "position" => [ "6", "10" ],
          "lock_version" => [ "0", "1" ]
        }
      }
    )

    message = log.message
    assert_match "updated Job Title:", message
    assert_match "status from 'open' to 'in_progress'", message
    refute_match "position", message
    refute_match "lock_version", message
  end

  test "message for priority change" do
    log = ActivityLog.new(
      action: "updated",
      loggable: @job,
      metadata: {
        "name" => "Computer won't start",
        "changes" => {
          "priority" => [ "low", "high" ]
        }
      }
    )

    assert_equal "marked 💼 Computer won't start as ❗ High Priority", log.message
  end

  test "message for deleted action" do
    log = ActivityLog.new(
      action: "deleted",
      loggable_type: "Job",
      metadata: { "name" => "Deleted Job" }
    )

    assert_equal "deleted 💼 Deleted Job", log.message
  end

  test "message for assigned action" do
    log = ActivityLog.new(
      action: "assigned",
      loggable: @job,
      metadata: {
        "name" => "Job Title",
        "assigned_to" => "John Doe"
      }
    )

    assert_equal "assigned 💼 Job Title to John Doe", log.message
  end

  test "message for unassigned action" do
    log = ActivityLog.new(
      action: "unassigned",
      loggable: @job,
      metadata: {
        "name" => "Job Title",
        "unassigned_from" => "John Doe"
      }
    )

    assert_equal "unassigned John Doe from 💼 Job Title", log.message
  end

  test "message for status_changed action" do
    log = ActivityLog.new(
      action: "status_changed",
      loggable: @task,
      metadata: {
        "name" => "Task Title",
        "new_status" => "in_progress",
        "new_status_label" => "In Progress"
      }
    )

    assert_equal "set ☑️ Task Title to 🟢 In Progress", log.message
  end

  test "message for added action" do
    log = ActivityLog.new(
      action: "added",
      loggable_type: "Device",
      metadata: {
        "name" => "MacBook Pro",
        "parent_type" => "Person",
        "parent_name" => "John Doe"
      }
    )

    assert_equal "added  MacBook Pro to Person John Doe", log.message
  end

  test "message for logged_in action" do
    log = ActivityLog.new(action: "logged_in", user: @user)

    assert_equal "signed into bŏs", log.message
  end

  test "message for logged_out action" do
    log = ActivityLog.new(action: "logged_out", user: @user)

    assert_equal "signed out of bŏs", log.message
  end

  test "message for unknown action" do
    log = ActivityLog.new(
      action: "custom_action",
      loggable: @job,
      metadata: { "name" => "Job Title" }
    )

    assert_equal "••• custom_action Job Title", log.message
  end

  test "get_status_emoji for different statuses" do
    log = ActivityLog.new(action: "status_changed", loggable: @task)

    # Test each status emoji using send to call private method
    assert_equal "⚫️", log.send(:get_status_emoji, "new_task")
    assert_equal "🟢", log.send(:get_status_emoji, "in_progress")
    assert_equal "⏸️", log.send(:get_status_emoji, "paused")
    assert_equal "☑️", log.send(:get_status_emoji, "successfully_completed")
    assert_equal "❌", log.send(:get_status_emoji, "cancelled")
    assert_equal "⚫", log.send(:get_status_emoji, "open")
    assert_equal "", log.send(:get_status_emoji, "unknown")
  end

  test "polymorphic associations" do
    # Can log different types
    client_log = ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: @client,
      client: @client
    )

    job_log = ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: @job,
      client: @client,
      job: @job
    )

    task_log = ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: @task,
      client: @client,
      job: @job
    )

    assert_equal @client, client_log.loggable
    assert_equal @job, job_log.loggable
    assert_equal @task, task_log.loggable
  end

  test "metadata stored as JSONB" do
    complex_metadata = {
      "name" => "Test",
      "changes" => {
        "status" => [ "open", "closed" ],
        "priority" => [ "normal", "high" ]
      },
      "nested" => {
        "deep" => {
          "value" => "test"
        }
      }
    }

    log = ActivityLog.create!(
      user: @user,
      action: "updated",
      loggable: @job,
      metadata: complex_metadata
    )

    log.reload
    assert_equal complex_metadata["nested"]["deep"]["value"], log.metadata["nested"]["deep"]["value"]
  end

  test "activity logging integration" do
    # Create a job and verify activity log is created
    assert_difference "ActivityLog.count", 1 do
      job = @client.jobs.create!(
        title: "Test Job",
        status: "open"
      )

      log = ActivityLog.last
      assert_equal "created", log.action
      assert_equal job, log.loggable
      assert_equal @user, log.user
      assert_equal @client, log.client
    end
  end

  test "chained scopes" do
    # Create logs for different combinations
    tech = users(:technician)
    other_client = clients(:techstartup)

    # Admin log for acme job
    admin_acme_log = ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: @job,
      client: @client
    )

    # Tech log for acme job
    tech_acme_log = ActivityLog.create!(
      user: tech,
      action: "updated",
      loggable: @job,
      client: @client
    )

    # Admin log for other client
    admin_other_log = ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: other_client,
      client: other_client
    )

    # Chain scopes
    admin_acme_logs = ActivityLog.for_user(@user).for_client(@client)

    assert_includes admin_acme_logs, admin_acme_log
    assert_not_includes admin_acme_logs, tech_acme_log
    assert_not_includes admin_acme_logs, admin_other_log
  end

  # Tests for foreign key constraint issue fixes
  test "should not create activity log when current_user is nil during model creation" do
    ActivityLog.delete_all
    User.current_user = nil

    # Create a user without current_user set - should not create activity log
    user = User.create!(name: "Test User", email: "test@example.com", password: "password123", role: "admin")

    # Ensure no activity log was created during user creation
    assert_equal 0, ActivityLog.count
  end

  test "should not create activity log when user is not persisted" do
    ActivityLog.delete_all

    # Create a user without saving it
    user = User.new(name: "Test User", email: "test@example.com", password: "password123", role: "admin")
    User.current_user = user

    client = Client.create!(name: "Test Client", client_type: "residential")

    # Should not create activity log because current_user is not persisted
    assert_equal 0, ActivityLog.count
  end

  test "should create activity log when current_user is properly set and persisted" do
    ActivityLog.delete_all

    # Create and save a user first
    user = User.create!(name: "Test User", email: "test@example.com", password: "password123", role: "admin")
    User.current_user = user

    # Now create a client - should create activity log
    client = Client.create!(name: "Test Client", client_type: "residential")

    # Should create activity log because current_user is persisted
    assert_equal 1, ActivityLog.count

    log = ActivityLog.first
    assert_equal user, log.user
    assert_equal "created", log.action
    assert_equal client, log.loggable
  end

  test "should not create activity log when DISABLE_ACTIVITY_LOGGING is set" do
    ActivityLog.delete_all

    # Create and save a user first
    user = User.create!(name: "Test User", email: "test@example.com", password: "password123", role: "admin")
    User.current_user = user

    # Disable activity logging
    ENV["DISABLE_ACTIVITY_LOGGING"] = "true"

    # Now create a client - should NOT create activity log
    client = Client.create!(name: "Test Client", client_type: "residential")

    # Should not create activity log because it's disabled
    assert_equal 0, ActivityLog.count
  ensure
    ENV["DISABLE_ACTIVITY_LOGGING"] = nil
  end

  test "test environment should work without foreign key violations" do
    ActivityLog.delete_all

    # This test simulates the test environment setup process
    without_activity_logging do
      # Create users like the test environment does
      user1 = User.create!(name: "Test Admin", email: "admin@bos-test.local", password: "password123", role: "admin")
      user2 = User.create!(name: "Test Tech", email: "tech@bos-test.local", password: "password123", role: "technician")

      # Create clients
      client = Client.create!(name: "Test Client", client_type: "residential")

      # Create jobs
      job = Job.create!(title: "Test Job", client: client, status: "open")

      # Verify no activity logs were created
      assert_equal 0, ActivityLog.count
    end

    # Now enable activity logging and verify it works
    user = User.first
    User.current_user = user

    new_client = Client.create!(name: "Another Client", client_type: "business")

    # Should create activity log now
    assert_equal 1, ActivityLog.count

    log = ActivityLog.first
    assert_equal user, log.user
    assert_equal "created", log.action
    assert_equal new_client, log.loggable
  end
end
