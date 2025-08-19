# frozen_string_literal: true

class SidebarStatsService
  def initialize(user:, client: nil)
    @user = user
    @client = client
  end

  def calculate
    Rails.cache.fetch(cache_key, expires_in: 1.minute) do
      calculate_stats
    end
  end

  private

  def calculate_stats
    # For simplicity and to avoid SQL syntax issues, let's use ActiveRecord::Base.sanitize_sql_array
    successfully_completed_status = Job.statuses[:successfully_completed]
    cancelled_status = Job.statuses[:cancelled]

    if @client
      sql = ActiveRecord::Base.sanitize_sql_array([
        <<~SQL,
          SELECT#{' '}
            COUNT(CASE WHEN jobs.status NOT IN (?, ?) AND job_assignments.user_id = ? THEN 1 END) as my_jobs,
            COUNT(CASE WHEN jobs.status NOT IN (?, ?) AND job_assignments.id IS NULL THEN 1 END) as unassigned,
            COUNT(DISTINCT CASE WHEN jobs.status NOT IN (?, ?) AND job_assignments.user_id IS NOT NULL AND job_assignments.user_id != ? THEN jobs.id END) as others,
            COUNT(CASE WHEN jobs.status IN (?, ?) THEN 1 END) as closed,
            COUNT(CASE WHEN jobs.starts_at IS NOT NULL THEN 1 END) as scheduled
          FROM jobs
          LEFT JOIN job_assignments ON job_assignments.job_id = jobs.id
          WHERE jobs.client_id = ?
        SQL
        successfully_completed_status, cancelled_status, @user.id,
        successfully_completed_status, cancelled_status,
        successfully_completed_status, cancelled_status, @user.id,
        successfully_completed_status, cancelled_status,
        @client.id
      ])
    else
      sql = ActiveRecord::Base.sanitize_sql_array([
        <<~SQL,
          SELECT#{' '}
            COUNT(CASE WHEN jobs.status NOT IN (?, ?) AND job_assignments.user_id = ? THEN 1 END) as my_jobs,
            COUNT(CASE WHEN jobs.status NOT IN (?, ?) AND job_assignments.id IS NULL THEN 1 END) as unassigned,
            COUNT(DISTINCT CASE WHEN jobs.status NOT IN (?, ?) AND job_assignments.user_id IS NOT NULL AND job_assignments.user_id != ? THEN jobs.id END) as others,
            COUNT(CASE WHEN jobs.status IN (?, ?) THEN 1 END) as closed,
            COUNT(CASE WHEN jobs.starts_at IS NOT NULL THEN 1 END) as scheduled
          FROM jobs
          LEFT JOIN job_assignments ON job_assignments.job_id = jobs.id
        SQL
        successfully_completed_status, cancelled_status, @user.id,
        successfully_completed_status, cancelled_status,
        successfully_completed_status, cancelled_status, @user.id,
        successfully_completed_status, cancelled_status
      ])
    end

    result = ActiveRecord::Base.connection.exec_query(sql, "SidebarStats").first

    {
      my_jobs: result["my_jobs"],
      unassigned: result["unassigned"],
      others: result["others"],
      closed: result["closed"],
      scheduled: result["scheduled"]
    }
  end


  def cache_key
    client_part = @client ? "client_#{@client.id}" : "all_clients"
    # Simple time-based cache key that expires after the cache timeout
    # This avoids database queries just to build the cache key
    time_part = (Time.current.to_i / 60) # Changes every minute

    "sidebar_stats/user_#{@user.id}/#{client_part}/#{time_part}"
  end
end
