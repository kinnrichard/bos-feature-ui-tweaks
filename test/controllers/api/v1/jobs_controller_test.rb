require "test_helper"

class Api::V1::JobsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:technician)
    @job = jobs(:open_job)
    @job.technicians << @user

    # Create additional jobs for pagination tests
    15.times do |i|
      job = Job.create!(
        client: clients(:acme),
        title: "Test Job #{i}",
        status: i.even? ? "open" : "in_progress",
        priority: i % 3
      )
      job.technicians << @user
    end

    login_as(@user)
  end

  test "should get index with authentication" do
    get api_v1_jobs_path

    assert_response :success
    assert_json_response

    json = JSON.parse(response.body)
    assert json["data"].is_a?(Array)
    assert json["meta"].present?
    assert json["links"].present?
  end

  test "should require authentication" do
    logout

    get api_v1_jobs_path

    assert_response :unauthorized
  end

  test "should paginate results" do
    get api_v1_jobs_path, params: { page: 1, per_page: 5 }

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal 5, json["data"].length
    assert_equal 1, json["meta"]["current_page"]
    assert_equal 5, json["meta"]["per_page"]
    assert json["meta"]["total_pages"] > 1
    assert json["links"]["next"].present?
    assert json["links"]["first"].present?
    assert json["links"]["last"].present?
  end

  test "should get second page" do
    get api_v1_jobs_path, params: { page: 2, per_page: 5 }

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal 2, json["meta"]["current_page"]
    assert json["links"]["prev"].present?
  end

  test "should limit per_page to maximum" do
    get api_v1_jobs_path, params: { per_page: 200 }

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal 100, json["meta"]["per_page"]
  end

  test "should filter by status" do
    get api_v1_jobs_path, params: { status: "open" }

    assert_response :success

    json = JSON.parse(response.body)
    json["data"].each do |job|
      assert_equal "open", job["attributes"]["status"]
    end
  end

  test "should filter by priority" do
    get api_v1_jobs_path, params: { priority: "high" }

    assert_response :success

    json = JSON.parse(response.body)
    json["data"].each do |job|
      assert_equal "high", job["attributes"]["priority"]
    end
  end

  test "should search by title" do
    get "/api/v1/jobs", params: { q: "Test Job" }

    assert_response :success

    json = JSON.parse(response.body)
    assert json["data"].all? { |job| job["attributes"]["title"].include?("Test Job") }
  end

  test "should include relationships when requested" do
    get "/api/v1/jobs", params: { include: "client,tasks,technicians" }

    assert_response :success

    json = JSON.parse(response.body)
    assert json["included"].present?

    included_types = json["included"].map { |item| item["type"] }.uniq
    assert included_types.include?("clients")
    assert included_types.include?("tasks")
    assert included_types.include?("users")
  end

  test "should show job" do
    get api_v1_job_path(@job)

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal "jobs", json["data"]["type"]
    assert_equal @job.uuid, json["data"]["id"]
    assert_equal @job.title, json["data"]["attributes"]["title"]
  end

  test "should create job" do
    assert_difference("Job.count") do
      post api_v1_jobs_path, params: {
        job: {
          title: "New API Job",
          description: "Created via API",
          client_id: clients(:acme).id,
          status: "open",
          priority: "normal"
        }
      }.to_json
    end

    assert_response :created

    json = JSON.parse(response.body)
    assert_equal "New API Job", json["data"]["attributes"]["title"]
    assert_equal "open", json["data"]["attributes"]["status"]
  end

  test "should update job" do
    patch api_v1_job_path(@job), params: {
      job: {
        title: "Updated Title",
        status: "in_progress"
      }
    }.to_json

    assert_response :success

    json = JSON.parse(response.body)
    assert_equal "Updated Title", json["data"]["attributes"]["title"]
    assert_equal "in_progress", json["data"]["attributes"]["status"]

    @job.reload
    assert_equal "Updated Title", @job.title
    assert_equal "in_progress", @job.status
  end

  test "should destroy job if authorized" do
    # Use owner who can delete
    owner = users(:owner)
    login_as(owner)
    job = Job.create!(
      client: clients(:acme),
      title: "To Delete",
      status: "open",
      priority: "normal"
    )
    # Add owner as technician so they can access the job
    job.technicians << owner

    assert_difference("Job.count", -1) do
      delete api_v1_job_path(job)
    end

    assert_response :no_content
  end

  test "should not destroy job if unauthorized" do
    assert_no_difference("Job.count") do
      delete api_v1_job_path(@job)
    end

    assert_response :forbidden
  end

  private

  def login_as(user)
    token = JwtService.encode(user_id: user.id)
    @headers = { "Authorization" => "Bearer #{token}" }
  end

  def logout
    @headers = {}
  end

  def api_v1_jobs_path(params = {})
    "/api/v1/jobs#{params.any? ? '?' + params.to_query : ''}"
  end

  def api_v1_job_path(job)
    "/api/v1/jobs/#{job.id}"
  end

  def get(path, **options)
    super(path, headers: @headers, **options)
  end

  def post(path, **options)
    super(path, headers: @headers.merge("Content-Type" => "application/json"), **options)
  end

  def patch(path, **options)
    super(path, headers: @headers.merge("Content-Type" => "application/json"), **options)
  end

  def delete(path, **options)
    super(path, headers: @headers, **options)
  end

  def assert_json_response
    assert response.content_type.start_with?("application/json")
  end
end
