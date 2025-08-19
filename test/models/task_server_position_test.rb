require "test_helper"

class TaskServerPositionTest < ActiveSupport::TestCase
  setup do
    @job = jobs(:simple_website_job)
    # Clean up any existing tasks from fixtures
    @job.tasks.destroy_all
  end

  test "task created with repositioned_to_top=true gets position before first task" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1")
    task2 = @job.tasks.create!(title: "Task 2")

    # Get their actual positions assigned by positioning gem
    initial_positions = [ task1.position, task2.position ].sort

    # Create new task with repositioned_to_top
    new_task = @job.tasks.create!(
      title: "Top Task",
      repositioned_to_top: true,
      position_finalized: false
    )

    # Should be positioned before all existing tasks
    assert new_task.position < initial_positions.first
    assert new_task.position_finalized
  end

  test "task created with repositioned_after_id gets position after specified task" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1")
    task2 = @job.tasks.create!(title: "Task 2")
    task3 = @job.tasks.create!(title: "Task 3")

    # Create new task positioned after task1
    new_task = @job.tasks.create!(
      title: "After Task 1",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    # Reload to get actual positions
    task1.reload
    task2.reload

    # New task should be between task1 and whatever comes after it
    assert new_task.position > task1.position

    # Find the task that was originally after task1
    next_task = [ task2, task3 ].min_by(&:position)
    if next_task.position > task1.position
      assert new_task.position < next_task.position
    end
  end

  test "task with invalid repositioned_after_id is positioned at end" do
    # Create existing task
    task1 = @job.tasks.create!(title: "Task 1")

    # Try to create task with non-existent repositioned_after_id
    # The model should clear the invalid ID and position at end
    new_task = @job.tasks.create!(
      title: "Invalid Reference",
      repositioned_after_id: SecureRandom.uuid,
      position_finalized: false
    )

    assert new_task.persisted?
    assert new_task.position > task1.position
    assert_nil new_task.repositioned_after_id
  end

  test "position_finalized prevents position recalculation" do
    # Create task with explicit position
    task = @job.tasks.create!(
      title: "Fixed Position",
      position: 5000,
      position_finalized: true
    )

    # Position should be what we set
    assert_equal 5000, task.position
  end

  test "updating task with repositioned_after_id moves it" do
    # Create tasks
    task1 = @job.tasks.create!(title: "Task 1")
    task2 = @job.tasks.create!(title: "Task 2")
    task3 = @job.tasks.create!(title: "Task 3")
    moving_task = @job.tasks.create!(title: "Moving Task")

    original_position = moving_task.position

    # Move task after task1
    moving_task.update!(
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    # Should have moved
    assert_not_equal original_position, moving_task.position
    assert moving_task.position > task1.position
  end

  test "server clears repositioning fields after use" do
    task1 = @job.tasks.create!(title: "Task 1")

    new_task = @job.tasks.create!(
      title: "New Task",
      repositioned_after_id: task1.id,
      repositioned_to_top: false,
      position_finalized: false
    )

    # Repositioning fields should be cleared after save
    assert_nil new_task.repositioned_after_id
    assert_equal false, new_task.repositioned_to_top
    assert new_task.position_finalized
  end

  test "subtasks respect parent scope when positioning" do
    # Create parent tasks
    parent1 = @job.tasks.create!(title: "Parent 1")
    parent2 = @job.tasks.create!(title: "Parent 2")

    # Create subtasks for parent1
    sub1 = @job.tasks.create!(title: "P1 Sub 1", parent: parent1)
    sub2 = @job.tasks.create!(title: "P1 Sub 2", parent: parent1)

    # Create subtask for parent2
    other_sub = @job.tasks.create!(title: "P2 Sub 1", parent: parent2)

    # Create new subtask positioned after sub1
    new_sub = @job.tasks.create!(
      title: "P1 New Sub",
      parent: parent1,
      repositioned_after_id: sub1.id,
      position_finalized: false
    )

    # Should be positioned relative to parent1's subtasks only
    assert new_sub.position > sub1.position
    assert new_sub.parent_id == parent1.id
  end

  test "concurrent creation with same repositioned_after_id works" do
    task1 = @job.tasks.create!(title: "Task 1")

    # Create two tasks "concurrently" after task1
    new_task1 = @job.tasks.create!(
      title: "Concurrent 1",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    new_task2 = @job.tasks.create!(
      title: "Concurrent 2",
      repositioned_after_id: task1.id,
      position_finalized: false
    )

    # Both should be after task1
    assert new_task1.position > task1.position
    assert new_task2.position > task1.position

    # They should have different positions
    assert_not_equal new_task1.position, new_task2.position
  end
end
