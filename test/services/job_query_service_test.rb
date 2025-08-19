require "test_helper"

class JobQueryServiceTest < ActiveSupport::TestCase
  setup do
    @client = clients(:acme)
    @user = users(:admin)
    sign_in_as @user
  end

  test "call returns ActiveRecord relation" do
    service = JobQueryService.new(client: @client)
    result = service.call

    assert result.is_a?(ActiveRecord::Relation)
    assert result.respond_to?(:limit)
    assert result.respond_to?(:offset)
  end

  test "paginated_results uses database-level pagination" do
    service = JobQueryService.new(client: @client, params: { page: 1, per_page: 2 })
    result = service.paginated_results

    assert result.key?(:jobs)
    assert result.key?(:pagination)
    assert result[:jobs].is_a?(ActiveRecord::Relation)
    assert_equal 2, result[:pagination][:per_page]
    assert_equal 1, result[:pagination][:current_page]
  end

  test "applies search filter" do
    service = JobQueryService.new(client: @client, params: { q: "Empty" })
    result = service.call

    # Should include jobs with "Empty" in title
    assert result.any?
    assert result.all? { |job| job.title.include?("Empty") }
  end

  test "applies status filter" do
    service = JobQueryService.new(client: @client, params: { status: "open" })
    result = service.call

    # Should only include open jobs
    assert result.all? { |job| job.open? }
  end

  test "applies sorting with database-level ordering" do
    service = JobQueryService.new(client: @client)
    result = service.call

    # Should return ordered relation
    assert result.is_a?(ActiveRecord::Relation)

    # Check that order clause is applied
    order_values = result.order_values
    assert order_values.any?, "Should have order values applied"
  end

  test "respects per_page limits" do
    service = JobQueryService.new(client: @client, params: { per_page: 100 })
    result = service.paginated_results

    # Should cap at 50
    assert_equal 50, result[:pagination][:per_page]
  end

  test "handles empty results" do
    service = JobQueryService.new(client: @client, params: { q: "NonexistentJob" })
    result = service.paginated_results

    assert_equal [], result[:jobs].to_a
    assert_equal 0, result[:pagination][:total_count]
  end
end
