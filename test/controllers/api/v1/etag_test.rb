require "test_helper"

class Api::V1::EtagTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:technician)
    @job = jobs(:open_job)
    @admin = users(:admin)
  end

  test "returns ETag header for job show" do
    login_as(@user)

    authenticated_get api_v1_job_url(@job), as: :json
    assert_response :success

    # Should have ETag header
    etag = response.headers["ETag"]
    assert etag.present?, "Response should include ETag header"

    # Should have Last-Modified header
    last_modified = response.headers["Last-Modified"]
    assert last_modified.present?, "Response should include Last-Modified header"
  end

  test "returns 304 Not Modified when ETag matches" do
    login_as(@user)

    # First request to get ETag
    authenticated_get api_v1_job_url(@job), as: :json
    assert_response :success

    etag = response.headers["ETag"]
    last_modified = response.headers["Last-Modified"]

    # Second request with If-None-Match header
    authenticated_get api_v1_job_url(@job),
        headers: {
          "If-None-Match" => etag,
          "If-Modified-Since" => last_modified
        },
        as: :json

    assert_response :not_modified
    assert response.body.blank?, "304 response should have no body"
  end

  test "returns new data when ETag doesn't match after update" do
    login_as(@user)

    # First request to get ETag
    authenticated_get api_v1_job_url(@job), as: :json
    assert_response :success

    etag = response.headers["ETag"]

    # Update the job
    @job.touch

    # Request with old ETag
    authenticated_get api_v1_job_url(@job),
        headers: { "If-None-Match" => etag },
        as: :json

    assert_response :success
    assert response.body.present?, "Should return full response when data changed"

    # Should have new ETag
    new_etag = response.headers["ETag"]
    assert new_etag.present?
    assert_not_equal etag, new_etag, "ETag should change after update"
  end

  test "ETags include user context" do
    # Use a job that both users can access
    shared_job = jobs(:urgent_job)

    login_as(@admin)

    # Get ETag as admin user
    authenticated_get api_v1_job_url(shared_job), as: :json
    admin_etag = response.headers["ETag"]

    # Login as different user (owner also has access to urgent_job)
    owner = users(:owner)
    login_as(owner)

    # Get ETag as owner user
    authenticated_get api_v1_job_url(shared_job), as: :json
    owner_etag = response.headers["ETag"]

    assert_not_equal admin_etag, owner_etag,
      "ETags should differ for different users"
  end

  test "collection ETags work for job index" do
    login_as(@user)

    # First request
    get api_v1_jobs_url, headers: { "X-CSRF-Token" => @csrf_token }, as: :json
    assert_response :success

    etag = response.headers["ETag"]
    assert etag.present?, "Collection should have ETag"

    # Second request with ETag
    get api_v1_jobs_url,
        headers: {
          "X-CSRF-Token" => @csrf_token,
          "If-None-Match" => etag
        },
        as: :json

    assert_response :not_modified
  end

  test "collection ETags include filter params" do
    login_as(@user)

    # Request with status filter
    get api_v1_jobs_url(status: "open"),
        headers: { "X-CSRF-Token" => @csrf_token },
        as: :json
    assert_response :success
    open_etag = response.headers["ETag"]
    assert open_etag.present?, "Response should have ETag for filtered collection"

    # Request with different status filter
    get api_v1_jobs_url(status: "in_progress"),
        headers: { "X-CSRF-Token" => @csrf_token },
        as: :json
    assert_response :success
    in_progress_etag = response.headers["ETag"]
    assert in_progress_etag.present?, "Response should have ETag for different filter"

    assert_not_equal open_etag, in_progress_etag,
      "ETags should differ for different filter parameters"
  end

  private

  def login_as(user)
    post api_v1_auth_login_url, params: {
      auth: {
        email: user.email,
        password: "password123"
      }
    }, as: :json

    # Store CSRF token for subsequent requests
    @csrf_token = response.headers["X-CSRF-Token"]
  end

  def authenticated_get(url, **options)
    headers = options[:headers] || {}
    headers["X-CSRF-Token"] = @csrf_token if @csrf_token
    options[:headers] = headers
    get url, **options
  end
end
