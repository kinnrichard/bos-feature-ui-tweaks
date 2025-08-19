require "test_helper"

class Api::V1::Auth::SessionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:technician)
  end

  test "should login with valid credentials" do
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    assert_response :success

    json_response = JSON.parse(response.body)
    assert_equal "Successfully authenticated", json_response["data"]["attributes"]["message"]
    assert json_response["data"]["attributes"]["expires_at"].present?
    assert json_response["included"][0]["attributes"]["email"] == @user.email

    # Tokens should NOT be in JSON response
    assert_nil json_response["data"]["attributes"]["access_token"]
    assert_nil json_response["data"]["attributes"]["refresh_token"]

    # Check cookies are set
    assert cookies[:auth_token].present?
    assert cookies[:refresh_token].present?
  end

  test "should not login with invalid credentials" do
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "wrongpassword"
      }
    }, as: :json

    assert_response :unauthorized

    json_response = JSON.parse(response.body)
    assert json_response["errors"][0]["code"] == "INVALID_CREDENTIALS"
  end

  test "should refresh token with valid refresh token" do
    # First login to get tokens
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    # Get refresh token from cookie instead of JSON
    refresh_token = cookies[:refresh_token]
    csrf_token = response.headers["X-CSRF-Token"]

    # Now refresh using cookie
    post api_v1_auth_refresh_url,
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    assert_response :success

    json_response = JSON.parse(response.body)
    assert_equal "Token refreshed successfully", json_response["data"]["attributes"]["message"]
    assert json_response["data"]["attributes"]["expires_at"].present?

    # Tokens should NOT be in JSON response
    assert_nil json_response["data"]["attributes"]["access_token"]
    assert_nil json_response["data"]["attributes"]["refresh_token"]
  end

  test "should logout successfully" do
    # First login
    post api_v1_auth_login_url, params: {
      auth: {
        email: @user.email,
        password: "password123"
      }
    }, as: :json

    csrf_token = response.headers["X-CSRF-Token"]

    # Now logout using cookie authentication
    post api_v1_auth_logout_url,
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    assert_response :success

    # Check cookies are cleared
    assert cookies[:auth_token].blank?
    assert cookies[:refresh_token].blank?
  end

  test "should require authentication for logout" do
    post api_v1_auth_logout_url, as: :json

    assert_response :unauthorized
  end
end
