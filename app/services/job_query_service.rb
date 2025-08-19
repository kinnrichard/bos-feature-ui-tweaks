# frozen_string_literal: true

# Service object for handling job queries and filtering
class JobQueryService
  def initialize(client:, params: {})
    @client = client
    @params = params
  end

  def call
    jobs = base_query
    jobs = apply_search_filter(jobs)
    jobs = apply_status_filter(jobs)
    apply_sorting(jobs)
  end

  def paginated_results
    jobs = call
    page = (@params[:page] || 1).to_i
    per_page = calculate_per_page

    # Use database-level pagination with proper count
    paginated_jobs = jobs.limit(per_page).offset((page - 1) * per_page)
    total_count = jobs.count

    {
      jobs: paginated_jobs,
      pagination: {
        current_page: page,
        per_page: per_page,
        total_pages: (total_count.to_f / per_page).ceil,
        total_count: total_count
      }
    }
  end

  private

  def base_query
    @client.jobs.includes(:technicians, :tasks)
  end

  def apply_search_filter(jobs)
    return jobs unless @params[:q].present?

    search_term = @params[:q].strip
    jobs.where("jobs.title ILIKE ?", "%#{search_term}%")
  end

  def apply_status_filter(jobs)
    return jobs unless @params[:status].present?

    # Convert hyphenated format to underscored format if needed
    status = @params[:status].tr("-", "_")
    return jobs unless Job.statuses.key?(status)

    jobs.where(status: status)
  end

  def apply_sorting(jobs)
    # Use database-level sorting with proper SQL CASE statement
    jobs.order(
      Arel.sql("CASE
        WHEN status = '#{Job.statuses['in_progress']}' THEN 1
        WHEN status = '#{Job.statuses['paused']}' THEN 2
        WHEN status = '#{Job.statuses['open']}' THEN 3
        WHEN status = '#{Job.statuses['successfully_completed']}' THEN 4
        WHEN status = '#{Job.statuses['cancelled']}' THEN 5
        ELSE 6
      END"),
      :created_at
    )
  end

  def calculate_per_page
    per_page = (@params[:per_page] || 25).to_i
    per_page > 50 ? 50 : per_page # Max 50 per page
  end
end
