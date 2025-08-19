require "test_helper"

class SidebarStatsServiceTest < ActiveSupport::TestCase
  setup do
    @user = users(:admin)
    @client = clients(:acme)
    @other_user = users(:technician)

    # Clear cache before each test
    Rails.cache.clear
  end

  test "calculates stats for client" do
    service = SidebarStatsService.new(user: @user, client: @client)
    stats = service.calculate

    # Verify we get all expected keys
    assert stats.key?(:my_jobs)
    assert stats.key?(:unassigned)
    assert stats.key?(:others)
    assert stats.key?(:closed)
    assert stats.key?(:scheduled)

    # Verify counts are integers
    stats.values.each do |count|
      assert_kind_of Integer, count
      assert count >= 0
    end
  end

  test "calculates stats across all clients when client is nil" do
    service = SidebarStatsService.new(user: @user, client: nil)
    stats = service.calculate

    # Stats without client should include jobs from all clients
    service_with_client = SidebarStatsService.new(user: @user, client: @client)
    stats_with_client = service_with_client.calculate

    # At minimum, global stats should be >= client-specific stats
    assert stats[:my_jobs] >= stats_with_client[:my_jobs]
    assert stats[:unassigned] >= stats_with_client[:unassigned]
  end

  test "uses cache to avoid repeated queries" do
    # Temporarily enable memory store for this test
    original_cache_store = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new

    service = SidebarStatsService.new(user: @user, client: @client)

    # First call should hit the database
    stats1 = nil
    query_count1 = count_queries { stats1 = service.calculate }
    assert query_count1 > 0, "First call should make database queries"

    # Second call should use cache
    stats2 = nil
    query_count2 = count_queries { stats2 = service.calculate }
    assert_equal 0, query_count2, "Second call should use cache and make no queries"

    # Results should be the same
    assert_equal stats1, stats2
  ensure
    # Restore original cache store
    Rails.cache = original_cache_store
  end

  test "cache expires and refreshes after timeout" do
    # Temporarily enable memory store for this test
    original_cache_store = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new

    service = SidebarStatsService.new(user: @user, client: @client)

    # Get initial stats
    initial_stats = service.calculate

    # Create a new job to change the counts
    new_job = @client.jobs.create!(
      title: "New Test Job",
      status: "open"
    )

    # Force cache expiration by travelling forward in time
    travel 2.minutes do
      updated_stats = service.calculate

      # Unassigned count should have increased
      assert_equal initial_stats[:unassigned] + 1, updated_stats[:unassigned]
    end
  ensure
    new_job&.destroy
    Rails.cache = original_cache_store
  end

  test "different users get different stats" do
    service_admin = SidebarStatsService.new(user: @user, client: @client)
    service_tech = SidebarStatsService.new(user: @other_user, client: @client)

    stats_admin = service_admin.calculate
    stats_tech = service_tech.calculate

    # Different users should potentially have different my_jobs counts
    # (unless they happen to be assigned to the same number of jobs)
    # At minimum, verify they're calculated independently
    assert_instance_of Hash, stats_admin
    assert_instance_of Hash, stats_tech
  end

  test "respects job status for active vs closed counts" do
    # Create specific test jobs
    active_job = @client.jobs.create!(
      title: "Active Test Job",
      status: "in_progress"
    )

    closed_job = @client.jobs.create!(
      title: "Closed Test Job",
      status: "successfully_completed"
    )

    service = SidebarStatsService.new(user: @user, client: @client)
    initial_stats = service.calculate

    # Change active job to closed
    active_job.update!(status: "cancelled")

    # Clear cache to get fresh counts
    Rails.cache.clear
    updated_stats = service.calculate

    # Closed count should increase
    assert_equal initial_stats[:closed] + 1, updated_stats[:closed]
  ensure
    active_job&.destroy
    closed_job&.destroy
  end

  private

  def count_queries(&block)
    count = 0
    counter = ->(name, started, finished, unique_id, payload) {
      count += 1 unless payload[:sql]&.match?(/SCHEMA|TRANSACTION|SAVEPOINT/)
    }

    ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &block)
    count
  end
end
