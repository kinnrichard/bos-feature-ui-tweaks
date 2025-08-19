require "test_helper"

class Api::V1::HealthControllerTest < ActionDispatch::IntegrationTest
  test "should get health status" do
    get api_v1_health_url
    assert_response :success

    json_response = JSON.parse(response.body)
    assert_equal "ok", json_response["status"]
    assert json_response["timestamp"].present?
    assert json_response["rails_version"].present?
    assert json_response["database"].present?
  end

  test "should include request id header" do
    get api_v1_health_url
    assert response.headers["X-Request-ID"].present?
  end
end
