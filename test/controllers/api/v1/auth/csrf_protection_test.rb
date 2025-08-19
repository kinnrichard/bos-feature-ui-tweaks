require "test_helper"

class Api::V1::Auth::CsrfProtectionTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:technician)
  end

  test "should skip CSRF check for Bearer token authentication" do
    # Generate a valid JWT token
    token = JwtService.encode({ user_id: @user.id, type: "access" }, 15.minutes.from_now)

    # Make request with Bearer token (no CSRF token needed)
    post api_v1_auth_logout_url,
      headers: { "Authorization" => "Bearer #{token}" },
      as: :json

    assert_response :success
  end

  test "should require CSRF token for cookie-based authentication on POST" do
    # Login to get cookies
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    # Try to make a POST request without CSRF token
    post api_v1_auth_logout_url, as: :json

    assert_response :forbidden
    json_response = JSON.parse(response.body)
    assert_equal "INVALID_CSRF_TOKEN", json_response["errors"][0]["code"]
  end

  test "should accept valid CSRF token for cookie-based authentication" do
    # Login to get cookies and CSRF token
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    csrf_token = response.headers["X-CSRF-Token"]
    assert csrf_token.present?

    # Make request with CSRF token
    post api_v1_auth_logout_url,
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    assert_response :success
  end

  test "should not require CSRF token for GET requests" do
    # Login to get cookies
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    # GET request should work without CSRF token
    get api_v1_jobs_url, as: :json

    assert_response :success
  end

  test "login endpoint should provide CSRF token in response header" do
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    assert_response :success
    assert response.headers["X-CSRF-Token"].present?
  end
end
