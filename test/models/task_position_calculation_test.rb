require "test_helper"

class TaskPositionCalculationTest < ActiveSupport::TestCase
  setup do
    @job = jobs(:simple_website_job)
    # Clean up any existing tasks from fixtures
    @job.tasks.destroy_all
  end

  test "task with repositioned_to_top gets negative position before first task" do
    # Create existing tasks with explicit positions
    first_task = @job.tasks.build(title: "First")
    first_task.save!
    first_task.update_column(:position, 1000)

    second_task = @job.tasks.build(title: "Second")
    second_task.save!
    second_task.update_column(:position, 2000)

    # Create task to be positioned at top
    new_task = @job.tasks.build(
      title: "New Top Task",
      repositioned_to_top: true,
      position_finalized: false
    )

    # Disable positioning gem for this test
    new_task.instance_eval { def set_list_position; end }

    assert new_task.save
    assert new_task.position < first_task.position, "New task should be positioned before first task"
    assert new_task.position >= -10000, "Position should not be too negative"
    assert new_task.position < 0, "Position should be negative for top positioning"
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task with repositioned_to_top in empty list gets positive position" do
    # Create task in empty list
    new_task = @job.tasks.build(
      title: "First Task",
      repositioned_to_top: true,
      position_finalized: false
    )

    assert new_task.save
    assert new_task.position > 0, "First task should have positive position"
    assert new_task.position >= 1000, "Position should be at least 1000"
    assert new_task.position <= 10000, "Position should not exceed 10000"
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task positioned after specific task gets position between tasks" do
    # Create existing tasks with good spacing
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)
    task2 = @job.tasks.create!(title: "Task 2", position: 20000)
    task3 = @job.tasks.create!(title: "Task 3", position: 30000)

    # Create task to be positioned after task1
    new_task = @job.tasks.build(
      title: "New Task",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    assert new_task.save
    assert new_task.position > task1.position, "New task should be after task1"
    assert new_task.position < task2.position, "New task should be before task2"

    # Should be randomly placed in middle 50% of gap
    gap = task2.position - task1.position
    quarter_gap = gap / 4
    assert new_task.position >= task1.position + quarter_gap
    assert new_task.position <= task2.position - quarter_gap
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task positioned after last task gets standard spacing" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)
    task2 = @job.tasks.create!(title: "Task 2", position: 20000)

    # Create task to be positioned after last task
    new_task = @job.tasks.build(
      title: "New Last Task",
      repositioned_after_id: task2.id,
      position_finalized: false
    )

    assert new_task.save
    assert new_task.position > task2.position, "New task should be after last task"
    assert new_task.position >= task2.position + 10000, "Should have at least standard spacing"
    assert new_task.position <= task2.position + 15000, "Should not exceed standard spacing + randomization"
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task with small gap triggers proper positioning" do
    # Create tasks with very small gap
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)
    task2 = @job.tasks.create!(title: "Task 2", position: 1001)

    # Create task to be positioned between them
    new_task = @job.tasks.build(
      title: "Squeezed Task",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    assert new_task.save
    # With gap of 1, it should position at task1.position + 1
    assert_equal task1.position + 1, new_task.position
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task with invalid repositioned_after_id falls back to end position" do
    # Create existing task
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)

    # Create task with non-existent repositioned_after_id
    new_task = @job.tasks.build(
      title: "New Task",
      repositioned_after_id: SecureRandom.uuid,
      position_finalized: false
    )

    assert new_task.save
    assert new_task.position > task1.position, "Should be positioned at end"
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task without positioning info gets end position" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)
    task2 = @job.tasks.create!(title: "Task 2", position: 20000)

    # Create task without any positioning info
    new_task = @job.tasks.build(
      title: "Default Position Task",
      position_finalized: false
    )

    assert new_task.save
    assert new_task.position > task2.position, "Should be positioned at end"
    assert new_task.position_finalized, "Position should be finalized after save"
  end

  test "task with position_finalized true skips calculation" do
    # Create task with explicit position and finalized flag
    explicit_position = 12345
    new_task = @job.tasks.build(
      title: "Explicit Position",
      position: explicit_position,
      position_finalized: true,
      repositioned_after_id: SecureRandom.uuid  # Should be ignored
    )

    assert new_task.save
    assert_equal explicit_position, new_task.position, "Position should not be recalculated"
  end

  test "subtask positioning respects parent scope" do
    # Create parent tasks
    parent1 = @job.tasks.create!(title: "Parent 1", position: 10000)
    parent2 = @job.tasks.create!(title: "Parent 2", position: 20000)

    # Create subtasks for parent1
    sub1 = @job.tasks.create!(title: "P1 Sub 1", parent: parent1, position: 1000)
    sub2 = @job.tasks.create!(title: "P1 Sub 2", parent: parent1, position: 2000)

    # Create subtask for parent2
    other_sub = @job.tasks.create!(title: "P2 Sub 1", parent: parent2, position: 1000)

    # Create new subtask to be positioned after sub1
    new_sub = @job.tasks.build(
      title: "P1 New Sub",
      parent: parent1,
      repositioned_after_id: sub1.id,
      position_finalized: false
    )

    assert new_sub.save
    assert new_sub.position > sub1.position, "Should be after sub1"
    assert new_sub.position < sub2.position, "Should be before sub2"
    # Should not consider other_sub from different parent
  end

  test "concurrent task creation handles position conflicts" do
    # Create base task
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)

    # Simulate concurrent creation of two tasks after task1
    new_task1 = @job.tasks.build(
      title: "Concurrent 1",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    new_task2 = @job.tasks.build(
      title: "Concurrent 2",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    assert new_task1.save
    assert new_task2.save

    # Both should have positions after task1
    assert new_task1.position > task1.position
    assert new_task2.position > task1.position

    # They should have different positions due to randomization
    assert_not_equal new_task1.position, new_task2.position
  end

  test "updating task with new repositioned_after_id recalculates position" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)
    task2 = @job.tasks.create!(title: "Task 2", position: 20000)
    task3 = @job.tasks.create!(title: "Task 3", position: 30000)

    # Create task at end
    moving_task = @job.tasks.create!(title: "Moving Task", position: 40000)

    # Update task to reposition after task1
    moving_task.update!(
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    assert moving_task.position > task1.position
    assert moving_task.position < task2.position
    assert moving_task.position_finalized
  end

  test "randomization provides different positions for same gap" do
    # Create tasks with large gap
    task1 = @job.tasks.create!(title: "Task 1", position: 10000)
    task2 = @job.tasks.create!(title: "Task 2", position: 50000)

    # Create multiple tasks in same gap
    positions = []
    5.times do |i|
      new_task = @job.tasks.build(
        title: "Random #{i}",
        repositioned_after_id: task1.id,
        position_finalized: false
      )
      new_task.save!
      positions << new_task.position

      # Clean up for next iteration
      new_task.destroy
    end

    # Should have at least some variation in positions
    unique_positions = positions.uniq
    assert unique_positions.length > 1, "Randomization should produce different positions"

    # All should be in the correct range
    positions.each do |pos|
      assert pos > task1.position
      assert pos < task2.position
    end
  end
end
