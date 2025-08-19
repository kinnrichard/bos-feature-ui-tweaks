require "test_helper"

class TestHelperVerificationTest < ActiveSupport::TestCase
  test "fixtures are properly loaded" do
    assert_equal 4, User.count, "Should have 4 users from fixtures"
    assert_equal 4, Client.count, "Should have 4 clients from fixtures"
    assert_equal 5, Job.count, "Should have 5 jobs from fixtures"

    # Verify specific fixtures
    assert users(:owner).owner?
    assert users(:admin).admin?
    assert users(:technician).technician?
    assert users(:technician).authenticate("password123")
  end

  test "test helpers work correctly" do
    # Test job creation helper
    job = create_job_with_tasks(task_count: 5)
    assert_equal 5, job.tasks.count
    assert_equal [ 10, 20, 30, 40, 50 ], job.tasks.order(:position).pluck(:position)

    # Test task position assertion
    assert_task_positions(job, [ 10, 20, 30, 40, 50 ])

    # Test validation helpers
    client = Client.new(name: "Test Client", client_type: "business")
    assert_valid client

    invalid_client = Client.new(name: "")
    assert_invalid invalid_client, attribute: :name
  end

  test "activity logging helpers work" do
    clean_activity_logs # Start fresh

    client = clients(:acme)
    sign_in_as users(:admin)

    # Simulate an activity
    ActivityLog.create!(
      user: User.current_user,
      action: "updated",
      loggable: client,
      metadata: { changes: { name: [ "Old", "New" ] } }
    )

    assert_activity_logged("updated", client)
  end

  test "time helpers work" do
    travel_to_weekday do
      assert_equal "Monday", Date.current.strftime("%A")
      assert_equal 10, Time.current.hour
    end

    with_timezone("America/New_York") do
      assert_equal "America/New_York", Time.zone.name
    end
  end
end
