require "test_helper"

class Api::V1::ErrorHandlingTest < ActionDispatch::IntegrationTest
  # Create a test controller to test error handling
  class TestController < Api::V1::BaseController
    skip_before_action :authenticate_request

    def record_not_found
      raise ActiveRecord::RecordNotFound, "User not found"
    end

    def record_invalid
      user = User.new
      user.errors.add(:email, "can't be blank")
      user.errors.add(:name, "is too short")
      raise ActiveRecord::RecordInvalid, user
    end

    def parameter_missing
      raise ActionController::ParameterMissing, "user"
    end

    def authentication_error
      raise AuthenticationError, "Invalid credentials"
    end

    def authorization_error
      raise AuthorizationError, "You cannot access this resource"
    end

    def validation_error
      raise ValidationError.new("Custom validation failed", errors: { field: [ "is invalid" ] })
    end

    def business_logic_error
      raise BusinessLogicError.new("Cannot process order", code: "ORDER_INVALID")
    end

    def standard_error
      raise StandardError, "Something went wrong"
    end
  end

  setup do
    # Temporarily add routes for testing
    Rails.application.routes.draw do
      namespace :api do
        namespace :v1 do
          get "test/record_not_found", to: "error_handling_test/test#record_not_found"
          get "test/record_invalid", to: "error_handling_test/test#record_invalid"
          get "test/parameter_missing", to: "error_handling_test/test#parameter_missing"
          get "test/authentication_error", to: "error_handling_test/test#authentication_error"
          get "test/authorization_error", to: "error_handling_test/test#authorization_error"
          get "test/validation_error", to: "error_handling_test/test#validation_error"
          get "test/business_logic_error", to: "error_handling_test/test#business_logic_error"
          get "test/standard_error", to: "error_handling_test/test#standard_error"
        end
      end
    end
  end

  teardown do
    Rails.application.reload_routes!
  end

  test "handles record not found" do
    get api_v1_test_record_not_found_path

    assert_response :not_found
    assert response.content_type.start_with?("application/json")

    json = JSON.parse(response.body)
    assert_equal 1, json["errors"].size

    error = json["errors"].first
    assert_equal "404", error["status"]
    assert_equal "NOT_FOUND", error["code"]
    assert_equal "Resource Not Found", error["title"]
    assert_equal "User not found", error["detail"]
  end

  test "handles record invalid with validation errors" do
    get api_v1_test_record_invalid_path

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert_equal 2, json["errors"].size

    errors = json["errors"]
    assert errors.all? { |e| e["status"] == "422" }
    assert errors.all? { |e| e["code"] == "VALIDATION_FAILED" }
    assert errors.all? { |e| e["title"] == "Validation Error" }
    assert errors.any? { |e| e["detail"].include?("Email") }
    assert errors.any? { |e| e["detail"].include?("Name") }
  end

  test "handles parameter missing" do
    get api_v1_test_parameter_missing_path

    assert_response :bad_request

    json = JSON.parse(response.body)
    error = json["errors"].first
    assert_equal "400", error["status"]
    assert_equal "BAD_REQUEST", error["code"]
    assert_equal "Bad Request", error["title"]
    assert error["detail"].include?("user")
  end

  test "handles authentication error" do
    get api_v1_test_authentication_error_path

    assert_response :unauthorized

    json = JSON.parse(response.body)
    error = json["errors"].first
    assert_equal "401", error["status"]
    assert_equal "UNAUTHORIZED", error["code"]
    assert_equal "Authentication Required", error["title"]
    assert_equal "Invalid credentials", error["detail"]
  end

  test "handles authorization error" do
    get api_v1_test_authorization_error_path

    assert_response :forbidden

    json = JSON.parse(response.body)
    error = json["errors"].first
    assert_equal "403", error["status"]
    assert_equal "FORBIDDEN", error["code"]
    assert_equal "Access Denied", error["title"]
    assert_equal "You cannot access this resource", error["detail"]
  end

  test "handles validation error with custom errors" do
    get api_v1_test_validation_error_path

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)
    assert json["errors"].present?, "Expected errors to be present, got: #{json.inspect}"
    error = json["errors"].first
    assert error.present?, "Expected error to be present, full error: #{error.inspect}"

    # The status might be a string "422"
    assert_equal "422", error["status"]
    assert_equal "VALIDATION_ERROR", error["code"]
    assert_equal "Validation Failed", error["title"]
    assert_equal "Custom validation failed", error["detail"]
    assert error["meta"].present?
  end

  test "handles business logic error" do
    get api_v1_test_business_logic_error_path

    assert_response :conflict

    json = JSON.parse(response.body)
    error = json["errors"].first
    assert_equal "409", error["status"]
    assert_equal "ORDER_INVALID", error["code"]
    assert_equal "Business Logic Error", error["title"]
    assert_equal "Cannot process order", error["detail"]
  end

  test "handles standard error differently in development vs production" do
    # In test environment, should show error details
    get api_v1_test_standard_error_path

    assert_response :internal_server_error

    json = JSON.parse(response.body)
    error = json["errors"].first
    assert_equal "500", error["status"]
    assert_equal "INTERNAL_ERROR", error["code"]

    # In non-production, should show error class and message
    assert_equal "StandardError", error["title"]
    assert_equal "Something went wrong", error["detail"]
    assert error["meta"]["backtrace"].present?
  end

  test "includes request ID in response headers" do
    get api_v1_test_record_not_found_path

    assert response.headers["X-Request-ID"].present?
  end
end
