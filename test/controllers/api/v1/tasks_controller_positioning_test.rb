require "test_helper"

class Api::V1::TasksControllerPositioningTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:admin)
    @job = jobs(:simple_website_job)

    # Clean up any existing tasks from fixtures
    @job.tasks.destroy_all

    # Ensure admin can access the job
    unless @job.technicians.include?(@user)
      @job.technicians << @user
    end

    login_as(@user)
  end

  test "create task with repositioned_to_top positions it at beginning" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)
    task2 = @job.tasks.create!(title: "Task 2", position: 2000)

    # Create new task at top
    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "Top Task",
             repositioned_to_top: true,
             position_finalized: false
           }
         },
         as: :json

    assert_response :created
    json = JSON.parse(response.body)
    new_task_id = json["task"]["id"]

    # Verify position
    new_task = Task.find(new_task_id)
    assert new_task.position < task1.position, "New task should be before task1"
    assert new_task.position_finalized, "Position should be finalized"
  end

  test "create task with repositioned_after_id positions it after specified task" do
    # Create existing tasks
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)
    task2 = @job.tasks.create!(title: "Task 2", position: 5000)
    task3 = @job.tasks.create!(title: "Task 3", position: 10000)

    # Create new task after task1
    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "After Task 1",
             repositioned_after_id: task1.id,
             position_finalized: false
           }
         },
         as: :json

    assert_response :created
    json = JSON.parse(response.body)
    new_task_id = json["task"]["id"]

    # Verify position
    new_task = Task.find(new_task_id)
    assert new_task.position > task1.position, "New task should be after task1"
    assert new_task.position < task2.position, "New task should be before task2"
    assert new_task.position_finalized, "Position should be finalized"
  end

  test "create task with invalid repositioned_after_id positions at end" do
    # Create existing task
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)

    # Create new task with invalid reference
    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "Invalid Reference",
             repositioned_after_id: SecureRandom.uuid,
             position_finalized: false
           }
         },
         as: :json

    assert_response :created
    json = JSON.parse(response.body)
    new_task_id = json["task"]["id"]

    # Verify position
    new_task = Task.find(new_task_id)
    assert new_task.position > task1.position, "New task should be at end"
    assert new_task.position_finalized, "Position should be finalized"
    assert_nil new_task.repositioned_after_id, "Invalid ID should be cleared"
  end

  test "create task with explicit position ignores repositioning fields" do
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)

    # Create task with both position and repositioning fields
    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "Explicit Position",
             position: 5000,
             repositioned_after_id: task1.id,
             repositioned_to_top: true
           }
         },
         as: :json

    assert_response :created
    json = JSON.parse(response.body)
    new_task_id = json["task"]["id"]

    # Verify explicit position was used
    new_task = Task.find(new_task_id)
    assert_equal 5000, new_task.position
    assert new_task.position_finalized
  end

  test "legacy after_task_id parameter is converted to repositioned_after_id" do
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)
    task2 = @job.tasks.create!(title: "Task 2", position: 5000)

    # Use legacy parameter
    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "Legacy Position",
             after_task_id: task1.id
           }
         },
         as: :json

    assert_response :created
    json = JSON.parse(response.body)
    new_task_id = json["task"]["id"]

    # Verify positioning worked
    new_task = Task.find(new_task_id)
    assert new_task.position > task1.position
    assert new_task.position < task2.position
  end

  test "update task with repositioned_after_id moves it" do
    # Create tasks
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)
    task2 = @job.tasks.create!(title: "Task 2", position: 2000)
    task3 = @job.tasks.create!(title: "Task 3", position: 3000)
    moving_task = @job.tasks.create!(title: "Moving Task", position: 4000)

    original_position = moving_task.position

    # Update task to reposition after task1
    patch api_v1_job_task_path(@job, moving_task),
          params: {
            task: {
              repositioned_after_id: task1.id,
              position_finalized: false
            }
          },
          as: :json

    assert_response :success

    # Verify task moved
    moving_task.reload
    assert_not_equal original_position, moving_task.position
    assert moving_task.position > task1.position
    assert moving_task.position < task2.position
  end

  test "concurrent task creation with same repositioned_after_id gets different positions" do
    task1 = @job.tasks.create!(title: "Task 1", position: 1000)

    # Create two tasks positioned after task1
    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "Concurrent 1",
             repositioned_after_id: task1.id,
             position_finalized: false
           }
         },
         as: :json

    assert_response :created
    json1 = JSON.parse(response.body)
    task_id1 = json1["task"]["id"]

    post api_v1_job_tasks_path(@job),
         params: {
           task: {
             title: "Concurrent 2",
             repositioned_after_id: task1.id,
             position_finalized: false
           }
         },
         as: :json

    assert_response :created
    json2 = JSON.parse(response.body)
    task_id2 = json2["task"]["id"]

    # Verify different positions
    concurrent1 = Task.find(task_id1)
    concurrent2 = Task.find(task_id2)

    assert concurrent1.position > task1.position
    assert concurrent2.position > task1.position
    assert_not_equal concurrent1.position, concurrent2.position
  end

  test "serializer includes positioning fields" do
    task = @job.tasks.create!(
      title: "Test Task",
      repositioned_after_id: nil,
      repositioned_to_top: false,
      position_finalized: true
    )

    get api_v1_job_task_path(@job, task), as: :json

    assert_response :success
    json = JSON.parse(response.body)

    # Check that positioning fields are included
    attributes = json["data"]["attributes"]
    assert attributes.key?("position_finalized")
    assert attributes.key?("repositioned_to_top")
    assert attributes.key?("repositioned_after_id")
  end

  private

  def login_as(user)
    # Login via the actual API to get proper cookies
    post "/api/v1/auth/login", params: {
      auth: {
        email: user.email,
        password: "password123"
      }
    }, as: :json

    assert_response :success

    # Capture CSRF token from response
    @csrf_token = response.headers["X-CSRF-Token"]
    @headers = { "X-CSRF-Token" => @csrf_token }
  end

  def api_v1_job_tasks_path(job)
    "/api/v1/jobs/#{job.id}/tasks"
  end

  def api_v1_job_task_path(job, task)
    "/api/v1/jobs/#{job.id}/tasks/#{task.id}"
  end

  def post(path, **options)
    if @headers
      super(path, headers: @headers.merge("Content-Type" => "application/json"), **options)
    else
      super(path, **options)
    end
  end

  def patch(path, **options)
    if @headers
      super(path, headers: @headers.merge("Content-Type" => "application/json"), **options)
    else
      super(path, **options)
    end
  end

  def get(path, **options)
    if @headers
      super(path, headers: @headers, **options)
    else
      super(path, **options)
    end
  end
end
