require "test_helper"

class ViewDataServiceTest < ActiveSupport::TestCase
  setup do
    @job = jobs(:empty_project)  # Use the correct fixture name
    @client = clients(:acme)
    @user = users(:admin)
  end

  test "schedule_popover_data returns scheduled dates and available technicians" do
    data = ViewDataService.schedule_popover_data(job: @job)

    assert data.key?(:scheduled_dates)
    assert data.key?(:available_technicians)
    assert_kind_of Array, data[:available_technicians]

    # Should include users with technician, admin, or owner roles
    tech_roles = data[:available_technicians].map(&:role).uniq
    assert (tech_roles - [ "technician", "admin", "owner" ]).empty?
  end

  test "job_assignment_data returns available technicians" do
    data = ViewDataService.job_assignment_data

    assert data.key?(:available_technicians)
    assert_kind_of Array, data[:available_technicians]
    assert data[:available_technicians].any?
  end

  test "people_index_data preloads contact types" do
    people = @client.people
    data = ViewDataService.people_index_data(people: people)

    assert data.key?(:people)
    assert data.key?(:contact_types_by_person)

    # Verify contact types are correctly mapped
    person = people.first
    if person.contact_methods.any?
      expected_types = person.contact_methods.pluck(:contact_type)
      assert_equal expected_types.sort, data[:contact_types_by_person][person.id].sort
    end
  end

  test "task_list_data returns last status changes" do
    task = tasks(:simple_install)  # Use an in_progress task
    tasks_tree = [ { task: task, subtasks: [] } ]

    # Create a status change log
    ActivityLog.create!(
      user: @user,
      action: "status_changed",
      loggable: task,
      metadata: { new_status: "in_progress" }
    )

    data = ViewDataService.task_list_data(tasks_tree: tasks_tree)

    assert data.key?(:last_status_changes)
    assert data.key?(:time_in_progress)
    assert_kind_of Hash, data[:last_status_changes]
    assert_kind_of Hash, data[:time_in_progress]
  end

  test "bulk_calculate_time_in_progress handles multiple tasks efficiently" do
    task1 = tasks(:simple_install)
    task2 = tasks(:simple_theme)

    # Create status change logs for both tasks
    ActivityLog.create!(
      user: @user,
      action: "status_changed",
      loggable: task1,
      metadata: { new_status: "in_progress" },
      created_at: 1.hour.ago
    )

    ActivityLog.create!(
      user: @user,
      action: "status_changed",
      loggable: task1,
      metadata: { new_status: "successfully_completed" },
      created_at: 30.minutes.ago
    )

    ActivityLog.create!(
      user: @user,
      action: "status_changed",
      loggable: task2,
      metadata: { new_status: "in_progress" },
      created_at: 45.minutes.ago
    )

    # Set task2 to in_progress status for current time calculation
    task2.update!(status: :in_progress)

    # Test bulk calculation
    tasks_tree = [
      { task: task1, subtasks: [] },
      { task: task2, subtasks: [] }
    ]

    data = ViewDataService.task_list_data(tasks_tree: tasks_tree)

    # Should have time data for both tasks
    assert data[:time_in_progress].key?(task1.id)
    assert data[:time_in_progress].key?(task2.id)

    # Task1 should have 30 minutes (1 hour in progress, completed 30 min ago)
    assert_operator data[:time_in_progress][task1.id], :>, 25.minutes
    assert_operator data[:time_in_progress][task1.id], :<, 35.minutes

    # Task2 should have ~45 minutes (still in progress)
    assert_operator data[:time_in_progress][task2.id], :>, 40.minutes
  end

  test "job_card_data includes necessary associations" do
    jobs = Job.all
    preloaded_jobs = ViewDataService.job_card_data(jobs: jobs)

    # Check that associations are loaded
    assert preloaded_jobs.first.association(:client).loaded?
    assert preloaded_jobs.first.association(:technicians).loaded?
  end

  test "available_technicians is cached" do
    # First call
    data1 = ViewDataService.job_assignment_data
    technicians1 = data1[:available_technicians]

    # Second call should return the same object (cached)
    data2 = ViewDataService.job_assignment_data
    technicians2 = data2[:available_technicians]

    assert_equal technicians1.object_id, technicians2.object_id
  end
end
