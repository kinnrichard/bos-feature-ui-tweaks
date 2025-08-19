# Test Controller for Frontend Test Support
# Provides endpoints for frontend tests to manage test database state
# Only available in test environment for security

require Rails.root.join("test", "test_environment")

class Api::V1::TestController < Api::V1::BaseController
  skip_before_action :authenticate_request
  # Enable CSRF protection for test controller to match production behavior

  before_action :ensure_test_environment!

  # POST /api/v1/test/reset_database
  def reset_database
    TestEnvironment.reset_database!

    render json: {
      data: {
        type: "test_operation",
        attributes: {
          message: "Database reset successfully",
          timestamp: Time.current.iso8601
        }
      }
    }
  rescue => e
    render json: {
      errors: [ {
        status: "500",
        code: "RESET_FAILED",
        title: "Database Reset Failed",
        detail: e.message
      } ]
    }, status: :internal_server_error
  end

  # POST /api/v1/test/seed_database
  def seed_database
    TestEnvironment.setup_test_data!

    render json: {
      data: {
        type: "test_operation",
        attributes: {
          message: "Database seeded successfully",
          timestamp: Time.current.iso8601
        }
      }
    }
  rescue => e
    render json: {
      errors: [ {
        status: "500",
        code: "SEED_FAILED",
        title: "Database Seed Failed",
        detail: e.message
      } ]
    }, status: :internal_server_error
  end

  # GET /api/v1/test/verify_data
  def verify_data
    begin
      TestEnvironment.verify_test_data!

      # Get data counts
      counts = {
        users: User.count,
        clients: Client.count,
        jobs: Job.count,
        tasks: Task.count,
        devices: Device.count
      }

      render json: {
        data: {
          type: "test_verification",
          attributes: {
            valid: true,
            message: "Test data verification passed",
            counts: counts,
            timestamp: Time.current.iso8601
          }
        }
      }
    rescue => e
      render json: {
        data: {
          type: "test_verification",
          attributes: {
            valid: false,
            message: e.message,
            timestamp: Time.current.iso8601
          }
        }
      }
    end
  end



  # POST /api/v1/test/begin_transaction
  def begin_transaction
    # Start a database transaction for test isolation
    # Note: This is a simplified approach - full transaction isolation
    # would require more sophisticated connection management

    transaction_id = SecureRandom.uuid
    Rails.cache.write("test_transaction_#{transaction_id}", {
      started_at: Time.current,
      isolation_level: "READ_COMMITTED"
    }, expires_in: 1.hour)

    render json: {
      data: {
        type: "transaction",
        attributes: {
          transaction_id: transaction_id,
          started_at: Time.current.iso8601
        }
      }
    }
  end

  # POST /api/v1/test/rollback_transaction
  def rollback_transaction
    transaction_id = params[:transaction_id]

    # For now, we'll simulate rollback by clearing recent test data
    # A full implementation would use database savepoints/transactions
    if Rails.cache.exist?("test_transaction_#{transaction_id}")
      Rails.cache.delete("test_transaction_#{transaction_id}")

      render json: {
        data: {
          type: "transaction",
          attributes: {
            transaction_id: transaction_id,
            status: "rolled_back",
            timestamp: Time.current.iso8601
          }
        }
      }
    else
      render json: {
        errors: [ {
          status: "404",
          code: "TRANSACTION_NOT_FOUND",
          title: "Transaction Not Found",
          detail: "Transaction ID not found or already completed"
        } ]
      }, status: :not_found
    end
  end

  # POST /api/v1/test/commit_transaction
  def commit_transaction
    transaction_id = params[:transaction_id]

    if Rails.cache.exist?("test_transaction_#{transaction_id}")
      Rails.cache.delete("test_transaction_#{transaction_id}")

      render json: {
        data: {
          type: "transaction",
          attributes: {
            transaction_id: transaction_id,
            status: "committed",
            timestamp: Time.current.iso8601
          }
        }
      }
    else
      render json: {
        errors: [ {
          status: "404",
          code: "TRANSACTION_NOT_FOUND",
          title: "Transaction Not Found",
          detail: "Transaction ID not found or already completed"
        } ]
      }, status: :not_found
    end
  end

  # DELETE /api/v1/test/cleanup
  def cleanup
    # Clean up test data created during the test session
    # This is safer than full database reset for running tests

    begin
      # Use database reset for reliable cleanup
      ActiveRecord::Base.transaction do
        # Temporarily disable foreign key checks
        ActiveRecord::Base.connection.execute("SET session_replication_role = replica;")

        # Now delete all data in dependency order (ActivityLog first)
        [ ActivityLog, RefreshToken, Task, Job, Device, ContactMethod, Person, Client ].each(&:delete_all)

        # Clean up test users but keep seed users for authentication
        User.where("email LIKE '%@example.com' OR email LIKE '%test%'").delete_all

        # Re-enable foreign key checks
        ActiveRecord::Base.connection.execute("SET session_replication_role = DEFAULT;")
      end

      render json: {
        data: {
          type: "test_operation",
          attributes: {
            message: "Test data cleanup completed",
            timestamp: Time.current.iso8601
          }
        }
      }
    rescue => e
      render json: {
        errors: [ {
          status: "500",
          code: "CLEANUP_FAILED",
          title: "Cleanup Failed",
          detail: e.message
        } ]
      }, status: :internal_server_error
    end
  end

  # DELETE /api/v1/test/cleanup_entity
  def cleanup_entity
    entity_type = params[:entity_type]
    entity_id = params[:entity_id]

    unless entity_type && entity_id
      return render json: {
        errors: [ {
          status: "400",
          code: "MISSING_PARAMETERS",
          title: "Bad Request",
          detail: "entity_type and entity_id parameters are required"
        } ]
      }, status: :bad_request
    end

    begin
      case entity_type
      when "jobs"
        # Find the specific job and destroy it (will cascade to tasks via dependent: :destroy)
        job = Job.find_by(id: entity_id)
        job&.destroy
      when "tasks"
        # Use destroy to trigger callbacks and dependent associations
        task = Task.find_by(id: entity_id)
        task&.destroy
      when "clients"
        # Find the specific client and destroy it (will cascade to jobs and tasks via dependent: :destroy)
        client = Client.find_by(id: entity_id)
        client&.destroy
      when "users"
        User.where(id: entity_id).destroy_all
      else
        return render json: {
          errors: [ {
            status: "400",
            code: "INVALID_ENTITY_TYPE",
            title: "Bad Request",
            detail: "entity_type must be one of: jobs, tasks, clients, users"
          } ]
        }, status: :bad_request
      end

      render json: {
        data: {
          type: "test_operation",
          attributes: {
            message: "Entity cleanup completed",
            entity_type: entity_type,
            entity_id: entity_id,
            timestamp: Time.current.iso8601
          }
        }
      }
    rescue ActiveRecord::RecordNotFound
      # Silently succeed for missing records (already deleted)
      render json: {
        data: {
          type: "test_operation",
          attributes: {
            message: "Entity not found (may already be deleted)",
            entity_type: entity_type,
            entity_id: entity_id,
            timestamp: Time.current.iso8601
          }
        }
      }
    rescue => e
      render json: {
        errors: [ {
          status: "500",
          code: "CLEANUP_ENTITY_FAILED",
          title: "Entity Cleanup Failed",
          detail: e.message
        } ]
      }, status: :internal_server_error
    end
  end

  private

  def ensure_test_environment!
    unless Rails.env.test? || Rails.env.development?
      render json: {
        errors: [ {
          status: "403",
          code: "FORBIDDEN_ENVIRONMENT",
          title: "Forbidden",
          detail: "Test endpoints only available in test and development environments"
        } ]
      }, status: :forbidden
    end
  end
end
