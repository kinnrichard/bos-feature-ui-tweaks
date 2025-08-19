require "test_helper"

class TaskTest < ActiveSupport::TestCase
  setup do
    @job = jobs(:simple_website_job)
    @user = users(:admin)
    sign_in_as @user
  end

  test "valid task attributes" do
    task = @job.tasks.build(
      title: "Test Task",
      status: 0,
      position: 1
    )

    assert_valid task
  end

  test "requires title" do
    task = @job.tasks.build(status: 0)

    assert_invalid task, attribute: :title
  end

  test "requires valid status" do
    task = @job.tasks.build(title: "Test")

    assert_valid task # Should default to new_task
    assert_equal "new_task", task.status
  end

  test "prevents self reference" do
    task = @job.tasks.create!(title: "Test", status: 0)
    task.parent_id = task.id

    assert_invalid task, attribute: :parent_id
  end

  test "prevents circular reference" do
    parent = @job.tasks.create!(title: "Parent", status: 0)
    child = @job.tasks.create!(title: "Child", parent: parent, status: 0)
    grandchild = @job.tasks.create!(title: "Grandchild", parent: child, status: 0)

    # Try to make grandchild the parent of parent
    parent.parent = grandchild

    assert_invalid parent, attribute: :parent_id
  end

  test "positioned within job and parent scope" do
    # Clear existing tasks for this job
    @job.tasks.destroy_all

    # Root level tasks
    task1 = @job.tasks.create!(title: "Task 1", status: 0)
    task2 = @job.tasks.create!(title: "Task 2", status: 0)
    task3 = @job.tasks.create!(title: "Task 3", status: 0)

    # Should auto-assign positions
    assert_equal 1, task1.position
    assert_equal 2, task2.position
    assert_equal 3, task3.position

    # Move task3 to position 1
    task3.update(position: 1)

    assert_equal 2, task1.reload.position
    assert_equal 3, task2.reload.position
    assert_equal 1, task3.reload.position
  end

  test "subtasks have separate position sequence" do
    # Clear existing tasks for this job
    @job.tasks.destroy_all

    parent = @job.tasks.create!(title: "Parent", status: 0)
    child1 = @job.tasks.create!(title: "Child 1", parent: parent, status: 0)
    child2 = @job.tasks.create!(title: "Child 2", parent: parent, status: 0)

    # Another root task shouldn't affect subtask positions
    root_task = @job.tasks.create!(title: "Root", status: 0)

    assert_equal 1, parent.position
    assert_equal 2, root_task.position
    assert_equal 1, child1.position
    assert_equal 2, child2.position
  end

  test "time in progress calculation" do
    task = @job.tasks.create!(title: "Test", status: "new_task")

    # No time when never in progress
    assert_equal 0, task.time_in_progress

    # Start progress
    travel_to Time.parse("2024-01-01 10:00:00") do
      task.update!(status: "in_progress")
      ActivityLog.create!(
        user: @user,
        action: "status_changed",
        loggable: task,
        metadata: { new_status: "in_progress", old_status: "new_task" }
      )
    end

    # Check after 30 minutes
    travel_to Time.parse("2024-01-01 10:30:00") do
      assert_equal 1800, task.time_in_progress # 30 minutes
    end

    # Pause task
    travel_to Time.parse("2024-01-01 11:00:00") do
      task.update!(status: "paused")
      ActivityLog.create!(
        user: @user,
        action: "status_changed",
        loggable: task,
        metadata: { new_status: "paused", old_status: "in_progress" }
      )
    end

    # Time should stay at 1 hour
    travel_to Time.parse("2024-01-01 12:00:00") do
      assert_equal 3600, task.time_in_progress # 1 hour
    end
  end

  test "formatted time in progress" do
    task = @job.tasks.create!(title: "Test", status: "new_task")

    # Test with no time
    def task.time_in_progress; 0; end
    assert_nil task.formatted_time_in_progress

    # Test with 5 minutes
    def task.time_in_progress; 300; end
    assert_equal "5m", task.formatted_time_in_progress

    # Test with 1 hour
    def task.time_in_progress; 3600; end
    assert_equal "1h", task.formatted_time_in_progress

    # Test with 1 hour 30 minutes
    def task.time_in_progress; 5400; end
    assert_equal "1h 30m", task.formatted_time_in_progress
  end

  test "progress percentage calculation" do
    parent = @job.tasks.create!(title: "Parent", status: "new_task")

    # No subtasks = 0% (unless completed)
    assert_equal 0, parent.progress_percentage

    # Create subtasks
    child1 = @job.tasks.create!(title: "Child 1", parent: parent, status: "new_task")
    child2 = @job.tasks.create!(title: "Child 2", parent: parent, status: "new_task")
    child3 = @job.tasks.create!(title: "Child 3", parent: parent, status: "new_task")

    # All new = 0%
    assert_equal 0, parent.reload.progress_percentage

    # Complete one = 33%
    child1.update!(status: "successfully_completed")
    assert_equal 33, parent.reload.progress_percentage

    # Complete two = 67%
    child2.update!(status: "successfully_completed")
    assert_equal 67, parent.reload.progress_percentage

    # Parent marked complete = 100% regardless of children
    parent.update!(status: "successfully_completed")
    assert_equal 100, parent.progress_percentage
  end

  test "status emoji helpers" do
    # Disable resort for this test
    @user.update!(resort_tasks_on_status_change: false)

    task = @job.tasks.create!(title: "Test", status: "new_task")
    assert_equal "⚫️", task.status_emoji

    task.update!(status: "in_progress")
    assert_equal "in_progress", task.status
    assert_equal "🟢", task.status_emoji

    task.update!(status: "paused")
    assert_equal "⏸️", task.status_emoji

    task.update!(status: "successfully_completed")
    assert_equal "☑️", task.status_emoji

    task.update!(status: "cancelled")
    assert_equal "❌", task.status_emoji
  end

  test "root task finder" do
    root = @job.tasks.create!(title: "Root", status: 0)
    child = @job.tasks.create!(title: "Child", parent: root, status: 0)
    grandchild = @job.tasks.create!(title: "Grandchild", parent: child, status: 0)

    assert_equal root, root.root_task
    assert_equal root, child.root_task
    assert_equal root, grandchild.root_task
  end

  test "scopes work correctly" do
    parent1 = @job.tasks.create!(title: "Parent 1", status: 0)
    parent2 = @job.tasks.create!(title: "Parent 2", status: 0)
    child1 = @job.tasks.create!(title: "Child 1", parent: parent1, status: 0)
    child2 = @job.tasks.create!(title: "Child 2", parent: parent1, status: 0)

    # Root tasks scope
    root_tasks = @job.tasks.root_tasks
    assert_includes root_tasks, parent1
    assert_includes root_tasks, parent2
    assert_not_includes root_tasks, child1
    assert_not_includes root_tasks, child2

    # Subtasks of scope
    subtasks = Task.subtasks_of(parent1)
    assert_includes subtasks, child1
    assert_includes subtasks, child2
    assert_not_includes subtasks, parent2
  end

  test "ordered by status scope" do
    # Clear existing tasks for this job
    @job.tasks.destroy_all

    # Create tasks with different statuses
    task_cancelled = @job.tasks.create!(title: "Cancelled", status: "cancelled")
    task_new = @job.tasks.create!(title: "New", status: "new_task")
    task_progress = @job.tasks.create!(title: "Progress", status: "in_progress")
    task_complete = @job.tasks.create!(title: "Complete", status: "successfully_completed")
    task_paused = @job.tasks.create!(title: "Paused", status: "paused")

    ordered = @job.tasks.ordered_by_status.pluck(:id)

    # Expected order: in_progress, paused, new, completed, cancelled
    expected_order = [
      task_progress.id,
      task_paused.id,
      task_new.id,
      task_complete.id,
      task_cancelled.id
    ]

    assert_equal expected_order, ordered
  end

  test "auto reorder on status change when enabled" do
    @user.update!(resort_tasks_on_status_change: true)

    # Clear existing tasks for this job to ensure clean test
    @job.tasks.destroy_all

    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: "new_task")
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: "new_task")
    task3 = @job.tasks.create!(title: "Task 3", position: 3, status: "new_task")

    # Change task3 to in_progress - should move to top
    task3.update!(status: "in_progress")

    assert_equal 1, task3.reload.position
    assert_equal 2, task1.reload.position
    assert_equal 3, task2.reload.position
  end

  test "no auto reorder when disabled" do
    @user.update!(resort_tasks_on_status_change: false)

    # Clear existing tasks for this job to ensure clean test
    @job.tasks.destroy_all

    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: "new_task")
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: "new_task")
    task3 = @job.tasks.create!(title: "Task 3", position: 3, status: "new_task")

    # Change task3 to in_progress - positions should not change
    task3.update!(status: "in_progress")

    assert_equal 1, task1.reload.position
    assert_equal 2, task2.reload.position
    assert_equal 3, task3.reload.position
  end

  test "updates reordered_at on position change" do
    task = @job.tasks.create!(title: "Test", status: 0)
    original_reordered_at = task.reordered_at

    travel 1.minute do
      task.update!(position: 5)
      assert_not_equal original_reordered_at, task.reordered_at
    end
  end

  test "discard functionality" do
    task = @job.tasks.create!(title: "Test Task", status: 0)

    assert task.kept?
    assert_not task.discarded?

    task.discard

    assert task.discarded?
    assert_not task.kept?
    assert_not_nil task.discarded_at
  end

  test "undiscard functionality" do
    task = @job.tasks.create!(title: "Test Task", status: 0)
    task.discard

    assert task.discarded?

    task.undiscard

    assert task.kept?
    assert_not task.discarded?
    assert_nil task.discarded_at
  end

  test "prevents discarding task with active subtasks" do
    parent = @job.tasks.create!(title: "Parent Task", status: 0)
    child = @job.tasks.create!(title: "Child Task", parent: parent, status: 0)

    result = parent.discard_with_subtask_check

    assert_not result
    assert parent.kept?
    assert_includes parent.errors.full_messages, "Cannot delete task with active subtasks. Please delete or move subtasks first."
  end

  test "allows discarding task with discarded subtasks" do
    parent = @job.tasks.create!(title: "Parent Task", status: 0)
    child = @job.tasks.create!(title: "Child Task", parent: parent, status: 0)

    # Discard the child first
    child.discard

    # Now parent should be discardable
    result = parent.discard_with_subtask_check

    assert result
    assert parent.discarded?
  end

  test "discard scopes work correctly" do
    task1 = @job.tasks.create!(title: "Kept Task", status: 0)
    task2 = @job.tasks.create!(title: "Discarded Task", status: 0)

    task2.discard

    # Default association should only show kept tasks
    assert_includes @job.tasks, task1
    assert_not_includes @job.tasks, task2

    # All tasks association should show both
    assert_includes @job.all_tasks, task1
    assert_includes @job.all_tasks, task2

    # Explicit scopes
    assert_includes Task.kept, task1
    assert_not_includes Task.kept, task2

    assert_not_includes Task.discarded, task1
    assert_includes Task.discarded, task2

    assert_includes Task.with_discarded, task1
    assert_includes Task.with_discarded, task2
  end
end
