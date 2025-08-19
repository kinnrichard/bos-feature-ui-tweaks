require "test_helper"

class Api::V1::DocumentationControllerTest < ActionDispatch::IntegrationTest
  test "should get documentation without authentication" do
    get api_v1_documentation_path

    assert_response :success
    assert_equal "application/json", response.content_type.split(";").first

    json = JSON.parse(response.body)

    # Check OpenAPI structure
    assert_equal "3.0.0", json["openapi"]
    assert json["info"].present?
    assert_equal "BOS API", json["info"]["title"]
    assert_equal "1.0.0", json["info"]["version"]

    # Check servers
    assert json["servers"].is_a?(Array)
    assert json["servers"].first["url"].present?

    # Check components
    assert json["components"].present?
    assert json["components"]["securitySchemes"].present?
    assert json["components"]["schemas"].present?

    # Check paths
    assert json["paths"].present?
    assert json["paths"]["/health"].present?
    assert json["paths"]["/auth/login"].present?
    assert json["paths"]["/auth/refresh"].present?
    assert json["paths"]["/auth/logout"].present?
    assert json["paths"]["/websocket/connection_info"].present?
  end

  test "documentation includes proper security schemes" do
    get api_v1_documentation_path

    json = JSON.parse(response.body)
    security_schemes = json["components"]["securitySchemes"]

    # Check bearer auth
    assert security_schemes["bearerAuth"].present?
    assert_equal "http", security_schemes["bearerAuth"]["type"]
    assert_equal "bearer", security_schemes["bearerAuth"]["scheme"]
    assert_equal "JWT", security_schemes["bearerAuth"]["bearerFormat"]

    # Check cookie auth
    assert security_schemes["cookieAuth"].present?
    assert_equal "apiKey", security_schemes["cookieAuth"]["type"]
    assert_equal "cookie", security_schemes["cookieAuth"]["in"]
    assert_equal "auth_token", security_schemes["cookieAuth"]["name"]
  end

  test "documentation includes error schema" do
    get api_v1_documentation_path

    json = JSON.parse(response.body)
    error_schema = json["components"]["schemas"]["Error"]

    assert error_schema.present?
    assert_equal "object", error_schema["type"]
    assert error_schema["properties"]["errors"].present?
    assert_equal "array", error_schema["properties"]["errors"]["type"]
  end

  test "documentation includes proper login endpoint definition" do
    get api_v1_documentation_path

    json = JSON.parse(response.body)
    login_endpoint = json["paths"]["/auth/login"]["post"]

    assert login_endpoint.present?
    assert_equal [ "Authentication" ], login_endpoint["tags"]
    assert_equal "User login", login_endpoint["summary"]

    # Check request body
    assert login_endpoint["requestBody"]["required"]
    assert login_endpoint["requestBody"]["content"]["application/json"]["schema"]["$ref"].present?

    # Check responses
    assert login_endpoint["responses"]["200"].present?
    assert login_endpoint["responses"]["401"].present?

    # Check security is empty for login
    assert_equal [], login_endpoint["security"] || []
  end

  test "public api-docs.html file exists" do
    assert File.exist?(Rails.root.join("public", "api-docs.html"))
  end
end
