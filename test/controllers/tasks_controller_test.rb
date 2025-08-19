require "test_helper"

class TasksControllerTest < ActionDispatch::IntegrationTest
  setup do
    @client = clients(:acme)
    @job = jobs(:open_job)
    @task = tasks(:open_task_1)
    @owner = users(:owner)
    @admin = users(:admin)
    @technician = users(:technician)
  end

  # Authentication tests
  test "requires authentication for all actions" do
    # Create
    post client_job_tasks_path(@client, @job), params: { task: { title: "Test" } }
    assert_redirected_to login_path

    # Update
    patch client_job_task_path(@client, @job, @task), params: { task: { title: "Updated" } }
    assert_redirected_to login_path

    # Destroy
    delete client_job_task_path(@client, @job, @task)
    assert_redirected_to login_path

    # Reorder (member action)
    patch reorder_client_job_task_path(@client, @job, @task), params: { position: 1 }
    assert_redirected_to login_path

    # Reorder (collection action)
    patch reorder_client_job_tasks_path(@client, @job), params: { positions: [] }
    assert_redirected_to login_path
  end

  # Create authorization
  test "all authenticated users can create tasks" do
    [ @owner, @admin, @technician ].each do |user|
      sign_in_as user

      assert_difference "Task.count", 1 do
        post client_job_tasks_path(@client, @job), params: {
          task: {
            title: "Task by #{user.role}",
            status: "new_task"
          }
        }
      end

      assert_redirected_to client_job_path(@client, @job)
      assert_equal "Task was successfully created.", flash[:notice]
    end
  end

  test "creates task via JSON API" do
    sign_in_as @admin

    assert_difference "Task.count", 1 do
      post client_job_tasks_path(@client, @job), params: {
        task: { title: "API Task" }
      }, as: :json
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "success", json["status"]
    assert_equal "API Task", json["task"]["title"]
  end

  # Update authorization
  test "all authenticated users can update tasks" do
    [ @owner, @admin, @technician ].each do |user|
      sign_in_as user

      patch client_job_task_path(@client, @job, @task), params: {
        task: { title: "Updated by #{user.role}" }
      }

      assert_redirected_to client_job_path(@client, @job)
      assert_equal "Task was successfully updated.", flash[:notice]
      assert_equal "Updated by #{user.role}", @task.reload.title
    end
  end

  test "updates task status" do
    sign_in_as @admin

    patch client_job_task_path(@client, @job, @task), params: {
      task: { status: "in_progress" }
    }

    assert_redirected_to client_job_path(@client, @job)
    assert_equal "in_progress", @task.reload.status
  end

  test "updates task parent" do
    sign_in_as @admin
    parent_task = @job.tasks.create!(title: "Parent Task", status: "new_task")

    patch client_job_task_path(@client, @job, @task), params: {
      task: { parent_id: parent_task.id }
    }

    assert_redirected_to client_job_path(@client, @job)
    assert_equal parent_task, @task.reload.parent
  end

  test "updates task with position and parent change" do
    sign_in_as @admin
    parent_task = @job.tasks.create!(title: "Parent", status: "new_task")

    patch client_job_task_path(@client, @job, @task), params: {
      task: {
        parent_id: parent_task.id,
        position: 1
      }
    }

    assert_redirected_to client_job_path(@client, @job)
    @task.reload
    assert_equal parent_task, @task.parent
    assert_equal 1, @task.position
  end

  # Delete authorization - follows job deletion rules
  test "owners can delete any task" do
    sign_in_as @owner

    assert_difference "Task.count", -1 do
      delete client_job_task_path(@client, @job, @task)
    end

    assert_redirected_to client_job_path(@client, @job)
    assert_equal "Task was successfully deleted.", flash[:notice]
  end

  test "admins can delete any task" do
    sign_in_as @admin

    assert_difference "Task.count", -1 do
      delete client_job_task_path(@client, @job, @task)
    end

    assert_redirected_to client_job_path(@client, @job)
  end

  test "technicians can delete tasks from their recently created jobs" do
    sign_in_as @technician

    # Create a recent job and task
    tech_job = @client.jobs.create!(
      title: "Tech Job",
      created_at: 2.minutes.ago
    )
    tech_task = tech_job.tasks.create!(title: "Tech Task", status: "new_task")

    assert_difference "Task.count", -1 do
      delete client_job_task_path(@client, tech_job, tech_task)
    end

    assert_redirected_to client_job_path(@client, tech_job)
  end

  test "technicians cannot delete tasks from old jobs" do
    sign_in_as @technician

    # Create an old job
    old_job = @client.jobs.create!(
      title: "Old Job",
      created_at: 10.minutes.ago
    )
    old_task = old_job.tasks.create!(title: "Old Task", status: "new_task")

    assert_no_difference "Task.count" do
      delete client_job_task_path(@client, old_job, old_task)
    end

    assert_redirected_to client_job_path(@client, old_job)
    assert_equal "You do not have permission to delete this task.", flash[:alert]
  end

  test "technicians cannot delete tasks from other users' jobs" do
    sign_in_as @technician

    assert_no_difference "Task.count" do
      delete client_job_task_path(@client, @job, @task)
    end

    assert_redirected_to client_job_path(@client, @job)
    assert_equal "You do not have permission to delete this task.", flash[:alert]
  end

  # Reordering tests
  test "reorders single task to new position" do
    sign_in_as @admin

    # Create tasks with known positions
    @job.tasks.destroy_all
    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: "new_task")
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: "new_task")
    task3 = @job.tasks.create!(title: "Task 3", position: 3, status: "new_task")

    # Move task3 to position 1
    patch reorder_client_job_task_path(@client, @job, task3), params: {
      position: 1
    }

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "success", json["status"]

    # Verify positions
    assert_equal 2, task1.reload.position
    assert_equal 3, task2.reload.position
    assert_equal 1, task3.reload.position
  end

  test "reorders multiple tasks in batch" do
    sign_in_as @admin

    # Create tasks
    @job.tasks.destroy_all
    task1 = @job.tasks.create!(title: "Task 1", position: 1, status: "new_task")
    task2 = @job.tasks.create!(title: "Task 2", position: 2, status: "new_task")
    task3 = @job.tasks.create!(title: "Task 3", position: 3, status: "new_task")

    # Batch reorder
    patch reorder_client_job_tasks_path(@client, @job), params: {
      positions: [
        { id: task3.id, position: 1 },
        { id: task1.id, position: 2 },
        { id: task2.id, position: 3 }
      ]
    }

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "success", json["status"]

    # Verify new order
    assert_equal 2, task1.reload.position
    assert_equal 3, task2.reload.position
    assert_equal 1, task3.reload.position
  end

  test "reorder requires position parameter for single task" do
    sign_in_as @admin

    patch reorder_client_job_task_path(@client, @job, @task), params: {}

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "Position parameter required", json["error"]
  end

  test "batch reorder requires positions parameter" do
    sign_in_as @admin

    patch reorder_client_job_tasks_path(@client, @job), params: {}

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_equal "Positions parameter required", json["error"]
  end

  # Turbo Stream responses
  test "returns turbo stream response when requested" do
    sign_in_as @admin

    patch client_job_task_path(@client, @job, @task),
          params: { task: { title: "Updated" } },
          headers: { "Accept" => "text/vnd.turbo-stream.html" }

    assert_response :success
    assert_equal "text/vnd.turbo-stream.html; charset=utf-8", response.content_type
    assert_match "<turbo-stream action=\"update\"", response.body
    assert_match "target=\"tasks-list\"", response.body
  end

  # CSRF protection
  test "skips CSRF protection for JSON requests" do
    sign_in_as @admin

    # This should work even without CSRF token
    post client_job_tasks_path(@client, @job),
         params: { task: { title: "JSON Task" } },
         as: :json,
         headers: { "X-CSRF-Token" => "invalid" }

    assert_response :success
  end

  # Error handling
  test "handles validation errors on create" do
    sign_in_as @admin

    post client_job_tasks_path(@client, @job), params: {
      task: { title: "" } # Invalid - title required
    }

    assert_redirected_to client_job_path(@client, @job)
    assert_equal "Error creating task.", flash[:alert]
  end

  test "handles validation errors on create via JSON" do
    sign_in_as @admin

    post client_job_tasks_path(@client, @job),
         params: { task: { title: "" } },
         as: :json

    assert_response :unprocessable_entity
    json = JSON.parse(response.body)
    assert_match "Title can't be blank", json["error"]
  end

  test "handles validation errors on update" do
    sign_in_as @admin

    patch client_job_task_path(@client, @job, @task), params: {
      task: { title: "" }
    }

    assert_response :success # Renders edit view
  end

  # Edge cases
  test "handles non-existent client" do
    sign_in_as @admin

    post client_job_tasks_path(999999, @job), params: {
      task: { title: "Test" }
    }

    assert_response :not_found
  end

  test "handles non-existent job" do
    sign_in_as @admin

    post client_job_tasks_path(@client, 999999), params: {
      task: { title: "Test" }
    }

    assert_response :not_found
  end

  test "handles non-existent task" do
    sign_in_as @admin

    patch client_job_task_path(@client, @job, 999999), params: {
      task: { title: "Test" }
    }

    assert_response :not_found
  end

  # Parameter filtering
  test "filters unpermitted parameters" do
    sign_in_as @admin

    original_job = @task.job

    patch client_job_task_path(@client, @job, @task), params: {
      task: {
        title: "Updated",
        job_id: jobs(:in_progress_job).id, # Should be filtered
        created_at: 1.year.ago # Should be filtered
      }
    }

    @task.reload
    assert_equal "Updated", @task.title
    assert_equal original_job, @task.job
    assert_not_equal 1.year.ago.to_date, @task.created_at.to_date
  end

  # Activity logging
  test "creates activity log on task creation" do
    sign_in_as @admin

    assert_difference "ActivityLog.count", 1 do
      post client_job_tasks_path(@client, @job), params: {
        task: { title: "New Task", status: "new_task" }
      }
    end

    log = ActivityLog.last
    assert_equal "created", log.action
    assert_equal "Task", log.loggable_type
    assert_equal @admin, log.user
  end

  test "creates activity log on task update" do
    sign_in_as @admin

    assert_difference "ActivityLog.count", 1 do
      patch client_job_task_path(@client, @job, @task), params: {
        task: { status: "in_progress" }
      }
    end

    log = ActivityLog.last
    assert_includes [ "updated", "status_changed" ], log.action
    assert_equal @task, log.loggable
    assert_equal @admin, log.user
  end

  test "creates activity log on task deletion" do
    sign_in_as @admin

    task_title = @task.title

    assert_difference "ActivityLog.count", 1 do
      delete client_job_task_path(@client, @job, @task)
    end

    log = ActivityLog.last
    assert_equal "deleted", log.action
    assert_equal "Task", log.loggable_type
    assert_equal @task.id, log.loggable_id
  end
end
