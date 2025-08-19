require "test_helper"

class TaskSortingServiceTest < ActiveSupport::TestCase
  setup do
    @job = jobs(:open_job)
    @user = users(:admin)
    sign_in_as @user
    # Clear existing tasks for clean tests
    @job.tasks.destroy_all
  end

  test "sort and resolve conflicts updates positions correctly" do
    # Create tasks with initial positions
    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: 0)
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: 0)
    task3 = @job.tasks.create!(title: "Task 3", position: 3, status: 0)

    # Reorder: move task3 to position 1
    service = TaskSortingService.new(@job)
    updates = [
      { id: task3.id, position: 1, timestamp: Time.current }
    ]
    service.sort_and_resolve_conflicts(updates)

    # Verify new positions
    assert_equal 1, task3.reload.position
    assert_equal 2, task1.reload.position
    assert_equal 3, task2.reload.position
  end

  test "sort resolves conflicts by timestamp order" do
    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: 0)
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: 0)

    # Two conflicting updates - later timestamp should win
    service = TaskSortingService.new(@job)
    updates = [
      { id: task1.id, position: 2, timestamp: 1.minute.ago },
      { id: task1.id, position: 1, timestamp: Time.current }
    ]
    service.sort_and_resolve_conflicts(updates)

    # Task1 should remain at position 1 (latest update)
    assert_equal 1, task1.reload.position
  end

  test "get ordered tasks returns proper hierarchy" do
    # Create parent tasks with subtasks
    parent1 = @job.tasks.create!(title: "Parent 1", status: "new_task")
    child1 = @job.tasks.create!(title: "Child 1", parent: parent1, status: "in_progress")
    child2 = @job.tasks.create!(title: "Child 2", parent: parent1, status: "new_task")

    parent2 = @job.tasks.create!(title: "Parent 2", status: "in_progress")

    service = TaskSortingService.new(@job)
    tree = service.get_ordered_tasks

    # Should have 2 root tasks
    assert_equal 2, tree.length

    # First should be parent2 (in_progress status)
    assert_equal parent2, tree[0][:task]
    assert_equal 0, tree[0][:depth]
    assert_empty tree[0][:subtasks]

    # Second should be parent1 (new_task status)
    assert_equal parent1, tree[1][:task]
    assert_equal 0, tree[1][:depth]
    assert_equal 2, tree[1][:subtasks].length

    # Subtasks should be ordered by status
    assert_equal child1, tree[1][:subtasks][0][:task]
    assert_equal 1, tree[1][:subtasks][0][:depth]
    assert_equal child2, tree[1][:subtasks][1][:task]
    assert_equal 1, tree[1][:subtasks][1][:depth]
  end

  test "updates position when specified" do
    task1 = @job.tasks.create!(title: "Task 1", status: 0)
    task2 = @job.tasks.create!(title: "Task 2", status: 0)

    service = TaskSortingService.new(@job)
    updates = [
      { id: task2.id, position: 1, timestamp: Time.current }
    ]
    service.sort_and_resolve_conflicts(updates)

    # Task2 should now be at position 1
    assert_equal 1, task2.reload.position
    assert_equal 2, task1.reload.position
  end

  test "updates reordered_at timestamp" do
    task = @job.tasks.create!(title: "Task", status: 0)
    original_reordered_at = task.reordered_at

    travel 1.minute do
      service = TaskSortingService.new(@job)
      updates = [
        { id: task.id, position: 2, timestamp: Time.current }
      ]
      service.sort_and_resolve_conflicts(updates)

      assert_not_equal original_reordered_at, task.reload.reordered_at
    end
  end

  test "handles multiple task updates in batch" do
    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: 0)
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: 0)
    task3 = @job.tasks.create!(title: "Task 3", position: 3, status: 0)

    service = TaskSortingService.new(@job)
    updates = [
      { id: task1.id, position: 3, timestamp: Time.current },
      { id: task3.id, position: 1, timestamp: Time.current }
    ]
    service.sort_and_resolve_conflicts(updates)

    # Verify position updates applied
    assert_equal 3, task1.reload.position
    assert_equal 1, task3.reload.position
    assert_equal 2, task2.reload.position  # Should shift to make room
  end

  test "respects ordered_by_status scope in tree building" do
    # Create tasks with mixed statuses
    task_new = @job.tasks.create!(title: "New", status: "new_task")
    task_progress = @job.tasks.create!(title: "Progress", status: "in_progress")
    task_complete = @job.tasks.create!(title: "Complete", status: "successfully_completed")

    # Add subtasks with mixed statuses to one parent
    sub_new = @job.tasks.create!(title: "Sub New", parent: task_new, status: "new_task")
    sub_progress = @job.tasks.create!(title: "Sub Progress", parent: task_new, status: "in_progress")

    service = TaskSortingService.new(@job)
    tree = service.get_ordered_tasks

    # Root level should be ordered by status
    assert_equal task_progress, tree[0][:task]
    assert_equal task_new, tree[1][:task]
    assert_equal task_complete, tree[2][:task]

    # Subtasks should also be ordered by status
    new_task_subtasks = tree[1][:subtasks]
    assert_equal sub_progress, new_task_subtasks[0][:task]
    assert_equal sub_new, new_task_subtasks[1][:task]
  end
end
