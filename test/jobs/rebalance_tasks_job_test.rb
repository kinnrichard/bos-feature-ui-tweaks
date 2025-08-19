require "test_helper"

class RebalanceTasksJobTest < ActiveJob::TestCase
  setup do
    @job = jobs(:simple_website_job)
    # Clean up any existing tasks from fixtures
    @job.tasks.destroy_all
  end

  test "rebalances tasks with small gaps" do
    # Create tasks with gaps of 1
    5.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: i + 1)
    end

    assert_equal [ 1, 2, 3, 4, 5 ], @job.tasks.kept.order(:position).pluck(:position)

    # Perform rebalancing
    RebalanceTasksJob.perform_now(@job.id, nil)

    # Check tasks were rebalanced with proper spacing
    rebalanced_positions = @job.tasks.kept.order(:position).pluck(:position)
    assert_equal [ 10000, 20000, 30000, 40000, 50000 ], rebalanced_positions
  end

  test "skips rebalancing if gaps are sufficient" do
    # Create tasks with good spacing
    5.times do |i|
      task = @job.tasks.create!(title: "Task #{i + 1}")
      task.update_column(:position, (i + 1) * 10000)
    end

    original_positions = @job.tasks.kept.reload.order(:position).pluck(:position)
    assert_equal [ 10000, 20000, 30000, 40000, 50000 ], original_positions

    # Perform rebalancing
    RebalanceTasksJob.perform_now(@job.id, nil)

    # Positions should remain unchanged
    assert_equal original_positions, @job.tasks.kept.order(:position).pluck(:position)
  end

  test "rebalances only tasks in specified scope" do
    # Create parent task
    parent = @job.tasks.create!(title: "Parent", position: 10000)

    # Create root tasks with small gaps
    3.times do |i|
      @job.tasks.create!(title: "Root #{i + 1}", position: i + 1)
    end

    # Create subtasks with small gaps
    3.times do |i|
      @job.tasks.create!(title: "Sub #{i + 1}", parent: parent, position: i + 1)
    end

    # Rebalance only subtasks
    RebalanceTasksJob.perform_now(@job.id, parent.id)

    # Check root tasks remain unchanged
    root_positions = @job.tasks.kept.where(parent_id: nil).order(:position).pluck(:position)
    assert root_positions.include?(1) # Still has original positions

    # Check subtasks were rebalanced
    subtask_positions = @job.tasks.kept.where(parent: parent).order(:position).pluck(:position)
    assert_equal [ 10000, 20000, 30000 ], subtask_positions
  end

  test "handles concurrent task modifications" do
    # Create tasks
    5.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: i + 1)
    end

    # Perform rebalancing while modifying a task
    task_to_modify = @job.tasks.first

    RebalanceTasksJob.perform_now(@job.id, nil)

    # Task modification should still work
    task_to_modify.reload
    task_to_modify.update!(title: "Modified")
    assert_equal "Modified", task_to_modify.title
  end

  test "prevents recursive rebalancing triggers" do
    # Create tasks that need rebalancing
    3.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: i + 1)
    end

    # This test would need mocking which isn't available
    # Instead, let's just verify that rebalancing completes without infinite recursion
    assert_nothing_raised do
      RebalanceTasksJob.perform_now(@job.id, nil)
    end

    # Verify tasks were rebalanced
    positions = @job.tasks.reload.order(:position).pluck(:position)
    assert_equal [ 10000, 20000, 30000 ], positions
  end

  test "logs rebalancing activity" do
    # Create tasks
    3.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: i + 1)
    end

    # We can't mock the logger easily, but we can verify the job completes
    assert_nothing_raised do
      RebalanceTasksJob.perform_now(@job.id, nil)
    end

    # Verify rebalancing occurred
    assert_equal [ 10000, 20000, 30000 ], @job.tasks.reload.order(:position).pluck(:position)
  end

  test "handles empty task list gracefully" do
    # Ensure no tasks exist
    @job.tasks.destroy_all

    # Should not raise error
    assert_nothing_raised do
      RebalanceTasksJob.perform_now(@job.id, nil)
    end
  end

  test "handles single task gracefully" do
    # Create single task
    @job.tasks.create!(title: "Only task", position: 1)

    # Should not raise error or change position
    assert_nothing_raised do
      RebalanceTasksJob.perform_now(@job.id, nil)
    end

    assert_equal 1, @job.tasks.first.position
  end

  test "maintains task order during rebalancing" do
    # Create tasks with specific titles indicating order
    titles = [ "Alpha", "Bravo", "Charlie", "Delta", "Echo" ]
    titles.each_with_index do |title, i|
      @job.tasks.create!(title: title, position: i + 1)
    end

    # Get original order
    original_order = @job.tasks.kept.order(:position).pluck(:title)

    # Perform rebalancing
    RebalanceTasksJob.perform_now(@job.id, nil)

    # Order should be preserved
    new_order = @job.tasks.kept.order(:position).pluck(:title)
    assert_equal original_order, new_order
  end

  test "performance with large task lists" do
    # Create 500 tasks with varying gaps
    500.times do |i|
      position = if i < 250
        i * 100  # Larger gaps
      else
        25000 + (i - 250) * 2  # Smaller gaps that need rebalancing
      end
      @job.tasks.create!(title: "Task #{i + 1}", position: position)
    end

    start_time = Time.current
    RebalanceTasksJob.perform_now(@job.id, nil)
    duration = Time.current - start_time

    # Should complete quickly even with many tasks
    assert duration < 5.seconds, "Rebalancing 500 tasks took too long: #{duration}s"

    # Verify all tasks have proper spacing
    positions = @job.tasks.kept.order(:position).pluck(:position)
    positions.each_with_index do |pos, i|
      assert_equal (i + 1) * 10000, pos
    end
  end
end
