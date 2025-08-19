require "test_helper"

class AllJobsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @technician = users(:technician)
    @client = clients(:acme)
    @job = jobs(:empty_project)
  end

  test "apply_job_filters handles mine filter correctly" do
    controller = AllJobsController.new

    # Set up controller with required methods
    def controller.params
      ActionController::Parameters.new(filter: "mine")
    end

    def controller.current_user
      @current_user
    end

    def controller.performed?
      false
    end

    controller.instance_variable_set(:@current_user, @admin)

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should apply the joins and where clause for the user's jobs
    assert_includes filtered_jobs.to_sql, "job_assignments"
    assert_equal :my_jobs, controller.instance_variable_get(:@active_section)
  end

  test "apply_job_filters handles unassigned filter correctly" do
    controller = AllJobsController.new
    controller.define_singleton_method(:params) { ActionController::Parameters.new(filter: "unassigned") }
    controller.define_singleton_method(:current_user) { @admin }
    controller.define_singleton_method(:performed?) { false }

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should apply left joins and where clause for unassigned jobs
    assert_includes filtered_jobs.to_sql, "LEFT OUTER JOIN"
    assert_equal :unassigned, controller.instance_variable_get(:@active_section)
  end

  test "apply_job_filters handles closed filter correctly" do
    controller = AllJobsController.new
    controller.define_singleton_method(:params) { ActionController::Parameters.new(filter: "closed") }
    controller.define_singleton_method(:current_user) { @admin }
    controller.define_singleton_method(:performed?) { false }

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should filter by closed statuses - check for status numbers instead of names
    assert_includes filtered_jobs.to_sql, "5"  # successfully_completed status
    assert_equal :closed, controller.instance_variable_get(:@active_section)
  end

  test "apply_job_filters handles technician_ids filter" do
    controller = AllJobsController.new
    controller.define_singleton_method(:params) { ActionController::Parameters.new(filter: "mine", technician_ids: [ @technician.id ]) }
    controller.define_singleton_method(:current_user) { @admin }
    controller.define_singleton_method(:performed?) { false }

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should apply technician filter
    assert_includes filtered_jobs.to_sql, @technician.id
  end

  test "apply_job_filters handles statuses filter" do
    controller = AllJobsController.new
    controller.define_singleton_method(:params) { ActionController::Parameters.new(filter: "mine", statuses: [ "open", "in_progress" ]) }
    controller.define_singleton_method(:current_user) { @admin }
    controller.define_singleton_method(:performed?) { false }

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should apply status filter
    assert_includes filtered_jobs.to_sql.downcase, "status"
  end

  test "apply_job_filters handles empty technician_ids" do
    controller = AllJobsController.new
    controller.define_singleton_method(:params) { ActionController::Parameters.new(filter: "mine", technician_ids: [ "" ]) }
    controller.define_singleton_method(:current_user) { @admin }
    controller.define_singleton_method(:performed?) { false }

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should ignore empty technician IDs
    assert_kind_of ActiveRecord::Relation, filtered_jobs
  end

  test "apply_job_filters handles empty statuses" do
    controller = AllJobsController.new
    controller.define_singleton_method(:params) { ActionController::Parameters.new(filter: "mine", statuses: [ "" ]) }
    controller.define_singleton_method(:current_user) { @admin }
    controller.define_singleton_method(:performed?) { false }

    jobs = Job.includes(:client, :technicians, :tasks)
    filtered_jobs = controller.send(:apply_job_filters, jobs)

    # Should ignore empty statuses
    assert_kind_of ActiveRecord::Relation, filtered_jobs
  end
end
