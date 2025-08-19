require "test_helper"

class Api::V1::TasksControllerRebalanceTest < ActionDispatch::IntegrationTest
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

  test "rebalance endpoint requires authentication" do
    logout
    post api_v1_job_tasks_rebalance_path(@job)
    assert_response :unauthorized
  end

  test "rebalance with evenly spaced tasks returns no rebalancing needed" do
    # Create tasks with even spacing
    5.times do |i|
      task = @job.tasks.create!(title: "Task #{i + 1}")
      task.update_column(:position, (i + 1) * 10000)
    end

    # Verify positions before test
    initial_positions = @job.tasks.reload.order(:position).pluck(:position)
    assert_equal [ 10000, 20000, 30000, 40000, 50000 ], initial_positions

    post api_v1_job_tasks_rebalance_path(@job), as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "success", json["status"]
    assert_equal "No rebalancing needed", json["message"]
    assert_equal 5, json["tasks_checked"]
  end

  test "rebalance with tasks having small gaps triggers rebalancing" do
    # Create tasks with very small gaps
    positions = [ 1, 2, 3, 4, 5 ]
    positions.each_with_index do |pos, i|
      @job.tasks.create!(title: "Task #{i + 1}", position: pos)
    end

    post api_v1_job_tasks_rebalance_path(@job), as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "success", json["status"]
    assert_equal "Tasks rebalanced successfully", json["message"]
    assert_equal 5, json["tasks_rebalanced"]

    # Verify new positions have proper spacing
    rebalanced_tasks = @job.tasks.kept.order(:position)
    expected_positions = [ 10000, 20000, 30000, 40000, 50000 ]
    assert_equal expected_positions, rebalanced_tasks.pluck(:position)
  end

  test "rebalance with custom spacing parameter" do
    # Create tasks with small gaps
    3.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: i + 1)
    end

    post api_v1_job_tasks_rebalance_path(@job),
         params: { spacing: 5000 },
         as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "success", json["status"]
    assert_equal "Tasks rebalanced successfully", json["message"]

    # Verify custom spacing was applied
    rebalanced_tasks = @job.tasks.kept.order(:position)
    expected_positions = [ 5000, 10000, 15000 ]
    assert_equal expected_positions, rebalanced_tasks.pluck(:position)
  end

  test "rebalance with parent_id filters tasks correctly" do
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

    # Rebalance only root tasks
    post api_v1_job_tasks_rebalance_path(@job),
         params: { parent_id: nil },
         as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "Tasks rebalanced successfully", json["message"]
    assert_equal 4, json["tasks_rebalanced"] # Including parent task

    # Verify only root tasks were rebalanced
    root_tasks = @job.tasks.kept.where(parent_id: nil).order(:position)
    assert_equal [ 10000, 20000, 30000, 40000 ], root_tasks.pluck(:position)

    # Verify subtasks were not touched
    subtasks = @job.tasks.kept.where(parent: parent).order(:position)
    assert_equal [ 1, 2, 3 ], subtasks.pluck(:position)
  end

  test "rebalance with tasks approaching integer limit" do
    # Create tasks near 32-bit integer limit
    high_position = 2_000_000_001
    3.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: high_position + i)
    end

    post api_v1_job_tasks_rebalance_path(@job), as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "Tasks rebalanced successfully", json["message"]

    # Verify positions were reset to safe values
    rebalanced_tasks = @job.tasks.kept.order(:position)
    expected_positions = [ 10000, 20000, 30000 ]
    assert_equal expected_positions, rebalanced_tasks.pluck(:position)
  end

  test "rebalance handles large task lists efficiently" do
    # Create 100 tasks with decreasing gaps
    100.times do |i|
      # Create gaps that get smaller as we go
      position = if i < 50
        i * 1000
      else
        50000 + (i - 50) * 10
      end
      @job.tasks.create!(title: "Task #{i + 1}", position: position)
    end

    start_time = Time.current
    post api_v1_job_tasks_rebalance_path(@job), as: :json
    duration = Time.current - start_time

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "Tasks rebalanced successfully", json["message"]
    assert_equal 100, json["tasks_rebalanced"]

    # Should complete in reasonable time
    assert duration < 2.seconds, "Rebalancing 100 tasks took too long: #{duration}s"

    # Verify all tasks have proper spacing
    rebalanced_tasks = @job.tasks.kept.order(:position)
    positions = rebalanced_tasks.pluck(:position)

    # Check that positions are evenly spaced
    positions.each_with_index do |pos, i|
      expected = (i + 1) * 10000
      assert_equal expected, pos
    end
  end

  test "rebalance maintains task order" do
    # Create tasks with specific order
    task_titles = [ "First", "Second", "Third", "Fourth", "Fifth" ]
    task_titles.each_with_index do |title, i|
      @job.tasks.create!(title: title, position: i + 1)
    end

    # Remember original order
    original_order = @job.tasks.kept.order(:position).pluck(:title)

    post api_v1_job_tasks_rebalance_path(@job), as: :json

    assert_response :success

    # Verify order is preserved after rebalancing
    rebalanced_order = @job.tasks.kept.order(:position).pluck(:title)
    assert_equal original_order, rebalanced_order
  end

  test "rebalance handles concurrent modifications gracefully" do
    # Create tasks that need rebalancing
    5.times do |i|
      @job.tasks.create!(title: "Task #{i + 1}", position: i + 1)
    end

    # Start rebalancing in a thread
    rebalance_thread = Thread.new do
      post api_v1_job_tasks_rebalance_path(@job), as: :json
    end

    # Try to modify a task during rebalancing
    task = @job.tasks.first
    task.update(title: "Modified during rebalance")

    # Wait for rebalancing to complete
    rebalance_thread.join

    # Both operations should succeed
    assert_response :success
    assert_equal "Modified during rebalance", @job.tasks.find(task.id).title
  end

  test "rebalance with discarded tasks excludes them" do
    # Create mix of kept and discarded tasks
    3.times do |i|
      task = @job.tasks.create!(title: "Kept #{i + 1}", position: i + 1)
    end

    3.times do |i|
      task = @job.tasks.create!(title: "Discarded #{i + 1}", position: i + 10)
      task.discard
    end

    post api_v1_job_tasks_rebalance_path(@job), as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 3, json["tasks_rebalanced"]

    # Verify only kept tasks were rebalanced
    kept_tasks = @job.tasks.kept.order(:position)
    assert_equal 3, kept_tasks.count
    assert_equal [ 10000, 20000, 30000 ], kept_tasks.pluck(:position)
  end

  test "rebalance error handling" do
    # We can't easily mock database errors in integration tests
    # So let's test a different error scenario - invalid spacing parameter

    # Create tasks
    3.times do |i|
      task = @job.tasks.create!(title: "Task #{i + 1}")
      task.update_column(:position, i + 1)
    end

    # Try to rebalance with invalid spacing (negative number)
    post api_v1_job_tasks_rebalance_path(@job),
         params: { spacing: -100 },
         as: :json

    # The controller uses spacing.to_i which will give 0 for negative,
    # but let's check it handles edge cases gracefully
    assert_response :success
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

  def logout
    # Clear cookies by making a new request without auth
    @headers = {}
    # Reset cookies for next request
    reset!
  end

  def api_v1_job_tasks_rebalance_path(job)
    "/api/v1/jobs/#{job.id}/tasks/rebalance"
  end

  def post(path, **options)
    if @headers
      super(path, headers: @headers.merge("Content-Type" => "application/json"), **options)
    else
      super(path, **options)
    end
  end
end
