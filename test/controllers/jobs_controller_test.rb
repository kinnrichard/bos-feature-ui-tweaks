require "test_helper"

class JobsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @client = clients(:acme)
    @job = jobs(:empty_project)  # Use the correct fixture name
    @owner = users(:owner)
    @admin = users(:admin)
    @technician = users(:technician)
  end

  # Authentication tests
  test "requires authentication for all actions" do
    # Index
    get client_jobs_path(@client)
    assert_redirected_to login_path

    # Show
    get client_job_path(@client, @job)
    assert_redirected_to login_path

    # New
    get new_client_job_path(@client)
    assert_redirected_to login_path

    # Create
    post client_jobs_path(@client), params: { job: { title: "Test" } }
    assert_redirected_to login_path

    # Edit
    get edit_client_job_path(@client, @job)
    assert_redirected_to login_path

    # Update
    patch client_job_path(@client, @job), params: { job: { title: "Updated" } }
    assert_redirected_to login_path

    # Destroy
    delete client_job_path(@client, @job)
    assert_redirected_to login_path
  end

  # Index authorization
  test "all authenticated users can view job index" do
    [ @owner, @admin, @technician ].each do |user|
      sign_in_as user
      get client_jobs_path(@client)
      assert_response :success
    end
  end

  # Show authorization
  test "all authenticated users can view job details" do
    [ @owner, @admin, @technician ].each do |user|
      sign_in_as user
      get client_job_path(@client, @job)
      assert_response :success
    end
  end

  # Create authorization
  test "all authenticated users can create jobs" do
    [ @owner, @admin, @technician ].each do |user|
      sign_in_as user

      assert_difference "Job.count", 1 do
        post client_jobs_path(@client), params: {
          job: {
            title: "New Job by #{user.role}",
            status: "open",
            priority: "normal"
          }
        }
      end

      assert_redirected_to client_job_path(@client, Job.last)
      assert_equal "Job was successfully created.", flash[:notice]
    end
  end

  # Update authorization
  test "all authenticated users can update jobs" do
    [ @owner, @admin, @technician ].each do |user|
      sign_in_as user

      patch client_job_path(@client, @job), params: {
        job: { title: "Updated by #{user.role}" }
      }

      assert_redirected_to client_job_path(@client, @job)
      assert_equal "Job was successfully updated.", flash[:notice]
      assert_equal "Updated by #{user.role}", @job.reload.title
    end
  end

  # Delete authorization - owners can delete any job
  test "owners can delete any job" do
    @job.update!(status: "cancelled") # Job must be cancelled first

    sign_in_as @owner

    assert_difference "Job.count", -1 do
      delete client_job_path(@client, @job)
    end

    assert_redirected_to client_jobs_path(@client)
    assert_equal "Job was successfully deleted.", flash[:notice]
  end

  # Delete authorization - admins can delete any job
  test "admins can delete any job" do
    @job.update!(status: "cancelled")

    sign_in_as @admin

    assert_difference "Job.count", -1 do
      delete client_job_path(@client, @job)
    end

    assert_redirected_to client_jobs_path(@client)
  end

  # Delete authorization - technicians can only delete their own recent jobs
  test "technicians can delete their own recently created jobs" do
    sign_in_as @technician

    # Create a job as technician
    tech_job = @client.jobs.create!(
      title: "Tech's Job",
      status: "cancelled",
      created_at: 2.minutes.ago
    )

    assert_difference "Job.count", -1 do
      delete client_job_path(@client, tech_job)
    end

    assert_redirected_to client_jobs_path(@client)
  end

  test "technicians cannot delete old jobs they created" do
    sign_in_as @technician

    # Create an old job
    old_job = @client.jobs.create!(
      title: "Old Tech Job",
      status: "cancelled",
      created_at: 10.minutes.ago
    )

    assert_no_difference "Job.count" do
      delete client_job_path(@client, old_job)
    end

    assert_redirected_to client_jobs_path(@client)
    assert_equal "You do not have permission to delete this job.", flash[:alert]
  end

  test "technicians cannot delete other users' jobs" do
    @job.update!(status: "cancelled")
    sign_in_as @technician

    assert_no_difference "Job.count" do
      delete client_job_path(@client, @job)
    end

    assert_redirected_to client_jobs_path(@client)
    assert_equal "You do not have permission to delete this job.", flash[:alert]
  end

  # Status constraints
  test "cannot delete job that is not cancelled" do
    sign_in_as @owner

    assert_no_difference "Job.count" do
      delete client_job_path(@client, @job)
    end

    assert_redirected_to client_job_path(@client, @job)
    assert_equal "Jobs must be cancelled before they can be deleted.", flash[:alert]
  end

  # Activity logging
  test "creates activity log on job creation" do
    sign_in_as @admin

    assert_difference "ActivityLog.count", 1 do
      post client_jobs_path(@client), params: {
        job: { title: "Test Job", status: "open", priority: "normal" }
      }
    end

    log = ActivityLog.last
    assert_equal "created", log.action
    assert_equal "Job", log.loggable_type
    assert_equal @admin, log.user
    assert_equal @client, log.client
  end

  test "creates activity log on job update" do
    sign_in_as @admin

    assert_difference "ActivityLog.count", 1 do
      patch client_job_path(@client, @job), params: {
        job: { title: "Updated Title" }
      }
    end

    log = ActivityLog.last
    assert_includes [ "updated", "renamed" ], log.action
    assert_equal @job, log.loggable
    assert_equal @admin, log.user
  end

  test "creates activity log on job deletion" do
    @job.update!(status: "cancelled")
    sign_in_as @owner

    job_title = @job.title

    assert_difference "ActivityLog.count", 1 do
      delete client_job_path(@client, @job)
    end

    log = ActivityLog.last
    assert_equal "deleted", log.action
    assert_equal "Job", log.loggable_type
    assert_equal @job.id, log.loggable_id
    assert_equal job_title, log.metadata["job_title"]
    assert_equal @client.name, log.metadata["client_name"]
  end

  # Parameter filtering
  test "filters unpermitted parameters" do
    sign_in_as @admin

    patch client_job_path(@client, @job), params: {
      job: {
        title: "Updated",
        client_id: clients(:techstartup).id # Should be filtered
      }
    }

    @job.reload
    assert_equal "Updated", @job.title
    assert_equal @client, @job.client
  end

  # Job assignment tests
  test "can assign technicians to job" do
    sign_in_as @admin

    patch client_job_path(@client, @job), params: {
      job: {
        technician_ids: [ @admin.id, @technician.id ]
      }
    }

    assert_redirected_to client_job_path(@client, @job)
    assert_includes @job.reload.technician_ids, @admin.id
    assert_includes @job.technician_ids, @technician.id
  end

  test "clearing technicians removes all assignments" do
    sign_in_as @admin

    # First assign some technicians
    @job.job_assignments.create!(user: @admin)
    @job.job_assignments.create!(user: @technician)

    # Clear assignments
    patch client_job_path(@client, @job), params: {
      job: {
        technician_ids: [ "" ]
      }
    }

    assert_redirected_to client_job_path(@client, @job)
    assert_empty @job.reload.technicians
  end

  # Edge cases
  test "handles non-existent client gracefully" do
    sign_in_as @admin

    get client_jobs_path(999999)
    assert_response :not_found
  end

  test "handles non-existent job gracefully" do
    sign_in_as @admin

    get client_job_path(@client, 999999)
    assert_response :not_found
  end

  # Search and filtering
  test "filters jobs by search query" do
    sign_in_as @admin

    # Create jobs with specific titles
    @client.jobs.create!(title: "Server Maintenance")
    @client.jobs.create!(title: "Network Setup")

    get client_jobs_path(@client), params: { q: "Server" }

    assert_response :success
    assert_select "h3", text: /Server Maintenance/
    assert_select "h3", text: /Network Setup/, count: 0
  end

  test "filters jobs by status" do
    sign_in_as @admin

    # Create jobs with different statuses
    completed_job = @client.jobs.create!(
      title: "Completed Job",
      status: "successfully_completed"
    )

    get client_jobs_path(@client), params: { status: "open" }

    assert_response :success
    assert_select "h3", text: @job.title
    assert_select "h3", text: completed_job.title, count: 0
  end
end
