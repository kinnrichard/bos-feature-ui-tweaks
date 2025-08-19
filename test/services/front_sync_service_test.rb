require "test_helper"

class FrontSyncServiceTest < ActiveSupport::TestCase
  def setup
    # Skip if no Front API token is configured
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    @service = FrontSyncService.new
  end

  test "has resource-specific sync methods" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    assert_respond_to @service, :sync_contacts
    assert_respond_to @service, :sync_tags
    assert_respond_to @service, :sync_inboxes
    assert_respond_to @service, :sync_conversations
    assert_respond_to @service, :sync_messages
  end

  test "has sync_all method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    assert_respond_to @service, :sync_all
  end

  test "aggregate_stats combines service statistics correctly" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    total_stats = { created: 5, updated: 3, failed: 1, errors: [ "error1" ] }
    service_stats = { created: 2, updated: 1, failed: 0, errors: [] }

    @service.send(:aggregate_stats!, total_stats, service_stats)

    assert_equal 7, total_stats[:created]
    assert_equal 4, total_stats[:updated]
    assert_equal 1, total_stats[:failed]
    assert_equal [ "error1" ], total_stats[:errors]
  end

  test "aggregate_stats handles errors correctly" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    total_stats = { created: 0, updated: 0, failed: 0, errors: [] }
    service_stats = { created: 1, updated: 0, failed: 2, errors: [ "service error 1", "service error 2" ] }

    @service.send(:aggregate_stats!, total_stats, service_stats)

    assert_equal 1, total_stats[:created]
    assert_equal 0, total_stats[:updated]
    assert_equal 2, total_stats[:failed]
    assert_equal [ "service error 1", "service error 2" ], total_stats[:errors]
  end
end
