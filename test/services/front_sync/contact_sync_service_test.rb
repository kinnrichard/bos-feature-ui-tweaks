require "test_helper"

class FrontSync::ContactSyncServiceTest < ActiveSupport::TestCase
  def setup
    # Skip if no Front API token is configured
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    @service = FrontSync::ContactSyncService.new
  end

  test "inherits from FrontSyncService" do
    assert_equal FrontSyncService, FrontSync::ContactSyncService.superclass
  end

  test "has sync_all method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_all
  end

  test "initializes with empty stats" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_equal 0, @service.stats[:created]
    assert_equal 0, @service.stats[:updated]
    assert_equal 0, @service.stats[:failed]
    assert_equal [], @service.stats[:errors]
  end

  test "transform_contact_attributes handles basic contact data" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    contact_data = {
      "id" => "crd_123",
      "name" => "John Doe",
      "handle" => "john@example.com",
      "handles" => [
        { "source" => "email", "handle" => "john@example.com" },
        { "source" => "phone", "handle" => "555-1234" }
      ],
      "_links" => { "self" => "https://api.frontapp.com/contacts/crd_123" }
    }

    result = @service.send(:transform_contact_attributes, contact_data)

    assert_equal "crd_123", result[:front_id]
    assert_equal "John Doe", result[:name]
    assert_equal "john@example.com", result[:handle]
    assert_equal 2, result[:handles].size
    assert result[:api_links].present?
  end

  test "transform_contact_attributes handles missing front_id" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    contact_data = {
      "name" => "Jane Doe",
      "handle" => "jane@example.com",
      "handles" => []
    }

    result = @service.send(:transform_contact_attributes, contact_data)

    assert_nil result[:front_id]
    assert_equal "Jane Doe", result[:name]
    assert_equal "jane@example.com", result[:handle]
    assert_equal [], result[:handles]
  end
end
